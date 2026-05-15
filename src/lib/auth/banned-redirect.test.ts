import { describe, it, expect } from 'vitest';

// Pure logic extracted from hooks.server.ts for unit testing
function shouldRedirectToBanned(
	globalRole: string | undefined,
	pathname: string
): boolean {
	return (
		globalRole === 'banned' &&
		pathname !== '/banned' &&
		!pathname.startsWith('/logout')
	);
}

describe('banned user redirect logic', () => {
	it('redirects a banned user on a normal route', () => {
		expect(shouldRedirectToBanned('banned', '/f/general')).toBe(true);
	});

	it('does not redirect on /banned itself', () => {
		expect(shouldRedirectToBanned('banned', '/banned')).toBe(false);
	});

	it('does not redirect on /logout', () => {
		expect(shouldRedirectToBanned('banned', '/logout')).toBe(false);
	});

	it('does not redirect a member', () => {
		expect(shouldRedirectToBanned('member', '/f/general')).toBe(false);
	});

	it('does not redirect an admin', () => {
		expect(shouldRedirectToBanned('admin', '/f/general')).toBe(false);
	});

	it('does not redirect when user is null (unauthenticated)', () => {
		expect(shouldRedirectToBanned(undefined, '/f/general')).toBe(false);
	});
});
