import DataLoader from 'dataloader';
import type { Collection } from '../../modules/collection/entities/collection.entity';
import { CollectionService } from '../../modules/collection/collection.service';

export function createCollectionLoader(
  collectionService: CollectionService,
): DataLoader<string, Collection | null> {
  return new DataLoader<string, Collection | null>(async (ids) => {
    const collections = await collectionService.findByIds([...ids]);
    const collectionById = new Map(
      collections.map((collection) => [collection.id, collection]),
    );

    return ids.map((id) => collectionById.get(id) ?? null);
  });
}
