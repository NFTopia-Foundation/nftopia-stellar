import { Injectable, Logger } from '@nestjs/common';
import type { ApolloServerPlugin } from '@apollo/server';
import type { GraphqlContext } from '../context/context.interface';

@Injectable()
export class GraphqlLoggingMiddleware {
  private readonly logger = new Logger(GraphqlLoggingMiddleware.name);

  createPlugin(): ApolloServerPlugin<GraphqlContext> {
    const logger = this.logger;

    return {
      requestDidStart(requestContext) {
        const startedAt = Date.now();
        const operationName =
          requestContext.request.operationName || 'anonymous-operation';

        return Promise.resolve({
          willSendResponse() {
            const durationMs = Date.now() - startedAt;
            logger.log(`GraphQL ${operationName} completed in ${durationMs}ms`);
            return Promise.resolve();
          },
        });
      },
    };
  }
}
