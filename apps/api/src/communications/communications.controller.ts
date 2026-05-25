import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CommunicationsService } from './communications.service';
import { MailService } from '../mail/mail.service';
import { CreateCommunicationDto } from './dto/create-communication.dto';
import { SendEmailDto } from './dto/send-email.dto';
import { RenderEmailQueryDto } from './dto/render-email-query.dto';
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

  @ApiOperation({ summary: 'Render a template with booking context — returns subject and body for the compose sheet' })
  @ApiResponse({
    status: 200,
    description: 'Rendered subject and body with list of variables that fell back to defaults',
    schema: {
      properties: {
        subject: { type: 'string' },
        body: { type: 'string' },
        missingVariables: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @Get('render')
  async render(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Query() query: RenderEmailQueryDto,
  ) {
    const template = await this.service.findTemplate(req.userId, query.templateId);
    if (!template) throw new NotFoundException('Template not found');

    const context = await this.mail.buildContext(req.userId, bookingId, query.invoiceId, query.issueDate, query.dueDate);

    const { html, missingVariables: bodyMissing } = this.mail.renderTemplate(template.content, context);
    const { subject, missingVariables: subjectMissing } = this.mail.renderSubject(template.builtInType, context);

    const missingVariables = [...new Set([...subjectMissing, ...bodyMissing])];

    return { subject, body: html, missingVariables };
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

  @ApiOperation({ summary: 'Send an email for a booking' })
  @ApiResponse({ status: 204, description: 'Email sent and communication logged' })
  @ApiResponse({ status: 404, description: 'Booking or public profile not found' })
  @Post('send')
  @HttpCode(204)
  async send(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Body() dto: SendEmailDto,
  ) {
    await this.mail.send({
      userId: req.userId,
      bookingId,
      contactId: dto.contactId,
      to: dto.to,
      subject: dto.subject,
      body: dto.body,
      templateId: dto.templateId,
    });
  }
}
