import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Patch,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  async create(@Body() createOrderDto: CreateOrderDto) {
    return this.orderService.create(createOrderDto);
  }

  @Get()
  async findAll(@Query() query: OrderQueryDto) {
    return this.orderService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.orderService.findOne(id);
  }

  @Patch(':id/status')
  async updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.orderService.updateStatus(id, status);
  }

  @Post(':id/execute')
  async executeBundle(
    @Param('id') id: string,
    @Body('buyerId') buyerId: string,
    @Body('amount') amount?: string,
  ) {
    return this.orderService.executeBundle(id, buyerId, amount);
  }

  @Post(':id/cancel')
  async cancelBundle(
    @Param('id') id: string,
    @Body('sellerId') sellerId: string,
  ) {
    return this.orderService.cancelBundle(id, sellerId);
  }

  @Get(':id/stats')
  async getStats(@Param('id') nftId: string) {
    return this.orderService.getStats(nftId);
  }
}
