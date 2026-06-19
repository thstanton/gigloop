import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreatePackageDto } from './dto/create-package.dto';
import type { SlotUpsertDto, UpdatePackageDto } from './dto/update-package.dto';

const SLOTS_INCLUDE = { slots: { orderBy: { order: 'asc' as const } } };

@Injectable()
export class PackagesRepository {
  constructor(private prisma: PrismaService) {}

  countByUserId(userId: string) {
    return this.prisma.packageTemplate.count({ where: { userId } });
  }

  findAll(userId: string) {
    return this.prisma.packageTemplate.findMany({
      where: { userId },
      include: SLOTS_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  findOne(userId: string, id: string) {
    return this.prisma.packageTemplate.findFirst({
      where: { userId, id },
      include: SLOTS_INCLUDE,
    });
  }

  create(userId: string, dto: CreatePackageDto) {
    const { slots = [], ...fields } = dto;
    return this.prisma.packageTemplate.create({
      data: {
        userId,
        ...fields,
        keyMoments: fields.keyMoments ?? [],
        defaultGenreSelection: fields.defaultGenreSelection ?? [],
        slots: { create: slots.map((s) => ({ ...s, userId })) },
      },
      include: SLOTS_INCLUDE,
    });
  }

  async update(userId: string, id: string, dto: UpdatePackageDto) {
    const { slots, ...fields } = dto;

    if (slots !== undefined) {
      await this.syncSlots(userId, id, slots);
    }

    return this.prisma.packageTemplate.update({
      where: { id },
      data: fields,
      include: SLOTS_INCLUDE,
    });
  }

  private async syncSlots(userId: string, packageTemplateId: string, slots: SlotUpsertDto[]) {
    const incomingIds = slots.filter((s) => s.id).map((s) => s.id as string);

    await this.prisma.packageTemplateSlot.deleteMany({
      where: { packageTemplateId, id: { notIn: incomingIds } },
    });

    for (const slot of slots) {
      if (slot.id) {
        await this.prisma.packageTemplateSlot.update({
          where: { id: slot.id, packageTemplateId },
          data: {
            label: slot.label,
            duration: slot.duration,
            order: slot.order,
          },
        });
      } else {
        await this.prisma.packageTemplateSlot.create({
          data: {
            userId,
            packageTemplateId,
            label: slot.label,
            duration: slot.duration ?? 60,
            order: slot.order ?? 0,
          },
        });
      }
    }
  }

  delete(id: string) {
    return this.prisma.packageTemplate.delete({ where: { id } });
  }

  createMany(
    userId: string,
    packages: Array<{
      label: string;
      category?: string;
      icon: string;
      keyMoments: string[];
      defaultGenreSelection: string[];
      notes?: string;
      isSystemDefault?: boolean;
      slots: Array<{ label?: string; duration: number; order: number }>;
    }>,
  ) {
    return this.prisma.$transaction(
      packages.map(({ slots, ...pkg }) =>
        this.prisma.packageTemplate.create({
          data: {
            userId,
            ...pkg,
            slots: {
              create: slots.map((s) => ({ ...s, userId })),
            },
          },
          include: SLOTS_INCLUDE,
        }),
      ),
    );
  }
}
