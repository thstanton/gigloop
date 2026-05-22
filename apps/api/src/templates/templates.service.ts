import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TemplatesRepository } from './templates.repository';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { type BuiltInTemplateType, BUILT_IN_EMAIL_TYPES, getDefaultContent } from './default-templates';

@Injectable()
export class TemplatesService {
  constructor(private repo: TemplatesRepository) {}

  async findAll(userId: string) {
    const templates = await this.repo.findAll(userId);
    const existing = new Set(templates.map((t) => t.builtInType).filter(Boolean));
    const missing = BUILT_IN_EMAIL_TYPES.filter((type) => !existing.has(type));
    if (missing.length > 0) {
      await this.repo.seedBuiltIns(userId, missing);
      return this.repo.findAll(userId);
    }
    return templates;
  }

  async findOne(userId: string, id: string) {
    const template = await this.repo.findOne(userId, id);
    if (!template) throw new NotFoundException('Template not found');
    return template;
  }

  create(userId: string, dto: CreateTemplateDto) {
    return this.repo.create(userId, dto);
  }

  async update(userId: string, id: string, dto: UpdateTemplateDto) {
    await this.findOne(userId, id);
    return this.repo.update(id, dto);
  }

  async delete(userId: string, id: string) {
    const template = await this.findOne(userId, id);
    if (template.builtInType !== null) {
      throw new ForbiddenException('Built-in templates cannot be deleted');
    }
    return this.repo.delete(id);
  }

  async resetToDefault(userId: string, id: string) {
    const template = await this.findOne(userId, id);
    if (!template.builtInType) {
      throw new BadRequestException('Only built-in templates can be reset to default');
    }
    return this.repo.update(id, {
      content: getDefaultContent(template.builtInType as BuiltInTemplateType),
    });
  }
}
