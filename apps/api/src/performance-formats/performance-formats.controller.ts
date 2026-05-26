import { Controller, Get, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PerformanceFormatsService } from './performance-formats.service';
import type { Request } from 'express';

type AuthedRequest = Request & { userId: string };

@ApiTags('Performance Formats')
@ApiBearerAuth('clerk-jwt')
@Controller('performance-formats')
export class PerformanceFormatsController {
  constructor(private service: PerformanceFormatsService) {}

  @ApiOperation({ summary: 'List performance formats (seeds defaults on first call)' })
  @Get()
  findAll(@Req() req: AuthedRequest) {
    return this.service.findAll(req.userId);
  }
}
