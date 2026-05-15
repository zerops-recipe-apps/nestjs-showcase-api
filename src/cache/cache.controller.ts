import { Controller, Get, Header, Post, Res } from '@nestjs/common';
import type { Response } from 'express';
import { CacheService } from './cache.service';

@Controller('cache')
export class CacheController {
  constructor(private readonly cache: CacheService) {}

  @Get('demo')
  async demo(@Res({ passthrough: true }) res: Response) {
    const result = await this.cache.fetchDemoPayload();
    // Surface the cache decision in response headers so curl can read
    // HIT/MISS without parsing the body; the SPA reads the same headers.
    // The header names must also appear in CORS exposedHeaders for
    // cross-origin JS to see them.
    res.setHeader('X-Cache', result.cacheHit ? 'HIT' : 'MISS');
    res.setHeader('X-Cache-Elapsed-Ms', String(result.elapsedMs));
    const stats = await this.cache.stats();
    return {
      payload: result.payload,
      cacheHit: result.cacheHit,
      elapsedMs: result.elapsedMs,
      hits: stats.hits,
      misses: stats.misses,
    };
  }

  @Get('state')
  @Header('Cache-Control', 'no-store')
  async state() {
    return this.cache.stats();
  }

  @Post('reset')
  async reset() {
    await this.cache.resetDemo();
    return { reset: true };
  }
}
