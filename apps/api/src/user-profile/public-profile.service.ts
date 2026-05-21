import { BadRequestException, Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PublicProfileRepository } from './public-profile.repository';
import { UpdatePublicProfileDto } from './dto/update-public-profile.dto';

const HEX_COLOUR_RE = /^#[0-9A-Fa-f]{6}$/;

@Injectable()
export class PublicProfileService {
  constructor(private repo: PublicProfileRepository) {}

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
