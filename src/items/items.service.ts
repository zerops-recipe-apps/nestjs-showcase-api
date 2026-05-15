import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../db/db.module';

export interface Item {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
}

@Injectable()
export class ItemsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async list(limit = 20): Promise<Item[]> {
    const { rows } = await this.pool.query(
      'SELECT id, name, description, created_at FROM items ORDER BY id ASC LIMIT $1',
      [limit],
    );
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      createdAt: r.created_at.toISOString(),
    }));
  }
}
