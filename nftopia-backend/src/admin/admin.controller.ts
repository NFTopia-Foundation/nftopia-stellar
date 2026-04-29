import { Controller, Put, Param, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Put('users/:id/ban')
  @Roles(UserRole.ADMIN)
  async banUser(@Param('id') id: string) {
    return this.adminService.banUser(id);
  }

  @Put('users/:id/unban')
  @Roles(UserRole.ADMIN)
  async unbanUser(@Param('id') id: string) {
    return this.adminService.unbanUser(id);
  }

  @Put('collections/:id/hide')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async hideCollection(@Param('id') id: string) {
    return this.adminService.hideCollection(id);
  }

  @Put('collections/:id/verify')
  @Roles(UserRole.ADMIN)
  async verifyCollection(@Param('id') id: string) {
    return this.adminService.verifyCollection(id);
  }
}
