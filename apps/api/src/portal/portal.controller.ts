import { Controller, Get, Post, Param, Body, Req } from '@nestjs/common';
import { ApiTags, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../auth/public.decorator';
import { PortalService } from './portal.service';
import { SignContractDto } from './dto/sign-contract.dto';

@ApiTags('portal')
@Public()
@Controller('booking/:token')
export class PortalController {
  constructor(private service: PortalService) {}

  @Get()
  @ApiResponse({ status: 200, description: 'Booking portal data' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  getBookingData(@Param('token') token: string) {
    return this.service.getBookingData(token);
  }

  @Get('contract')
  @ApiResponse({ status: 200, description: 'Contract content (Tiptap JSON) with title' })
  @ApiResponse({ status: 400, description: 'already_signed' })
  @ApiResponse({ status: 404, description: 'Booking or template not found' })
  getContractContent(@Param('token') token: string) {
    return this.service.getContractContent(token);
  }

  @Post('sign')
  @ApiResponse({ status: 201, description: 'Contract signed' })
  @ApiResponse({ status: 400, description: 'Contract already signed' })
  @ApiResponse({ status: 404, description: 'Booking not found' })
  signContract(
    @Param('token') token: string,
    @Body() dto: SignContractDto,
    @Req() req: Request,
  ) {
    return this.service.signContract(token, dto.signature, req);
  }
}
