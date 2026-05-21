import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateAssetSlug } from '$lib/assets';

// Mock database and filesystem operations
vi.mock('$lib/db', () => ({
	db: {
		query: {
			adminAssets: {
				findMany: vi.fn(),
			},
		},
		insert: vi.fn().mockReturnValue({
			values: vi.fn().mockResolvedValue(undefined),
		}),
		update: vi.fn().mockReturnValue({
			set: vi.fn().mockReturnValue({
				where: vi.fn().mockResolvedValue(undefined),
			}),
		}),
		delete: vi.fn().mockReturnValue({
			where: vi.fn().mockResolvedValue(undefined),
		}),
	},
}));

vi.mock('fs', () => ({
	writeFileSync: vi.fn(),
	unlinkSync: vi.fn(),
}));

describe('Admin Assets Server Actions', () => {
	describe('uploadAsset', () => {
		it('requires admin permission', async () => {
			const { actions } = await import('./+page.server');
			const request = new Request('http://localhost/admin/assets', {
				method: 'POST',
				body: new FormData(),
			});

			const result = await actions.uploadAsset({
				request,
				locals: { user: null, sessionId: null },
			} as any);

			expect(result).toEqual({ error: 'Unauthorized' });
		});

		it('rejects non-admin users', async () => {
			const { actions } = await import('./+page.server');
			const request = new Request('http://localhost/admin/assets', {
				method: 'POST',
				body: new FormData(),
			});

			const result = await actions.uploadAsset({
				request,
				locals: {
					user: { globalRole: 'member' },
					sessionId: null,
				},
			} as any);

			expect(result).toEqual({ error: 'Unauthorized' });
		});

		it('requires a file', async () => {
			const { actions } = await import('./+page.server');
			const form = new FormData();
			const request = new Request('http://localhost/admin/assets', {
				method: 'POST',
				body: form,
			});

			const result = await actions.uploadAsset({
				request,
				locals: {
					user: { globalRole: 'admin', did: 'did:example:admin' },
					sessionId: null,
				},
			} as any);

			expect(result).toEqual({ error: 'No file provided' });
		});

		it('rejects disallowed MIME types', async () => {
			const { actions } = await import('./+page.server');
			const form = new FormData();
			form.append('file', new File(['content'], 'test.exe', { type: 'application/x-msdownload' }));
			const request = new Request('http://localhost/admin/assets', {
				method: 'POST',
				body: form,
			});

			const result = await actions.uploadAsset({
				request,
				locals: {
					user: { globalRole: 'admin', did: 'did:example:admin' },
					sessionId: null,
				},
			} as any);

			expect(result?.error).toMatch(/File type not allowed/);
		});

		it('rejects files exceeding size limit', async () => {
			const { actions } = await import('./+page.server');
			const largeContent = new ArrayBuffer(51 * 1024 * 1024); // 51 MB
			const form = new FormData();
			form.append('file', new File([largeContent], 'test.pdf', { type: 'application/pdf' }));
			const request = new Request('http://localhost/admin/assets', {
				method: 'POST',
				body: form,
			});

			const result = await actions.uploadAsset({
				request,
				locals: {
					user: { globalRole: 'admin', did: 'did:example:admin' },
					sessionId: null,
				},
			} as any);

			expect(result?.error).toMatch(/File too large/);
		});

		it('accepts allowed image types', async () => {
			const { actions } = await import('./+page.server');
			const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

			for (const mimeType of allowedTypes) {
				const form = new FormData();
				form.append('file', new File(['img'], 'test.jpg', { type: mimeType }));
				const request = new Request('http://localhost/admin/assets', {
					method: 'POST',
					body: form,
				});

				const result = await actions.uploadAsset({
					request,
					locals: {
						user: { globalRole: 'admin', did: 'did:example:admin' },
						sessionId: null,
					},
				} as any);

				expect(result?.success).toBe(true);
				expect(result?.slug).toBeDefined();
				expect(result?.url).toMatch(/^\/assets\//);
			}
		});

		it('accepts allowed document types', async () => {
			const { actions } = await import('./+page.server');
			const allowedTypes = ['application/pdf', 'application/zip'];

			for (const mimeType of allowedTypes) {
				const form = new FormData();
				form.append('file', new File(['content'], 'test.file', { type: mimeType }));
				const request = new Request('http://localhost/admin/assets', {
					method: 'POST',
					body: form,
				});

				const result = await actions.uploadAsset({
					request,
					locals: {
						user: { globalRole: 'admin', did: 'did:example:admin' },
						sessionId: null,
					},
				} as any);

				expect(result?.success).toBe(true);
				expect(result?.slug).toBeDefined();
			}
		});
	});

	describe('deleteAsset', () => {
		it('requires admin permission', async () => {
			const { actions } = await import('./+page.server');
			const form = new FormData();
			form.append('slug', 'test-slug');
			const request = new Request('http://localhost/admin/assets', {
				method: 'POST',
				body: form,
			});

			const result = await actions.deleteAsset({
				request,
				locals: { user: null, sessionId: null },
			} as any);

			expect(result).toEqual({ error: 'Unauthorized' });
		});

		it('requires a slug', async () => {
			const { actions } = await import('./+page.server');
			const form = new FormData();
			const request = new Request('http://localhost/admin/assets', {
				method: 'POST',
				body: form,
			});

			const result = await actions.deleteAsset({
				request,
				locals: {
					user: { globalRole: 'admin', did: 'did:example:admin' },
					sessionId: null,
				},
			} as any);

			expect(result).toEqual({ error: 'No slug provided' });
		});

		it('deletes asset on success', async () => {
			const { actions } = await import('./+page.server');
			const form = new FormData();
			form.append('slug', 'test-slug-123');
			const request = new Request('http://localhost/admin/assets', {
				method: 'POST',
				body: form,
			});

			const result = await actions.deleteAsset({
				request,
				locals: {
					user: { globalRole: 'admin', did: 'did:example:admin' },
					sessionId: null,
				},
			} as any);

			expect(result).toEqual({ success: true });
		});
	});

	describe('renameAsset', () => {
		it('requires admin permission', async () => {
			const { actions } = await import('./+page.server');
			const form = new FormData();
			form.append('slug', 'test-slug');
			form.append('newFilename', 'new.pdf');
			const request = new Request('http://localhost/admin/assets', {
				method: 'POST',
				body: form,
			});

			const result = await actions.renameAsset({
				request,
				locals: { user: null, sessionId: null },
			} as any);

			expect(result).toEqual({ error: 'Unauthorized' });
		});

		it('requires slug and filename', async () => {
			const { actions } = await import('./+page.server');
			const form = new FormData();
			form.append('slug', 'test-slug');
			const request = new Request('http://localhost/admin/assets', {
				method: 'POST',
				body: form,
			});

			const result = await actions.renameAsset({
				request,
				locals: {
					user: { globalRole: 'admin', did: 'did:example:admin' },
					sessionId: null,
				},
			} as any);

			expect(result).toEqual({ error: 'Missing slug or filename' });
		});

		it('renames asset on success', async () => {
			const { actions } = await import('./+page.server');
			const form = new FormData();
			form.append('slug', 'test-slug-123');
			form.append('newFilename', 'renamed-file.pdf');
			const request = new Request('http://localhost/admin/assets', {
				method: 'POST',
				body: form,
			});

			const result = await actions.renameAsset({
				request,
				locals: {
					user: { globalRole: 'admin', did: 'did:example:admin' },
					sessionId: null,
				},
			} as any);

			expect(result).toEqual({ success: true });
		});
	});
});
