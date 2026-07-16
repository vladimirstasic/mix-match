import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export function buildYtdlpBaseArgs(url: string): string[] {
  const isYouTube = /(?:youtube\.com|youtu\.be)/i.test(url);
  const baseArgs = ['--force-ipv4', '--socket-timeout', '30', '--retries', '2'];
  if (isYouTube && process.env.YTDLP_PROXY) {
    baseArgs.push('--proxy', process.env.YTDLP_PROXY);
  }
  return baseArgs;
}

// Metadata-only lookup -- does not download the media, safe to call before deciding which
// recognition path (realtime download vs. File Scanning platform submission) to take.
export async function getVideoTitle(url: string): Promise<string> {
  const { stdout: title } = await execFileAsync('yt-dlp', [...buildYtdlpBaseArgs(url), '--print', 'title', url], {
    timeout: 90_000,
  });
  return title.trim() || 'Unknown title';
}
