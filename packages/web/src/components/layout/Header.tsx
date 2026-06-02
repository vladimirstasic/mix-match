import { UserButton } from '@clerk/clerk-react';
import { ThemeToggle } from './ThemeToggle';
import { Disc3 } from 'lucide-react';

interface HeaderProps {
  credits: number | null;
  betaMode?: boolean;
  onLogoClick: () => void;
}

export const Header = ({ credits, betaMode, onLogoClick }: HeaderProps) => {
  return (
    <header className="sticky top-0 z-50 w-full backdrop-blur-2xl bg-background/60 border-b border-border/50 mb-6">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <button className="flex items-center gap-2 hover:opacity-80 transition-opacity" onClick={onLogoClick}>
          <Disc3 className="w-5 h-5 text-primary" />
          <span className="font-semibold tracking-tight">MIXMATCH</span>
          <span className="font-mono text-xs text-muted-foreground -ml-1">/studio</span>
          {betaMode && (
            <span className="font-mono text-[10px] tracking-wider px-1.5 py-0.5 bg-primary/10 text-primary border border-primary/20 uppercase">
              Beta
            </span>
          )}
        </button>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          {credits !== null && (
            <span className="text-xs text-muted-foreground px-2 py-1 rounded-lg bg-muted/50 border border-border/50">
              {credits} credits
            </span>
          )}
          <UserButton />
        </div>
      </div>
    </header>
  );
};
