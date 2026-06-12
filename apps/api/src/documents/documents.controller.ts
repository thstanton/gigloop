import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DocumentsService } from './documents.service';
import { DocumentResponseDto } from './dto/document-response.dto';
import type { Request } from 'express';

type AuthedRequest = Request & { userId: string };

// Minimal shape of the Multer file object; avoids requiring @types/multer
interface MulterFile { buffer: Buffer; mimetype: string; }

const MAX_PDF_SIZE = 10 * 1024 * 1024;

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
      contractStatus: d.type === 'CONTRACT' ? (d.contract?.status ?? null) : null,
      name: d.name ?? null,
    }));
  }

  @ApiOperation({ summary: 'Upload a PDF document to a booking' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'name'],
      properties: {
        file: { type: 'string', format: 'binary' },
        name: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 201, type: DocumentResponseDto })
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_PDF_SIZE },
      fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'application/pdf') {
          cb(new BadRequestException('Only PDF files are accepted'), false);
        } else {
          cb(null, true);
        }
      },
    }),
  )
  async upload(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @UploadedFile() file: MulterFile,
  ): Promise<DocumentResponseDto> {
    if (!file) throw new BadRequestException('file is required');
    const name: string = (req.body as { name?: string }).name?.trim() ?? '';
    if (!name) throw new BadRequestException('name is required');
    const doc = await this.service.uploadDocument(req.userId, bookingId, file.buffer, name);
    return {
      id: doc.id,
      createdAt: doc.createdAt.toISOString(),
      type: doc.type,
      url: doc.url,
      invoiceId: null,
      contractStatus: null,
      name: doc.name ?? null,
    };
  }

  @ApiOperation({ summary: 'Delete an uploaded document' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 403, description: 'System-generated documents cannot be deleted' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  @Delete(':id')
  @HttpCode(204)
  async remove(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
  ): Promise<void> {
    await this.service.deleteDocument(req.userId, id);
  }
}
