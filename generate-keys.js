const fs = require('fs');
const path = require('path');
const webPush = require('web-push');

console.log('Generating new VAPID keys for Web Push...');
const vapidKeys = webPush.generateVAPIDKeys();

console.log('\n--- VAPID KEYS GENERATED ---');
console.log('Public Key:\n' + vapidKeys.publicKey);
console.log('\nPrivate Key:\n' + vapidKeys.privateKey);
console.log('----------------------------\n');

const envPath = path.join(__dirname, '.env');
const envContent = `# Web Push VAPID Keys
PORT=3000
VAPID_PUBLIC_KEY=${vapidKeys.publicKey}
VAPID_PRIVATE_KEY=${vapidKeys.privateKey}
VAPID_EMAIL=mailto:admin@guvenlikampus.poc
`;

fs.writeFileSync(envPath, envContent, 'utf8');
console.log(`Saved keys to .env file at: ${envPath}`);
