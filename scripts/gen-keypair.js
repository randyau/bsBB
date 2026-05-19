#!/usr/bin/env node
// Generates a P-256 (ES256) JWK keypair and prints both keys as JSON on separate lines.
// Called by setup.sh; output is captured and written to .env and client-metadata.json.

const { webcrypto } = await import('node:crypto');
const { subtle } = webcrypto;

const keyPair = await subtle.generateKey(
	{ name: 'ECDSA', namedCurve: 'P-256' },
	true, // extractable
	['sign', 'verify']
);

const privateJwk = await subtle.exportKey('jwk', keyPair.privateKey);
const publicJwk = await subtle.exportKey('jwk', keyPair.publicKey);

// Add kid (key ID) and alg to both keys — required by ATproto OAuth
const kid = 'key-' + Math.random().toString(36).substring(2, 15);
privateJwk.kid = kid;
privateJwk.alg = 'ES256';
publicJwk.kid = kid;
publicJwk.alg = 'ES256';

// Output as environment variable assignments (one per line)
console.log('ATPROTO_PRIVATE_KEY=' + JSON.stringify(privateJwk));
console.log('ATPROTO_PUBLIC_KEY=' + JSON.stringify(publicJwk));
