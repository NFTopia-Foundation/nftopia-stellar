import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EmailService } from './email.service';
import { EmailTemplateService } from './email-template.service';
import { EmailLog } from './entities/email-log.entity';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { VerificationToken } from './entities/verification-token.entity';
import { User } from '../../users/user.entity';
import { EMAIL_PROVIDER_TOKEN } from './email.provider';
import { EmailProvider, EmailStatus } from './email.interface';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';

describe('EmailService', () => {
  let service: EmailService;
  let emailProvider: EmailProvider;
  let templateService: EmailTemplateService;
  let emailLogRepository: Repository<EmailLog>;
  let passwordResetTokenRepository: Repository<PasswordResetToken>;
  let verificationTokenRepository: Repository<VerificationToken>;
  let userRepository: Repository<User>;

  const mockEmailProvider: EmailProvider = {
    send: jest.fn().mockResolvedValue(undefined),
    verify: jest.fn().mockResolvedValue(true),
  };

  const mockTemplateService = {
    render: jest.fn().mockResolvedValue('<html>Test Email</html>'),
    htmlToText: jest.fn().mockReturnValue('Test Email'),
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config: Record<string, any> = {
        EMAIL_FROM_ADDRESS: 'test@nftopia.com',
        EMAIL_FROM_NAME: 'NFTopia Test',
        FRONTEND_URL: 'http://localhost:3001',
        EMAIL_PROVIDER: 'smtp',
        EMAIL_VERIFICATION_EXPIRY_HOURS: 24,
        EMAIL_PASSWORD_RESET_EXPIRY_HOURS: 1,
      };
      return config[key] ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: EMAIL_PROVIDER_TOKEN,
          useValue: mockEmailProvider,
        },
        {
          provide: EmailTemplateService,
          useValue: mockTemplateService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: getRepositoryToken(EmailLog),
          useValue: {
            create: jest.fn((dto) => dto),
            save: jest.fn((entity) => Promise.resolve({ id: '123', ...entity })),
            findOne: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(PasswordResetToken),
          useValue: {
            create: jest.fn((dto) => dto),
            save: jest.fn((entity) => Promise.resolve({ id: '456', ...entity })),
            findOne: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(VerificationToken),
          useValue: {
            create: jest.fn((dto) => dto),
            save: jest.fn((entity) => Promise.resolve({ id: '789', ...entity })),
            findOne: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    emailProvider = module.get<EmailProvider>(EMAIL_PROVIDER_TOKEN);
    templateService = module.get<EmailTemplateService>(EmailTemplateService);
    emailLogRepository = module.get<Repository<EmailLog>>(getRepositoryToken(EmailLog));
    passwordResetTokenRepository = module.get<Repository<PasswordResetToken>>(
      getRepositoryToken(PasswordResetToken),
    );
    verificationTokenRepository = module.get<Repository<VerificationToken>>(
      getRepositoryToken(VerificationToken),
    );
    userRepository = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('sendVerificationEmail', () => {
    it('should send a verification email successfully', async () => {
      const userId = 'user-123';
      const email = 'test@example.com';
      const username = 'testuser';

      jest.spyOn(verificationTokenRepository, 'delete').mockResolvedValue({ affected: 0 } as any);

      await service.sendVerificationEmail(userId, email, username);

      expect(verificationTokenRepository.delete).toHaveBeenCalledWith({ userId });
      expect(verificationTokenRepository.save).toHaveBeenCalled();
      expect(templateService.render).toHaveBeenCalledWith(
        'verification',
        expect.objectContaining({ username }),
      );
      expect(emailProvider.send).toHaveBeenCalled();
    });
  });

  describe('verifyEmail', () => {
    it('should verify email with valid token', async () => {
      const token = 'valid-token';
      const mockVerificationToken = {
        id: '789',
        userId: 'user-123',
        email: 'test@example.com',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        verifiedAt: null,
      };

      jest.spyOn(verificationTokenRepository, 'findOne').mockResolvedValue(mockVerificationToken as any);
      jest.spyOn(userRepository, 'update').mockResolvedValue({ affected: 1 } as any);

      await service.verifyEmail(token);

      expect(verificationTokenRepository.findOne).toHaveBeenCalled();
      expect(verificationTokenRepository.save).toHaveBeenCalled();
      expect(userRepository.update).toHaveBeenCalledWith(
        { id: mockVerificationToken.userId },
        { isEmailVerified: true },
      );
    });

    it('should throw error for invalid token', async () => {
      jest.spyOn(verificationTokenRepository, 'findOne').mockResolvedValue(null);

      await expect(service.verifyEmail('invalid-token')).rejects.toThrow(BadRequestException);
    });

    it('should throw error for already verified token', async () => {
      const mockVerificationToken = {
        id: '789',
        userId: 'user-123',
        email: 'test@example.com',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        verifiedAt: new Date(),
      };

      jest.spyOn(verificationTokenRepository, 'findOne').mockResolvedValue(mockVerificationToken as any);

      await expect(service.verifyEmail('token')).rejects.toThrow(ConflictException);
    });

    it('should throw error for expired token', async () => {
      const mockVerificationToken = {
        id: '789',
        userId: 'user-123',
        email: 'test@example.com',
        expiresAt: new Date(Date.now() - 1000),
        verifiedAt: null,
      };

      jest.spyOn(verificationTokenRepository, 'findOne').mockResolvedValue(mockVerificationToken as any);

      await expect(service.verifyEmail('token')).rejects.toThrow(BadRequestException);
    });
  });

  describe('requestPasswordReset', () => {
    it('should create password reset token for existing user', async () => {
      const email = 'test@example.com';
      const mockUser = {
        id: 'user-123',
        email,
        username: 'testuser',
        passwordHash: 'hashed-password',
      };

      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(passwordResetTokenRepository, 'delete').mockResolvedValue({ affected: 0 } as any);

      await service.requestPasswordReset(email);

      expect(userRepository.findOne).toHaveBeenCalledWith({ where: { email } });
      expect(passwordResetTokenRepository.delete).toHaveBeenCalledWith({ userId: mockUser.id });
      expect(passwordResetTokenRepository.save).toHaveBeenCalled();
      expect(emailProvider.send).toHaveBeenCalled();
    });

    it('should not throw error for non-existent user', async () => {
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(null);

      await expect(service.requestPasswordReset('nonexistent@example.com')).resolves.not.toThrow();
    });
  });

  describe('resetPassword', () => {
    it('should reset password with valid token', async () => {
      const token = 'valid-token';
      const newPassword = 'NewPassword123!';
      const mockResetToken = {
        id: '456',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: null,
      };
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
      };

      jest.spyOn(passwordResetTokenRepository, 'findOne').mockResolvedValue(mockResetToken as any);
      jest.spyOn(userRepository, 'findOne').mockResolvedValue(mockUser as any);
      jest.spyOn(userRepository, 'update').mockResolvedValue({ affected: 1 } as any);

      await service.resetPassword(token, newPassword);

      expect(passwordResetTokenRepository.findOne).toHaveBeenCalled();
      expect(userRepository.update).toHaveBeenCalled();
      expect(passwordResetTokenRepository.save).toHaveBeenCalled();
    });

    it('should throw error for invalid token', async () => {
      jest.spyOn(passwordResetTokenRepository, 'findOne').mockResolvedValue(null);

      await expect(service.resetPassword('invalid', 'password')).rejects.toThrow(BadRequestException);
    });

    it('should throw error for already used token', async () => {
      const mockResetToken = {
        id: '456',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        usedAt: new Date(),
      };

      jest.spyOn(passwordResetTokenRepository, 'findOne').mockResolvedValue(mockResetToken as any);

      await expect(service.resetPassword('token', 'password')).rejects.toThrow(BadRequestException);
    });

    it('should throw error for expired token', async () => {
      const mockResetToken = {
        id: '456',
        userId: 'user-123',
        expiresAt: new Date(Date.now() - 1000),
        usedAt: null,
      };

      jest.spyOn(passwordResetTokenRepository, 'findOne').mockResolvedValue(mockResetToken as any);

      await expect(service.resetPassword('token', 'password')).rejects.toThrow(BadRequestException);
    });
  });

  describe('sendTemplatedEmail', () => {
    it('should send templated email successfully', async () => {
      const to = 'recipient@example.com';
      const templateName = 'test-template';
      const subject = 'Test Subject';
      const data = { name: 'Test User' };

      await service.sendTemplatedEmail(to, templateName, subject, data);

      expect(templateService.render).toHaveBeenCalledWith(templateName, data);
      expect(emailProvider.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to,
          subject,
        }),
      );
      expect(emailLogRepository.save).toHaveBeenCalled();
    });

    it('should log failure when email send fails', async () => {
      const error = new Error('Send failed');
      jest.spyOn(emailProvider, 'send').mockRejectedValueOnce(error);

      await expect(
        service.sendTemplatedEmail('test@example.com', 'template', 'Subject', {}),
      ).rejects.toThrow(error);

      expect(emailLogRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: EmailStatus.FAILED,
          errorMessage: error.message,
        }),
      );
    });
  });
});
