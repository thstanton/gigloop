import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { BookingStatus } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateBookingDto } from './dto/update-booking.dto';
import { CreateSetDto } from './dto/create-set.dto';
import { UpdateSetDto } from './dto/update-set.dto';
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
