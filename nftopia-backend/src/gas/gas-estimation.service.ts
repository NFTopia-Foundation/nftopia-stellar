import { Injectable } from "@nestjs/common";
import { Contract, RpcProvider } from "starknet";

const STARKNET_RPC_URL = "";
const GAS_ESTIMATOR_ABI = "";
const GAS_ESTIMATOR_ADDRESS = "";

@Injectable()
export class GasEstimationService {
  private provider: RpcProvider;

  constructor() {
    this.provider = new RpcProvider({ nodeUrl: STARKNET_RPC_URL });
  }

  async estimateBatchPurchase(tokenIds: string[], prices: bigint[]) {
    // const estimator = new Contract(
    //   GAS_ESTIMATOR_ABI,
    //   GAS_ESTIMATOR_ADDRESS,
    //   this.provider
    // );

    // return estimator.estimate_batch_purchase(tokenIds, prices);
  }
}