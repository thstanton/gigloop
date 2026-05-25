import { Controller, Get, Param, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { DocumentResponseDto } from './dto/document-response.dto';
import type { Request } from 'express';

type AuthedRequest = Request & { userId: string };

@ApiTags('Documents')
@ApiBearerAuth('clerk-jwt')
@Controller('bookings/:bookingId/documents')
export class DocumentsController {
  constructor(private service: DocumentsService) {}

  @ApiOperation({ summary: 'List documents for a booking' })
  @ApiResponse({ status: 200, type: [DocumentResponseDto] })
  @Get()
  async findAll(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
  ): Promise<DocumentResponseDto[]> {
    const docs = await this.service.findByBooking(req.userId, bookingId);
    return docs.map((d) => ({
      id: d.id,
      createdAt: d.createdAt.toISOString(),
      type: d.type,
      url: d.url,
      invoiceId: d.invoiceId ?? null,
    }));
  }
}
