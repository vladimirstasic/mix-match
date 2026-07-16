// THROWAWAY DIAGNOSTIC — send an already-prepared WAV straight through OUR
// ACRCloud path (identifyChunk), no normalize/split. Lets us test the EXACT
// file Aha recognized, to isolate "our request config" vs "our chunk position".
//
//   DOTENV_CONFIG_PATH=./.env npx tsx packages/api/src/scripts/diag-one.ts <wav> [wav2 ...]
//
// Delete after diagnosis.
import 'dotenv/config';
import { identifyChunk } from '../services/acrcloud.js';

async function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error('usage: diag-one.ts <wav> [wav2 ...]');
    process.exit(1);
  }
  for (const f of files) {
    const m = await identifyChunk(f, 0);
    console.log(`\nFILE: ${f}`);
    console.log(
      `  => ${m ? `${m.artist} - ${m.title}  (score=${m.score})` : 'NO MATCH or below threshold (see [acr] line above)'}`,
    );
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
