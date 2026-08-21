import { Body, Controller, Delete, Get, Header, HttpCode, NotFoundException, Param, Patch, Post, Req, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { InvoicesService } from './invoices.service';
import { InvoiceResponseDto, InvoiceLineItemResponseDto } from './dto/invoice-response.dto';
import { InvoiceDocumentResponseDto } from './dto/invoice-document-response.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { IssueInvoiceDto } from './dto/issue-invoice.dto';
import { SendInvoiceDto } from './dto/send-invoice.dto';
import { MarkSentDto } from './dto/mark-sent.dto';
import { MarkPaidDto } from './dto/mark-paid.dto';
import { CreateLineItemDto } from './dto/create-line-item.dto';
import { UpdateLineItemDto } from './dto/update-line-item.dto';

type AuthedRequest = Request & { userId: string };
type AuthedResponse = Response;

/**
 * Operations on an invoice that **already exists** (ADR-0069). The owner is read off the
 * invoice's own FK, never off the path, so one route serves a booking invoice and a series
 * invoice alike. Creation stays owner-scoped on `InvoicesController` and `SeriesController`:
 * before the invoice exists there is no FK to derive from, and the two creation paths
 * genuinely differ.
 *
 * The family grew in two stages: `GET`, `PATCH` and the three line-item routes (#844/#845),
 * then the nine duplicated lifecycle transitions plus payment-correction (#853), at which
 * point the two owner-scoped route families this superseded were removed — see ADR-0069.
 * `preview-number` never joins this family: it previews the number a not-yet-created invoice
 * would get, so it stays on the owner-scoped creation controllers (`InvoicesService.previewInvoiceNumber`
 * and `SeriesService.previewInvoiceNumber`).
 */
@ApiTags('Invoices')
@ApiBearerAuth('clerk-jwt')
@Controller('invoices')
export class InvoiceOperationsController {
  constructor(private service: InvoicesService) {}

  @ApiOperation({
    summary: 'Get an invoice by id, whichever owner it has',
    description:
      'Scoped by the JWT userId and nothing else. Resolves a series invoice (bookingId: null) ' +
      'as readily as a booking invoice, which the booking-scoped list route cannot do.',
  })
  @ApiResponse({ status: 200, type: InvoiceResponseDto })
  @ApiResponse({ status: 404, description: 'No invoice with that id belongs to the caller' })
  @Get(':id')
  findOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.findById(req.userId, id);
  }

  @ApiOperation({ summary: 'Update an invoice, whichever owner it has' })
  @ApiResponse({ status: 200, type: InvoiceResponseDto })
  @ApiResponse({ status: 400, description: 'Invoice is not a draft' })
  @ApiResponse({ status: 404, description: 'No invoice with that id belongs to the caller' })
  @Patch(':id')
  update(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: UpdateInvoiceDto) {
    return this.service.updateById(req.userId, id, dto);
  }

  @ApiOperation({ summary: 'Add a line item to an invoice, whichever owner it has' })
  @ApiResponse({ status: 201, type: InvoiceLineItemResponseDto })
  @ApiResponse({ status: 400, description: 'Invoice is not a draft' })
  @ApiResponse({ status: 404, description: 'No invoice with that id belongs to the caller' })
  @Post(':id/line-items')
  addLineItem(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: CreateLineItemDto) {
    return this.service.addLineItemById(req.userId, id, dto);
  }

  @ApiOperation({ summary: 'Update a line item on an invoice, whichever owner it has' })
  @ApiResponse({ status: 200, type: InvoiceLineItemResponseDto })
  @ApiResponse({ status: 400, description: 'Invoice is not a draft' })
  @ApiResponse({ status: 404, description: 'No such invoice or line item for the caller' })
  @Patch(':id/line-items/:itemId')
  updateLineItem(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateLineItemDto,
  ) {
    return this.service.updateLineItemById(req.userId, id, itemId, dto);
  }

  @ApiOperation({ summary: 'Remove a line item from an invoice, whichever owner it has' })
  @ApiResponse({ status: 204, description: 'Line item removed' })
  @ApiResponse({ status: 400, description: 'Invoice is not a draft' })
  @ApiResponse({ status: 404, description: 'No such invoice or line item for the caller' })
  @Delete(':id/line-items/:itemId')
  @HttpCode(204)
  deleteLineItem(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.service.deleteLineItemById(req.userId, id, itemId);
  }

  // ─── Lifecycle transitions (#853) ──────────────────────────────────────────

  @ApiOperation({ summary: 'Issue a draft invoice: assign number, lock line items, store PDF — whichever owner it has' })
  @ApiResponse({ status: 200, description: 'Invoice issued (ISSUED status)', type: InvoiceResponseDto })
  @ApiResponse({ status: 400, description: 'Invoice is not a draft, or the draft has no line items' })
  @ApiResponse({ status: 404, description: 'No invoice with that id belongs to the caller' })
  @Post(':id/issue')
  @HttpCode(200)
  issue(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: IssueInvoiceDto) {
    return this.service.issueById(req.userId, id, dto);
  }

  @ApiOperation({ summary: 'Send an invoice email and mark it Sent — whichever owner it has' })
  @ApiResponse({ status: 204, description: 'Invoice sent and marked Sent' })
  @ApiResponse({ status: 400, description: 'Invoice is not issued' })
  @ApiResponse({ status: 404, description: 'No invoice with that id belongs to the caller' })
  @Post(':id/send')
  @HttpCode(204)
  send(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: SendInvoiceDto) {
    return this.service.sendById(req.userId, id, dto);
  }

  @ApiOperation({ summary: 'Mark an invoice as sent without emailing — whichever owner it has' })
  @ApiResponse({ status: 200, description: 'Invoice marked Sent', type: InvoiceResponseDto })
  @ApiResponse({ status: 400, description: 'Invoice is not issued' })
  @ApiResponse({ status: 404, description: 'No invoice with that id belongs to the caller' })
  @Post(':id/mark-sent')
  @HttpCode(200)
  markSent(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: MarkSentDto) {
    return this.service.markSentById(req.userId, id, dto);
  }

  @ApiOperation({ summary: 'Mark an invoice as paid, recording the date received and an optional reference — whichever owner it has' })
  @ApiResponse({ status: 200, description: 'Invoice marked Paid; paidAt set to the received date. A paid deposit or balance invoice auto-completes its checklist received step', type: InvoiceResponseDto })
  @ApiResponse({ status: 400, description: 'Invoice is not sent, or the payment date is missing/unparseable' })
  @ApiResponse({ status: 404, description: 'No invoice with that id belongs to the caller' })
  @Post(':id/mark-paid')
  @HttpCode(200)
  markPaid(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: MarkPaidDto) {
    return this.service.markPaidById(req.userId, id, dto);
  }

  @ApiOperation({ summary: 'Correct the recorded payment (date + reference) on a paid invoice — whichever owner it has' })
  @ApiResponse({ status: 200, description: 'Payment corrected; invoice stays Paid, document unchanged', type: InvoiceResponseDto })
  @ApiResponse({ status: 400, description: 'Invoice is not paid, or the payment date is missing/unparseable' })
  @ApiResponse({ status: 404, description: 'No invoice with that id belongs to the caller' })
  @Patch(':id/payment')
  correctPayment(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: MarkPaidDto) {
    return this.service.correctPaymentById(req.userId, id, dto);
  }

  @ApiOperation({ summary: 'Void an invoice (SENT or PAID only; drafts must be deleted) — whichever owner it has' })
  @ApiResponse({ status: 200, description: 'Invoice voided', type: InvoiceResponseDto })
  @ApiResponse({ status: 400, description: 'Invoice is a draft or already void' })
  @ApiResponse({ status: 404, description: 'No invoice with that id belongs to the caller' })
  @Post(':id/void')
  @HttpCode(200)
  voidInvoice(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.voidInvoiceById(req.userId, id);
  }

  @ApiOperation({ summary: 'Delete a draft invoice — whichever owner it has' })
  @ApiResponse({ status: 204, description: 'Invoice deleted' })
  @ApiResponse({ status: 400, description: 'Invoice is not a draft' })
  @ApiResponse({ status: 404, description: 'No invoice with that id belongs to the caller' })
  @Delete(':id')
  @HttpCode(204)
  delete(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.deleteById(req.userId, id);
  }

  @ApiOperation({ summary: 'Preview invoice PDF — whichever owner it has' })
  @ApiResponse({ status: 200, description: 'PDF stream' })
  @ApiResponse({ status: 404, description: 'No invoice with that id belongs to the caller' })
  @Get(':id/preview.pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'inline; filename="invoice-preview.pdf"')
  async previewPdf(@Req() req: AuthedRequest, @Param('id') id: string, @Res() res: AuthedResponse) {
    const buffer = await this.service.generatePreviewPdfById(req.userId, id);
    res.end(buffer);
  }

  @ApiOperation({
    summary: 'Get the stored PDF document for an issued invoice — whichever owner it has',
    description:
      'How the client discovers a stored document\'s id and the shared access-controlled ' +
      '/documents/:id/download route (ADR-0059) — most useful for a series invoice, which ' +
      'appears in no booking document list because it has no bookingId (#830).',
  })
  @ApiResponse({ status: 200, type: InvoiceDocumentResponseDto })
  @ApiResponse({ status: 404, description: 'No stored PDF for this invoice — it belongs to another tenant, does not exist, or is still a DRAFT' })
  @Get(':id/document')
  async getDocument(@Req() req: AuthedRequest, @Param('id') id: string): Promise<InvoiceDocumentResponseDto> {
    const doc = await this.service.getDocumentById(req.userId, id);
    // A DRAFT has no stored PDF yet. 404 (rather than a null body) so the client's
    // apiGetNullable resolves it to null without a second shape to handle.
    if (!doc) throw new NotFoundException('No stored PDF for this invoice');
    return { id: doc.id, createdAt: doc.createdAt.toISOString(), url: doc.url };
  }
}
