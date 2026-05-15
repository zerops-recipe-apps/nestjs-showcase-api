import { forwardRef, Global, Module } from '@nestjs/common';
import { MeiliSearch } from 'meilisearch';
import { SearchIndexerService } from './search-indexer.service';
import { SearchController } from './search.controller';
import { ItemsModule } from '../items/items.module';
import { ITEMS_INDEX, SEARCH_CLIENT } from './search.tokens';

export { ITEMS_INDEX, SEARCH_CLIENT };

@Global()
@Module({
  imports: [forwardRef(() => ItemsModule)],
  controllers: [SearchController],
  providers: [
    {
      provide: SEARCH_CLIENT,
      useFactory: (): MeiliSearch =>
        new MeiliSearch({
          host: process.env.SEARCH_URL!,
          apiKey: process.env.SEARCH_MASTER_KEY,
        }),
    },
    SearchIndexerService,
  ],
  exports: [SEARCH_CLIENT, SearchIndexerService],
})
export class SearchModule {}
