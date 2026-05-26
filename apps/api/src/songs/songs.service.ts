import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SONG_GENRES } from '../common/constants';
import { SongsRepository } from './songs.repository';
import { CreateSongDto } from './dto/create-song.dto';
import { UpdateSongDto } from './dto/update-song.dto';

const VALID_GENRES = new Set<string>(SONG_GENRES);

@Injectable()
export class SongsService {
  constructor(private repo: SongsRepository) {}

  findAll(userId: string, genre?: string, active?: string) {
    if (genre !== undefined && !VALID_GENRES.has(genre)) {
      throw new BadRequestException(`Invalid genre: ${genre}`);
    }
    let activeFilter: boolean | undefined;
    if (active === 'true') activeFilter = true;
    else if (active === 'false') activeFilter = false;
    else if (active !== undefined) {
      throw new BadRequestException(`Invalid active value: ${active}. Use "true" or "false"`);
    }
    return this.repo.findAll(userId, genre, activeFilter);
  }

  async findOne(userId: string, id: string) {
    const song = await this.repo.findOne(userId, id);
    if (!song) throw new NotFoundException('Song not found');
    return song;
  }

  create(userId: string, dto: CreateSongDto) {
    return this.repo.create(userId, dto);
  }

  async update(userId: string, id: string, dto: UpdateSongDto) {
    await this.findOne(userId, id);
    return this.repo.update(id, dto);
  }

  async delete(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.repo.delete(id);
  }
}
