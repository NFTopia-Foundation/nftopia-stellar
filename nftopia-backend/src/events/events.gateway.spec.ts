/* eslint-disable prettier/prettier */

import { Test, TestingModule } from '@nestjs/testing';
import { EventsGateway } from '../../src/events/events.gateway';
import { EventsService } from '../../src/events/events.service';
import { JwtService } from '@nestjs/jwt';

describe('EventsGateway', () => {
  let gateway: EventsGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EventsGateway, EventsService, JwtService],
    }).compile();

    gateway = module.get<EventsGateway>(EventsGateway);
    gateway = module.get<EventsGateway>(EventsGateway);
  });
  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
