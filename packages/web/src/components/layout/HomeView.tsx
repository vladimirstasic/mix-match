import { useState } from 'react';
import type { AnalysisMode } from '@mix-match/shared';
import { Dashboard, Analytics, Feed } from '../dashboard';
import { FileUpload } from '../upload';
import { ProfileSettings } from '../profile';

type Tab = 'home' | 'feed' | 'profile';

interface HomeViewProps {
  credits: number | null;
  onSelectAnalysis: (id: string) => void;
  onFileSelected: (file: File, mode: AnalysisMode) => void;
  onUrlSubmitted: (url: string, mode: AnalysisMode) => void;
}

export const HomeView = ({ credits, onSelectAnalysis, onFileSelected, onUrlSubmitted }: HomeViewProps) => {
  const [tab, setTab] = useState<Tab>('home');

  const TABS: { id: Tab; label: string }[] = [
    { id: 'home', label: 'Home' },
    { id: 'feed', label: 'Feed' },
    { id: 'profile', label: 'Profile' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-stretch border border-border max-w-md mx-auto">
        {TABS.map(({ id, label }, i) => (
          <button
            key={id}
            type="button"
            className={`flex-1 px-4 py-2.5 font-mono uppercase tracking-[0.1em] text-xs transition-colors ${
              i < TABS.length - 1 ? 'border-r border-border' : ''
            } ${tab === id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'home' && (
        <div className="app-stage relative">
          <span className="corner tl" aria-hidden />
          <span className="corner tr" aria-hidden />
          <span className="corner bl" aria-hidden />
          <span className="corner br" aria-hidden />
          <div className="grid grid-cols-1 md:grid-cols-[1fr_320px] gap-4 p-6">
            {credits === 0 ? (
              <div className="border border-border bg-card text-center py-12 px-4">
                <p className="font-mono uppercase tracking-[0.1em] text-sm">No credits remaining</p>
                <p className="text-sm text-muted-foreground mt-2">Credits reset monthly. Upgrade for more.</p>
              </div>
            ) : (
              <FileUpload onFileSelected={onFileSelected} onUrlSubmitted={onUrlSubmitted} />
            )}
            <aside className="recent">
              <div className="console-head">
                <span>// RECENT SCANS</span>
              </div>
              <Dashboard onSelectAnalysis={onSelectAnalysis} />
            </aside>
          </div>
        </div>
      )}

      {tab === 'feed' && <Feed onSelectAnalysis={onSelectAnalysis} />}

      {tab === 'profile' && (
        <div className="space-y-6">
          <ProfileSettings />
          <Analytics />
        </div>
      )}
    </div>
  );
};
