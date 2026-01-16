import { Controller, Get, Post, Param } from '@nestjs/common';
import { EventListenerService } from './event-listener.service';

@Controller('starknet/listeners')
export class ListenersHealthController {
  constructor(private readonly eventListenerService: EventListenerService) {}

  @Get('health')
  getHealth() {
    return this.eventListenerService.getHealthStatus();
  }

  @Post('restart/:eventType')
  async restartListener(@Param('eventType') eventType: 'marketplace' | 'auction' | 'transaction') {
    await this.eventListenerService.restartListener(eventType);
    return { message: `${eventType} listener restarted successfully` };
  }
}