import { Injectable } from '@nestjs/common';
import { PerformanceFormatsRepository } from './performance-formats.repository';

const DEFAULT_GENRES = ['CONTEMPORARY', 'CLASSICAL', 'JAZZ', 'FILM_TV_MUSICALS'];

const SYSTEM_DEFAULTS = [
  {
    label: 'Wedding Ceremony',
    category: 'WEDDING',
    icon: 'heart',
    keyMoments: ['Processional', 'Signing of the Register (Song 1)', 'Signing of the Register (Song 2)', 'Signing of the Register (Song 3)', 'Recessional'],
    defaultGenreSelection: DEFAULT_GENRES,
    slots: [{ label: 'Ceremony', duration: 30, order: 1 }],
  },
  {
    label: 'Drinks Reception',
    category: 'WEDDING',
    icon: 'glass-water',
    keyMoments: [],
    defaultGenreSelection: DEFAULT_GENRES,
    slots: [{ label: 'Drinks Reception', duration: 90, order: 1 }],
  },
  {
    label: 'Wedding Breakfast',
    category: 'WEDDING',
    icon: 'utensils',
    keyMoments: [],
    defaultGenreSelection: DEFAULT_GENRES,
    slots: [{ label: 'Wedding Breakfast', duration: 90, order: 1 }],
  },
  {
    label: 'Evening Reception',
    category: 'WEDDING',
    icon: 'moon',
    keyMoments: ['First Dance'],
    defaultGenreSelection: DEFAULT_GENRES,
    slots: [
      { label: 'Evening Reception', duration: 45, order: 1 },
      { label: 'Evening Reception', duration: 45, order: 2 },
    ],
  },
  {
    label: 'Corporate Dinner',
    category: 'CORPORATE',
    icon: 'briefcase',
    keyMoments: [],
    defaultGenreSelection: DEFAULT_GENRES,
    slots: [
      { label: 'Drinks', duration: 60, order: 1 },
      { label: 'Dinner', duration: 90, order: 2 },
    ],
  },
  {
    label: 'Background Music',
    category: undefined,
    icon: 'music',
    keyMoments: [],
    defaultGenreSelection: DEFAULT_GENRES,
    slots: [{ label: 'Background Music', duration: 60, order: 1 }],
  },
  {
    label: 'Solo Piano',
    category: undefined,
    icon: 'music-2',
    keyMoments: [],
    defaultGenreSelection: DEFAULT_GENRES,
    slots: [{ label: 'Solo Piano', duration: 60, order: 1 }],
  },
];

@Injectable()
export class PerformanceFormatsService {
  constructor(private repo: PerformanceFormatsRepository) {}

  async findAll(userId: string) {
    const count = await this.repo.countByUserId(userId);
    if (count === 0) {
      await this.repo.createMany(userId, SYSTEM_DEFAULTS);
    }
    return this.repo.findAll(userId);
  }
}
