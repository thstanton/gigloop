import { Injectable } from '@nestjs/common';
import { UserProfileRepository } from './user-profile.repository';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

@Injectable()
export class UserProfileService {
  constructor(private repo: UserProfileRepository) {}

  findOrCreate(userId: string) {
    return this.repo.upsertByUserId(userId);
  }

  update(userId: string, dto: UpdateUserProfileDto) {
    return this.repo.updateByUserId(userId, dto);
  }
}
