import DataLoader from 'dataloader';
import { In, type DataSource } from 'typeorm';
import { Order } from '../../modules/order/entities/order.entity';

export function createOrderByNftLoader(dataSource: DataSource) {
  return new DataLoader<string, Order[]>(async (nftIds) => {
    const orders = await dataSource.getRepository(Order).find({
      where: { nftId: In([...nftIds]) },
      order: { createdAt: 'DESC' },
    });
    const map = new Map<string, Order[]>();
    for (const order of orders) {
      const arr = map.get(order.nftId) ?? [];
      arr.push(order);
      map.set(order.nftId, arr);
    }
    return nftIds.map((id) => map.get(id) ?? []);
  });
}
