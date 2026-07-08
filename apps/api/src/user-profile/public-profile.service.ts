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
    const colour = dto.clientPortalConfig?.brandColour;
    if (colour !== undefined && !HEX_COLOUR_RE.test(colour)) {
      throw new BadRequestException('brandColour must be a valid hex colour (e.g. #3B82F6)');
    }
    // logoUrl / photo are asset pointers, not free-form input: the only legitimate value is the
    // app-issued R2 public URL for this user's own key (set by the upload flow). Reject anything
    // else so a user can't store an arbitrary URL that the server later fetches when embedding it
    // into a PDF (SSRF — see assertOwnAssetUrl in documents.service).
    this.assertOwnedAssetUrl(dto.logoUrl, `logos/${userId}`, 'logoUrl');
    this.assertOwnedAssetUrl(dto.photo, `photos/${userId}`, 'photo');
    return this.repo.updateByUserId(userId, dto);
  }

  // undefined = field not being updated; null = clearing the asset — both are allowed. Any other
  // value must be exactly this user's own uploaded-asset URL.
  private assertOwnedAssetUrl(value: string | null | undefined, key: string, field: string): void {
    if (value == null) return;
    if (value !== this.storage.getPublicUrl(key)) {
      throw new BadRequestException(`${field} must be an uploaded asset URL`);
    }
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
    await this.storage.deleteAsset(`logos/${userId}`);
    await this.repo.updateByUserId(userId, { logoUrl: null });
  }

  async deletePhoto(userId: string): Promise<void> {
    await this.storage.deleteAsset(`photos/${userId}`);
    await this.repo.updateByUserId(userId, { photo: null });
  }
}
