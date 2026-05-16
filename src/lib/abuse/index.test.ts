import { describe, it, expect } from 'vitest';
import type { AbuseContext, AbuseVerdict } from './index.js';

/**
 * Unit tests for checkAbuse types and contract.
 *
 * checkAbuse requires a live Postgres DB (rate_limit_buckets table).
 * These tests verify the type contract and context shapes only — DB-dependent
 * behavior (actual enforcement) is covered by the Phase 4 integration tests
 * in src/routes/api/test/integration.test.ts.
 *
 * Key learnings from integration testing:
 * - checkAbuse returns AbuseVerdict ({allowed: boolean}), never throws.
 * - Call sites must check verdict.allowed — try/catch does NOT work.
 * - Rate limit SQL requires windowStart as ISO string with ::timestamptz cast;
 *   passing a plain Date object via drizzle sql`` template fails silently with postgres-js.
 */

describe('AbuseContext type shapes', () => {
	it('post_submit context has did and ip', () => {
		const ctx: AbuseContext = { type: 'post_submit', did: 'did:plc:test', ip: '1.2.3.4' };
		expect(ctx.type).toBe('post_submit');
	});

	it('thread_create context has did and ip', () => {
		const ctx: AbuseContext = { type: 'thread_create', did: 'did:plc:test', ip: '1.2.3.4' };
		expect(ctx.type).toBe('thread_create');
	});

	it('login_attempt context has only ip', () => {
		const ctx: AbuseContext = { type: 'login_attempt', ip: '1.2.3.4' };
		expect(ctx.type).toBe('login_attempt');
	});

	it('preview_request context accepts null did', () => {
		const ctx: AbuseContext = { type: 'preview_request', did: null, ip: '1.2.3.4' };
		expect(ctx.type).toBe('preview_request');
	});

	it('flag_submit context has did and ip', () => {
		const ctx: AbuseContext = { type: 'flag_submit', did: 'did:plc:test', ip: '1.2.3.4' };
		expect(ctx.type).toBe('flag_submit');
	});

	it('og_fetch context has only ip', () => {
		const ctx: AbuseContext = { type: 'og_fetch', ip: '1.2.3.4' };
		expect(ctx.type).toBe('og_fetch');
	});
});

describe('AbuseVerdict type shapes', () => {
	it('allowed verdict shape', () => {
		const v: AbuseVerdict = { allowed: true };
		expect(v.allowed).toBe(true);
	});

	it('denied verdict shape with reason', () => {
		const v: AbuseVerdict = { allowed: false, reason: 'Rate limit exceeded for thread_create', retryAfterSeconds: 3540 };
		expect(v.allowed).toBe(false);
		if (!v.allowed) {
			expect(v.reason).toContain('thread_create');
			expect(v.retryAfterSeconds).toBeGreaterThan(0);
		}
	});
});
