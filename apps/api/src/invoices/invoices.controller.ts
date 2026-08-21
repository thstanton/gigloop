import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { PreviewInvoiceNumberQuery } from './dto/preview-invoice-number.query';
import { InvoiceResponseDto } from './dto/invoice-response.dto';
import type { Request } from 'express';

type AuthedRequest = Request & { userId: string };

/**
 * Creation and booking-scoped reads only (ADR-0069, #853). Every operation on an invoice that
 * already exists — GET/PATCH by id, line items, and all nine lifecycle transitions plus
 * payment-correction — lives on `InvoiceOperationsController` (`/invoices/:id/...`), owner read
 * off the invoice itself. What stays here genuinely needs the booking in the path: listing all
 * of a booking's invoices, creating one (no invoice exists yet to derive an owner from), and
 * previewing the number a not-yet-created invoice would get (also no invoice yet — see
 * `InvoicesService.previewInvoiceNumber` and its series twin on `SeriesService`).
 */
@ApiTags('Invoices')
@ApiBearerAuth('clerk-jwt')
@Controller('bookings/:bookingId/invoices')
export class InvoicesController {
  constructor(private service: InvoicesService) {}

  @ApiOperation({ summary: 'List invoices for a booking' })
  @ApiResponse({ status: 200, type: [InvoiceResponseDto] })
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

  @ApiOperation({ summary: 'Create an invoice for a booking' })
  @ApiResponse({ status: 201, type: InvoiceResponseDto })
  @Post()
  create(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.service.create(req.userId, bookingId, dto);
  }
}
