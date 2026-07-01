import { Global, Module } from '@nestjs/common';
import { SchemaReadinessService } from './schema-readiness.service';

@Global()
@Module({
  providers: [SchemaReadinessService],
  exports: [SchemaReadinessService],
})
export class DatabaseSupportModule {}
