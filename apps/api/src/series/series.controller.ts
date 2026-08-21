import { Controller, Get, NotFoundException, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SeriesService } from './series.service';
import { InvoiceResponseDto } from '../invoices/dto/invoice-response.dto';
import { CreateSeriesInvoiceResponseDto } from './dto/create-series-invoice-response.dto';
import type { Request } from 'express';

type AuthedRequest = Request & { userId: string };

/**
 * Series entity reads and invoice creation only (ADR-0069, #853). Every operation on a series
 * invoice that already exists — GET/PATCH by id, line items, and all nine lifecycle transitions
 * plus payment-correction — lives on `InvoiceOperationsController` (`/invoices/:id/...`), owner
 * read off the invoice itself. `createInvoice` stays here because there is no invoice yet to
 * derive an owner from; `previewInvoiceNumber` stays for the same reason, previewing the number
 * a not-yet-created invoice would get; `getActiveInvoice` stays because it is how the client
 * discovers a series invoice's id at all — the series has no list route, only a current one.
 */
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
  @ApiResponse({ status: 201, type: CreateSeriesInvoiceResponseDto })
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
}
