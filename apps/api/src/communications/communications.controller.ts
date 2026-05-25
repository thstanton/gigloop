import { Body, Controller, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommunicationsService } from './communications.service';
import { MailService } from '../mail/mail.service';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { SendEmailDto } from './dto/send-email.dto';
import type { Request } from 'express';

type AuthedRequest = Request & { userId: string };

@ApiTags('Communications')
@ApiBearerAuth('clerk-jwt')
@Controller('bookings/:bookingId/communications')
export class CommunicationsController {
  constructor(
    private service: CommunicationsService,
    private mail: MailService,
  ) {}

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

  @ApiOperation({ summary: 'Send an email for a booking using a template' })
  @ApiResponse({ status: 204, description: 'Email sent and communication logged' })
  @ApiResponse({ status: 404, description: 'Booking, template, or public profile not found' })
  @Post('send')
  @HttpCode(204)
  async send(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Body() dto: SendEmailDto,
  ) {
    const context = await this.mail.buildContext(req.userId, bookingId, dto.invoiceId);
    await this.mail.send({
      userId: req.userId,
      bookingId,
      contactId: dto.contactId,
      to: dto.to,
      subject: dto.subject,
      templateId: dto.templateId,
      context,
    });
  }
}
