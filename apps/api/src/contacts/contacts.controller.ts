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
import { ContactsService } from './contacts.service';
import { CreateContactDto } from './dto/create-contact.dto';
import { UpdateContactDto } from './dto/update-contact.dto';
import type { Request } from 'express';

type AuthedRequest = Request & { userId: string };

@Controller('contacts')
export class ContactsController {
  constructor(private service: ContactsService) {}

  @Get()
  findAll(@Req() req: AuthedRequest) {
    return this.service.findAll(req.userId);
  }

  @Get(':id')
  findOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.findOne(req.userId, id);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateContactDto) {
    return this.service.create(req.userId, dto);
  }

  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateContactDto,
  ) {
    return this.service.update(req.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.delete(req.userId, id);
  }
}
