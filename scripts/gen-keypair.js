#!/usr/bin/env node
// Generates a P-256 (ES256) JWK keypair and prints both keys as JSON on separate lines.
// Called by setup.sh; output is captured and written to .env.

const { webcrypto } = await import('node:crypto');
const { subtle } = webcrypto;

const keyPair = await subtle.generateKey(
	{ name: 'ECDSA', namedCurve: 'P-256' },
	true, // extractable
	['sign', 'verify']
);

let privateJwk = await subtle.exportKey('jwk', keyPair.privateKey);
let publicJwk = await subtle.exportKey('jwk', keyPair.publicKey);

// Remove ext and key_ops from both keys (not needed for OAuth jwks)
const { ext: _, key_ops: __, ...cleanPrivateJwk } = privateJwk;
const { ext: ___, key_ops: ____, ...cleanPublicJwk } = publicJwk;

// Add kid and alg to both keys — required by ATproto OAuth
const kid = 'key-' + Math.random().toString(36).substring(2, 15);
cleanPrivateJwk.kid = kid;
cleanPrivateJwk.alg = 'ES256';
cleanPublicJwk.kid = kid;
cleanPublicJwk.use = 'sig';
cleanPublicJwk.alg = 'ES256';

// Output as environment variable assignments (one per line)
console.log('ATPROTO_PRIVATE_KEY=' + JSON.stringify(cleanPrivateJwk));
console.log('ATPROTO_PUBLIC_KEY=' + JSON.stringify(cleanPublicJwk));
