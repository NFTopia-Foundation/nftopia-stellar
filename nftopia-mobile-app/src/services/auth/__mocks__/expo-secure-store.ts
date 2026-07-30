export const hasHardwareAsync = jest.fn().mockResolvedValue(true);
export const isEnrolledAsync = jest.fn().mockResolvedValue(true);
export const authenticateAsync = jest.fn().mockResolvedValue({ success: true, error: null });
