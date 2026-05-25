import { BadRequestException, Injectable } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { PublicProfileRepository } from './public-profile.repository';
import { UpdatePublicProfileDto } from './dto/update-public-profile.dto';

const HEX_COLOUR_RE = /^#[0-9A-Fa-f]{6}$/;

@Injectable()
export class PublicProfileService {
  constructor(
    private repo: PublicProfileRepository,
    private storage: StorageService,
  ) {}

  findOrCreate(userId: string) {
    return this.repo.upsertByUserId(userId);
  }

  update(userId: string, dto: UpdatePublicProfileDto) {
    if (dto.brandColour !== undefined && !HEX_COLOUR_RE.test(dto.brandColour)) {
      throw new BadRequestException('brandColour must be a valid hex colour (e.g. #3B82F6)');
    }
    return this.repo.updateByUserId(userId, dto);
  }

  async getLogoUploadUrl(userId: string, contentType: string) {
    const key = `logos/${userId}`;
    const uploadUrl = await this.storage.getPresignedUploadUrl(key, contentType);
    return { uploadUrl, publicUrl: this.storage.getPublicUrl(key) };
  }

  async getPhotoUploadUrl(userId: string, contentType: string) {
    const key = `photos/${userId}`;
    const uploadUrl = await this.storage.getPresignedUploadUrl(key, contentType);
    return { uploadUrl, publicUrl: this.storage.getPublicUrl(key) };
  }

  async deleteLogo(userId: string): Promise<void> {
    await this.storage.deleteObject(`logos/${userId}`);
    await this.repo.updateByUserId(userId, { logoUrl: null });
  }

  async deletePhoto(userId: string): Promise<void> {
    await this.storage.deleteObject(`photos/${userId}`);
    await this.repo.updateByUserId(userId, { photo: null });
  }
}
