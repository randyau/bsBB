import { NodeOAuthClient, type NodeSavedSession, type NodeSavedState } from '@atproto/oauth-client-node';
import { Keyset } from '@atproto/jwk';
import { JoseKey } from '@atproto/jwk-jose';
import { getSetting } from '$lib/settings';

// In-memory stores for OAuth state/session (sufficient for single-process deployment).
// These are transient — a server restart requires re-login. Acceptable for this scale.
const stateStore = new Map<string, NodeSavedState>();
const sessionStore = new Map<string, NodeSavedSession>();

// In-memory lock for concurrent OAuth operations (credentials need exclusive access)
const locks = new Map<string, Promise<void>>();

async function requestLock<T>(key: string, fn: () => T | PromiseLike<T>): Promise<T> {
	const lock = locks.get(key) ?? Promise.resolve();
	let resolver: (value: void) => void;
	const newLock = new Promise<void>((resolve) => {
		resolver = resolve;
	});
	locks.set(key, newLock);
	try {
		await lock;
		return await fn();
	} finally {
		resolver!();
	}
}

let _client: NodeOAuthClient | null = null;

export async function getAtprotoClient(): Promise<NodeOAuthClient> {
	if (_client) return _client;

	const clientId = process.env.ATPROTO_CLIENT_ID;
	const privateKeyJwk = process.env.ATPROTO_PRIVATE_KEY;
	const baseUrl = process.env.PUBLIC_BASE_URL;

	if (!clientId || !privateKeyJwk || !baseUrl) {
		throw new Error(
			'Missing ATproto config: ATPROTO_CLIENT_ID, ATPROTO_PRIVATE_KEY, PUBLIC_BASE_URL required'
		);
	}

	let privateKeyJwkObj: JsonWebKey;
	try {
		privateKeyJwkObj = JSON.parse(privateKeyJwk);
	} catch {
		throw new Error('ATPROTO_PRIVATE_KEY must be a valid JSON JWK string');
	}

	const siteName = await getSetting('site_name', 'bsBB');

	// JoseKey handles the private key internally; pass it as-is for signing operations
	const key = await JoseKey.fromJWK(privateKeyJwkObj as Record<string, unknown>);
	const keyset = new Keyset([key]);

	_client = new NodeOAuthClient({
		clientMetadata: {
			client_id: clientId,
			client_name: `${siteName} Forum`,
			client_uri: baseUrl,
			redirect_uris: [`${baseUrl}/callback`],
			scope: 'atproto',
			grant_types: ['authorization_code', 'refresh_token'],
			response_types: ['code'],
			token_endpoint_auth_method: 'private_key_jwt',
			token_endpoint_auth_signing_alg: 'ES256',
			dpop_bound_access_tokens: true,
			application_type: 'web',
		},
		keyset,
		stateStore: {
			async get(key: string) {
				return stateStore.get(key);
			},
			async set(key: string, value: NodeSavedState) {
				stateStore.set(key, value);
			},
			async del(key: string) {
				stateStore.delete(key);
			},
		},
		sessionStore: {
			async get(sub: string) {
				return sessionStore.get(sub);
			},
			async set(sub: string, value: NodeSavedSession) {
				sessionStore.set(sub, value);
			},
			async del(sub: string) {
				sessionStore.delete(sub);
			},
		},
		requestLock,
	});

	return _client;
}
