import { Controller, Get, Param, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { DocumentsService } from './documents.service';
import { DocumentDownloadResponseDto } from './dto/document-download-response.dto';

type AuthedRequest = Request & { userId: string };

// Access-controlled download for a single document, keyed by document id rather
// than nested under a booking (ADR-0059, #654). Clerk-guarded by the global
// AuthGuard and scoped to the caller's own documents; another user's id → 404.
// Returns the resolved storage URL (not a 302) because the admin client fetches
// this with the Clerk JWT in a header — a top-level redirect could not carry it.
@ApiTags('Documents')
@ApiBearerAuth('clerk-jwt')
@Controller('documents')
export class DocumentDownloadController {
  constructor(private service: DocumentsService) {}

  @ApiOperation({ summary: "Resolve a fetchable URL for the caller's own document" })
  @ApiResponse({ status: 200, type: DocumentDownloadResponseDto })
  @ApiResponse({ status: 404, description: 'Document not found or not owned by the caller' })
  @Get(':id/download')
  download(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
  ): Promise<DocumentDownloadResponseDto> {
    return this.service.resolveDownloadTarget(req.userId, id);
  }
}
