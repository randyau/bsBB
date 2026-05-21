/**
 * One-time script to populate drizzle.__drizzle_migrations for databases
 * that have the schema applied but an empty migrations tracking table.
 *
 * This happens when Drizzle's migrate() runs all migrations in one transaction
 * and the first migration fails (e.g. non-idempotent CREATE TABLE on existing
 * tables), rolling back the entire batch including the tracking inserts.
 *
 * Usage (inside the app container or with DATABASE_URL set):
 *   npx tsx scripts/stamp-migrations.ts
 *
 * Safe to re-run — skips migrations already recorded in __drizzle_migrations.
 */

import { readMigrationFiles } from 'drizzle-orm/migrator';
import postgres from 'postgres';
import { resolve } from 'path';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
	console.error('DATABASE_URL is required');
	process.exit(1);
}

const migrationsFolder = resolve('./src/lib/db/migrations');
const migrations = readMigrationFiles({ migrationsFolder });

console.log(`Found ${migrations.length} migrations in journal.`);

const client = postgres(DATABASE_URL, { max: 1 });

try {
	// Fetch already-recorded migrations
	const existing = await client<{ hash: string }[]>`
		SELECT hash FROM drizzle.__drizzle_migrations
	`;
	const existingHashes = new Set(existing.map((r) => r.hash));

	let stamped = 0;
	for (const migration of migrations) {
		if (existingHashes.has(migration.hash)) {
			console.log(`  already recorded: ${migration.hash}`);
			continue;
		}
		await client`
			INSERT INTO drizzle.__drizzle_migrations (hash, created_at)
			VALUES (${migration.hash}, ${migration.folderMillis})
		`;
		console.log(`  stamped: ${migration.hash} (${migration.folderMillis})`);
		stamped++;
	}

	console.log(`\nDone. Stamped ${stamped} migration(s).`);
	console.log('Run npm run db:migrate to verify — it should report nothing to apply.');
} finally {
	await client.end();
}
