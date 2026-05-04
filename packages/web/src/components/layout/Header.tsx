import { UserButton } from '@clerk/clerk-react';
import { ThemeToggle } from './ThemeToggle';

interface HeaderProps {
  credits: number | null;
  onLogoClick: () => void;
}

export const Header = ({ credits, onLogoClick }: HeaderProps) => {
  return (
    <header className="text-center mb-12">
      <div className="flex justify-end items-center gap-2 mb-4">
        <ThemeToggle />
        {credits !== null && <span className="text-xs text-muted-foreground">{credits} credits</span>}
        <UserButton />
      </div>
      <h1
        className="text-3xl font-bold tracking-tight cursor-pointer hover:text-primary transition-colors"
        onClick={onLogoClick}
      >
        Mix Match
      </h1>
      <p className="text-muted-foreground mt-2">Upload a DJ mix and identify every track</p>
    </header>
  );
};
