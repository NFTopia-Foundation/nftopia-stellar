import { Test } from '@nestjs/testing';
import { JwtStrategy } from './jwt.strategy';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { Request } from 'express';

describe('JwtStrategy', () => {
  let jwtStrategy: JwtStrategy;

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test_secret';

    const module = await Test.createTestingModule({
      providers: [JwtStrategy],
    }).compile();

    jwtStrategy = module.get<JwtStrategy>(JwtStrategy);
  });

  afterEach(() => {
    delete process.env.JWT_SECRET;
  });

  it('should be defined', () => {
    expect(jwtStrategy).toBeDefined();
  });

  describe('constructor', () => {
    it('should initialize with correct configuration', () => {
      expect(jwtStrategy).toBeInstanceOf(PassportStrategy(Strategy));
      
      // Verify the strategy options
      const options = (jwtStrategy as any).options;
      expect(options.jwtFromRequest).toBeDefined();
      expect(options.ignoreExpiration).toBe(false);
      expect(options.secretOrKey).toBe('test_secret');
    });

    it('should fall back to default secret if JWT_SECRET is not set', () => {
      delete process.env.JWT_SECRET;
      const strategy = new JwtStrategy();
      expect((strategy as any).options.secretOrKey).toBe('my_jwt_secret');
    });

    it('should extract JWT from cookies', () => {
        const mockRequest = {
            cookies: {
              jwt: 'test.jwt.token',
            },
          } as Partial<Request>;
          
      
      const extractor = (jwtStrategy as any).options.jwtFromRequest;
      const token = extractor(mockRequest);
      
      expect(token).toBe('test.jwt.token');
    });

    it('should return null if no JWT cookie exists', () => {
      const mockRequest = {
        cookies: {}
      } as Request;
      
      const extractor = (jwtStrategy as any).options.jwtFromRequest;
      const token = extractor(mockRequest);
      
      expect(token).toBeNull();
    });
  });

  describe('validate', () => {
    it('should return user object from payload', async () => {
      const mockPayload = {
        sub: '123',
        walletAddress: '0x123...',
        isArtist: true,
        username: 'testuser'
      };
      
      const result = await jwtStrategy.validate(mockPayload);
      
      expect(result).toEqual({
        id: '123',
        walletAddress: '0x123...',
        isArtist: true,
        username: 'testuser'
      });
    });

    it('should work with minimal payload', async () => {
      const mockPayload = {
        sub: '123',
        walletAddress: '0x123...'
      };
      
      const result = await jwtStrategy.validate(mockPayload);
      
      expect(result).toEqual({
        id: '123',
        walletAddress: '0x123...',
        isArtist: undefined,
        username: undefined
      });
    });
  });
});