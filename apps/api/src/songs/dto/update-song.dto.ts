import type { SongGenre } from '@prisma/client';

export class UpdateSongDto {
  title?: string;
  genre?: SongGenre;
  artist?: string | null;
  active?: boolean;
  tags?: string[];
}
