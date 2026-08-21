import { Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { isEnabled } from '../common/featureFlags';
import { LineupsService } from './lineups.service';
import { CreateLineupDto } from './dto/create-lineup.dto';
import { UpdateLineupDto } from './dto/update-lineup.dto';
import type { Request } from 'express';

type AuthedRequest = Request & { userId: string };

// Band members v1 (#879). Gated on FEATURE_BAND_MEMBERS, default-off: every route 404s with the
// flag off, so the lineup library is unreachable until the feature goes live (ADR-0072).
function assertEnabled() {
  if (!isEnabled('FEATURE_BAND_MEMBERS')) throw new NotFoundException();
}

@ApiTags('Lineups')
@ApiBearerAuth('clerk-jwt')
@Controller('lineups')
export class LineupsController {
  constructor(private service: LineupsService) {}

  @ApiOperation({ summary: "List the user's lineup templates" })
  @ApiResponse({ status: 200, description: 'Array of lineup templates with slots' })
  @Get()
  findAll(@Req() req: AuthedRequest) {
    assertEnabled();
    return this.service.findAll(req.userId);
  }

  @ApiOperation({ summary: 'Create a new lineup template' })
  @ApiResponse({ status: 201, description: 'Created lineup template with slots' })
  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateLineupDto) {
    assertEnabled();
    return this.service.create(req.userId, dto);
  }

  @ApiOperation({ summary: 'Update a lineup template and its slots' })
  @ApiResponse({ status: 200, description: 'Updated lineup template with slots' })
  @ApiResponse({ status: 404, description: 'Lineup template not found' })
  @Patch(':id')
  update(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: UpdateLineupDto) {
    assertEnabled();
    return this.service.update(req.userId, id, dto);
  }

  @ApiOperation({ summary: 'Delete a lineup template' })
  @ApiResponse({ status: 204, description: 'Deleted successfully' })
  @ApiResponse({ status: 404, description: 'Lineup template not found' })
  @HttpCode(204)
  @Delete(':id')
  delete(@Req() req: AuthedRequest, @Param('id') id: string) {
    assertEnabled();
    return this.service.delete(req.userId, id);
  }
}
