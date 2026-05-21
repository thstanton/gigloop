import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { UserProfileService } from './user-profile.service';
import { PublicProfileService } from './public-profile.service';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UpdatePublicProfileDto } from './dto/update-public-profile.dto';
import type { Request } from 'express';

type AuthedRequest = Request & { userId: string };

@Controller('me')
export class UserProfileController {
  constructor(
    private userProfileService: UserProfileService,
    private publicProfileService: PublicProfileService,
  ) {}

  @Get()
  getMe(@Req() req: AuthedRequest) {
    return this.userProfileService.findOrCreate(req.userId);
  }

  @Patch()
  updateMe(@Req() req: AuthedRequest, @Body() dto: UpdateUserProfileDto) {
    return this.userProfileService.update(req.userId, dto);
  }

  @Get('public')
  getPublicProfile(@Req() req: AuthedRequest) {
    return this.publicProfileService.findOrCreate(req.userId);
  }

  @Patch('public')
  updatePublicProfile(@Req() req: AuthedRequest, @Body() dto: UpdatePublicProfileDto) {
    return this.publicProfileService.update(req.userId, dto);
  }

  @Post('logo-upload-url')
  getLogoUploadUrl(
    @Req() req: AuthedRequest,
    @Body('contentType') contentType: string,
  ) {
    return this.publicProfileService.getLogoUploadUrl(req.userId, contentType);
  }
}
