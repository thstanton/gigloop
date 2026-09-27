import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { isEnabled } from '../common/featureFlags';
import { BandCommunicationsService } from './band-communications.service';
import { RenderBandInviteQueryDto } from './dto/render-band-invite-query.dto';
import { SendBandInviteDto } from './dto/send-band-invite.dto';
import { SendBandCallSheetDto } from './dto/send-band-call-sheet.dto';
import { SendBandFinalDetailsDto } from './dto/send-band-final-details.dto';
import type { Request } from 'express';

type AuthedRequest = Request & { userId: string };

function assertBandMembersEnabled() {
  if (!isEnabled('FEATURE_BAND_MEMBERS')) throw new NotFoundException();
}

@ApiTags('Band communications')
@ApiBearerAuth('clerk-jwt')
@Controller('bookings/:bookingId/band-members/:memberId')
export class BandCommunicationsController {
  constructor(private readonly service: BandCommunicationsService) {}

  @ApiOperation({ summary: 'Render the band invitation email for one member' })
  @ApiResponse({
    status: 200,
    description: 'Rendered subject and body for the member-specific invitation compose sheet',
    schema: {
      properties: {
        subject: { type: 'string' },
        body: { type: 'string' },
        missingVariables: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'The template ID is invalid' })
  @ApiResponse({ status: 404, description: 'Band member or invitation template not found' })
  @Get('invite/render')
  render(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Param('memberId') memberId: string,
    @Query() query: RenderBandInviteQueryDto,
  ) {
    assertBandMembersEnabled();
    return this.service.renderInvite(req.userId, bookingId, memberId, query.templateId);
  }

  @ApiOperation({ summary: 'Render the plain-text band invitation message for one member' })
  @ApiResponse({
    status: 200,
    description: 'Rendered plain-text invitation message for copying and pasting',
    schema: {
      properties: {
        body: { type: 'string' },
        missingVariables: { type: 'array', items: { type: 'string' } },
      },
    },
  })
  @ApiResponse({ status: 400, description: 'The template ID is invalid' })
  @ApiResponse({ status: 404, description: 'Band member or invitation message template not found' })
  @Get('invite/message/render')
  renderMessage(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Param('memberId') memberId: string,
    @Query() query: RenderBandInviteQueryDto,
  ) {
    assertBandMembersEnabled();
    return this.service.renderInviteMessage(req.userId, bookingId, memberId, query.templateId);
  }

  @ApiOperation({ summary: 'Send the composed band invitation email and calendar attachment to one member' })
  @ApiResponse({ status: 204, description: 'Invitation sent, communication logged, and member marked invited' })
  @ApiResponse({ status: 400, description: 'The member has no email address or the request body is invalid' })
  @ApiResponse({ status: 404, description: 'Booking, member, or band invitation template not found' })
  @Post('invite/send')
  @HttpCode(204)
  async send(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Param('memberId') memberId: string,
    @Body() dto: SendBandInviteDto,
  ): Promise<void> {
    assertBandMembersEnabled();
    await this.service.sendInvite(req.userId, bookingId, memberId, dto);
  }

  @ApiOperation({ summary: 'Render the call-sheet email for one band member' })
  @ApiResponse({ status: 200, description: 'Rendered subject, body and missing variables' })
  @ApiResponse({ status: 400, description: 'The template ID is invalid' })
  @ApiResponse({ status: 404, description: 'Band member or call-sheet template not found' })
  @Get('call-sheet/render')
  renderCallSheet(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Param('memberId') memberId: string,
    @Query() query: RenderBandInviteQueryDto,
  ) {
    assertBandMembersEnabled();
    return this.service.renderCallSheet(req.userId, bookingId, memberId, query.templateId);
  }

  @ApiOperation({ summary: 'Render the plain-text call-sheet message for one band member' })
  @ApiResponse({ status: 200, description: 'Rendered plain-text message and missing variables' })
  @ApiResponse({ status: 400, description: 'The template ID is invalid' })
  @ApiResponse({ status: 404, description: 'Band member or call-sheet message template not found' })
  @Get('call-sheet/message/render')
  renderCallSheetMessage(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Param('memberId') memberId: string,
    @Query() query: RenderBandInviteQueryDto,
  ) {
    assertBandMembersEnabled();
    return this.service.renderCallSheetMessage(req.userId, bookingId, memberId, query.templateId);
  }

  @ApiOperation({ summary: 'Send a member-specific call-sheet email with its PDF attachment' })
  @ApiResponse({ status: 204, description: 'Call sheet sent and logged with its stored document' })
  @ApiResponse({ status: 400, description: 'The member has no email address or the request body is invalid' })
  @ApiResponse({ status: 404, description: 'Booking, member, or call-sheet template not found' })
  @Post('call-sheet/send')
  @HttpCode(204)
  async sendCallSheet(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Param('memberId') memberId: string,
    @Body() dto: SendBandCallSheetDto,
  ): Promise<void> {
    assertBandMembersEnabled();
    await this.service.sendCallSheet(req.userId, bookingId, memberId, dto);
  }

  @ApiOperation({ summary: 'Render final-details email for one band member' })
  @ApiResponse({ status: 200, description: 'Rendered subject, body and missing variables' })
  @ApiResponse({ status: 400, description: 'The template ID is invalid' })
  @ApiResponse({ status: 404, description: 'Band member or final-details template not found' })
  @Get('final-details/render')
  renderFinalDetails(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Param('memberId') memberId: string,
    @Query() query: RenderBandInviteQueryDto,
  ) {
    assertBandMembersEnabled();
    return this.service.renderFinalDetails(req.userId, bookingId, memberId, query.templateId);
  }

  @ApiOperation({ summary: 'Render plain-text final details for one band member' })
  @ApiResponse({ status: 200, description: 'Rendered plain-text message and missing variables' })
  @ApiResponse({ status: 400, description: 'The template ID is invalid' })
  @ApiResponse({ status: 404, description: 'Band member or final-details message template not found' })
  @Get('final-details/message/render')
  renderFinalDetailsMessage(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Param('memberId') memberId: string,
    @Query() query: RenderBandInviteQueryDto,
  ) {
    assertBandMembersEnabled();
    return this.service.renderFinalDetailsMessage(req.userId, bookingId, memberId, query.templateId);
  }

  @ApiOperation({ summary: 'Send final-details email to one band member' })
  @ApiResponse({ status: 204, description: 'Final details sent and communication logged' })
  @ApiResponse({ status: 400, description: 'The member has no email address or the request body is invalid' })
  @ApiResponse({ status: 404, description: 'Booking, member, or final-details template not found' })
  @Post('final-details/send')
  @HttpCode(204)
  async sendFinalDetails(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Param('memberId') memberId: string,
    @Body() dto: SendBandFinalDetailsDto,
  ): Promise<void> {
    assertBandMembersEnabled();
    await this.service.sendFinalDetails(req.userId, bookingId, memberId, dto);
  }
}
