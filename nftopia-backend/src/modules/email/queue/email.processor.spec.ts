import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmailProcessor } from './email.processor';
import { EmailService } from '../email.service';
import { EmailLog } from '../entities/email-log.entity';
import { EmailStatus } from '../email.interface';
import { Job } from 'bullmq';

describe('EmailProcessor', () => {
  let processor: EmailProcessor;
  let emailService: EmailService;

  const mockEmailService = {
    sendRaw: jest.fn().mockResolvedValue(undefined),
  };

  const mockEmailLogRepository = {
    create: jest.fn((dto) => dto),
    save: jest.fn((entity) => Promise.resolve({ id: 'log-123', ...entity })),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailProcessor,
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: getRepositoryToken(EmailLog),
          useValue: mockEmailLogRepository,
        },
      ],
    }).compile();

    processor = module.get<EmailProcessor>(EmailProcessor);
    emailService = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockJob = (data: any, overrides: Partial<Job> = {}): Job => ({
    id: 'job-123',
    data,
    attemptsMade: 0,
    opts: { attempts: 3 },
    ...overrides,
  } as unknown as Job);

  describe('process', () => {
    it('should process email job successfully', async () => {
      const jobData = {
        templateName: 'verification',
        to: 'test@example.com',
        subject: 'Verify Email',
        data: { username: 'TestUser' },
      };

      mockEmailLogRepository.findOne.mockResolvedValue(null);

      const job = createMockJob(jobData);
      await processor.process(job);

      expect(mockEmailService.sendRaw).toHaveBeenCalledWith(
        jobData.to,
        jobData.templateName,
        jobData.subject,
        jobData.data,
      );

      expect(mockEmailLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: EmailStatus.SENT }),
      );
    });

    it('should mark job as retrying on failure when attempts remain', async () => {
      const error = new Error('Send failed');
      mockEmailService.sendRaw.mockRejectedValueOnce(error);
      mockEmailLogRepository.findOne.mockResolvedValue(null);

      const job = createMockJob(
        { templateName: 'verification', to: 'test@example.com', subject: 'Test', data: {} },
        { attemptsMade: 1, opts: { attempts: 3 } } as any,
      );

      await expect(processor.process(job)).rejects.toThrow('Send failed');

      expect(mockEmailLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: EmailStatus.RETRYING }),
      );
    });

    it('should mark job as failed after all attempts exhausted', async () => {
      const error = new Error('Send failed');
      mockEmailService.sendRaw.mockRejectedValueOnce(error);
      mockEmailLogRepository.findOne.mockResolvedValue(null);

      const job = createMockJob(
        { templateName: 'verification', to: 'test@example.com', subject: 'Test', data: {} },
        { attemptsMade: 3, opts: { attempts: 3 } } as any,
      );

      await expect(processor.process(job)).rejects.toThrow('Send failed');

      expect(mockEmailLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: EmailStatus.FAILED }),
      );
    });

    it('should reuse existing email log entry when job already tracked', async () => {
      const existingLog = {
        id: 'existing-log',
        jobId: 'job-123',
        status: EmailStatus.PENDING,
        attemptCount: 1,
      };
      mockEmailLogRepository.findOne.mockResolvedValue(existingLog);

      const job = createMockJob({
        templateName: 'verification',
        to: 'test@example.com',
        subject: 'Test',
        data: {},
      });

      await processor.process(job);

      // Should have saved the existing log (not created new)
      expect(mockEmailLogRepository.create).not.toHaveBeenCalled();
    });
  });
});
