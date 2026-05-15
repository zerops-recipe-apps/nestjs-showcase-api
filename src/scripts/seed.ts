import { Client } from 'pg';

async function main() {
  const client = new Client({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  await client.connect();
  try {
    const { rows } = await client.query('SELECT COUNT(*)::int AS c FROM items');
    if (rows[0].c > 0) {
      // eslint-disable-next-line no-console
      console.log(`Seed skipped: items already has ${rows[0].c} row(s).`);
      return;
    }
    await client.query(
      `INSERT INTO items (name, description) VALUES
        ('Welcome', 'First seeded showcase row'),
        ('Cache demo', 'Row used by the cache panel'),
        ('Search demo', 'Row indexed by the search panel');`,
    );
    // eslint-disable-next-line no-console
    console.log('Seeded 3 rows into items.');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed', err);
  process.exit(1);
});
