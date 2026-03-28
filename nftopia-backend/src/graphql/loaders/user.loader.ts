import DataLoader from 'dataloader';
import { In, type DataSource } from 'typeorm';
import { User } from '../../users/user.entity';

export function createUserLoader(dataSource: DataSource) {
  return new DataLoader<string, User | null>(async (ids) => {
    const users = await dataSource.getRepository(User).find({
      where: { id: In([...ids]) },
    });
    const map = new Map(users.map((u) => [u.id, u]));
    return ids.map((id) => map.get(id) ?? null);
  });
}
