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
import { SongsService } from './songs.service';
import { CreateSongDto } from './dto/create-song.dto';
import { UpdateSongDto } from './dto/update-song.dto';
import type { Request } from 'express';

type AuthedRequest = Request & { userId: string };

@Controller('songs')
export class SongsController {
  constructor(private service: SongsService) {}

  @Get()
  findAll(
    @Req() req: AuthedRequest,
    @Query('genre') genre?: string,
    @Query('active') active?: string,
  ) {
    return this.service.findAll(req.userId, genre, active);
  }

  @Get(':id')
  findOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.findOne(req.userId, id);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateSongDto) {
    return this.service.create(req.userId, dto);
  }

  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateSongDto,
  ) {
    return this.service.update(req.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.delete(req.userId, id);
  }
}
