import { useContract } from '@starknet-react/core';

const GAS_ESTIMATOR_ADDRESS = "0x000";
const GAS_ESTIMATOR_ABI = "";

export function useGasEstimation() {
  // const { contract: estimator } = useContract({
  //   address: GAS_ESTIMATOR_ADDRESS,
  //   abi: GAS_ESTIMATOR_ABI,
  // });

  const estimateAuctionBid = async (nftId: string, bidAmount: bigint) => {
    try {
      // const { wei, strk } = await estimator.estimate_auction_bid(nftId, bidAmount);
      // return { weiEstimate: wei, strkEstimate: strk };
    } catch (error) {
      console.error('Estimation failed:', error);
      return null;
    }
  };

  return { estimateAuctionBid };
}