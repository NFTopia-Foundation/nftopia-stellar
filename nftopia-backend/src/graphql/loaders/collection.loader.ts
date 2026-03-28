import DataLoader from 'dataloader';
import { In, type DataSource } from 'typeorm';
import { Collection } from '../../modules/collection/entities/collection.entity';

export function createCollectionLoader(dataSource: DataSource) {
  return new DataLoader<string, Collection | null>(async (ids) => {
    const collections = await dataSource.getRepository(Collection).find({
      where: { id: In([...ids]) },
    });
    const map = new Map(collections.map((c) => [c.id, c]));
    return ids.map((id) => map.get(id) ?? null);
  });
}
