import { Controller, Get, Query } from '@nestjs/common';
import { ItemsService } from './items.service';

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  async list(@Query('limit') limit?: string) {
    const parsed = limit ? Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100) : 20;
    const items = await this.itemsService.list(parsed);
    return { items, count: items.length };
  }
}
