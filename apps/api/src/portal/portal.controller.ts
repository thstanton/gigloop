import { Controller, Get, Post, HttpCode, Param, Body, Req, Redirect } from '@nestjs/common';
import { ApiTags, ApiResponse } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../auth/public.decorator';
import { PortalService } from './portal.service';
import { SignContractDto } from './dto/sign-contract.dto';
import { SubmitMusicFormDto } from './dto/submit-music-form.dto';

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

  @Get('music')
  @ApiResponse({ status: 200, description: 'Music form config, song library, and existing response' })
  @ApiResponse({ status: 404, description: 'Booking or music form not found' })
  getMusicFormData(@Param('token') token: string) {
    return this.service.getMusicFormData(token);
  }

  @Post('music')
  @HttpCode(201)
  @ApiResponse({ status: 201, description: 'Music form submitted' })
  @ApiResponse({ status: 404, description: 'Booking or music form not found' })
  submitMusicForm(
    @Param('token') token: string,
    @Body() dto: SubmitMusicFormDto,
  ) {
    return this.service.submitMusicForm(token, dto);
  }

  // Access-controlled document download (ADR-0059, #655). The portalToken in the
  // path is the auth, so a top-level navigation is sufficient and we 302 to the
  // resolved storage URL. Only serves a doc that belongs to this booking and
  // passes the portal-visibility rules; otherwise 404.
  @Get('documents/:id')
  @Redirect()
  @ApiResponse({ status: 302, description: 'Redirect to the document storage URL' })
  @ApiResponse({ status: 404, description: 'Document not found or not visible to this portal' })
  async downloadDocument(@Param('token') token: string, @Param('id') id: string) {
    const url = await this.service.resolvePortalDocumentUrl(token, id);
    return { url, statusCode: 302 };
  }

  // Signed-contract variant — resolves the booking's signed contract without its id.
  @Get('signed-contract')
  @Redirect()
  @ApiResponse({ status: 302, description: 'Redirect to the signed contract storage URL' })
  @ApiResponse({ status: 404, description: 'Signed contract not found or not visible' })
  async downloadSignedContract(@Param('token') token: string) {
    const url = await this.service.resolvePortalSignedContractUrl(token);
    return { url, statusCode: 302 };
  }
}
