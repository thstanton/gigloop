import { Body, Controller, Get, HttpCode, NotFoundException, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { isEnabled } from '../common/featureFlags';
import { BandCommunicationsService } from './band-communications.service';
import { RenderBandInviteQueryDto } from './dto/render-band-invite-query.dto';
import { SendBandInviteDto } from './dto/send-band-invite.dto';
import type { Request } from 'express';

type AuthedRequest = Request & { userId: string };

function assertBandMembersEnabled() {
  if (!isEnabled('FEATURE_BAND_MEMBERS')) throw new NotFoundException();
}

@ApiTags('Band communications')
@ApiBearerAuth('clerk-jwt')
@Controller('bookings/:bookingId/band-members/:memberId/invite')
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
  @Get('render')
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
  @Get('message/render')
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
  @Post('send')
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
}
