import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  ParseBoolPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSetDto } from './dto/update-set.dto';
import { ApplyPackageTemplateDto } from './dto/apply-package-template.dto';
import { UpsertMusicFormConfigDto } from './dto/upsert-music-form-config.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { BookingChecklistItemResponseDto } from './dto/checklist-item-response.dto';
import { UpdateBookingSeriesDto } from './dto/update-booking-series.dto';
import type { Request } from 'express';

type AuthedRequest = Request & { userId: string };

@ApiTags('Bookings')
@ApiBearerAuth('clerk-jwt')
@Controller('bookings')
export class BookingsController {
  constructor(private service: BookingsService) {}

  @ApiOperation({ summary: 'List bookings (returns all statuses when no status param supplied)' })
  @ApiQuery({ name: 'status', required: false, enum: BookingStatus, isArray: true, description: 'Filter by one or more statuses (repeat param for multiple)' })
  @ApiQuery({ name: 'q', required: false, description: 'Free-text search across customer name, email, title, venue, agent, series, event type, and notes' })
  @ApiQuery({ name: 'eventType', required: false, description: 'Filter by event type (equality match — e.g. WEDDING, CORPORATE)' })
  @ApiQuery({ name: 'from', required: false, description: 'Filter bookings on or after this date (ISO 8601 date, e.g. 2026-04-06)' })
  @ApiQuery({ name: 'to', required: false, description: 'Filter bookings on or before this date (ISO 8601 date, e.g. 2027-04-05)' })
  @Get()
  findAll(
    @Req() req: AuthedRequest,
    @Query('status') status?: string | string[],
    @Query('q') q?: string,
    @Query('eventType') eventType?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.service.findAll(req.userId, status, q, eventType, from, to);
  }

  @ApiOperation({ summary: 'Get dashboard action items for upcoming bookings' })
  @Get('actions')
  getActions(@Req() req: AuthedRequest) {
    return this.service.getActions(req.userId);
  }

  @ApiOperation({ summary: 'Get a booking by ID' })
  @Get(':id')
  findOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.findOne(req.userId, id);
  }

  @ApiOperation({ summary: 'Create a booking' })
  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateBookingDto) {
    return this.service.create(req.userId, dto);
  }

  @ApiOperation({ summary: 'Assign or remove the booking from a series; returns requiresConfirmation on customer mismatch' })
  @Patch(':id/series')
  updateSeries(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateBookingSeriesDto,
  ) {
    return this.service.updateSeries(req.userId, id, dto.seriesId, dto.confirm);
  }

  @ApiOperation({ summary: 'Update a booking' })
  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateBookingDto,
  ) {
    return this.service.update(req.userId, id, dto);
  }

  @ApiOperation({ summary: 'Cancel a booking (sets status to CANCELLED)' })
  @Delete(':id')
  @HttpCode(204)
  delete(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.delete(req.userId, id);
  }

  @ApiOperation({ summary: 'Create a new contract for a booking from the contract template' })
  @Post(':id/contracts')
  createContract(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.createContract(req.userId, id);
  }

  @ApiOperation({ summary: 'Update a contract (edit content or manually mark signed)' })
  @Patch(':id/contracts/:contractId')
  updateContract(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('contractId') contractId: string,
    @Body() dto: UpdateContractDto,
  ) {
    return this.service.updateContract(req.userId, id, contractId, dto);
  }

  @ApiOperation({ summary: 'Transition a DRAFT contract to SENT' })
  @Post(':id/contracts/:contractId/send')
  @HttpCode(200)
  sendContract(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('contractId') contractId: string,
  ) {
    return this.service.sendContract(req.userId, id, contractId);
  }

  @ApiOperation({ summary: 'Delete a DRAFT contract (hard delete; only permitted for DRAFT status)' })
  @Delete(':id/contracts/:contractId')
  @HttpCode(204)
  deleteContract(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('contractId') contractId: string,
  ) {
    return this.service.deleteContract(req.userId, id, contractId);
  }

  @ApiOperation({ summary: 'Void a contract; pass confirmSignedVoid=true to void a SIGNED contract' })
  @Post(':id/contracts/:contractId/void')
  @HttpCode(204)
  voidContract(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('contractId') contractId: string,
    @Body('confirmSignedVoid', new DefaultValuePipe(false), ParseBoolPipe) confirmSignedVoid: boolean,
  ) {
    return this.service.voidContract(req.userId, id, contractId, confirmSignedVoid);
  }

  @ApiOperation({ summary: 'Get checklist items for a booking' })
  @ApiResponse({ status: 200, type: [BookingChecklistItemResponseDto] })
  @Get(':id/checklist')
  getChecklist(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.getChecklist(req.userId, id);
  }

  @ApiOperation({ summary: 'Add a custom ad-hoc checklist item to a booking' })
  @Post(':id/checklist')
  addChecklistItem(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: CreateChecklistItemDto,
  ) {
    return this.service.addChecklistItem(
      req.userId,
      id,
      dto.label,
      dto.requiredForStatus ?? null,
      dto.dueDate ?? null,
    );
  }

  @ApiOperation({ summary: 'Update a checklist item state' })
  @Patch(':id/checklist/:itemId')
  updateChecklistItem(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateChecklistItemDto,
  ) {
    return this.service.updateChecklistItem(req.userId, id, itemId, dto.state);
  }

  @ApiOperation({ summary: 'Get the music form config for a booking' })
  @Get(':id/music-form-config')
  getMusicFormConfig(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.getMusicFormConfig(req.userId, id);
  }

  @ApiOperation({ summary: 'Get the music form response for a booking' })
  @Get(':id/music-form-response')
  getMusicFormResponse(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.getMusicFormResponse(req.userId, id);
  }

  @ApiOperation({ summary: 'Create or replace the music form config for a booking' })
  @Put(':id/music-form-config')
  upsertMusicFormConfig(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: UpsertMusicFormConfigDto,
  ) {
    return this.service.upsertMusicFormConfig(req.userId, id, dto);
  }

  @ApiOperation({ summary: 'Remove the music form config for a booking' })
  @ApiResponse({ status: 200, description: 'Config deleted' })
  @Delete(':id/music-form-config')
  deleteMusicFormConfig(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.deleteMusicFormConfig(req.userId, id);
  }

  @ApiOperation({ summary: 'Apply a package template to a booking (creates a booking-owned Package snapshot)' })
  @Post(':id/packages')
  applyPackageTemplate(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: ApplyPackageTemplateDto,
  ) {
    return this.service.applyPackageTemplate(req.userId, id, dto.packageTemplateId);
  }

  @ApiOperation({ summary: 'Remove a booking-owned Package and its sets from a booking' })
  @Delete(':id/packages/:packageId')
  @HttpCode(204)
  removePackage(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('packageId') packageId: string,
  ) {
    return this.service.removePackage(req.userId, id, packageId);
  }

  @ApiOperation({ summary: 'Add a performance set to a booking' })
  @Post(':id/sets')
  addSet(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: CreateSetDto,
  ) {
    return this.service.addSet(req.userId, id, dto);
  }

  @ApiOperation({ summary: 'Update a performance set' })
  @Patch(':id/sets/:setId')
  updateSet(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('setId') setId: string,
    @Body() dto: UpdateSetDto,
  ) {
    return this.service.updateSet(req.userId, id, setId, dto);
  }

  @ApiOperation({ summary: 'Remove a performance set from a booking' })
  @Delete(':id/sets/:setId')
  @HttpCode(204)
  deleteSet(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('setId') setId: string,
  ) {
    return this.service.deleteSet(req.userId, id, setId);
  }
}
