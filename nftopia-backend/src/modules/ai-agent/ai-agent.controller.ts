import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  RequestMethod,
  Sse,
  UnauthorizedException,
  UseGuards,
  Query,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { METHOD_METADATA } from '@nestjs/common/constants';
import type { Observable } from 'rxjs';
import type { Request } from 'express';
import { ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { AiChatRateLimitGuard } from '../../common/guards/ai-chat-rate-limit.guard';
import { CopilotRateLimitGuard } from '../../common/guards/copilot-rate-limit.guard';
import { AiAgentService } from './ai-agent.service';
import { AiUsageService, type UsageSummary } from './ai-usage.service';
import {
  AiAgentHealthService,
  type AnthropicHealthStatus,
} from './ai-agent-health.service';
import { ChatRequestDto } from './dto/chat-request.dto';
import { SetCapOverrideDto } from './dto/set-cap-override.dto';
import { DraftListingRequestDto } from './dto/draft-listing-request.dto';
import type { DraftListingResult } from './tools/creator-copilot.tools';
import type { ToolSetName } from './tools/tool-set.types';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { UserRole } from '../../common/enums/user-role.enum';

type RequestWithUser = Request & {
  user?: { userId: string; role?: string };
};

/**
 * The only tool set this controller is allowed to use — see
 * src/modules/ai-agent/tools/README.md for the full endpoint mapping.
 * Both chat and chatStream request this set explicitly; neither takes it
 * from the caller, so a request body can't widen what tools run.
 */
const TOOL_SET: ToolSetName = 'marketplace-assistant';

@Controller('ai')
export class AiAgentController {
  constructor(
    private readonly aiAgentService: AiAgentService,
    private readonly aiUsageService: AiUsageService,
    private readonly aiAgentHealthService: AiAgentHealthService,
  ) {}

  // Unauthenticated on purpose: an ops/uptime probe for /ai/health can't
  // carry a user JWT. Every other route below still requires one — see
  // JwtAuthGuard on each — this is why the guard moved off the class.
  @Get('health')
  @ApiOperation({ summary: 'Check whether the Anthropic API is reachable' })
  @ApiResponse({
    status: 200,
    description:
      'Anthropic reachability status. Always 200 — the status field, not ' +
      'the HTTP code, carries up/down/unconfigured.',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'up' },
        timestamp: { type: 'string', example: '2024-01-22T12:00:00.000Z' },
      },
    },
  })
  async getHealth(): Promise<{
    status: AnthropicHealthStatus;
    timestamp: string;
  }> {
    return this.aiAgentHealthService.getHealth();
  }

  // Guards run left to right: JwtAuthGuard first, so req.user.userId is
  // populated by the time AiChatRateLimitGuard keys the per-user limiter.
  @UseGuards(JwtAuthGuard, AiChatRateLimitGuard)
  @Post('chat')
  async chat(
    @Req() req: RequestWithUser,
    @Body() dto: ChatRequestDto,
  ): Promise<{ reply: string; sessionId: string }> {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }
    return this.aiAgentService.chat(
      req.user.userId,
      TOOL_SET,
      dto.message,
      dto.sessionId,
    );
  }

  // @Sse defaults to GET; override the method metadata to POST so the
  // request body (message + history) can be sent the same way as /ai/chat.
  // Same rate-limit bucket as /ai/chat — both hit the same Anthropic spend.
  @UseGuards(JwtAuthGuard, AiChatRateLimitGuard)
  @Sse('chat/stream', { [METHOD_METADATA]: RequestMethod.POST })
  chatStream(
    @Req() req: RequestWithUser,
    @Body() dto: ChatRequestDto,
  ): Observable<MessageEvent> {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }
    return this.aiAgentService.chatStream(
      req.user.userId,
      TOOL_SET,
      dto.message,
      dto.sessionId,
    );
  }

  // Dedicated rate limit bucket (#528) — separate from /ai/chat's, so a
  // creator drafting listings can't be starved by (or starve) chat usage.
  // Ownership of the NFT is verified inside AiAgentService.draftListing,
  // before the model is ever called; this route never trusts a client-sent
  // owner id, only the JWT-derived userId.
  @UseGuards(JwtAuthGuard, CopilotRateLimitGuard)
  @Post('copilot/draft-listing')
  @ApiOperation({
    summary:
      'Draft a marketplace listing (title/description/suggested price) for ' +
      "an NFT the caller owns. Returns a draft for the creator's review — " +
      'nothing is published.',
  })
  async draftListing(
    @Req() req: RequestWithUser,
    @Body() dto: DraftListingRequestDto,
  ): Promise<DraftListingResult> {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }
    return this.aiAgentService.draftListing(req.user.userId, dto.nftId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('usage')
  async getUsage(@Req() req: RequestWithUser): Promise<UsageSummary> {
    if (!req.user?.userId) {
      throw new UnauthorizedException('Invalid JWT payload');
    }
    return this.aiUsageService.getUsageSummary(req.user.userId);
  }

  // NOTE: this route previously had only @Roles(UserRole.ADMIN) with no
  // RolesGuard in @UseGuards — that decorator sets metadata RolesGuard
  // reads, so without the guard actually running, it was inert and this
  // endpoint was reachable by any authenticated user. Fixed alongside
  // #529's own admin endpoints below, which use the same (correct)
  // pairing every other admin controller in this codebase already uses.
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/tool-logs')
  async getToolLogs(
    @Query('userId') userId?: string,
    @Query('sessionId') sessionId?: string,
    @Query('toolName') toolName?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.aiAgentService.getToolLogs({
      userId,
      sessionId,
      toolName,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  // ── Admin: AI chat spend cap overrides (#529) ────────────────────────

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Get('admin/usage/:userId')
  @ApiOperation({
    summary:
      "Inspect a user's current AI usage/cap standing (admin support tool)",
  })
  async getUsageForAdmin(
    @Param('userId') userId: string,
  ): Promise<UsageSummary> {
    return this.aiUsageService.getUsageSummary(userId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Post('admin/usage/:userId/override')
  @ApiOperation({
    summary:
      "Set (replacing any existing) an override of a user's AI chat spend caps",
  })
  async setCapOverride(
    @Param('userId') userId: string,
    @Body() dto: SetCapOverrideDto,
    @Req() req: RequestWithUser,
  ) {
    return this.aiUsageService.setCapOverride(userId, {
      dailyTokenCap: dto.dailyTokenCap,
      monthlyTokenCap: dto.monthlyTokenCap,
      dailySpendCapUsd: dto.dailySpendCapUsd,
      monthlySpendCapUsd: dto.monthlySpendCapUsd,
      reason: dto.reason,
      grantedBy: req.user?.userId,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @Delete('admin/usage/:userId/override')
  @ApiOperation({
    summary: "Clear a user's cap override, reverting them to the default caps",
  })
  async clearCapOverride(
    @Param('userId') userId: string,
  ): Promise<{ cleared: true }> {
    await this.aiUsageService.clearCapOverride(userId);
    return { cleared: true };
  }
}
