import { Controller, Get, Query } from '@nestjs/common';
import { SearchIndexerService } from './search-indexer.service';

@Controller()
export class SearchController {
  constructor(private readonly indexer: SearchIndexerService) {}

  @Get('search')
  async search(@Query('q') q?: string, @Query('limit') limit?: string) {
    const query = (q ?? '').trim();
    const parsed = limit ? clamp(parseInt(limit, 10) || 20, 1, 50) : 20;
    if (!query) {
      const total = await this.indexer.indexedCount();
      return { hits: [], query: '', total, indexed: total };
    }
    const result = await this.indexer.search(query, parsed);
    return {
      hits: result.hits,
      query,
      total: result.estimatedTotalHits ?? result.hits.length,
      indexed: await this.indexer.indexedCount(),
    };
  }

  @Get('search/state')
  async state() {
    return { indexed: await this.indexer.indexedCount() };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
