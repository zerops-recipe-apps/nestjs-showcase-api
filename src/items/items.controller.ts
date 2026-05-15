import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ItemsService } from './items.service';
import { SearchIndexerService } from '../search/search-indexer.service';

interface CreateBody {
  name?: unknown;
  description?: unknown;
}

interface UpdateBody {
  name?: unknown;
  description?: unknown;
}

@Controller('items')
export class ItemsController {
  constructor(
    private readonly itemsService: ItemsService,
    private readonly indexer: SearchIndexerService,
  ) {}

  @Get()
  async list(@Query('limit') limit?: string) {
    const parsed = limit ? clamp(parseInt(limit, 10) || 20, 1, 100) : 20;
    const items = await this.itemsService.list(parsed);
    const total = await this.itemsService.count();
    return { items, count: items.length, total };
  }

  @Get(':id')
  async show(@Param('id', ParseIntPipe) id: number) {
    const item = await this.itemsService.findOne(id);
    if (!item) throw new NotFoundException(`Item ${id} not found`);
    return { item };
  }

  @Post()
  async create(@Body() body: CreateBody) {
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!name) {
      throw new BadRequestException('name is required');
    }
    const description =
      typeof body.description === 'string' ? body.description : null;
    const item = await this.itemsService.create({ name, description });
    // Index immediately so the search panel sees newly-created rows
    // without waiting for a background reindex pass.
    void this.indexer.upsertOne(item).catch(() => undefined);
    return { item };
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: UpdateBody,
  ) {
    const patch: { name?: string; description?: string | null } = {};
    if (typeof body.name === 'string') patch.name = body.name.trim();
    if (body.description === null || typeof body.description === 'string') {
      patch.description = body.description as string | null;
    }
    const item = await this.itemsService.update(id, patch);
    if (!item) throw new NotFoundException(`Item ${id} not found`);
    void this.indexer.upsertOne(item).catch(() => undefined);
    return { item };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(@Param('id', ParseIntPipe) id: number) {
    const ok = await this.itemsService.remove(id);
    if (!ok) throw new NotFoundException(`Item ${id} not found`);
    void this.indexer.deleteOne(id).catch(() => undefined);
    return { deleted: true, id };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
