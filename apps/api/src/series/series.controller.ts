import { Controller, Get, Param, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SeriesService } from './series.service';
import type { Request } from 'express';

type AuthedRequest = Request & { userId: string };

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
}
