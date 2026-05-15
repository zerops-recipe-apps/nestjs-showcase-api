import { Global, Module } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import { StorageController } from './storage.controller';
import { StorageService } from './storage.service';
import { STORAGE_BUCKET, STORAGE_CLIENT } from './storage.tokens';

export { STORAGE_BUCKET, STORAGE_CLIENT };

@Global()
@Module({
  controllers: [StorageController],
  providers: [
    {
      provide: STORAGE_CLIENT,
      useFactory: (): S3Client => {
        return new S3Client({
          // ${storage_apiUrl} already carries the https:// scheme.
          endpoint: process.env.S3_ENDPOINT,
          // MinIO ignores the value, but every S3 SDK requires one.
          region: process.env.S3_REGION ?? 'us-east-1',
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID!,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
          },
          // MinIO backend behind Zerops object storage requires
          // path-style addressing.
          forcePathStyle: true,
        });
      },
    },
    {
      provide: STORAGE_BUCKET,
      useFactory: () => process.env.S3_BUCKET ?? '',
    },
    StorageService,
  ],
  exports: [STORAGE_CLIENT, STORAGE_BUCKET, StorageService],
})
export class StorageModule {}
