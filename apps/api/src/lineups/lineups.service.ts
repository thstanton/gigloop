import { Injectable, NotFoundException } from '@nestjs/common';
import { LineupsRepository } from './lineups.repository';
import type { CreateLineupDto } from './dto/create-lineup.dto';
import type { UpdateLineupDto } from './dto/update-lineup.dto';

@Injectable()
export class LineupsService {
  constructor(private repo: LineupsRepository) {}

  findAll(userId: string) {
    return this.repo.findAll(userId);
  }

  // Used by PackagesService to prove ownership before setting defaultLineupTemplateId — the FK
  // alone would happily accept another tenant's lineup id (ADR-0061).
  findOne(userId: string, id: string) {
    return this.repo.findOne(userId, id);
  }

  create(userId: string, dto: CreateLineupDto) {
    return this.repo.create(userId, dto);
  }

  async update(userId: string, id: string, dto: UpdateLineupDto) {
    const lineup = await this.repo.findOne(userId, id);
    if (!lineup) throw new NotFoundException('Lineup template not found');
    return this.repo.update(userId, id, dto);
  }

  async delete(userId: string, id: string) {
    const lineup = await this.repo.findOne(userId, id);
    if (!lineup) throw new NotFoundException('Lineup template not found');
    return this.repo.delete(id);
  }
}
