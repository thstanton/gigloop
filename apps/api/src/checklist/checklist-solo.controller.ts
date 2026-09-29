import { Controller, HttpCode, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { isEnabled } from '../common/featureFlags';
import { ChecklistSoloService } from './checklist-solo.service';

type AuthedRequest = Request & { userId: string };

@ApiTags('Bookings')
@ApiBearerAuth('clerk-jwt')
@Controller('bookings/:bookingId/checklist')
export class ChecklistSoloController {
  constructor(private readonly service: ChecklistSoloService) {}

  @ApiOperation({ summary: 'Skip this booking’s band goals and disable both band defaults' })
  @ApiResponse({ status: 200, schema: { example: { success: true } } })
  @ApiResponse({ status: 404, description: 'Booking or band checklist goal not found.' })
  @Post('solo')
  @HttpCode(200)
  async playSolo(@Req() req: AuthedRequest, @Param('bookingId') bookingId: string) {
    if (!isEnabled('FEATURE_BAND_MEMBERS')) throw new NotFoundException();
    const succeeded = await this.service.playSolo(req.userId, bookingId);
    if (!succeeded) throw new NotFoundException('Band checklist goal not found');
    return { success: true };
  }
}
