import { Module } from '@nestjs/common';
import { UserProfileController } from './user-profile.controller';
import { UserProfileService } from './user-profile.service';
import { UserProfileRepository } from './user-profile.repository';
import { PublicProfileService } from './public-profile.service';
import { PublicProfileRepository } from './public-profile.repository';

@Module({
  controllers: [UserProfileController],
  providers: [
    UserProfileService,
    UserProfileRepository,
    PublicProfileService,
    PublicProfileRepository,
  ],
  exports: [UserProfileRepository],
})
export class UserProfileModule {}
