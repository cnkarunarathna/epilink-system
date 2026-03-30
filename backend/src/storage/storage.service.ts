import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import * as path from 'path';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

@Injectable()
export class StorageService {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly bucketUrl: string;

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
    this.bucketUrl = `https://${s3Url}`;
  }

  async uploadEvidenceImage(file: Express.Multer.File): Promise<string> {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Only JPEG, PNG, and WebP images are allowed.',
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File size exceeds the 10 MB limit.');
    }

    const ext = path.extname(file.originalname) || '.jpg';
    const key = `evidence/${randomUUID()}${ext}`;

    const params: PutObjectCommandInput = {
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    };

    await this.s3.send(new PutObjectCommand(params));

    return `${this.bucketUrl}/${key}`;
  }
}
