import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PackagesService } from './packages.service';
import { CreatePackageDto } from './dto/create-package.dto';
import { UpdatePackageDto } from './dto/update-package.dto';
import type { Request } from 'express';

type AuthedRequest = Request & { userId: string };

@ApiTags('Packages')
@ApiBearerAuth('clerk-jwt')
@Controller('packages')
export class PackagesController {
  constructor(private service: PackagesService) {}

  @ApiOperation({ summary: 'List the user\'s package templates' })
  @ApiResponse({ status: 200, description: 'Array of packages with slots' })
  @Get()
  findAll(@Req() req: AuthedRequest) {
    return this.service.findAll(req.userId);
  }

  @ApiOperation({ summary: 'Starter package-template catalogue (system defaults, not persisted)' })
  @ApiResponse({ status: 200, description: 'Array of starter templates to base a new package on' })
  @Get('catalogue')
  getCatalogue() {
    return this.service.getCatalogue();
  }

  @ApiOperation({ summary: 'Create a new package' })
  @ApiResponse({ status: 201, description: 'Created package with slots' })
  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreatePackageDto) {
    return this.service.create(req.userId, dto);
  }

  @ApiOperation({ summary: 'Update a package and its slots' })
  @ApiResponse({ status: 200, description: 'Updated package with slots' })
  @ApiResponse({ status: 404, description: 'Package not found' })
  @Patch(':id')
  update(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: UpdatePackageDto) {
    return this.service.update(req.userId, id, dto);
  }

  @ApiOperation({ summary: 'Delete a package' })
  @ApiResponse({ status: 204, description: 'Deleted successfully' })
  @ApiResponse({ status: 404, description: 'Package not found' })
  @ApiResponse({ status: 409, description: 'Package is used by existing bookings' })
  @HttpCode(204)
  @Delete(':id')
  delete(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.delete(req.userId, id);
  }
}
