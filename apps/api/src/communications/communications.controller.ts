import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CommunicationsService } from './communications.service';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import type { Request } from 'express';

type AuthedRequest = Request & { userId: string };

@ApiTags('Communications')
@ApiBearerAuth('clerk-jwt')
@Controller('bookings/:bookingId/communications')
export class CommunicationsController {
  constructor(private service: CommunicationsService) {}

  @ApiOperation({ summary: 'List communications for a booking' })
  @Get()
  findAll(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
  ) {
    return this.service.findAll(req.userId, bookingId);
  }

  @ApiOperation({ summary: 'Get a communication by ID' })
  @Get(':id')
  findOne(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Param('id') id: string,
  ) {
    return this.service.findOne(req.userId, bookingId, id);
  }

  @ApiOperation({ summary: 'Log a communication on a booking' })
  @Post()
  create(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Body() dto: CreateCommunicationDto,
  ) {
    return this.service.create(req.userId, bookingId, dto);
  }
}
