import { Body, Controller, Delete, Get, HttpCode, Patch, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiOperation, ApiResponse, ApiTags, getSchemaPath } from '@nestjs/swagger';
import { UserProfileService } from './user-profile.service';
import { PublicProfileService } from './public-profile.service';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { UpdatePublicProfileDto } from './dto/update-public-profile.dto';
import { UpdateChecklistDefaultsDto } from './dto/update-checklist-defaults.dto';
import {
  ChecklistDefaultItemResponseDto,
  ChecklistDefaultStepDto,
} from './dto/checklist-default-response.dto';
import { UploadUrlDto } from './dto/upload-url.dto';
import type { Request } from 'express';

type AuthedRequest = Request & { userId: string };

// The checklist-defaults schema referenced by the getMe / updateChecklistDefaults responses so Scalar
// advertises the read shape — including the read-only `steps` preview (#620/#718). The endpoints
// return the whole merged profile; this documents the `preferences.checklistDefaults` array within it.
const CHECKLIST_DEFAULTS_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    preferences: {
      type: 'object',
      properties: {
        checklistDefaults: {
          type: 'array',
          items: { $ref: getSchemaPath(ChecklistDefaultItemResponseDto) },
        },
      },
    },
  },
} as const;

@ApiTags('User Profile')
@ApiBearerAuth('clerk-jwt')
@ApiExtraModels(ChecklistDefaultItemResponseDto, ChecklistDefaultStepDto)
@Controller('me')
export class UserProfileController {
  constructor(
    private userProfileService: UserProfileService,
    private publicProfileService: PublicProfileService,
  ) {}

  @ApiOperation({ summary: 'Get the current user profile (creates if not exists)' })
  @ApiResponse({
    status: 200,
    description: 'The user profile, including the merged checklist defaults (with read-only step previews).',
    schema: CHECKLIST_DEFAULTS_RESPONSE_SCHEMA,
  })
  @Get()
  getMe(@Req() req: AuthedRequest) {
    return this.userProfileService.findOrCreate(req.userId);
  }

  @ApiOperation({ summary: 'Update the current user profile' })
  @Patch()
  updateMe(@Req() req: AuthedRequest, @Body() dto: UpdateUserProfileDto) {
    return this.userProfileService.update(req.userId, dto);
  }

  @ApiOperation({ summary: 'Mark onboarding as complete (idempotent)' })
  @ApiResponse({ status: 200, description: 'Updated user profile' })
  @Post('onboarding/complete')
  completeOnboarding(@Req() req: AuthedRequest) {
    return this.userProfileService.completeOnboarding(req.userId);
  }

  @ApiOperation({ summary: 'Update checklist defaults (system item dueDateRules, reminderLeadDays, and custom items)' })
  @ApiResponse({
    status: 200,
    description: 'Updated user profile, including the merged checklist defaults (with read-only step previews).',
    schema: CHECKLIST_DEFAULTS_RESPONSE_SCHEMA,
  })
  @Patch('preferences/checklist-defaults')
  updateChecklistDefaults(@Req() req: AuthedRequest, @Body() dto: UpdateChecklistDefaultsDto) {
    return this.userProfileService.updateChecklistDefaults(req.userId, dto);
  }

  @ApiOperation({ summary: 'Get the public profile (creates if not exists)' })
  @Get('public')
  getPublicProfile(@Req() req: AuthedRequest) {
    return this.publicProfileService.findOrCreate(req.userId);
  }

  @ApiOperation({ summary: 'Update the public profile' })
  @Patch('public')
  updatePublicProfile(@Req() req: AuthedRequest, @Body() dto: UpdatePublicProfileDto) {
    return this.publicProfileService.update(req.userId, dto);
  }

  @ApiOperation({ summary: 'Get a presigned upload URL for the logo' })
  @ApiResponse({ status: 200, schema: { example: { uploadUrl: 'https://...', publicUrl: 'https://...' } } })
  @Post('logo-upload-url')
  getLogoUploadUrl(
    @Req() req: AuthedRequest,
    @Body() dto: UploadUrlDto,
  ) {
    return this.publicProfileService.getLogoUploadUrl(req.userId, dto.contentType);
  }

  @ApiOperation({ summary: 'Get a presigned upload URL for the musician photo' })
  @ApiResponse({ status: 200, schema: { example: { uploadUrl: 'https://...', publicUrl: 'https://...' } } })
  @Post('photo-upload-url')
  getPhotoUploadUrl(
    @Req() req: AuthedRequest,
    @Body() dto: UploadUrlDto,
  ) {
    return this.publicProfileService.getPhotoUploadUrl(req.userId, dto.contentType);
  }

  @ApiOperation({ summary: 'Delete the logo from storage and clear the logoUrl field' })
  @ApiResponse({ status: 204 })
  @Delete('logo')
  @HttpCode(204)
  deleteLogo(@Req() req: AuthedRequest) {
    return this.publicProfileService.deleteLogo(req.userId);
  }

  @ApiOperation({ summary: 'Delete the photo from storage and clear the photo field' })
  @ApiResponse({ status: 204 })
  @Delete('photo')
  @HttpCode(204)
  deletePhoto(@Req() req: AuthedRequest) {
    return this.publicProfileService.deletePhoto(req.userId);
  }
}
