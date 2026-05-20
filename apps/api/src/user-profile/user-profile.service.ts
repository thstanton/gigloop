import { Injectable } from '@nestjs/common';
import { UserProfileRepository } from './user-profile.repository';

@Injectable()
export class UserProfileService {
  constructor(private repo: UserProfileRepository) {}

  findOrCreate(userId: string) {
    return this.repo.upsertByUserId(userId);
  }
}
