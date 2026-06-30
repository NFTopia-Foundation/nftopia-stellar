import { CorrelationIdMiddleware } from './correlation-id.middleware';
import type { Request, Response } from 'express';

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;
  let mockRequest: any;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
    mockRequest = {
      headers: {},
    };
    mockResponse = {
      headersSent: false,
      setHeader: jest.fn(),
      getHeader: jest.fn(),
    };
    nextFunction = jest.fn();
  });

  it('should generate a new UUID and set it if no correlation ID exists', () => {
    middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

    const correlationId = mockRequest['correlationId'];
    expect(correlationId).toBeDefined();
    expect(typeof correlationId).toBe('string');
    expect(correlationId.length).toBe(36); // UUID length

    expect(mockRequest.headers['x-correlation-id']).toBe(correlationId);
    expect(mockResponse.setHeader).toHaveBeenCalledWith('x-correlation-id', correlationId);
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should reuse x-correlation-id from request headers', () => {
    const existingId = 'existing-correlation-id';
    mockRequest.headers['x-correlation-id'] = existingId;

    middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockRequest['correlationId']).toBe(existingId);
    expect(mockRequest.headers['x-correlation-id']).toBe(existingId);
    expect(mockResponse.setHeader).toHaveBeenCalledWith('x-correlation-id', existingId);
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should reuse x-request-id from request headers if x-correlation-id is missing', () => {
    const existingId = 'existing-request-id';
    mockRequest.headers['x-request-id'] = existingId;

    middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockRequest['correlationId']).toBe(existingId);
    expect(mockRequest.headers['x-correlation-id']).toBe(existingId);
    expect(mockResponse.setHeader).toHaveBeenCalledWith('x-correlation-id', existingId);
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should reuse req.id if present and headers are missing', () => {
    const existingId = 'existing-req-id';
    (mockRequest as any).id = existingId;

    middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockRequest['correlationId']).toBe(existingId);
    expect(mockRequest.headers['x-correlation-id']).toBe(existingId);
    expect(mockResponse.setHeader).toHaveBeenCalledWith('x-correlation-id', existingId);
    expect(nextFunction).toHaveBeenCalled();
  });

  it('should not overwrite x-correlation-id header on response if already sent', () => {
    mockResponse.headersSent = true;

    middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

    expect(mockResponse.setHeader).not.toHaveBeenCalled();
    expect(nextFunction).toHaveBeenCalled();
  });
});
