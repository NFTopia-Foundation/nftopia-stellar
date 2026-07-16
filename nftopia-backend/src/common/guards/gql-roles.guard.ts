import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { ROLES_KEY } from '../decorators/roles.decorator';
import { UserRole } from '../enums/user-role.enum';
import type { Request } from 'express';

// Define the user type expected from the request
interface RequestUser {
  userId: string;
  id?: string;
  role?: UserRole;
  isBanned?: boolean;
  username?: string;
  email?: string;
}

// Extend Express Request to include user
interface RequestWithUser extends Request {
  user: RequestUser;
}

@Injectable()
export class GqlRolesGuard implements CanActivate {
  private readonly logger = new Logger(GqlRolesGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // If no roles are required, let the user proceed
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    // Get GraphQL context
    const ctx = GqlExecutionContext.create(context);
    const { req } = ctx.getContext<{ req: RequestWithUser }>();

    // Get user from request (set by GqlAuthGuard)
    const user = req.user;

    if (!user) {
      this.logger.warn('Unauthorized access attempt: No user found in request');
      throw new UnauthorizedException('User not authenticated');
    }

    // Check if user is banned
    if (user.isBanned) {
      this.logger.warn(
        `Banned user attempted access: userId=${user.id ?? user.userId}`,
      );
      throw new ForbiddenException(
        'User is banned from accessing this resource',
      );
    }

    // Check if user has required role
    const userRole = user.role;
    const hasRole = requiredRoles.some((role) => userRole === role);

    if (!hasRole) {
      // Log unauthorized access attempt for security auditing
      this.logger.warn(
        `Unauthorized access attempt: userId=${user.id ?? user.userId}, role=${userRole}, requiredRoles=${requiredRoles.join(', ')}`,
      );
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
