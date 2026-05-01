import DataLoader from 'dataloader';
import type { User } from '../../users/user.entity';
import { UsersService } from '../../users/users.service';

export function createUserLoader(
  usersService: UsersService,
): DataLoader<string, User | null> {
  return new DataLoader<string, User | null>(async (ids) => {
    const users = await usersService.findByIds([...ids]);
    const userById = new Map(users.map((user) => [user.id, user]));

    return ids.map((id) => userById.get(id) ?? null);
  });
}
