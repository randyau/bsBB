import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('logger', () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it('exports a pino logger instance', async () => {
		const { logger } = await import('./logger');
		expect(logger).toBeDefined();
		expect(logger.info).toBeDefined();
		expect(logger.error).toBeDefined();
		expect(logger.warn).toBeDefined();
		expect(logger.debug).toBeDefined();
	});

	it('default level is debug in development', async () => {
		vi.stubEnv('NODE_ENV', 'development');
		vi.stubEnv('LOG_LEVEL', '');
		const { logger } = await import('./logger');
		expect(logger.level).toBe('debug');
	});

	it('default level is info in production', async () => {
		vi.stubEnv('NODE_ENV', 'production');
		vi.stubEnv('LOG_LEVEL', '');
		const { logger } = await import('./logger');
		expect(logger.level).toBe('info');
	});

	it('respects LOG_LEVEL env var override', async () => {
		vi.stubEnv('NODE_ENV', 'production');
		vi.stubEnv('LOG_LEVEL', 'warn');
		const { logger } = await import('./logger');
		expect(logger.level).toBe('warn');
	});

	it('child logger inherits parent level', async () => {
		const { logger } = await import('./logger');
		const child = logger.child({ module: 'test' });
		expect(child.level).toBe(logger.level);
	});

	it('child logger includes module field in all log records', async () => {
		const { logger } = await import('./logger');
		const child = logger.child({ module: 'test:module' });
		// Verify the child was created and has the module field merged into its base
		expect(child).toBeDefined();
		// The module field will be included automatically in all log records from this child
		const logRecord = (child as any).bindings();
		expect(logRecord).toContain('module');
	});
});
