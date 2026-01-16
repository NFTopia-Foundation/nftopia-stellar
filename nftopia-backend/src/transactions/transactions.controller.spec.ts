import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

describe('TransactionsController', () => {
  let controller: TransactionsController;
  let service: TransactionsService;

  const mockTxService = {
    recordTransaction: jest.fn(),
    getTransactionsByUser: jest.fn(),
  };

  const mockUser = { sub: 'user123' };
  const mockRequest = {
    user: mockUser,
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsController],
      providers: [
        { provide: TransactionsService, useValue: mockTxService },
        Reflector, // Required by JwtAuthGuard
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          const request = context.switchToHttp().getRequest();
          request.user = mockUser;
          return true;
        },
      })
      .compile();

    controller = module.get<TransactionsController>(TransactionsController);
    service = module.get<TransactionsService>(TransactionsService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should record a transaction', async () => {
    const body = { nftId: 'nft456', price: 150 };
    const mockTx = { id: 'tx123', amount: 150 };

    mockTxService.recordTransaction.mockResolvedValue(mockTx);

    const result = await controller.record(body, mockRequest);

    expect(service.recordTransaction).toHaveBeenCalledWith('user123', 'nft456', 150);
    expect(result).toEqual({ message: 'Transaction recorded', tx: mockTx });
  });

  it('should return user transactions', async () => {
    const transactions = [{ id: 'tx1' }, { id: 'tx2' }];
    mockTxService.getTransactionsByUser.mockResolvedValue(transactions);

    const result = await controller.getUserTransactions(mockRequest);

    expect(service.getTransactionsByUser).toHaveBeenCalledWith('user123');
    expect(result).toEqual({ transactions });
  });
});
