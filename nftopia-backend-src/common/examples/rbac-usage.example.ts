/**
 * RBAC Usage Examples
 *
 * This file demonstrates how to use the Role-Based Access Control system
 * in your NestJS controllers.
 */

import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { UserRole } from '../enums/user-role.enum';

/**
 * Example 1: Admin-only endpoint
 */
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  @Get('revenue')
  @Roles(UserRole.ADMIN)
  getRevenueStats() {
    return { message: 'Only accessible by ADMIN users' };
  }

  /**
   * Example 2: Multiple roles allowed
   */
  @Get('reports')
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  getBasicReports() {
    return { message: 'Accessible by both ADMINs and MODERATORs' };
  }

  /**
   * Example 3: Authenticated users (no specific role required)
   * Just use JwtAuthGuard without RolesGuard
   */
  @Get('profile')
  getProfile() {
    return { message: 'Any authenticated user can access this' };
  }
}

/**
 * RBAC Flow:
 *
 * 1. JwtAuthGuard validates the JWT token and populates req.user
 * 2. RolesGuard checks if req.user exists
 * 3. RolesGuard checks if user.isBanned === true (throws ForbiddenException)
 * 4. RolesGuard retrieves required roles from @Roles decorator
 * 5. RolesGuard verifies user.role matches one of the required roles
 * 6. If all checks pass, the request proceeds to the controller method
 *
 * Available Endpoints:
 * - PUT /admin/users/:id/ban - Ban a user (ADMIN only)
 * - PUT /admin/users/:id/unban - Unban a user (ADMIN only)
 * - PUT /admin/collections/:id/hide - Hide a collection (ADMIN or MODERATOR)
 * - PUT /admin/collections/:id/verify - Toggle collection verification (ADMIN only)
 */
