import { Controller, Post, Body, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) { }

    @Post('challenge')
    getChallenge(@Body('publicKey') publicKey: string) {
        if (!publicKey) {
            throw new BadRequestException('Public key is required');
        }
        return this.authService.generateChallenge(publicKey);
    }

    @Post('login')
    async login(@Body('transaction') transactionXdr: string) {
        if (!transactionXdr) {
            throw new BadRequestException('Transaction XDR is required');
        }

        // Validate signature and get user
        const user = await this.authService.validateStellarTransaction(transactionXdr);

        if (!user) {
            throw new BadRequestException('Invalid signature or transaction');
        }

        // Login and return JWT
        return this.authService.login(user);
    }
}
