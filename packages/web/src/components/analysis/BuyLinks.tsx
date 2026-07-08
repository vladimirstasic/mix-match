import { buildBuyLinks } from '@/lib/affiliate';

// Renders compact "buy track" affiliate chips for an identified track, derived
// from its name (search URLs). A leading "BUY" mono label disambiguates these
// from the streaming chips (StreamingLinks) rendered alongside.
export function BuyLinks({ trackName }: { trackName: string }) {
  const links = buildBuyLinks(trackName);
  const baseChip =
    'inline-flex items-center px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.08em] border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors';

  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-muted-foreground/60">buy</span>
      {links.map(({ key, label, url }) => (
        <a
          key={key}
          href={url}
          target="_blank"
          rel="sponsored nofollow noopener noreferrer"
          className={baseChip}
          onClick={e => e.stopPropagation()}
        >
          {label}
        </a>
      ))}
    </span>
  );
}
