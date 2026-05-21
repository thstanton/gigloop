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
import { SongGenre } from '@prisma/client';
import { SongsService } from './songs.service';
import { CreateSongDto } from './dto/create-song.dto';
import { UpdateSongDto } from './dto/update-song.dto';
import type { Request } from 'express';

type AuthedRequest = Request & { userId: string };

@ApiTags('Songs')
@ApiBearerAuth('clerk-jwt')
@Controller('songs')
export class SongsController {
  constructor(private service: SongsService) {}

  @ApiOperation({ summary: 'List songs' })
  @ApiQuery({ name: 'genre', required: false, enum: SongGenre, description: 'Filter by genre' })
  @ApiQuery({ name: 'active', required: false, type: Boolean, description: 'Filter by active status' })
  @Get()
  findAll(
    @Req() req: AuthedRequest,
    @Query('genre') genre?: string,
    @Query('active') active?: string,
  ) {
    return this.service.findAll(req.userId, genre, active);
  }

  @ApiOperation({ summary: 'Get a song by ID' })
  @Get(':id')
  findOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.findOne(req.userId, id);
  }

  @ApiOperation({ summary: 'Create a song' })
  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateSongDto) {
    return this.service.create(req.userId, dto);
  }

  @ApiOperation({ summary: 'Update a song' })
  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateSongDto,
  ) {
    return this.service.update(req.userId, id, dto);
  }

  @ApiOperation({ summary: 'Delete a song' })
  @Delete(':id')
  @HttpCode(204)
  delete(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.delete(req.userId, id);
  }
}
