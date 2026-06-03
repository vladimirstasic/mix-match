import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'light') setDark(false);
    else if (saved === 'dark') setDark(true);
  }, []);

  const toggle = () => {
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
    <button className="ctrl" onClick={toggle} aria-label="Toggle theme" type="button">
      <span className="ctrl-dot" />
      <span>{dark ? 'DARK' : 'LIGHT'}</span>
    </button>
  );
}
