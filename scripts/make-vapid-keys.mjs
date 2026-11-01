// Prints a VAPID key pair for web push. Run once: node scripts/make-vapid-keys.mjs
// Keep the private key secret. The public key is not secret.
import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pub = publicKey.export({ format: 'jwk' });
const priv = privateKey.export({ format: 'jwk' });
const b64 = (s) => s;
const publicRaw = Buffer.concat([Buffer.from([4]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]).toString('base64url');

console.log('VAPID_PUBLIC_KEY=' + publicRaw);
console.log('VITE_VAPID_PUBLIC_KEY=' + publicRaw);
console.log('VAPID_PRIVATE_KEY=' + b64(priv.d));
console.log('VAPID_SUBJECT=mailto:you@example.com   <- change to your own email');
