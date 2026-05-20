import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { UserProfileService } from './user-profile.service';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import type { Request } from 'express';

type AuthedRequest = Request & { userId: string };

@Controller('me')
export class UserProfileController {
  constructor(private service: UserProfileService) {}

  @Get()
  getMe(@Req() req: AuthedRequest) {
    return this.service.findOrCreate(req.userId);
  }

  @Patch()
  updateMe(@Req() req: AuthedRequest, @Body() dto: UpdateUserProfileDto) {
    return this.service.update(req.userId, dto);
  }

  @Post('logo-upload-url')
  getLogoUploadUrl(
    @Req() req: AuthedRequest,
    @Body('contentType') contentType: string,
  ) {
    return this.service.getLogoUploadUrl(req.userId, contentType);
  }
}
