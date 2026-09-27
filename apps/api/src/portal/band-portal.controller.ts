import { Body, Controller, Get, Header, NotFoundException, Param, Post, Res } from '@nestjs/common';
import { ApiTags, ApiResponse } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../auth/public.decorator';
import { isEnabled } from '../common/featureFlags';
import { BandPortalService } from './band-portal.service';
import { BandRespondDto } from './dto/band-respond.dto';

// Band members v1 (#891). Gated on FEATURE_BAND_MEMBERS, default-off — matches
// lineups.controller.ts / bookings.controller.ts: every route 404s with the flag off, so the band
// portal is unreachable until the feature goes live (ADR-0072).
function assertEnabled() {
  if (!isEnabled('FEATURE_BAND_MEMBERS')) throw new NotFoundException();
}

// The dep-facing band portal (#891, ADR-0073) — `/band/:token` validates a
// `BookingBandMember.bandPortalToken`, bypassing Clerk exactly as `/booking/:token` does
// (`portal.controller.ts`).
@ApiTags('band-portal')
@Public()
@Controller('band/:token')
export class BandPortalController {
  constructor(private service: BandPortalService) {}

  @Get()
  @ApiResponse({ status: 200, description: 'Band portal data (roster projection, ADR-0073)' })
  @ApiResponse({ status: 404, description: 'Unknown or removed band member token' })
  getBandPortalData(@Param('token') token: string) {
    assertEnabled();
    return this.service.getBandPortalData(token);
  }

  @Post('respond')
  @ApiResponse({ status: 200, description: "Updated band portal data reflecting the dep's answer" })
  @ApiResponse({ status: 400, description: 'Invite already answered, or the booking is cancelled' })
  @ApiResponse({ status: 404, description: 'Unknown or removed band member token' })
  respondToInvite(@Param('token') token: string, @Body() dto: BandRespondDto) {
    assertEnabled();
    return this.service.respondToInvite(token, dto.response);
  }

  // The call sheet (#893, ADR-0073 §4) — generated on demand and streamed directly, never a
  // redirect to a stored object: there is nothing stored to redirect to. No `Document` row is
  // created by a download; only a send (#881) creates one.
  @Get('call-sheet')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'inline; filename="call-sheet.pdf"')
  @ApiResponse({ status: 200, description: 'Call sheet PDF, generated on demand' })
  @ApiResponse({ status: 404, description: 'Unknown or removed band member token, or the booking is cancelled' })
  async downloadCallSheet(@Param('token') token: string, @Res() res: Response) {
    assertEnabled();
    const buffer = await this.service.getCallSheetPdfBuffer(token);
    res.end(buffer);
  }
}
