import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { BidModule } from './bid.module';
import { BidController } from './bid.controller';
import { BidService } from './bid.service';

describe('BidModule', () => {
  it('is defined', () => {
    expect(BidModule).toBeDefined();
  });

  it('registers controller/provider/export metadata', () => {
    const controllers = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      BidModule,
    ) as unknown[];
    const providers = Reflect.getMetadata(
      MODULE_METADATA.PROVIDERS,
      BidModule,
    ) as unknown[];
    const exportsList = Reflect.getMetadata(
      MODULE_METADATA.EXPORTS,
      BidModule,
    ) as unknown[];

    expect(controllers).toContain(BidController);
    expect(providers).toContain(BidService);
    expect(exportsList).toContain(BidService);
  });
});
