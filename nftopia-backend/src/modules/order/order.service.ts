// ...existing code...
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { CreateOrderDto, OrderStatus, OrderType } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { OrderPaginatedResponseDto } from './dto/order-paginated-response.dto';
import { OrderInterface, OrderStats } from './interfaces/order.interface';
import { ConfigService } from '@nestjs/config';
import { MarketplaceSettlementClient } from '../stellar/marketplace-settlement.client';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly configService: ConfigService,
    private readonly settlementClient: MarketplaceSettlementClient,
  ) {}

  async create(
    createOrderDto: CreateOrderDto,
  ): Promise<OrderInterface | { success: boolean; contractId: number }> {
    const enableOnchain = this.configService.get<boolean>(
      'ENABLE_ONCHAIN_SETTLEMENT',
    );
    if (enableOnchain) {
      // On-chain: call contract for bundle or trade
      // If you add a bundle contract, update this check
      if (createOrderDto.type === OrderType.PURCHASE) {
        if (!createOrderDto.items || createOrderDto.items.length < 2) {
          throw new BadRequestException(
            'Bundle orders must contain at least 2 items',
          );
        }
        if (
          !createOrderDto.totalPrice ||
          parseFloat(createOrderDto.totalPrice) <= 0
        ) {
          throw new BadRequestException(
            'Bundle orders require a valid totalPrice > 0',
          );
        }
        if (
          !createOrderDto.durationSeconds ||
          createOrderDto.durationSeconds < 1 ||
          createOrderDto.durationSeconds > 2592000
        ) {
          throw new BadRequestException(
            'Bundle duration must be between 1 second and 30 days',
          );
        }

        this.logger.log(
          `Creating on-chain bundle order for seller ${createOrderDto.sellerId} with ${createOrderDto.items.length} items`,
        );

        const contractId = await this.settlementClient.createBundle({
          seller: createOrderDto.sellerId,
          items: createOrderDto.items.map((i) => ({
            nftContract: i.nftContractAddress,
            tokenId: i.tokenId,
          })),
          totalPrice: createOrderDto.totalPrice,
          currency: createOrderDto.currency ?? 'XLM',
          durationSeconds: createOrderDto.durationSeconds,
        });

        const order = this.orderRepository.create({
          ...createOrderDto,
          transactionHash: contractId.toString(),
          status: OrderStatus.PENDING,
        });
        await this.orderRepository.save(order);

        this.logger.log(`Bundle order created on-chain with ID ${contractId}`);
        return { success: true, contractId };
      } else if (createOrderDto.type === OrderType.SALE) {
        // Map to createTrade contract call
        const params = {
          initiator: createOrderDto.buyerId,
          offeredNftContract: createOrderDto.nftContractId ?? '',
          offeredTokenId: createOrderDto.nftTokenId ?? '',
          requestedNftContract: createOrderDto.requestedNftContract ?? '',
          requestedTokenId: createOrderDto.requestedNftTokenId ?? '',
          expiresAt: createOrderDto.expiresAt ?? '',
        };
        const contractId = await this.settlementClient.createTrade(params);
        return { success: true, contractId };
      }
    }
    // Legacy DB logic
    const order = this.orderRepository.create(createOrderDto);
    const saved = await this.orderRepository.save(order);
    return this.toOrderInterface(saved);
  }

  async executeBundle(
    id: string,
    buyer: string,
    amount?: string,
  ): Promise<{ success: boolean }> {
    try {
      this.logger.log(`Executing bundle ${id} for buyer ${buyer}`);
      await this.settlementClient.executeBundle(Number(id), buyer, amount);
      this.logger.log(`Bundle ${id} executed successfully`);
      return { success: true };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to execute bundle ${id}: ${errMsg}`);
      if (errMsg.includes('timeout'))
        throw new BadRequestException('Bundle execution timed out');
      if (errMsg.includes('insufficient funds') || errMsg.includes('balance'))
        throw new BadRequestException('Insufficient funds to execute bundle');
      if (errMsg.includes('expired'))
        throw new BadRequestException('Bundle has expired');
      if (errMsg.includes('sold'))
        throw new BadRequestException(
          'One or more items in the bundle are already sold',
        );
      throw new BadRequestException(`Failed to execute bundle: ${errMsg}`);
    }
  }

  async cancelBundle(
    id: string,
    seller: string,
  ): Promise<{ success: boolean }> {
    try {
      this.logger.log(`Cancelling bundle ${id} for seller ${seller}`);
      await this.settlementClient.cancelBundle(Number(id), seller);
      this.logger.log(`Bundle ${id} cancelled successfully`);
      return { success: true };
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to cancel bundle ${id}: ${errMsg}`);
      if (errMsg.includes('timeout'))
        throw new BadRequestException('Bundle cancellation timed out');
      throw new BadRequestException(`Failed to cancel bundle: ${errMsg}`);
    }
  }

  async findAll(query: OrderQueryDto): Promise<OrderInterface[]> {
    const qb = this.orderRepository.createQueryBuilder('order');
    if (query.nftId)
      qb.andWhere('order.nftId = :nftId', { nftId: query.nftId });
    if (query.buyerId)
      qb.andWhere('order.buyerId = :buyerId', { buyerId: query.buyerId });
    if (query.sellerId)
      qb.andWhere('order.sellerId = :sellerId', { sellerId: query.sellerId });
    if (query.type) qb.andWhere('order.type = :type', { type: query.type });
    if (query.status)
      qb.andWhere('order.status = :status', { status: query.status });
    if (query.fromDate)
      qb.andWhere('order.createdAt >= :fromDate', { fromDate: query.fromDate });
    if (query.toDate)
      qb.andWhere('order.createdAt <= :toDate', { toDate: query.toDate });
    if (query.sortBy)
      qb.orderBy(
        `order.${query.sortBy}`,
        query.sortOrder === 'DESC' ? 'DESC' : 'ASC',
      );
    if (query.page && query.limit) {
      qb.skip((query.page - 1) * query.limit).take(query.limit);
    }
    const orders = await qb.getMany();
    return orders.map(this.toOrderInterface);
  }

  /**
   * Find all orders with pagination and total count.
   * Validates pagination inputs and applies sensible defaults.
   *
   * @param query - OrderQueryDto with optional pagination (page, limit)
   * @returns OrderPaginatedResponseDto with items, totalCount, page, limit, and hasNextPage
   */
  async findAllWithCount(
    query: OrderQueryDto,
  ): Promise<OrderPaginatedResponseDto> {
    // Validate and set defaults for pagination
    let page = query.page || 1;
    let limit = query.limit || 20;

    // Ensure page >= 1
    if (page < 1) {
      page = 1;
    }

    // Enforce sane limits (min: 1, max: 100)
    if (limit < 1) {
      limit = 20;
    } else if (limit > 100) {
      limit = 100;
    }

    const qb = this.orderRepository.createQueryBuilder('order');

    // Apply filters
    if (query.nftId)
      qb.andWhere('order.nftId = :nftId', { nftId: query.nftId });
    if (query.buyerId)
      qb.andWhere('order.buyerId = :buyerId', { buyerId: query.buyerId });
    if (query.sellerId)
      qb.andWhere('order.sellerId = :sellerId', { sellerId: query.sellerId });
    if (query.type) qb.andWhere('order.type = :type', { type: query.type });
    if (query.status)
      qb.andWhere('order.status = :status', { status: query.status });
    if (query.fromDate)
      qb.andWhere('order.createdAt >= :fromDate', { fromDate: query.fromDate });
    if (query.toDate)
      qb.andWhere('order.createdAt <= :toDate', { toDate: query.toDate });

    // Apply sorting (default by createdAt DESC)
    if (query.sortBy) {
      qb.orderBy(
        `order.${query.sortBy}`,
        query.sortOrder === 'DESC' ? 'DESC' : 'ASC',
      );
    } else {
      qb.orderBy('order.createdAt', 'DESC');
    }

    // Apply pagination
    qb.skip((page - 1) * limit).take(limit);

    // Get both data and count using getManyAndCount
    const [orders, totalCount] = await qb.getManyAndCount();

    // Calculate hasNextPage
    const hasNextPage = page * limit < totalCount;

    return {
      items: orders.map(this.toOrderInterface),
      totalCount,
      page,
      limit,
      hasNextPage,
    };
  }

  async findOne(id: string): Promise<OrderInterface> {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    return this.toOrderInterface(order);
  }

  async findByNFTIds(nftIds: string[]): Promise<OrderInterface[]> {
    const uniqueNftIds = [...new Set(nftIds.filter(Boolean))];
    if (!uniqueNftIds.length) {
      return [];
    }

    const orders = await this.orderRepository.find({
      where: { nftId: In(uniqueNftIds) },
      order: { createdAt: 'DESC' },
    });

    return orders.map(this.toOrderInterface);
  }

  async updateStatus(id: string, status: string): Promise<OrderInterface> {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
      throw new BadRequestException('Invalid status');
    }
    order.status = status;
    const saved = await this.orderRepository.save(order);
    return this.toOrderInterface(saved);
  }
  private toOrderInterface = (order: Order): OrderInterface => ({
    ...order,
    type: order.type as OrderType,
    status: order.status as OrderStatus,
  });

  async getStats(nftId: string): Promise<OrderStats> {
    const qb = this.orderRepository
      .createQueryBuilder('order')
      .select('SUM(order.price)', 'volume')
      .addSelect('COUNT(order.id)', 'count')
      .addSelect('AVG(order.price)', 'averagePrice')
      .where('order.nftId = :nftId', { nftId });
    const stats = ((await qb.getRawOne()) as {
      volume: string | null;
      count: string | null;
      averagePrice: string | null;
    }) || { volume: '0', count: '0', averagePrice: '0' };
    return {
      volume: stats.volume ?? '0',
      count: Number(stats.count ?? 0),
      averagePrice: stats.averagePrice ?? '0',
    };
  }

  async getSalesAnalytics(
    periodStart: Date,
    periodEnd: Date,
  ): Promise<{
    volume: string;
    count: number;
    averagePrice: string;
  }> {
    const qb = this.orderRepository
      .createQueryBuilder('order')
      .select('SUM(order.price)', 'volume')
      .addSelect('COUNT(order.id)', 'count')
      .addSelect('AVG(order.price)', 'averagePrice')
      .where('order.type = :type', { type: OrderType.SALE })
      .andWhere('order.status = :status', { status: OrderStatus.COMPLETED })
      .andWhere('order.createdAt BETWEEN :periodStart AND :periodEnd', {
        periodStart,
        periodEnd,
      });

    const stats = ((await qb.getRawOne()) as {
      volume: string | null;
      count: string | null;
      averagePrice: string | null;
    }) || { volume: '0', count: '0', averagePrice: '0' };

    return {
      volume: stats.volume ?? '0',
      count: Number(stats.count ?? 0),
      averagePrice: stats.averagePrice ?? '0',
    };
  }
}
