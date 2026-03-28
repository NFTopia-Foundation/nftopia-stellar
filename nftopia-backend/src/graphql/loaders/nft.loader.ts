import DataLoader from 'dataloader';
import { In, type DataSource } from 'typeorm';
import { Nft } from '../../modules/nft/entities/nft.entity';

export function createNftLoader(dataSource: DataSource) {
  return new DataLoader<string, Nft | null>(async (ids) => {
    const nfts = await dataSource.getRepository(Nft).find({
      where: { id: In([...ids]) },
      relations: ['attributes'],
    });
    const map = new Map(nfts.map((n) => [n.id, n]));
    return ids.map((id) => map.get(id) ?? null);
  });
}
