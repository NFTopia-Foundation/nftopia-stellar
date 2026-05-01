import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('User')
export class GraphqlUserType {
  @Field(() => ID)
  id: string;

  @Field(() => String, { nullable: true })
  username?: string | null;

  @Field(() => String, { nullable: true })
  email?: string | null;

  @Field(() => String, { nullable: true })
  walletAddress?: string | null;
}
