import { Controller, Get, Param, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { InvoicesService } from './invoices.service';
import { InvoiceResponseDto } from './dto/invoice-response.dto';

type AuthedRequest = Request & { userId: string };

/**
 * Operations on an invoice that **already exists** (ADR-0069). The owner is read off the
 * invoice's own FK, never off the path, so one route serves a booking invoice and a series
 * invoice alike. Creation stays owner-scoped on `InvoicesController` and `SeriesController`:
 * before the invoice exists there is no FK to derive from, and the two creation paths
 * genuinely differ.
 *
 * This is the first member of a family that grows in stages. `PATCH` and the three line-item
 * routes follow (#845); the nine duplicated transitions migrate later (#853), at which point
 * `invoiceOwnerRoute`'s prefix logic collapses to a constant. Two route families coexisting
 * is a declared intermediate state, not drift — see ADR-0069.
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
}
