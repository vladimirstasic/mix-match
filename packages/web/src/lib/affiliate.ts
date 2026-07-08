import type { Segment } from '@mix-match/shared';

// Affiliate tags are public by nature (they live in the outbound URL the user
// clicks), so reading them from build-time env on the client is fine. Empty
// fallback means the buttons render as plain "search/buy" links — useful to the
// user immediately, and they start earning the moment a tag is filled in.
const AFFILIATE_TAGS = {
  amazon: import.meta.env.VITE_AFF_AMAZON ?? '',
  apple: import.meta.env.VITE_AFF_APPLE ?? '',
  beatport: import.meta.env.VITE_AFF_BEATPORT ?? '',
};

export interface BuyLink {
  key: string;
  label: string;
  url: string;
}

// Which stores actually pay a commission today:
//   Beatport     — best fit (DJ purchase intent). NOTE: real attribution needs
//                  an Impact deep-link, not just a search URL. The search link
//                  below is product value now; wire Impact when the account is
//                  approved (VITE_AFF_BEATPORT reserved for it).
//   Amazon Music — easy (Associates), append ?tag=. Lower commission.
//   Apple/iTunes — affiliate program largely shut down; link is product value.
//   Bandcamp     — no affiliate program; product value only.
export function buildBuyLinks(trackName: string): BuyLink[] {
  const q = encodeURIComponent(trackName);

  const amazon = `https://www.amazon.com/s?k=${q}&i=digital-music${
    AFFILIATE_TAGS.amazon ? `&tag=${AFFILIATE_TAGS.amazon}` : ''
  }`;
  const apple = `https://music.apple.com/search?term=${q}${AFFILIATE_TAGS.apple ? `&at=${AFFILIATE_TAGS.apple}` : ''}`;

  return [
    { key: 'beatport', label: 'BP', url: `https://www.beatport.com/search?q=${q}` },
    { key: 'amazon', label: 'AMZ', url: amazon },
    { key: 'apple', label: 'AP', url: apple },
    { key: 'bandcamp', label: 'BC', url: `https://bandcamp.com/search?q=${q}` },
  ];
}

// A track is "buyable" if it was identified (has a name to search by).
export function isBuyable(seg: Pick<Segment, 'status' | 'trackName'>): boolean {
  return seg.status === 'identified' && !!seg.trackName;
}
