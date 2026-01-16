import { Test } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Response, Request } from 'express';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let authController: AuthController;
  let authService: AuthService;
  let jwtService: JwtService;

  const mockResponse = {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
    json: jest.fn()
  } as unknown as Response;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            generateNonce: jest.fn().mockReturnValue('123456'),
            verifySignature: jest.fn().mockResolvedValue({
              accessToken: 'access.token',
              refreshToken: 'refresh.token',
              user: { id: '123', walletAddress: '0x123...' }
            })
          }
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockImplementation((payload) => `token.${payload.sub}`),
            verify: jest.fn().mockReturnValue({ sub: '123' })
          }
        },
        {
          provide: getRepositoryToken(User),
          useValue: {
            findOne: jest.fn().mockResolvedValue({ id: '123', walletAddress: '0x123...' })
          }
        }
      ],
    }).compile();

    authController = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe('requestNonce', () => {
    it('should return a nonce for wallet address', () => {
      const result = authController.requestNonce('0x123...');
      expect(result).toEqual({ nonce: '123456' });
      expect(authService.generateNonce).toHaveBeenCalledWith('0x123...');
    });
  });

  describe('verifySignature', () => {
    it('should verify signature and set cookies', async () => {
      const result = await authController.verifySignature(
        '0x123...',
        'signature',
        mockResponse
      );

      expect(result).toEqual({
        message: 'Authenticated',
        user: { id: '123', walletAddress: '0x123...' }
      });
      
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'access_token',
        'access.token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 15 * 60 * 1000
        })
      );
      
      expect(mockResponse.cookie).toHaveBeenCalledWith(
        'refresh_token',
        'refresh.token',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000
        })
      );
    });
  });

  describe('refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const mockRequest = {
        cookies: { refresh_token: 'valid.token' }
      } as unknown as Request;

      const result = await authController.refresh(
        mockRequest,
        mockResponse
      );

      expect(result).toEqual({ message: 'Refreshed successfully' });
      expect(mockResponse.cookie).toHaveBeenCalledTimes(2);
    });

    it('should throw if no refresh token', async () => {
      const mockRequest = {
        cookies: {}
      } as Request;

      await expect(authController.refresh(mockRequest, mockResponse))
        .rejects.toThrow(UnauthorizedException);
    });
  });

  describe('logout', () => {
    it('should clear authentication cookies', () => {
      const result = authController.logout(mockResponse);
      
      expect(result).toEqual({ message: 'Logged out' });
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('jwt');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('access_token');
      expect(mockResponse.clearCookie).toHaveBeenCalledWith('refresh_token');
    });
  });
});