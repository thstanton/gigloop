import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { InvoicesService } from './invoices.service';
import { InvoiceResponseDto, InvoiceLineItemResponseDto } from './dto/invoice-response.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { CreateLineItemDto } from './dto/create-line-item.dto';
import { UpdateLineItemDto } from './dto/update-line-item.dto';

type AuthedRequest = Request & { userId: string };

/**
 * Operations on an invoice that **already exists** (ADR-0069). The owner is read off the
 * invoice's own FK, never off the path, so one route serves a booking invoice and a series
 * invoice alike. Creation stays owner-scoped on `InvoicesController` and `SeriesController`:
 * before the invoice exists there is no FK to derive from, and the two creation paths
 * genuinely differ.
 *
 * The family grows in stages. `GET`, `PATCH` and the three line-item routes are here; the nine
 * duplicated transitions migrate later (#853), at which point `invoiceOwnerRoute`'s prefix logic
 * collapses to a constant. Two route families coexisting is a declared intermediate state, not
 * drift — see ADR-0069.
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
}
