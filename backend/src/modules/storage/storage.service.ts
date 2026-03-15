import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private client: Minio.Client;
  private bucket: string;

  constructor(private readonly configService: ConfigService) {
    this.client = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: parseInt(this.configService.get<string>('MINIO_PORT', '9000'), 10),
      useSSL: this.configService.get<string>('MINIO_USE_SSL') === 'true',
      accessKey: this.configService.get<string>('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.configService.get<string>('MINIO_SECRET_KEY', 'minioadmin123'),
    });
    this.bucket = this.configService.get<string>('MINIO_BUCKET', 'tcardio-reports');
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        this.logger.log(`Bucket "${this.bucket}" created`);
      }
    } catch (error) {
      this.logger.warn(`MinIO not available: ${error.message}`);
    }
  }

  async uploadFile(fileName: string, buffer: Buffer, contentType: string = 'application/pdf'): Promise<string> {
    await this.client.putObject(this.bucket, fileName, buffer, buffer.length, {
      'Content-Type': contentType,
    });
    return `${this.bucket}/${fileName}`;
  }

  async getFileStream(fileName: string): Promise<NodeJS.ReadableStream> {
    return this.client.getObject(this.bucket, fileName);
  }

  async deleteFile(fileName: string): Promise<void> {
    await this.client.removeObject(this.bucket, fileName);
  }

  async getPresignedUrl(fileName: string, expirySeconds: number = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, fileName, expirySeconds);
  }

  async uploadToPath(bucket: string, path: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.client.putObject(bucket, path, buffer, buffer.length, {
      'Content-Type': contentType,
    });
    return `${bucket}/${path}`;
  }

  async downloadBuffer(bucket: string, path: string): Promise<Buffer> {
    const stream = await this.client.getObject(bucket, path);
    const chunks: Buffer[] = [];
    return new Promise((resolve, reject) => {
      stream.on('data', (chunk: Buffer) => chunks.push(chunk));
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
}
