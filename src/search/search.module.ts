import { Global, Module } from '@nestjs/common';
import { MeiliSearch } from 'meilisearch';

export const SEARCH_CLIENT = 'SEARCH_CLIENT';

@Global()
@Module({
  providers: [
    {
      provide: SEARCH_CLIENT,
      useFactory: (): MeiliSearch =>
        new MeiliSearch({
          host: process.env.SEARCH_URL!,
          apiKey: process.env.SEARCH_MASTER_KEY,
        }),
    },
  ],
  exports: [SEARCH_CLIENT],
})
export class SearchModule {}
