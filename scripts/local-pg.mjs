/**
 * PostgreSQL lokal untuk development (embedded, tanpa install PostgreSQL).
 *
 * Jalankan: bun run db:local
 * Hentikan: Ctrl+C
 *
 * Data tersimpan di .local/pgdata sehingga tetap ada setelah restart.
 * Untuk production tetap gunakan PostgreSQL server biasa (Docker/cloud/VPS).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import EmbeddedPostgres from 'embedded-postgres';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = process.env.PG_DATA_DIR ?? path.join(rootDir, '.local', 'pgdata');
const port = Number(process.env.PG_PORT ?? 5432);
const user = process.env.PG_USER ?? 'postgres';
const password = process.env.PG_PASSWORD ?? 'postgres';
const database = process.env.PG_DATABASE ?? 'marketara';

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user,
  password,
  port,
  persistent: true,
  autoRehydrateSymlinks: true,
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
});

let stopping = false;

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`\n[pg-local] Menerima ${signal}, menghentikan PostgreSQL...`);
  try {
    await pg.stop();
    console.log('[pg-local] PostgreSQL berhenti.');
  } catch (error) {
    console.error('[pg-local] Gagal menghentikan PostgreSQL:', error.message);
  }
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  if (!fs.existsSync(path.join(dataDir, 'PG_VERSION'))) {
    console.log('[pg-local] Inisialisasi cluster PostgreSQL pertama kali...');
    await pg.initialise();
  }

  console.log(`[pg-local] Menjalankan PostgreSQL di port ${port}...`);
  await pg.start();

  try {
    await pg.createDatabase(database);
    console.log(`[pg-local] Database "${database}" dibuat.`);
  } catch {
    console.log(`[pg-local] Database "${database}" sudah ada, lanjut.`);
  }

  const connectionUrl = `postgres://${user}:${password}@localhost:${port}/${database}`;
  console.log('');
  console.log('[pg-local] Siap dipakai.');
  console.log(`[pg-local] DATABASE_URL=${connectionUrl}`);
  console.log('[pg-local] Tekan Ctrl+C untuk berhenti.');
  console.log('');

  // Jaga proses tetap hidup selama PostgreSQL berjalan.
  await new Promise(() => {});
} catch (error) {
  console.error('[pg-local] Gagal menjalankan PostgreSQL:', error);
  process.exit(1);
}
