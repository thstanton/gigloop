import { Controller, Get, Req } from '@nestjs/common';
import { UserProfileService } from './user-profile.service';
import type { Request } from 'express';

@Controller('me')
export class UserProfileController {
  constructor(private service: UserProfileService) {}

  @Get()
  getMe(@Req() req: Request & { userId: string }) {
    return this.service.findOrCreate(req.userId);
  }
}
