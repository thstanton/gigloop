import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import type { Readable } from 'stream';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService implements OnModuleInit {
  private client: S3Client;
  // Two buckets, split by sensitivity class (ADR-0059). Same R2 account + creds,
  // so one S3Client serves both. Every method below names its bucket explicitly —
  // no generic method silently picks one.
  private assetsBucket: string; // public: musician logos/photos
  private documentsBucket: string; // private (public access off): contracts, invoices, uploads, song lists
  private publicBaseUrl: string;

  onModuleInit() {
    const required = [
      'R2_ACCOUNT_ID',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
      'R2_BUCKET_NAME',
      'R2_DOCUMENTS_BUCKET_NAME',
      'R2_PUBLIC_URL',
    ] as const;

    const missing = required.filter((k) => !process.env[k]);
    if (missing.length) {
      throw new Error(`Missing required R2 environment variables: ${missing.join(', ')}`);
    }

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
    this.assetsBucket = process.env.R2_BUCKET_NAME!;
    this.documentsBucket = process.env.R2_DOCUMENTS_BUCKET_NAME!;
    this.publicBaseUrl = process.env.R2_PUBLIC_URL!.replace(/\/$/, '');
  }

  // ─── Assets — public bucket (logos/photos) ─────────────────────────────────
  // Consumed as world-readable URLs (server-side PDF embedding, sent-email <img>),
  // so these stay public and unsigned (ADR-0059).

  getPresignedUploadUrl(key: string, contentType: string, expiresIn = 300): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.assetsBucket,
      Key: key,
      ContentType: contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  getPublicUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }

  async deleteAsset(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.assetsBucket, Key: key }));
  }

  // ─── Documents — private bucket (contracts/invoices/uploads/song lists) ─────
  // Never world-readable. Reachable only via a short-TTL presigned GET minted
  // after an access check (ADR-0059).

  async putDocument(key: string, buffer: Buffer, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.documentsBucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      }),
    );
  }

  async deleteDocument(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.documentsBucket, Key: key }));
  }

  async getDocument(key: string): Promise<Buffer> {
    const { Body } = await this.client.send(
      new GetObjectCommand({ Bucket: this.documentsBucket, Key: key }),
    );
    const stream = Body as Readable;
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      stream.on('data', (chunk: unknown) =>
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string)),
      );
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  // Short-TTL presigned GET against the private documents bucket. Minted only
  // after the caller passes the access check (admin ownership / portal token +
  // visibility); ~60s is long enough for the 302 round-trip, too short to be a
  // useful leaked credential. Mirrors getPresignedUploadUrl.
  getPresignedDownloadUrl(key: string, expiresIn = 60): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.documentsBucket, Key: key });
    return getSignedUrl(this.client, command, { expiresIn });
  }
}
