import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { IssueInvoiceDto } from './dto/issue-invoice.dto';
import { PreviewInvoiceNumberQuery } from './dto/preview-invoice-number.query';
import { SendInvoiceDto } from './dto/send-invoice.dto';
import { MarkSentDto } from './dto/mark-sent.dto';
import { CreateLineItemDto } from './dto/create-line-item.dto';
import { UpdateLineItemDto } from './dto/update-line-item.dto';
import type { Request } from 'express';

type AuthedRequest = Request & { userId: string };
type AuthedResponse = Response;

@ApiTags('Invoices')
@ApiBearerAuth('clerk-jwt')
@Controller('bookings/:bookingId/invoices')
export class InvoicesController {
  constructor(private service: InvoicesService) {}

  @ApiOperation({ summary: 'List invoices for a booking' })
  @Get()
  findAll(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
  ) {
    return this.service.findAll(req.userId, bookingId);
  }

  @ApiOperation({ summary: 'Preview the invoice number that will be assigned on issue (dry-run, no allocation)' })
  @ApiResponse({ status: 200, description: '{ invoiceNumber: string; willReuse: boolean }' })
  @Get('preview-number')
  previewNumber(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Query() query: PreviewInvoiceNumberQuery,
  ) {
    return this.service.previewInvoiceNumber(req.userId, bookingId, query.isDeposit);
  }

  @ApiOperation({ summary: 'Get an invoice by ID' })
  @Get(':id')
  findOne(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Param('id') id: string,
  ) {
    return this.service.findOne(req.userId, bookingId, id);
  }

  @ApiOperation({ summary: 'Create an invoice for a booking' })
  @Post()
  create(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.service.create(req.userId, bookingId, dto);
  }

  @ApiOperation({ summary: 'Update an invoice' })
  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.service.update(req.userId, bookingId, id, dto);
  }

  @ApiOperation({ summary: 'Issue a draft invoice: assign number, lock line items, store PDF' })
  @ApiResponse({ status: 200, description: 'Invoice issued (ISSUED status)' })
  @ApiResponse({ status: 400, description: 'Invoice is not a draft' })
  @Post(':id/issue')
  issue(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Param('id') id: string,
    @Body() dto: IssueInvoiceDto,
  ) {
    return this.service.issue(req.userId, bookingId, id, dto);
  }

  @ApiOperation({ summary: 'Send an invoice email and mark it Sent' })
  @ApiResponse({ status: 204, description: 'Invoice sent and marked Sent' })
  @ApiResponse({ status: 400, description: 'Invoice is not issued (or draft for series)' })
  @Post(':id/send')
  @HttpCode(204)
  send(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Param('id') id: string,
    @Body() dto: SendInvoiceDto,
  ) {
    return this.service.send(req.userId, bookingId, id, dto);
  }

  @ApiOperation({ summary: 'Mark an invoice as sent without emailing' })
  @ApiResponse({ status: 200, description: 'Invoice marked Sent' })
  @ApiResponse({ status: 400, description: 'Invoice is not a draft' })
  @Post(':id/mark-sent')
  markSent(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Param('id') id: string,
    @Body() dto: MarkSentDto,
  ) {
    return this.service.markSent(req.userId, bookingId, id, dto);
  }

  @ApiOperation({ summary: 'Void an invoice (SENT or PAID only; drafts must be deleted)' })
  @ApiResponse({ status: 200, description: 'Invoice voided' })
  @ApiResponse({ status: 400, description: 'Invoice is a draft or already void' })
  @Post(':id/void')
  voidInvoice(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Param('id') id: string,
  ) {
    return this.service.voidInvoice(req.userId, bookingId, id);
  }

  @ApiOperation({ summary: 'Mark an invoice as paid' })
  @ApiResponse({ status: 200, description: 'Invoice marked Paid; depositReceivedAt set if deposit invoice with INVOICE tracking mode' })
  @ApiResponse({ status: 400, description: 'Invoice is not sent' })
  @Post(':id/mark-paid')
  markPaid(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Param('id') id: string,
  ) {
    return this.service.markPaid(req.userId, bookingId, id);
  }

  @ApiOperation({ summary: 'Delete an invoice' })
  @Delete(':id')
  @HttpCode(204)
  delete(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Param('id') id: string,
  ) {
    return this.service.delete(req.userId, bookingId, id);
  }

  @ApiOperation({ summary: 'Add a line item to an invoice' })
  @Post(':id/line-items')
  addLineItem(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Param('id') id: string,
    @Body() dto: CreateLineItemDto,
  ) {
    return this.service.addLineItem(req.userId, bookingId, id, dto);
  }

  @ApiOperation({ summary: 'Update a line item' })
  @Patch(':id/line-items/:itemId')
  updateLineItem(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateLineItemDto,
  ) {
    return this.service.updateLineItem(req.userId, bookingId, id, itemId, dto);
  }

  @ApiOperation({ summary: 'Remove a line item from an invoice' })
  @Delete(':id/line-items/:itemId')
  @HttpCode(204)
  deleteLineItem(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ) {
    return this.service.deleteLineItem(req.userId, bookingId, id, itemId);
  }

  @ApiOperation({ summary: 'Preview invoice PDF' })
  @ApiResponse({ status: 200, description: 'PDF stream' })
  @Get(':id/preview.pdf')
  @Header('Content-Type', 'application/pdf')
  @Header('Content-Disposition', 'inline; filename="invoice-preview.pdf"')
  async previewPdf(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Param('id') id: string,
    @Res() res: AuthedResponse,
  ) {
    const buffer = await this.service.generatePreviewPdf(req.userId, bookingId, id);
    res.end(buffer);
  }
}
