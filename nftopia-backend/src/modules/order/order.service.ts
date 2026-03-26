import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Order } from './entities/order.entity';
import { CreateOrderDto, OrderStatus, OrderType } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import { OrderInterface, OrderStats } from './interfaces/order.interface';

@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async create(createOrderDto: CreateOrderDto): Promise<OrderInterface> {
    const order = this.orderRepository.create(createOrderDto);
    const saved = await this.orderRepository.save(order);
    return this.toOrderInterface(saved);
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

  async findOne(id: string): Promise<OrderInterface> {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    return this.toOrderInterface(order);
  }

  async updateStatus(id: string, status: string): Promise<OrderInterface> {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) throw new NotFoundException('Order not found');
    if (!Object.values(OrderStatus).includes(status as OrderStatus)) {
      throw new BadRequestException('Invalid status');
    }
    order.status = status as OrderStatus;
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
}
