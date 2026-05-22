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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { TemplatesService } from './templates.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import type { Request } from 'express';

type AuthedRequest = Request & { userId: string };

@ApiTags('Templates')
@ApiBearerAuth('clerk-jwt')
@Controller('templates')
export class TemplatesController {
  constructor(private service: TemplatesService) {}

  @ApiOperation({ summary: 'List all templates' })
  @Get()
  findAll(@Req() req: AuthedRequest) {
    return this.service.findAll(req.userId);
  }

  @ApiOperation({ summary: 'Get a template by ID' })
  @Get(':id')
  findOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.findOne(req.userId, id);
  }

  @ApiOperation({ summary: 'Create a custom template' })
  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateTemplateDto) {
    return this.service.create(req.userId, dto);
  }

  @ApiOperation({ summary: 'Update a template' })
  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
  ) {
    return this.service.update(req.userId, id, dto);
  }

  @ApiOperation({ summary: 'Delete a custom template' })
  @Delete(':id')
  @HttpCode(204)
  delete(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.delete(req.userId, id);
  }

  @ApiOperation({ summary: 'Reset a built-in template to its default content' })
  @Post(':id/reset')
  resetToDefault(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.resetToDefault(req.userId, id);
  }
}
