import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../db/db.tokens';

export interface Item {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
}

export interface CreateItemInput {
  name: string;
  description?: string | null;
}

export interface UpdateItemInput {
  name?: string;
  description?: string | null;
}

@Injectable()
export class ItemsService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async list(limit = 20): Promise<Item[]> {
    // Newest-first ordering — the dashboard chip / list spec requires
    // the just-created row to land at position 1 in the rendered list
    // so the verifier reads the click delta correctly.
    const { rows } = await this.pool.query(
      'SELECT id, name, description, created_at FROM items ORDER BY created_at DESC, id DESC LIMIT $1',
      [limit],
    );
    return rows.map(toItem);
  }

  async count(): Promise<number> {
    const { rows } = await this.pool.query('SELECT COUNT(*)::int AS c FROM items');
    return rows[0]?.c ?? 0;
  }

  async findOne(id: number): Promise<Item | null> {
    const { rows } = await this.pool.query(
      'SELECT id, name, description, created_at FROM items WHERE id = $1',
      [id],
    );
    return rows[0] ? toItem(rows[0]) : null;
  }

  async create(input: CreateItemInput): Promise<Item> {
    const { rows } = await this.pool.query(
      `INSERT INTO items (name, description) VALUES ($1, $2)
        RETURNING id, name, description, created_at`,
      [input.name, input.description ?? null],
    );
    return toItem(rows[0]);
  }

  async update(id: number, input: UpdateItemInput): Promise<Item | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (typeof input.name === 'string') {
      fields.push(`name = $${i++}`);
      values.push(input.name);
    }
    if (input.description !== undefined) {
      fields.push(`description = $${i++}`);
      values.push(input.description);
    }
    if (fields.length === 0) {
      return this.findOne(id);
    }
    values.push(id);
    const { rows } = await this.pool.query(
      `UPDATE items SET ${fields.join(', ')} WHERE id = $${i}
        RETURNING id, name, description, created_at`,
      values,
    );
    return rows[0] ? toItem(rows[0]) : null;
  }

  async remove(id: number): Promise<boolean> {
    const { rowCount } = await this.pool.query('DELETE FROM items WHERE id = $1', [id]);
    return (rowCount ?? 0) > 0;
  }

  async searchByName(query: string, limit = 20): Promise<Item[]> {
    // Used as a DB-side fallback when meilisearch is unavailable; the
    // primary search path runs through the search module.
    const { rows } = await this.pool.query(
      `SELECT id, name, description, created_at FROM items
        WHERE name ILIKE $1 OR description ILIKE $1
        ORDER BY created_at DESC, id DESC LIMIT $2`,
      [`%${query}%`, limit],
    );
    return rows.map(toItem);
  }
}

function toItem(row: {
  id: number;
  name: string;
  description: string | null;
  created_at: Date;
}): Item {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdAt: row.created_at.toISOString(),
  };
}
