import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

type DrizzleDb = ReturnType<typeof drizzle<typeof schema>>;

let cachedDb: DrizzleDb | null = null;

function getDatabaseUrl(): string {
	// First try process.env (set via NODE_OPTIONS or direct export)
	if (process.env.DATABASE_URL) {
		return process.env.DATABASE_URL;
	}

	// Fallback: dev default (only if DATABASE_URL is not required in production)
	const isDev = process.env.NODE_ENV !== 'production' && !process.env.CI;
	if (isDev) {
		// Default local dev database
		return 'postgresql://forum:forum@localhost:5432/forum';
	}

	throw new Error('DATABASE_URL environment variable is required');
}

// Lazy-load database on first access, allowing module to load without DATABASE_URL
export const db = new Proxy({} as DrizzleDb, {
	get(_target, prop) {
		if (!cachedDb) {
			const url = getDatabaseUrl();
			cachedDb = drizzle(postgres(url), { schema });
		}
		return Reflect.get(cachedDb, prop);
	}
}) as DrizzleDb;
