import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { STORAGE_BUCKET, STORAGE_CLIENT } from './storage.tokens';

export interface StorageObjectSummary {
  key: string;
  size: number;
  lastModified: string;
  url: string;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger('Storage');

  constructor(
    @Inject(STORAGE_CLIENT) private readonly client: S3Client,
    @Inject(STORAGE_BUCKET) private readonly bucket: string,
  ) {}

  async put(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<StorageObjectSummary> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    return {
      key,
      size: body.byteLength,
      lastModified: new Date().toISOString(),
      url: await this.signedGetUrl(key),
    };
  }

  async list(limit = 5): Promise<StorageObjectSummary[]> {
    const out = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: 'uploads/',
        MaxKeys: 100,
      }),
    );
    const contents = out.Contents ?? [];
    // ListObjectsV2 returns alphabetically-by-key. Sort DESC by
    // LastModified so the freshest upload lands at position 1 on the
    // dashboard's chip list (newest-first contract).
    const sorted = [...contents].sort((a, b) => {
      const ta = a.LastModified?.getTime() ?? 0;
      const tb = b.LastModified?.getTime() ?? 0;
      return tb - ta;
    });
    const sliced = sorted.slice(0, limit);
    return Promise.all(
      sliced.map(async (item) => ({
        key: item.Key ?? '',
        size: item.Size ?? 0,
        lastModified: (item.LastModified ?? new Date()).toISOString(),
        url: await this.signedGetUrl(item.Key ?? ''),
      })),
    );
  }

  async count(): Promise<number> {
    const out = await this.client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: 'uploads/',
      }),
    );
    return out.KeyCount ?? out.Contents?.length ?? 0;
  }

  async signedGetUrl(key: string): Promise<string> {
    // 5-minute signed URL — long enough for the porter to click,
    // short enough to demonstrate the signing flow.
    return getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: 300 },
    );
  }
}
