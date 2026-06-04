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
import { ApplyFormatDto } from './dto/apply-format.dto';
import { UpsertMusicFormConfigDto } from './dto/upsert-music-form-config.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { UpdateChecklistItemDto } from './dto/update-checklist-item.dto';
import { CreateChecklistItemDto } from './dto/create-checklist-item.dto';
import { UpdateBookingSeriesDto } from './dto/update-booking-series.dto';
import type { Request } from 'express';

type AuthedRequest = Request & { userId: string };

@ApiTags('Bookings')
@ApiBearerAuth('clerk-jwt')
@Controller('bookings')
export class BookingsController {
  constructor(private service: BookingsService) {}

  @ApiOperation({ summary: 'List bookings (excludes CANCELLED by default)' })
  @ApiQuery({ name: 'status', required: false, enum: BookingStatus, description: 'Filter by status' })
  @Get()
  findAll(@Req() req: AuthedRequest, @Query('status') status?: string) {
    return this.service.findAll(req.userId, status);
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

  @ApiOperation({ summary: 'Apply a performance format to a booking' })
  @Post(':id/formats')
  applyFormat(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: ApplyFormatDto,
  ) {
    return this.service.applyFormat(req.userId, id, dto.formatId);
  }

  @ApiOperation({ summary: 'Remove an applied format and its sets from a booking' })
  @Delete(':id/formats/:bookingFormatId')
  @HttpCode(204)
  removeFormat(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('bookingFormatId') bookingFormatId: string,
  ) {
    return this.service.removeFormat(req.userId, id, bookingFormatId);
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
