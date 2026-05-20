import { BadRequestException, Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { UserProfileRepository } from './user-profile.repository';
import { UpdateUserProfileDto } from './dto/update-user-profile.dto';

const HEX_COLOUR_RE = /^#[0-9A-Fa-f]{6}$/;

@Injectable()
export class UserProfileService {
  constructor(private repo: UserProfileRepository) {}

  findOrCreate(userId: string) {
    return this.repo.upsertByUserId(userId);
  }

  update(userId: string, dto: UpdateUserProfileDto) {
    if (dto.brandColour !== undefined && !HEX_COLOUR_RE.test(dto.brandColour)) {
      throw new BadRequestException('brandColour must be a valid hex colour (e.g. #3B82F6)');
    }
    return this.repo.updateByUserId(userId, dto);
  }

  async getLogoUploadUrl(userId: string, contentType: string) {
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });

    const key = `logos/${userId}`;
    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(client, command, { expiresIn: 300 });
    const publicUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

    return { uploadUrl, publicUrl };
  }
}
