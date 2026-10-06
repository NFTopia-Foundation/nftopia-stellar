import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { ContentFlagService } from '../modules/ai-agent/content-flag.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../common/enums/user-role.enum';
import { RequestUser } from '../common/audit/audit.decorator';
import { ListContentFlagsQueryDto } from './dto/list-content-flags-query.dto';
import { ResolveContentFlagDto } from './dto/resolve-content-flag.dto';

interface AuthUser {
  userId: string;
  username?: string;
}

/**
 * Admin surface for content_flags rows the moderation agent's flag_content
 * tool writes. Guarded the same way as AdminController's other endpoints —
 * moderators can review, only admins/moderators can act on flags.
 */
@Controller('admin/ai/flags')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminAiFlagsController {
  constructor(private readonly contentFlagService: ContentFlagService) {}

  @Get()
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async list(@Query() query: ListContentFlagsQueryDto) {
    return this.contentFlagService.listFlags({
      status: query.status ?? 'pending',
      limit: query.limit,
      offset: query.offset,
    });
  }

  @Patch(':id')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  async resolve(
    @Param('id') id: string,
    @Body() body: ResolveContentFlagDto,
    @RequestUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.contentFlagService.resolveFlag(id, {
      status: body.status,
      reviewedBy: user.userId,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      ...(body.reason !== undefined ? { reason: body.reason } : {}),
    });
  }
}
