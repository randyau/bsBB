/**
 * Background worker process for long-running tasks.
 * Runs as a separate process/container from the web tier.
 *
 * This separation ensures:
 * - Web tier remains stateless and can scale horizontally
 * - Queue distribution is safe across multiple worker instances via PostgreSQL's FOR UPDATE SKIP LOCKED
 * - No duplicate processing or race conditions from competing web process loops
 *
 * Execution:
 *   npx tsx src/worker.ts
 *
 * Or in Docker Compose:
 *   services:
 *     worker:
 *       build: .
 *       command: npm run worker
 *       environment: [DATABASE_URL, ATPROTO_*]
 *       depends_on: [db]
 */

import { db } from '$lib/db';

async function startNotificationWorker() {
	console.log('[worker] notification worker started');

	const pollInterval = 60 * 1000; // 60 seconds

	setInterval(async () => {
		try {
			// Phase 5: Fill in actual DM/email sending logic
			// For now, just log that we checked
			if (process.env.NODE_ENV === 'development') {
				console.debug('[worker] notification queue poll (stub)');
			}
		} catch (err) {
			console.error('[worker] error processing notifications:', err);
		}
	}, pollInterval);
}

async function main() {
	console.log('[worker] initializing...');

	if (!process.env.DATABASE_URL) {
		throw new Error('DATABASE_URL required');
	}

	startNotificationWorker();
	console.log('[worker] ready');
}

main().catch((err) => {
	console.error('[worker fatal error]', err);
	process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
	console.log('[worker] SIGTERM received, shutting down gracefully');
	process.exit(0);
});
