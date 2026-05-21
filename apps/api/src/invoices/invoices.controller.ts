import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { CreateLineItemDto } from './dto/create-line-item.dto';
import { UpdateLineItemDto } from './dto/update-line-item.dto';
import type { Request } from 'express';

type AuthedRequest = Request & { userId: string };

@Controller('bookings/:bookingId/invoices')
export class InvoicesController {
  constructor(private service: InvoicesService) {}

  @Get()
  findAll(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
  ) {
    return this.service.findAll(req.userId, bookingId);
  }

  @Get(':id')
  findOne(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Param('id') id: string,
  ) {
    return this.service.findOne(req.userId, bookingId, id);
  }

  @Post()
  create(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.service.create(req.userId, bookingId, dto);
  }

  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.service.update(req.userId, bookingId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Param('id') id: string,
  ) {
    return this.service.delete(req.userId, bookingId, id);
  }

  @Post(':id/line-items')
  addLineItem(
    @Req() req: AuthedRequest,
    @Param('bookingId') bookingId: string,
    @Param('id') id: string,
    @Body() dto: CreateLineItemDto,
  ) {
    return this.service.addLineItem(req.userId, bookingId, id, dto);
  }

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
}
