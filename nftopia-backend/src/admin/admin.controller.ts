import {
  Controller,
  Put,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { RequestUser } from '../common/audit/audit.decorator';
import type { Request } from 'express';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { BanUserDto } from './dto/ban-user.dto';
import { AuditLogsQueryDto } from './dto/audit-logs-query.dto';

interface AuthUser {
  userId: string;
  username?: string;
}

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async listUsers(@Query() query: ListUsersQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Get('audit-logs')
  @Roles(UserRole.ADMIN)
  async listAuditLogs(@Query() query: AuditLogsQueryDto) {
    return this.adminService.listAuditLogs(query);
  }

  @Get('users/:id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async getUserDetails(@Param('id') id: string) {
    return this.adminService.getUserDetails(id);
  }

  @Put('users/:id/ban')
  @Roles(UserRole.ADMIN)
  async banUser(
    @Param('id') id: string,
    @Body() body: BanUserDto,
    @RequestUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.adminService.banUser(
      user.userId,
      id,
      body?.reason,
      req.ip,
      req.get('user-agent'),
    );
  }

  @Put('users/:id/unban')
  @Roles(UserRole.ADMIN)
  async unbanUser(
    @Param('id') id: string,
    @RequestUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.adminService.unbanUser(
      user.userId,
      id,
      req.ip,
      req.get('user-agent'),
    );
  }

  @Put('collections/:id/hide')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async hideCollection(
    @Param('id') id: string,
    @RequestUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.adminService.hideCollection(
      user.userId,
      id,
      req.ip,
      req.get('user-agent'),
    );
  }

  @Put('collections/:id/verify')
  @Roles(UserRole.ADMIN)
  async verifyCollection(
    @Param('id') id: string,
    @RequestUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.adminService.verifyCollection(
      user.userId,
      id,
      req.ip,
      req.get('user-agent'),
    );
  }
}
