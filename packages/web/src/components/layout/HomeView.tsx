import { useState } from 'react';
import type { AnalysisMode } from '@mix-match/shared';
import { Dashboard, Analytics, Feed } from '../dashboard';
import { FileUpload } from '../upload';
import { ProfileSettings } from '../profile';
import { Home, Rss, User } from 'lucide-react';

type Tab = 'home' | 'feed' | 'profile';

interface HomeViewProps {
  credits: number | null;
  onSelectAnalysis: (id: string) => void;
  onFileSelected: (file: File, mode: AnalysisMode) => void;
  onUrlSubmitted: (url: string, mode: AnalysisMode) => void;
}

export const HomeView = ({ credits, onSelectAnalysis, onFileSelected, onUrlSubmitted }: HomeViewProps) => {
  const [tab, setTab] = useState<Tab>('home');

  return (
    <div className="space-y-6">
      {/* Tab Bar */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-glass-bg border border-glass-border">
          {(
            [
              { id: 'home', label: 'Home', icon: Home },
              { id: 'feed', label: 'Feed', icon: Rss },
              { id: 'profile', label: 'Profile', icon: User },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                tab === id
                  ? 'bg-primary/10 text-primary border border-primary/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
              onClick={() => setTab(id)}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {tab === 'home' && (
        <div className="space-y-6">
          {credits === 0 ? (
            <div className="text-center py-12 rounded-2xl border border-border/50 bg-muted/30">
              <p className="font-medium">No credits remaining</p>
              <p className="text-sm text-muted-foreground mt-1">Credits reset monthly. Upgrade for more.</p>
            </div>
          ) : (
            <FileUpload onFileSelected={onFileSelected} onUrlSubmitted={onUrlSubmitted} />
          )}

          <Dashboard onSelectAnalysis={onSelectAnalysis} />
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
