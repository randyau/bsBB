import { NodeOAuthClient, type NodeSavedSession, type NodeSavedState } from '@atproto/oauth-client-node';
import { Keyset } from '@atproto/jwk';
import { JoseKey } from '@atproto/jwk-jose';
import { getSetting } from '$lib/settings';

// In-memory stores for OAuth state/session (sufficient for single-process deployment).
// These are transient — a server restart requires re-login. Acceptable for this scale.
const stateStore = new Map<string, NodeSavedState>();
const sessionStore = new Map<string, NodeSavedSession>();

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
	console.log('[ATproto] Parsed JWK keys:', Object.keys(privateKeyJwkObj));
	console.log('[ATproto] JWK kty:', (privateKeyJwkObj as any).kty);

	try {
		console.log('[ATproto] Creating Key from JWK...');
		const key = await JoseKey.fromJWK(privateKeyJwkObj);
		console.log('[ATproto] Creating Keyset with key...');
		const keyset = new Keyset([key]);
		console.log('[ATproto] Keyset created successfully');

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
				jwks: {
					keys: [{ ...privateKeyJwkObj, use: 'sig', alg: 'ES256' }],
				},
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
		});
	} catch (err) {
		console.error('[ATproto] Failed to create client:', err);
		throw err;
	}

	return _client;
}
