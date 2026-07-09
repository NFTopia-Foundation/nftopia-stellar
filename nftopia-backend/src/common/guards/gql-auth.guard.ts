import { ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import type { GraphqlContext } from '../../graphql/context/context.interface';

@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext): Request | undefined {
    const graphqlContext =
      GqlExecutionContext.create(context).getContext<GraphqlContext>();
    return graphqlContext.req;
  }

  /**
   * Override handleRequest to ensure role is populated from JWT payload.
   * The role should already be attached to the user object by the JWT strategy.
   */
  handleRequest(
    err: any,
    user: any,
    info: any,
    context: ExecutionContext,
  ): any {
    // If user exists, ensure role is populated from JWT
    if (user) {
      // The role should already be in the JWT payload
      // and attached to the user object by the JWT strategy
      return user;
    }
    return super.handleRequest(err, user, info, context);
  }
}
