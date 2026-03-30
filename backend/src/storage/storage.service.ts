import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl as s3GetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import * as path from 'path';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

// Pre-signed URL expiry: 7 days (max for IAM user credentials)
const SIGNED_URL_EXPIRES_SECONDS = 7 * 24 * 60 * 60;

// Prefix used to detect raw S3 keys vs legacy full URLs stored in DB
const KEY_PREFIX = 'evidence/';

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly bucketUrlPrefix: string;

  constructor(private readonly configService: ConfigService) {
    this.s3 = new S3Client({
      region: this.configService.getOrThrow<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>('AWS_SECRET'),
      },
    });

    this.bucket = this.configService.getOrThrow<string>('AWS_S3_BUCKET');
    const s3Url = this.configService.getOrThrow<string>('AWS_S3_URL');
    this.bucketUrlPrefix = `https://${s3Url}/`;
  }

  /**
   * Upload an evidence image to S3.
   * Returns only the S3 object key (e.g. "evidence/<uuid>.png").
   * The caller should store this key and generate signed URLs on demand.
   */
  async uploadEvidenceImage(
    file: Express.Multer.File,
  ): Promise<{ key: string; signedUrl: string }> {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, and WebP images are allowed.',
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File size exceeds the 10 MB limit.');
    }

    const ext = path.extname(file.originalname) || '.jpg';
    const key = `${KEY_PREFIX}${randomUUID()}${ext}`;

    const params: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    await this.s3.send(new PutObjectCommand(params));

    const signedUrl = await this.getSignedUrl(key);
    return { key, signedUrl };
  }

  /**
   * Generate a pre-signed GET URL for an S3 object key.
   * Also handles legacy records where the full S3 URL was stored instead of
   * just the key — it extracts the key automatically.
   */
  async getSignedUrl(keyOrLegacyUrl: string): Promise<string> {
    const key = keyOrLegacyUrl.startsWith('http')
      ? keyOrLegacyUrl.replace(this.bucketUrlPrefix, '')
      : keyOrLegacyUrl;

    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });
    return s3GetSignedUrl(this.s3, command, {
      expiresIn: SIGNED_URL_EXPIRES_SECONDS,
    });
  }
}
