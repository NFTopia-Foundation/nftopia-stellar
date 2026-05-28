import DataLoader from 'dataloader';
import type { OrderInterface } from '../../modules/order/interfaces/order.interface';
import { OrderService } from '../../modules/order/order.service';

export function createOrderLoader(
  orderService: OrderService,
): DataLoader<string, OrderInterface[]> {
  return new DataLoader<string, OrderInterface[]>(async (nftIds) => {
    const orders = await orderService.findByNFTIds([...nftIds]);
    const ordersByNftId = new Map<string, OrderInterface[]>();

    for (const order of orders) {
      const current = ordersByNftId.get(order.nftId) ?? [];
      current.push(order);
      ordersByNftId.set(order.nftId, current);
    }

    return nftIds.map((nftId) => ordersByNftId.get(nftId) ?? []);
  });
}
