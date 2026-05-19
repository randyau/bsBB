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

// WebCrypto adds key_ops and ext; remove them for cleaner JWK
const { key_ops: _, ext: __, ...cleanPrivateJwk } = privateJwk;
const { key_ops: _2, ext: __2, ...cleanPublicJwk } = publicJwk;

// Add required properties for ATproto OAuth signing
const kid = 'key-' + Math.random().toString(36).substring(2, 15);
cleanPrivateJwk.kid = kid;
cleanPrivateJwk.use = 'sig';
cleanPublicJwk.kid = kid;
cleanPublicJwk.use = 'sig';

// Output as environment variable assignments (one per line)
console.log('ATPROTO_PRIVATE_KEY=' + JSON.stringify(cleanPrivateJwk));
console.log('ATPROTO_PUBLIC_KEY=' + JSON.stringify(cleanPublicJwk));
