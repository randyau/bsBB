import type { SessionUser } from '$lib/auth/session.js';

declare global {
	namespace App {
		interface Locals {
			user: SessionUser | null;
			sessionId: string | null;
		}
	}
}

export {};
