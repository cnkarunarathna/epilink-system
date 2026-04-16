import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as s3GetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageService } from './storage.service';

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn().mockReturnValue('fixed-uuid'),
}));

const mockSend = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
  GetObjectCommand: jest.fn().mockImplementation((input) => ({ input })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

describe('StorageService', () => {
  let service: StorageService;
  let configService: { getOrThrow: jest.Mock };
  const mockedSignedUrl = s3GetSignedUrl as jest.MockedFunction<
    typeof s3GetSignedUrl
  >;

  beforeEach(() => {
    jest.clearAllMocks();
    configService = {
      getOrThrow: jest.fn((key: string) => {
        const map: Record<string, string> = {
          AWS_REGION: 'ap-south-1',
          AWS_ACCESS_KEY_ID: 'key',
          AWS_SECRET: 'secret',
          AWS_S3_BUCKET: 'epilink-bucket',
          AWS_S3_URL: 'cdn.epilink.test',
        };
        return map[key];
      }),
    };
    service = new StorageService(configService as unknown as ConfigService);
    mockedSignedUrl.mockResolvedValue('https://signed.example.com/url');
  });

  it('should reject unsupported mime types for evidence uploads', async () => {
    const file = {
      mimetype: 'text/plain',
      size: 100,
      originalname: 'note.txt',
      buffer: Buffer.from('x'),
    } as Express.Multer.File;

    await expect(service.uploadEvidenceImage(file)).rejects.toThrow(
      BadRequestException,
    );
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('should reject files larger than 10 MB', async () => {
    const file = {
      mimetype: 'image/png',
      size: 10 * 1024 * 1024 + 1,
      originalname: 'large.png',
      buffer: Buffer.from('x'),
    } as Express.Multer.File;

    await expect(service.uploadEvidenceImage(file)).rejects.toThrow(
      'File size exceeds the 10 MB limit.',
    );
  });

  it('should upload evidence image and return key with signed URL', async () => {
    const file = {
      mimetype: 'image/png',
      size: 1024,
      originalname: 'photo.png',
      buffer: Buffer.from('img'),
    } as Express.Multer.File;

    const result = await service.uploadEvidenceImage(file);

    expect(result).toEqual({
      key: 'evidence/fixed-uuid.png',
      signedUrl: 'https://signed.example.com/url',
    });

    expect(PutObjectCommand as unknown as jest.Mock).toHaveBeenCalledWith({
      Bucket: 'epilink-bucket',
      Key: 'evidence/fixed-uuid.png',
      Body: file.buffer,
      ContentType: 'image/png',
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(mockedSignedUrl).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      { expiresIn: 604800 },
    );
  });

  it('should upload report pdf with attachment metadata', async () => {
    const buffer = Buffer.from('pdf');

    const result = await service.uploadReportPdf(buffer, 'weekly-report.pdf');

    expect(result).toEqual({
      key: 'reports/weekly-report.pdf',
      signedUrl: 'https://signed.example.com/url',
    });

    expect(PutObjectCommand as unknown as jest.Mock).toHaveBeenCalledWith({
      Bucket: 'epilink-bucket',
      Key: 'reports/weekly-report.pdf',
      Body: buffer,
      ContentType: 'application/pdf',
      ContentDisposition: 'attachment; filename="weekly-report.pdf"',
    });
  });

  it('should generate signed URL from legacy full S3 URL', async () => {
    await service.getSignedUrl('https://cdn.epilink.test/evidence/legacy.jpg');

    expect(GetObjectCommand as unknown as jest.Mock).toHaveBeenCalledWith({
      Bucket: 'epilink-bucket',
      Key: 'evidence/legacy.jpg',
    });
  });
});
