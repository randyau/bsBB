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

// Output one key per line (first private, then public)
console.log(JSON.stringify(privateJwk));
console.log(JSON.stringify(publicJwk));
