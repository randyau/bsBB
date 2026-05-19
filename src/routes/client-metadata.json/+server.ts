import type { RequestHandler } from '@sveltejs/kit';
import { json, error } from '@sveltejs/kit';

export const GET: RequestHandler = async ({ request }) => {
	const clientId = process.env.ATPROTO_CLIENT_ID;
	const publicKeyJwk = process.env.ATPROTO_PUBLIC_KEY;
	const baseUrl = process.env.PUBLIC_BASE_URL;

	// Validate required environment variables
	if (!clientId || !publicKeyJwk || !baseUrl) {
		return error(500, 'ATproto OAuth configuration incomplete');
	}

	let publicKey: any;
	try {
		publicKey = JSON.parse(publicKeyJwk);
	} catch {
		return error(500, 'Invalid ATPROTO_PUBLIC_KEY JSON');
	}

	// Construct client metadata dynamically from environment configuration
	// This eliminates a static file dependency, making the app stateless across instances
	const clientMetadata = {
		client_id: clientId,
		client_name: 'bsBB Forum',
		client_uri: baseUrl,
		redirect_uris: [`${baseUrl}/callback`],
		scope: 'atproto',
		grant_types: ['authorization_code', 'refresh_token'],
		response_types: ['code'],
		token_endpoint_auth_method: 'private_key_jwt',
		token_endpoint_auth_signing_alg: 'ES256',
		jwks: {
			keys: [publicKey],
		},
		dpop_bound_access_tokens: true,
		application_type: 'web',
	};

	return json(clientMetadata, {
		headers: {
			'Cache-Control': 'public, max-age=3600',
			'Content-Type': 'application/json',
		},
	});
};
