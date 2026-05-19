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

let privateJwk = await subtle.exportKey('jwk', keyPair.privateKey);
let publicJwk = await subtle.exportKey('jwk', keyPair.publicKey);

// Remove ext property (not needed), but keep key_ops as required by ATproto
const { ext: _, ...cleanPrivateJwk } = privateJwk;
const { ext: __, ...cleanPublicJwk } = publicJwk;

// Add kid and alg to both keys — required by ATproto OAuth
const kid = 'key-' + Math.random().toString(36).substring(2, 15);
cleanPrivateJwk.kid = kid;
cleanPrivateJwk.alg = 'ES256';  // Needed so algorithms array is computed correctly
cleanPublicJwk.kid = kid;
cleanPublicJwk.use = 'sig';
cleanPublicJwk.alg = 'ES256';

// Output as environment variable assignments (one per line)
console.log('ATPROTO_PRIVATE_KEY=' + JSON.stringify(cleanPrivateJwk));
console.log('ATPROTO_PUBLIC_KEY=' + JSON.stringify(cleanPublicJwk));
