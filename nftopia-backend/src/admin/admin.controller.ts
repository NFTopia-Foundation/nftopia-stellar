import { Controller, Put, Param, UseGuards, Req } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { RequestUser } from '../common/audit/audit.decorator';
import type { Request } from 'express';

interface AuthUser {
  userId: string;
  username?: string;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Put('users/:id/ban')
  @Roles(UserRole.ADMIN)
  async banUser(@Param('id') id: string, @RequestUser() user: AuthUser, @Req() req: Request) {
    return this.adminService.banUser(user.userId, id, req.ip, req.get('user-agent'));
  }

  @Put('users/:id/unban')
  @Roles(UserRole.ADMIN)
  async unbanUser(@Param('id') id: string, @RequestUser() user: AuthUser, @Req() req: Request) {
    return this.adminService.unbanUser(user.userId, id, req.ip, req.get('user-agent'));
  }

  @Put('collections/:id/hide')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async hideCollection(@Param('id') id: string, @RequestUser() user: AuthUser, @Req() req: Request) {
    return this.adminService.hideCollection(user.userId, id, req.ip, req.get('user-agent'));
  }

  @Put('collections/:id/verify')
  @Roles(UserRole.ADMIN)
  async verifyCollection(@Param('id') id: string, @RequestUser() user: AuthUser, @Req() req: Request) {
    return this.adminService.verifyCollection(user.userId, id, req.ip, req.get('user-agent'));
  }
}