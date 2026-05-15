import { describe, it, expect } from 'vitest';
import { checkAbuse } from './index.js';
import type { AbuseContext } from './index.js';

const contexts: AbuseContext[] = [
	{ type: 'post_submit', did: 'did:plc:test', ip: '1.2.3.4' },
	{ type: 'thread_create', did: 'did:plc:test', ip: '1.2.3.4' },
	{ type: 'login_attempt', ip: '1.2.3.4' },
	{ type: 'preview_request', did: null, ip: '1.2.3.4' },
	{ type: 'flag_submit', did: 'did:plc:test', ip: '1.2.3.4' },
	{ type: 'og_fetch', ip: '1.2.3.4' },
];

describe('checkAbuse stub', () => {
	for (const ctx of contexts) {
		it(`allows ${ctx.type} unconditionally`, async () => {
			const result = await checkAbuse(ctx);
			expect(result).toEqual({ allowed: true });
		});
	}

	it('never throws', async () => {
		for (const ctx of contexts) {
			await expect(checkAbuse(ctx)).resolves.not.toThrow();
		}
	});
});
