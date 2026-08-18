import { Body, Controller, Delete, Get, Header, HttpCode, NotFoundException, Param, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SeriesService } from './series.service';
import { SendInvoiceDto } from '../invoices/dto/send-invoice.dto';
import { MarkSentDto } from '../invoices/dto/mark-sent.dto';
import { MarkPaidDto } from '../invoices/dto/mark-paid.dto';
import { IssueInvoiceDto } from '../invoices/dto/issue-invoice.dto';
import { InvoiceResponseDto } from '../invoices/dto/invoice-response.dto';
import { SeriesInvoiceDocumentResponseDto } from './dto/series-invoice-document-response.dto';
import type { Request, Response } from 'express';

type AuthedRequest = Request & { userId: string };
type AuthedResponse = Response;

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

  @ApiOperation({ summary: 'List all bookings in a series' })
  @ApiResponse({ status: 200, description: 'Booking list items for the series, ordered by date ascending' })
  @ApiResponse({ status: 404, description: 'Series not found' })
  @Get(':id/bookings')
  getBookings(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.getBookings(req.userId, id);
  }

  @ApiOperation({ summary: 'Create a series invoice with auto-generated line items' })
  @ApiResponse({ status: 201, type: InvoiceResponseDto })
  @Post(':id/invoices')
  createInvoice(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.createInvoice(req.userId, id);
  }

  @ApiOperation({ summary: 'Preview the invoice number that will be assigned on send (dry-run, no allocation)' })
  @ApiResponse({ status: 200, description: '{ invoiceNumber: string; willReuse: boolean }' })
  @Get(':id/invoices/preview-number')
  previewInvoiceNumber(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.previewInvoiceNumber(req.userId, id);
  }

  @ApiOperation({ summary: 'Get the active (non-VOID) series invoice; 404 when none exists' })
  @ApiResponse({ status: 200, type: InvoiceResponseDto })
  @ApiResponse({ status: 404, description: 'No active series invoice' })
  @Get(':id/invoices/current')
  async getActiveInvoice(@Req() req: AuthedRequest, @Param('id') id: string) {
    const invoice = await this.service.getActiveInvoice(req.userId, id);
    if (!invoice) throw new NotFoundException('No active series invoice');
    return invoice;
  }

  @ApiOperation({ summary: 'Issue a series draft invoice (assign number, lock line items, store PDF)' })
  @ApiResponse({ status: 200, description: 'Invoice issued successfully', type: InvoiceResponseDto })
  @ApiResponse({ status: 400, description: 'Invoice is not in DRAFT status' })
  @ApiResponse({ status: 404, description: 'Series or invoice not found' })
  @Post(':id/invoices/:invoiceId/issue')
  @HttpCode(200)
  issueInvoice(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: IssueInvoiceDto,
  ) {
    return this.service.issueInvoice(req.userId, id, invoiceId, dto);
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
  @ApiResponse({ status: 201, type: InvoiceResponseDto })
  @Post(':id/invoices/:invoiceId/mark-sent')
  markSentInvoice(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: MarkSentDto,
  ) {
    return this.service.markSentInvoice(req.userId, id, invoiceId, dto);
  }

  @ApiOperation({ summary: 'Mark a series invoice as paid, recording the date received and an optional reference' })
  @ApiResponse({ status: 200, type: InvoiceResponseDto })
  @ApiResponse({ status: 400, description: 'Invoice is not sent, or the payment date is missing/unparseable' })
  @Post(':id/invoices/:invoiceId/mark-paid')
  @HttpCode(200)
  markPaidInvoice(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: MarkPaidDto,
  ) {
    return this.service.markPaidInvoice(req.userId, id, invoiceId, dto);
  }

  @ApiOperation({ summary: 'Void a series invoice' })
  @ApiResponse({ status: 200, type: InvoiceResponseDto })
  @Post(':id/invoices/:invoiceId/void')
  @HttpCode(200)
  voidInvoice(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.service.voidInvoice(req.userId, id, invoiceId);
  }

  @ApiOperation({
    summary: 'Preview a series invoice PDF (regenerated from live data — for DRAFTs)',
    description:
      'Renders the invoice as it stands right now. Once issued, the stored PDF is the ' +
      'authority — use the document endpoint so the musician sees exactly what the client got.',
  })
  @ApiResponse({ status: 200, description: 'PDF stream' })
  @ApiResponse({ status: 404, description: 'Series or invoice not found' })
  @Get(':id/invoices/:invoiceId/preview.pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'inline; filename="series-invoice-preview.pdf"')
  async previewInvoicePdf(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('invoiceId') invoiceId: string,
    @Res() res: AuthedResponse,
  ) {
    const buffer = await this.service.generateInvoicePreviewPdf(req.userId, id, invoiceId);
    res.end(buffer);
  }

  @ApiOperation({
    summary: 'Get the stored PDF document for an issued series invoice',
    description:
      'A series invoice document has no bookingId, so it appears in no booking document list ' +
      '(#830). This is how the client discovers its id and the /documents/:id/download route.',
  })
  @ApiResponse({ status: 200, type: SeriesInvoiceDocumentResponseDto })
  @ApiResponse({ status: 404, description: 'Series/invoice not found, or the invoice is still a DRAFT (no PDF yet)' })
  @Get(':id/invoices/:invoiceId/document')
  async getInvoiceDocument(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('invoiceId') invoiceId: string,
  ): Promise<SeriesInvoiceDocumentResponseDto> {
    const doc = await this.service.getInvoiceDocument(req.userId, id, invoiceId);
    // A DRAFT has no stored PDF yet. 404 (rather than a null body) so the client's
    // apiGetNullable resolves it to null without a second shape to handle.
    if (!doc) throw new NotFoundException('No stored PDF for this invoice');
    return { id: doc.id, createdAt: doc.createdAt.toISOString(), url: doc.url };
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
