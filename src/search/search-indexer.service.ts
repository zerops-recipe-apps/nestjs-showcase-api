import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { MeiliSearch, Index } from 'meilisearch';
import { ITEMS_INDEX, SEARCH_CLIENT } from './search.tokens';
import { ItemsService, Item } from '../items/items.service';

interface IndexedItem {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
}

@Injectable()
export class SearchIndexerService implements OnApplicationBootstrap {
  private readonly logger = new Logger('SearchIndexer');

  constructor(
    @Inject(SEARCH_CLIENT) private readonly client: MeiliSearch,
    private readonly items: ItemsService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    try {
      // Idempotent index bootstrap — primary key declared once;
      // subsequent process boots short-circuit because the index
      // already exists.
      await this.ensureIndex();
      const rows = await this.items.list(1000);
      if (rows.length > 0) {
        await this.indexFor().addDocuments(rows.map(toDocument), {
          primaryKey: 'id',
        });
        this.logger.log(`Indexed ${rows.length} rows into ${ITEMS_INDEX}`);
      } else {
        this.logger.log(`No rows to index into ${ITEMS_INDEX} at startup.`);
      }
    } catch (err) {
      this.logger.warn(
        `Index bootstrap failed (${(err as Error).message}); search will retry on demand.`,
      );
    }
  }

  async upsertOne(item: Item): Promise<void> {
    await this.ensureIndex();
    await this.indexFor().addDocuments([toDocument(item)], {
      primaryKey: 'id',
    });
  }

  async deleteOne(id: number): Promise<void> {
    try {
      await this.indexFor().deleteDocument(id);
    } catch (err) {
      this.logger.warn(`deleteDocument(${id}) failed: ${(err as Error).message}`);
    }
  }

  async search(query: string, limit = 20) {
    await this.ensureIndex();
    return this.indexFor().search(query, { limit });
  }

  async indexedCount(): Promise<number> {
    try {
      const stats = await this.indexFor().getStats();
      return stats.numberOfDocuments ?? 0;
    } catch {
      return 0;
    }
  }

  private indexFor(): Index {
    return this.client.index(ITEMS_INDEX);
  }

  private async ensureIndex(): Promise<void> {
    try {
      await this.client.getIndex(ITEMS_INDEX);
    } catch {
      await this.client.createIndex(ITEMS_INDEX, { primaryKey: 'id' });
      await this.indexFor().updateSearchableAttributes(['name', 'description']);
      await this.indexFor().updateFilterableAttributes(['id']);
    }
  }
}

function toDocument(item: Item): IndexedItem {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    createdAt: item.createdAt,
  };
}
