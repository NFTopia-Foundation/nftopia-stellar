import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Repository } from 'typeorm';
import { verifyMessage } from 'ethers';

jest.mock('ethers', () => ({
  verifyMessage: jest.fn().mockImplementation(() => '0x123...')
}));

describe('AuthService', () => {
  let authService: AuthService;
  let jwtService: JwtService;
  let userRepo: Repository<User>;

  beforeEach(async () => {
    process.env.JWT_ACCESS_SECRET = 'access_secret';
    process.env.JWT_REFRESH_SECRET = 'refresh_secret';
    process.env.JWT_ACCESS_EXPIRY = '15m';
    process.env.JWT_REFRESH_EXPIRY = '7d';

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockImplementation((payload) => `token.${payload.sub}`),
            verify: jest.fn().mockImplementation((token) => ({ sub: '123' }))
          }
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn().mockImplementation((user) => user),
            save: jest.fn().mockImplementation((user) => Promise.resolve({ id: '123', ...user }))
          }
        }
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
    userRepo = module.get<Repository<User>>(getRepositoryToken(User));
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.JWT_ACCESS_EXPIRY;
    delete process.env.JWT_REFRESH_EXPIRY;
  });

  describe('generateNonce', () => {
    it('should generate and store a nonce', () => {
      const walletAddress = '0x123...';
      const nonce = authService.generateNonce(walletAddress);
      
      expect(nonce).toBeDefined();
      expect(authService['nonces'].get(walletAddress.toLowerCase())).toBe(nonce);
    });
  });

  describe('generateTokens', () => {
    it('should generate access and refresh tokens', async () => {
      const user = { id: '123', walletAddress: '0x123...' } as User;
      const tokens = await authService.generateTokens(user);
      
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
      expect(jwtService.sign).toHaveBeenCalledTimes(2);
    });

    it('should use environment variables for configuration', async () => {
      const user = { id: '123', walletAddress: '0x123...' } as User;
      await authService.generateTokens(user);
      
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: '123', walletAddress: '0x123...' },
        { secret: 'access_secret', expiresIn: '15m' }
      );
      expect(jwtService.sign).toHaveBeenCalledWith(
        { sub: '123', walletAddress: '0x123...' },
        { secret: 'refresh_secret', expiresIn: '7d' }
      );
    });
  });

  describe('verifySignature', () => {
    it('should verify signature and return tokens', async () => {
      const walletAddress = '0x123...';
      const signature = 'test_signature';
      
      // Set up nonce
      authService.generateNonce(walletAddress);
      const nonce = authService['nonces'].get(walletAddress.toLowerCase());
      
      // Mock user lookup
      jest.spyOn(userRepo, 'findOne').mockResolvedValueOnce(null); // First call - no user
      jest.spyOn(userRepo, 'findOne').mockResolvedValueOnce({ id: '123', walletAddress } as User);
      
      const result = await authService.verifySignature(walletAddress, signature);
      
      expect(verifyMessage).toHaveBeenCalledWith(`Sign this message to log in: ${nonce}`, signature);
      expect(result).toEqual({
        accessToken: 'token.123',
        refreshToken: 'token.123',
        user: { id: '123', walletAddress }
      });
    });

    it('should throw if nonce not found', async () => {
      await expect(authService.verifySignature('0x123...', 'signature'))
        .rejects.toThrow('Nonce not found');
    });

    it('should throw if signature verification fails', async () => {
      const walletAddress = '0x123...';
      authService.generateNonce(walletAddress);
      
      (verifyMessage as jest.Mock).mockImplementationOnce(() => '0x456...');
      
      await expect(authService.verifySignature(walletAddress, 'signature'))
        .rejects.toThrow('Invalid signature');
    });
  });
});