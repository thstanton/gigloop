import type { SongGenre } from '@prisma/client';

export class CreateSongDto {
  title!: string;
  genre!: SongGenre;
  artist?: string;
  active?: boolean;
  tags?: string[];
}
