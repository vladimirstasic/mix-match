// THROWAWAY ONE-OFF SETUP SCRIPT — registers the ACRCloud File Scanning webhook callback URL
// against container 30969, once, so results stop needing manual polling.
//
//   DOTENV_CONFIG_PATH=./.env npx tsx packages/api/src/scripts/register-filescan-webhook.ts
//
// Requires ACRCLOUD_CONSOLE_TOKEN and PUBLIC_API_URL set. Prints the generated webhook secret —
// paste it into ACRCLOUD_FILESCAN_WEBHOOK_SECRET (Railway env) once signature verification is
// confirmed against a live webhook payload.
import 'dotenv/config';
import { config } from '../config.js';
import { registerWebhook, generateWebhookSecret } from '../services/acrcloud-filescan.js';

async function main() {
  if (!config.publicApiUrl) {
    console.error('PUBLIC_API_URL is not set');
    process.exit(1);
  }

  const callbackUrl = `${config.publicApiUrl.replace(/\/$/, '')}/api/webhooks/acrcloud-filescan`;
  const secret = generateWebhookSecret();

  console.log(`Registering webhook: ${callbackUrl}`);
  await registerWebhook(callbackUrl, secret);

  console.log('Webhook registered successfully.');
  console.log(`\nAdd this to your environment as ACRCLOUD_FILESCAN_WEBHOOK_SECRET:\n${secret}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
