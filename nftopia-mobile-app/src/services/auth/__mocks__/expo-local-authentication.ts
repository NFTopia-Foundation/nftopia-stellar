export const hasHardwareAsync = jest.fn().mockResolvedValue(true);
export const isEnrolledAsync = jest.fn().mockResolvedValue(true);
export const authenticateAsync = jest.fn().mockResolvedValue({ success: true });
export const supportedAuthenticationTypesAsync = jest.fn().mockResolvedValue([1, 2]);
