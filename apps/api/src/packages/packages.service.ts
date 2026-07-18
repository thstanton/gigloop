import { Injectable, NotFoundException } from '@nestjs/common';
import { PackagesRepository } from './packages.repository';
import type { CreatePackageDto } from './dto/create-package.dto';
import type { UpdatePackageDto } from './dto/update-package.dto';

const DEFAULT_GENRES = ['CONTEMPORARY', 'CLASSICAL', 'JAZZ', 'FILM_TV_MUSICALS'];

const SYSTEM_DEFAULTS = [
  {
    label: 'Wedding Ceremony',
    category: 'WEDDING',
    icon: 'heart',
    isSystemDefault: true,
    keyMoments: ['Processional', 'Signing of the Register (Song 1)', 'Signing of the Register (Song 2)', 'Signing of the Register (Song 3)', 'Recessional'],
    defaultGenreSelection: DEFAULT_GENRES,
    slots: [{ label: 'Ceremony', duration: 30, order: 1 }],
  },
  {
    label: 'Drinks Reception',
    category: 'WEDDING',
    icon: 'glass-water',
    isSystemDefault: true,
    keyMoments: [],
    defaultGenreSelection: DEFAULT_GENRES,
    slots: [{ label: 'Drinks Reception', duration: 90, order: 1 }],
  },
  {
    label: 'Wedding Breakfast',
    category: 'WEDDING',
    icon: 'utensils',
    isSystemDefault: true,
    keyMoments: [],
    defaultGenreSelection: DEFAULT_GENRES,
    slots: [{ label: 'Wedding Breakfast', duration: 90, order: 1 }],
  },
  {
    label: 'Evening Reception',
    category: 'WEDDING',
    icon: 'moon',
    isSystemDefault: true,
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
    isSystemDefault: true,
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
    isSystemDefault: true,
    keyMoments: [],
    defaultGenreSelection: DEFAULT_GENRES,
    slots: [{ label: 'Background Music', duration: 60, order: 1 }],
  },
  {
    label: 'Solo Piano',
    category: undefined,
    icon: 'music-2',
    isSystemDefault: true,
    keyMoments: [],
    defaultGenreSelection: DEFAULT_GENRES,
    slots: [{ label: 'Solo Piano', duration: 60, order: 1 }],
  },
];

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

@Injectable()
export class PackagesService {
  constructor(private repo: PackagesRepository) {}

  // Package libraries are no longer auto-seeded (#663): a new musician's library starts empty and
  // they build it up deliberately — one template shaped in onboarding, then more from the catalogue.
  findAll(userId: string) {
    return this.repo.findAll(userId);
  }

  // The system-default templates as a read-only starter catalogue (not persisted). Onboarding Step 3
  // and the admin Packages page base a new template on one of these; nothing is added to the library
  // until the musician saves it.
  getCatalogue() {
    return SYSTEM_DEFAULTS.map((t) => ({
      id: slug(t.label),
      label: t.label,
      category: t.category ?? null,
      icon: t.icon,
      keyMoments: t.keyMoments,
      defaultGenreSelection: t.defaultGenreSelection,
      slots: t.slots.map((s) => ({ label: s.label, duration: s.duration, order: s.order })),
    }));
  }

  create(userId: string, dto: CreatePackageDto) {
    return this.repo.create(userId, dto);
  }

  async update(userId: string, id: string, dto: UpdatePackageDto) {
    const pkg = await this.repo.findOne(userId, id);
    if (!pkg) throw new NotFoundException('Package not found');
    return this.repo.update(userId, id, dto);
  }

  async delete(userId: string, id: string) {
    const pkg = await this.repo.findOne(userId, id);
    if (!pkg) throw new NotFoundException('Package not found');
    return this.repo.delete(id);
  }
}
