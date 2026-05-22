import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { type BuiltInTemplateType, BUILT_IN_NAMES, getDefaultContent } from './default-templates';

@Injectable()
export class TemplatesRepository {
  constructor(private prisma: PrismaService) {}

  findAll(userId: string) {
    return this.prisma.template.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  }

  findOne(userId: string, id: string) {
    return this.prisma.template.findFirst({
      where: { id, userId },
    });
  }

  create(userId: string, dto: CreateTemplateDto) {
    return this.prisma.template.create({
      data: {
        userId,
        name: dto.name,
        content: dto.content as Prisma.InputJsonValue,
      },
    });
  }

  update(id: string, dto: UpdateTemplateDto) {
    return this.prisma.template.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.content !== undefined ? { content: dto.content as Prisma.InputJsonValue } : {}),
      },
    });
  }

  delete(id: string) {
    return this.prisma.template.delete({
      where: { id },
    });
  }

  async seedBuiltIns(userId: string, types: BuiltInTemplateType[]) {
    await this.prisma.template.createMany({
      data: types.map((type) => ({
        userId,
        name: BUILT_IN_NAMES[type],
        content: getDefaultContent(type) as Prisma.InputJsonValue,
        builtInType: type,
      })),
    });
  }
}
