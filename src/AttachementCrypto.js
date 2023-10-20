// this is based on https://github.com/matrix-org/matrix-content-scanner/blob/main/src/decrypt.js

// Pin the Buffer version
var Buffer = require('@craftzdog/react-native-buffer').Buffer;

export function decryptAttachment(dataBuffer, info) {
    if (
        info === undefined ||
        info.key === undefined ||
        info.iv === undefined ||
        info.hashes === undefined ||
        info.hashes.sha256 === undefined
    ) {
        throw new Error('Invalid info. Missing info.key, info.iv or info.hashes.sha256 key');
    }

    if (info.v !== 'v2') {
        throw new Error(`Unsupported protocol version: ${info.v ?? 'v0'}`);
    }

    const expectedSha256base64 = info.hashes.sha256;

    // Convert from JWK to openssl algorithm
    // See https://www.w3.org/2012/webcrypto/wiki/KeyWrap_Proposal#JSON_Web_Key
    const algorithms = {
        oct: {
            A256CTR: 'aes-256-ctr',
        },
    };

    const alg = algorithms[info.key.kty] ? algorithms[info.key.kty][info.key.alg] : undefined;

    if (!alg) {
        throw new Error(`Unsupported key type/algorithm: ` + `key.kty = ${info.key.kty}, kry.alg = ${info.key.alg}`);
    }

    const key = decodeBase64(info.key.k);

    // Calculate SHA 256 hash, encode as base64 without padding
    const hashDigestBase64 = encodeBase64(crypto.createHash('sha256').update(dataBuffer).digest());

    console.log('hashDigestBase64', hashDigestBase64);

    if (hashDigestBase64 !== expectedSha256base64) {
        throw new Error('Unexpected sha256 hash of encrypted data');
    }

    console.log('SHA256 ok');

    const iv = decodeBase64(info.iv);

    const decipher = crypto.createDecipheriv(alg, key, iv);

    console.log('dataBuffer length', dataBuffer.length);

    return Buffer.concat([decipher.update(dataBuffer), decipher.final()]);
}

export function encodeBase64(uint8Array) {
    const padded = Buffer.from(uint8Array).toString('base64');

    // remove padding
    const inputLength = uint8Array.length;
    const outputLength = 4 * Math.floor((inputLength + 2) / 3) + ((inputLength + 2) % 3) - 2;
    // Return the unpadded base64.
    return padded.slice(0, outputLength);
}

export function decodeBase64(base64) {
    // add padding if needed
    const paddedBase64 = base64 + '==='.slice(0, (4 - (base64.length % 4)) % 4);
    return Buffer.from(paddedBase64, 'base64');
}
