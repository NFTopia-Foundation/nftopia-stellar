import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/jwt-auth.guard';


@Controller('users') 
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @UseGuards(JwtAuthGuard)
  @Get('/profile')
  getProfile(@Request() req) {
    return {
      message: 'This is a protected resource',
      user: req.user,
    };
  }

  @Get('/health')
  getHealth() {
    return this.appService.getHealth();
  }

  
}


 
