import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PerformanceFormatsRepository {
  constructor(private prisma: PrismaService) {}

  countByUserId(userId: string) {
    return this.prisma.performanceFormat.count({ where: { userId } });
  }

  findAll(userId: string) {
    return this.prisma.performanceFormat.findMany({
      where: { userId },
      include: { slots: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  createMany(
    userId: string,
    formats: Array<{
      label: string;
      category?: string;
      icon: string;
      keyMoments: string[];
      defaultGenreSelection: string[];
      notes?: string;
      slots: Array<{ label?: string; duration: number; order: number }>;
    }>,
  ) {
    return this.prisma.$transaction(
      formats.map(({ slots, ...format }) =>
        this.prisma.performanceFormat.create({
          data: {
            userId,
            ...format,
            slots: {
              create: slots.map((s) => ({ ...s, userId })),
            },
          },
          include: { slots: { orderBy: { order: 'asc' } } },
        }),
      ),
    );
  }
}
