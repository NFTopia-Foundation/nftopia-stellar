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
}
