import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DocumentsRepository } from './documents.repository';
import { DocumentsService } from './documents.service';
import { PdfService } from './pdf.service';

@Module({
  imports: [PrismaModule],
  providers: [DocumentsRepository, DocumentsService, PdfService],
  exports: [DocumentsService, PdfService],
})
export class DocumentsModule {}
