import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, IsUrl, ValidateNested } from 'class-validator';

class PushSubscriptionKeysDto {
  @IsString()
  @IsNotEmpty()
  p256dh: string;

  @IsString()
  @IsNotEmpty()
  auth: string;
}

/** Matches the shape of `PushSubscription.toJSON()` in the browser. */
export class PushSubscribeDto {
  @IsUrl({ require_tld: false })
  endpoint: string;

  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys: PushSubscriptionKeysDto;
}

export class PushUnsubscribeDto {
  @IsUrl({ require_tld: false })
  endpoint: string;
}
