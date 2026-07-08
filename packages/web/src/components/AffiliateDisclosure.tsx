// Required by Amazon Associates ToS and FTC guidelines wherever affiliate links
// are shown. One small line; render once per page (not per track).
export function AffiliateDisclosure({ className = '' }: { className?: string }) {
  return (
    <p className={`text-[10px] text-muted-foreground/70 ${className}`}>
      Some "buy" links are affiliate links — we may earn a small commission if you purchase a track, at no extra cost to
      you.
    </p>
  );
}
