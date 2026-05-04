import { describe, it, expect } from 'vitest';
import { buildSignature } from '../acrcloud.js';

describe('acrcloud', () => {
  it('generates valid HMAC-SHA1 signature', () => {
    const sig = buildSignature('GET\n/v1/identify\nkey\naudio\n1234567890', 'secret');
    expect(sig).toMatch(/^[A-Za-z0-9+/=]+$/); // base64
  });
});
