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
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ContactsService } from './contacts.service';
import { TravelTimeService } from './travel-time.service';
import { TravelTimeResponseDto } from './dto/travel-time-response.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import type { Request } from 'express';

type AuthedRequest = Request & { userId: string };

@ApiTags('Contacts')
@ApiBearerAuth('clerk-jwt')
@Controller('contacts')
export class ContactsController {
  constructor(
    private service: ContactsService,
    private travelTimeService: TravelTimeService,
  ) {}

  @ApiOperation({ summary: 'List all contacts' })
  @Get()
  findAll(@Req() req: AuthedRequest) {
    return this.service.findAll(req.userId);
  }

  @ApiOperation({ summary: 'Get a contact by ID' })
  @Get(':id')
  findOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.findOne(req.userId, id);
  }

  @ApiOperation({ summary: 'Create a contact' })
  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateContactDto) {
    return this.service.create(req.userId, dto);
  }

  @ApiOperation({ summary: 'Update a contact' })
  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.service.update(req.userId, id, dto);
  }

  @ApiOperation({ summary: 'Get travel time from home to venue' })
  @ApiResponse({ status: 200, type: TravelTimeResponseDto })
  @ApiResponse({ status: 422, description: 'Home or venue address not set, or contact is not a venue' })
  @Get(':id/travel-time')
  getTravelTime(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.travelTimeService.getTravelTime(req.userId, id);
  }

  @ApiOperation({ summary: 'Delete a contact (blocked if it has bookings)' })
  @Delete(':id')
  @HttpCode(204)
  delete(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.delete(req.userId, id);
  }
}
