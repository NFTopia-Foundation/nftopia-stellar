import { ExecutionContext, CallHandler } from '@nestjs/common';
import { CorrelationIdInterceptor } from './correlation-id.interceptor';
import { of } from 'rxjs';

describe('CorrelationIdInterceptor', () => {
  let interceptor: CorrelationIdInterceptor;
  let mockExecutionContext: Partial<ExecutionContext>;
  let mockCallHandler: Partial<CallHandler>;

  beforeEach(() => {
    interceptor = new CorrelationIdInterceptor();
    mockCallHandler = {
      handle: jest.fn().mockReturnValue(of('response')),
    };
  });

  describe('HTTP context', () => {
    let mockRequest: any;
    let mockResponse: any;

    beforeEach(() => {
      mockRequest = {
        headers: {},
      };
      mockResponse = {
        headersSent: false,
        setHeader: jest.fn(),
        getHeader: jest.fn(),
      };

      mockExecutionContext = {
        getType: jest.fn().mockReturnValue('http'),
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: () => mockRequest,
          getResponse: () => mockResponse,
        }),
      };
    });

    it('should set x-correlation-id response header from request headers', () => {
      mockRequest.headers['x-correlation-id'] = 'test-id';

      interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler as CallHandler).subscribe();

      expect(mockResponse.setHeader).toHaveBeenCalledWith('x-correlation-id', 'test-id');
      expect(mockCallHandler.handle).toHaveBeenCalled();
    });

    it('should set x-correlation-id response header from request property correlationId', () => {
      mockRequest.correlationId = 'prop-id';

      interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler as CallHandler).subscribe();

      expect(mockResponse.setHeader).toHaveBeenCalledWith('x-correlation-id', 'prop-id');
    });

    it('should set x-correlation-id response header from request property id', () => {
      mockRequest.id = 'req-id';

      interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler as CallHandler).subscribe();

      expect(mockResponse.setHeader).toHaveBeenCalledWith('x-correlation-id', 'req-id');
    });

    it('should not set x-correlation-id if already set on response', () => {
      mockRequest.correlationId = 'prop-id';
      mockResponse.getHeader.mockReturnValue('already-set-id');

      interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler as CallHandler).subscribe();

      expect(mockResponse.setHeader).not.toHaveBeenCalled();
    });

    it('should not set x-correlation-id if response headers are already sent', () => {
      mockRequest.correlationId = 'prop-id';
      mockResponse.headersSent = true;

      interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler as CallHandler).subscribe();

      expect(mockResponse.setHeader).not.toHaveBeenCalled();
    });
  });

  describe('GraphQL context', () => {
    let mockGqlReq: any;
    let mockGqlRes: any;

    beforeEach(() => {
      mockGqlReq = {
        headers: {},
      };
      mockGqlRes = {
        headersSent: false,
        setHeader: jest.fn(),
        getHeader: jest.fn(),
      };

      mockExecutionContext = {
        getType: jest.fn().mockReturnValue('graphql'),
        getArgByIndex: jest.fn().mockImplementation((index) => {
          if (index === 2) {
            return { req: mockGqlReq, res: mockGqlRes };
          }
          return null;
        }),
      };
    });

    it('should set x-correlation-id response header from GraphQL request headers', () => {
      mockGqlReq.headers['x-correlation-id'] = 'gql-id';

      interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler as CallHandler).subscribe();

      expect(mockGqlRes.setHeader).toHaveBeenCalledWith('x-correlation-id', 'gql-id');
      expect(mockCallHandler.handle).toHaveBeenCalled();
    });

    it('should set x-correlation-id response header from GraphQL request correlationId property', () => {
      mockGqlReq.correlationId = 'gql-prop-id';

      interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler as CallHandler).subscribe();

      expect(mockGqlRes.setHeader).toHaveBeenCalledWith('x-correlation-id', 'gql-prop-id');
    });

    it('should not set x-correlation-id if already set on GraphQL response', () => {
      mockGqlReq.correlationId = 'gql-prop-id';
      mockGqlRes.getHeader.mockReturnValue('already-set-gql');

      interceptor.intercept(mockExecutionContext as ExecutionContext, mockCallHandler as CallHandler).subscribe();

      expect(mockGqlRes.setHeader).not.toHaveBeenCalled();
    });
  });
});
