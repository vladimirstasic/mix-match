import { apiFetch } from './client';

export interface FoundingStatus {
  totalSeats: number;
  seatsRemaining: number;
  isSoldOut: boolean;
}

export async function getFoundingStatus(): Promise<FoundingStatus | null> {
  const res = await apiFetch('/billing/founding-status');
  if (!res.ok) return null;
  return res.json();
}

export async function createCheckout(plan: 'pro' | 'studio'): Promise<string> {
  const res = await apiFetch('/billing/checkout', {
    method: 'POST',
    body: JSON.stringify({ plan }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Checkout failed' }));
    throw new Error(err.error || 'Checkout failed');
  }
  const { url } = await res.json();
  return url;
}

export async function openPortal(): Promise<string> {
  const res = await apiFetch('/billing/portal', { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Portal failed' }));
    throw new Error(err.error || 'Portal failed');
  }
  const { url } = await res.json();
  return url;
}
