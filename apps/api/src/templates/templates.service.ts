import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { TemplatesRepository } from './templates.repository';
import { CreateTemplateDto } from './dto/create-template.dto';
import { UpdateTemplateDto } from './dto/update-template.dto';

@Injectable()
export class TemplatesService {
  constructor(private repo: TemplatesRepository) {}

  findAll(userId: string) {
    return this.repo.findAll(userId);
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
}
