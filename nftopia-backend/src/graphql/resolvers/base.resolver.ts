import { Field, ObjectType, Query, Resolver } from '@nestjs/graphql';

@ObjectType()
class GraphqlHealthResponse {
  @Field()
  status: string;

  @Field()
  service: string;

  @Field()
  timestamp: string;
}

@Resolver()
export class BaseResolver {
  @Query(() => GraphqlHealthResponse, {
    name: 'health',
    description: 'GraphQL gateway health check',
  })
  health(): GraphqlHealthResponse {
    return {
      status: 'ok',
      service: 'graphql-gateway',
      timestamp: new Date().toISOString(),
    };
  }
}
