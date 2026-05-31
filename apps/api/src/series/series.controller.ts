import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SeriesService } from './series.service';
import { SendInvoiceDto } from '../invoices/dto/send-invoice.dto';
import { MarkSentDto } from '../invoices/dto/mark-sent.dto';
import type { Request } from 'express';

type AuthedRequest = Request & { userId: string };

@ApiTags('Series')
@ApiBearerAuth('clerk-jwt')
@Controller('series')
export class SeriesController {
  constructor(private service: SeriesService) {}

  @ApiOperation({ summary: 'List all booking series' })
  @Get()
  findAll(@Req() req: AuthedRequest) {
    return this.service.findAll(req.userId);
  }

  @ApiOperation({ summary: 'Get a series by ID' })
  @Get(':id')
  findOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.findOne(req.userId, id);
  }

  @ApiOperation({ summary: 'Create a series invoice with auto-generated line items' })
  @Post(':id/invoices')
  createInvoice(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.createInvoice(req.userId, id);
  }

  @ApiOperation({ summary: 'Get the active (non-VOID) series invoice' })
  @Get(':id/invoices/current')
  getActiveInvoice(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.getActiveInvoice(req.userId, id);
  }

  @ApiOperation({ summary: 'Send a series invoice by email' })
  @Post(':id/invoices/:invoiceId/send')
  sendInvoice(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: SendInvoiceDto,
  ) {
    return this.service.sendInvoice(req.userId, id, invoiceId, dto);
  }

  @ApiOperation({ summary: 'Mark a series invoice as sent without emailing' })
  @Post(':id/invoices/:invoiceId/mark-sent')
  markSentInvoice(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: MarkSentDto,
  ) {
    return this.service.markSentInvoice(req.userId, id, invoiceId, dto);
  }

  @ApiOperation({ summary: 'Void a series invoice' })
  @Post(':id/invoices/:invoiceId/void')
  @HttpCode(200)
  voidInvoice(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.service.voidInvoice(req.userId, id, invoiceId);
  }

  @ApiOperation({ summary: 'Delete a DRAFT series invoice' })
  @Delete(':id/invoices/:invoiceId')
  @HttpCode(204)
  deleteInvoice(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.service.deleteInvoice(req.userId, id, invoiceId);
  }
}
