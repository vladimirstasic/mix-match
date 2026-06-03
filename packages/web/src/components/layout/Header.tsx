import { UserButton } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';

interface HeaderProps {
  credits: number | null;
  betaMode?: boolean;
  onLogoClick: () => void;
  appRoute?: string;
}

export const Header = ({ credits, betaMode = true, onLogoClick, appRoute = 'CONSOLE / NEW SCAN' }: HeaderProps) => {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light') setDark(false);
    else if (saved === 'dark') setDark(true);
  }, []);

  const toggleTheme = () => {
    setDark(d => {
      const next = !d;
      if (next) {
        document.documentElement.classList.add('dark');
        localStorage.setItem('theme', 'dark');
      } else {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('theme', 'light');
      }
      return next;
    });
  };

  return (
    <header className="landing-bar">
      <button className="unit unit-btn" onClick={onLogoClick} type="button">
        <span className="led" aria-hidden />
        <span className="unit-name">MIXMATCH</span>
        <span className="unit-sub">/studio</span>
        {betaMode && <span className="tag">BETA</span>}
      </button>
      <div className="app-route">{appRoute}</div>
      <div className="bar-actions">
        {credits !== null && (
          <span className="ctrl readonly">
            CREDITS <b>{String(credits).padStart(2, '0')}</b>
          </span>
        )}
        <button className="ctrl" onClick={toggleTheme} aria-label="Toggle theme" type="button">
          <span className="ctrl-dot" />
          <span>{dark ? 'DARK' : 'LIGHT'}</span>
        </button>
        <UserButton />
      </div>
    </header>
  );
};
