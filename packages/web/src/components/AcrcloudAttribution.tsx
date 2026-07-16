// Required by ACRCloud's branding/attribution guidelines for services using their Music
// Recognition API — mandatory placement wherever recognition results are displayed.
export function AcrcloudAttribution({
  className = '',
  logoClassName = 'h-3',
}: {
  className?: string;
  logoClassName?: string;
}) {
  return (
    <a
      href="https://www.acrcloud.com/"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1.5 text-[10px] text-muted-foreground/70 hover:text-muted-foreground ${className}`}
    >
      Music Recognition by
      <img src="/acrcloud-logo.png" alt="ACRCloud" className={`${logoClassName} dark:hidden`} />
      <img src="/acrcloud-logo-white.png" alt="ACRCloud" className={`${logoClassName} hidden dark:inline`} />
    </a>
  );
}
