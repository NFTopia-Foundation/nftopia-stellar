import { Global, Module } from '@nestjs/common';
import { SorobanRpcService } from './soroban-rpc.service';

@Global()
@Module({
  providers: [SorobanRpcService],
  exports: [SorobanRpcService],
})
export class SorobanModule {}
