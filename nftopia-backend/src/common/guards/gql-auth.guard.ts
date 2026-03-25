import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';
import type { GraphqlContext } from '../../graphql/context/context.interface';

@Injectable()
export class GqlAuthGuard extends AuthGuard('jwt') {
  getRequest(context: ExecutionContext) {
    const graphqlContext =
      GqlExecutionContext.create(context).getContext<GraphqlContext>();
    return graphqlContext.req;
  }
}
