export const BASE_FEE_STROOPS = 100; // 0.00001 XLM
export const BASE_FEE_XLM = "0.00001";
 
export function useGasEstimation() {
  return {
    fee: BASE_FEE_STROOPS,
    feeXLM: BASE_FEE_XLM,
    loading: false,
    error: null,
  };
}