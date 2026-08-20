import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateLineupDto } from './dto/create-lineup.dto';
import type { LineupSlotUpsertDto, UpdateLineupDto } from './dto/update-lineup.dto';

const SLOTS_INCLUDE = { slots: { orderBy: { order: 'asc' as const } } };

@Injectable()
export class LineupsRepository {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.lineupTemplate.findMany({
      where: { userId },
      include: SLOTS_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
  }

  findOne(userId: string, id: string) {
    return this.prisma.lineupTemplate.findFirst({
      where: { userId, id },
      include: SLOTS_INCLUDE,
    });
  }

  create(userId: string, dto: CreateLineupDto) {
    const { slots = [], ...fields } = dto;
    return this.prisma.lineupTemplate.create({
      data: {
        userId,
        ...fields,
        slots: { create: slots.map((s) => ({ ...s, userId })) },
      },
      include: SLOTS_INCLUDE,
    });
  }

  async update(userId: string, id: string, dto: UpdateLineupDto) {
    const { slots, ...fields } = dto;

    if (slots !== undefined) {
      await this.syncSlots(userId, id, slots);
    }

    return this.prisma.lineupTemplate.update({
      where: { id }, // scoped-upstream: service.update calls findOne(userId, id) first, already proving ownership (ADR-0061)
      data: fields,
      include: SLOTS_INCLUDE,
    });
  }

  private async syncSlots(userId: string, lineupTemplateId: string, slots: LineupSlotUpsertDto[]) {
    const incomingIds = slots.filter((s) => s.id).map((s) => s.id as string);

    await this.prisma.lineupTemplateSlot.deleteMany({
      where: { lineupTemplateId, id: { notIn: incomingIds } }, // scoped-upstream: child rows scoped via the already-owned parent lineupTemplateId
    });

    for (const slot of slots) {
      if (slot.id) {
        await this.prisma.lineupTemplateSlot.update({
          where: { id: slot.id, lineupTemplateId }, // scoped-upstream: child row scoped via the already-owned parent lineupTemplateId
          data: {
            role: slot.role,
            order: slot.order,
          },
        });
      } else {
        await this.prisma.lineupTemplateSlot.create({
          data: {
            userId,
            lineupTemplateId,
            role: slot.role ?? '',
            order: slot.order ?? 0,
          },
        });
      }
    }
  }

  delete(id: string) {
    return this.prisma.lineupTemplate.delete({ where: { id } }); // scoped-upstream: service.delete calls findOne(userId, id) first, already proving ownership (ADR-0061)
  }
}
