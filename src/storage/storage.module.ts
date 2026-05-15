import { Global, Module } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';

export const STORAGE_CLIENT = 'STORAGE_CLIENT';

@Global()
@Module({
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
  ],
  exports: [STORAGE_CLIENT],
})
export class StorageModule {}
