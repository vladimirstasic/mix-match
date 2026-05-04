import { Routes, Route } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
import type { AnalysisMode } from '@mix-match/shared';
import { useAnalysis } from './hooks/useAnalysis';
import { LandingPage } from './components/LandingPage';
import { PublicTracklist } from './components/PublicTracklist';
import { DjProfile } from './components/DjProfile';
import { Dashboard } from './components/Dashboard';
import { FileUpload } from './components/FileUpload';
import { ProgressBar } from './components/ProgressBar';
import { Timeline } from './components/Timeline';
import { ProfileSettings } from './components/ProfileSettings';
import { MixCompare } from './components/MixCompare';
import { ManualTracklist } from './components/ManualTracklist';
import { Feed } from './components/Feed';
import { Analytics } from './components/Analytics';
import { ThemeToggle } from './components/ThemeToggle';
import { ToastContainer, useToast } from './components/Toast';
import { Button } from '@/components/ui/button';
import { API_BASE } from './constants';

type ViewMode = 'home' | 'compare' | 'manual' | 'feed';

function App() {
  return (
    <Routes>
      <Route path="/t/:slug" element={<PublicTracklist />} />
      <Route path="/dj/:username" element={<DjProfile />} />
      <Route path="*" element={<MainApp />} />
    </Routes>
  );
}

function MainApp() {
  const {
    phase,
    analysisId,
    uploadProgress,
    chunksProcessed,
    totalChunks,
    currentTrack,
    tracksFound,
    segments,
    chunksAvailable,
    waveformData,
    error,
    startAnalysis,
    startAnalysisFromUrl,
    reset,
    loadAnalysis,
    retrySegment,
    retryAll,
    editSegment,
    shareAnalysis,
  } = useAnalysis();

  const { toasts, addToast, removeToast } = useToast();
  const [view, setView] = useState<ViewMode>('home');
  const [credits, setCredits] = useState<number | null>(null);
  const prevPhase = useRef(phase);

  const resetToHome = useCallback(() => {
    reset();
    setView('home');
  }, [reset]);

  // Spotify OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const spotifyStatus = params.get('spotify');
    if (!spotifyStatus) return;

    if (spotifyStatus === 'success') {
      const playlistUrl = params.get('playlist');
      addToast('Spotify playlist created!');
      if (playlistUrl) window.open(decodeURIComponent(playlistUrl), '_blank');
    } else if (spotifyStatus === 'error') {
      addToast('Failed to create Spotify playlist', 'error');
    }
    window.history.replaceState({}, '', window.location.pathname);
  }, [addToast]);

  // Browser notifications
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Load credits
  useEffect(() => {
    fetch(`${API_BASE}/user/profile`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.creditsRemaining != null) setCredits(data.creditsRemaining);
      })
      .catch(() => {});
  }, []);

  // Phase transitions → toasts + browser notification
  useEffect(() => {
    if (prevPhase.current === 'processing' && phase === 'completed') {
      const count = segments.filter(s => s.status === 'identified').length;
      const msg = `Analysis complete — ${count} track${count !== 1 ? 's' : ''} identified`;
      addToast(msg);
      if (Notification.permission === 'granted') {
        new Notification('MixMatch', { body: msg, icon: '/favicon.svg' });
      }
    }
    if (prevPhase.current === 'processing' && phase === 'failed') {
      addToast(error || 'Analysis failed', 'error');
    }
    prevPhase.current = phase;
  }, [phase, segments, error, addToast]);

  const isIdle = phase === 'idle';
  const isProcessing = phase === 'uploading' || phase === 'processing';

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <SignedOut>
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>
        <LandingPage />
      </SignedOut>

      <SignedIn>
        <div className="min-h-screen bg-background text-foreground">
          <div className="max-w-4xl mx-auto px-4 py-12">
            <Header credits={credits} onLogoClick={resetToHome} />

            <main>
              {isIdle && view === 'home' && (
                <HomeView
                  credits={credits}
                  onCompare={() => setView('compare')}
                  onManual={() => setView('manual')}
                  onFeed={() => setView('feed')}
                  onSelectAnalysis={loadAnalysis}
                  onFileSelected={startAnalysis}
                  onUrlSubmitted={startAnalysisFromUrl}
                />
              )}

              {isIdle && view === 'feed' && (
                <BackWrapper onBack={() => setView('home')}>
                  <Feed
                    onSelectAnalysis={id => {
                      setView('home');
                      loadAnalysis(id);
                    }}
                  />
                </BackWrapper>
              )}

              {isIdle && view === 'compare' && <MixCompare onBack={() => setView('home')} />}

              {isIdle && view === 'manual' && (
                <ManualTracklist
                  onCreated={id => {
                    setView('home');
                    loadAnalysis(id);
                  }}
                  onBack={() => setView('home')}
                />
              )}

              {isProcessing && (
                <>
                  <ProgressBar
                    phase={phase}
                    uploadProgress={uploadProgress}
                    chunksProcessed={chunksProcessed}
                    totalChunks={totalChunks}
                    currentTrack={currentTrack}
                    tracksFound={tracksFound}
                  />
                  {phase === 'processing' && segments.length > 0 && (
                    <div className="mt-6">
                      <Timeline
                        segments={segments}
                        chunksAvailable={false}
                        analysisId={analysisId || ''}
                        waveformData={null}
                        onRetrySegment={() => {}}
                        onRetryAll={() => {}}
                        onReset={() => {}}
                        onEditSegment={() => {}}
                        onShare={async () => null}
                      />
                    </div>
                  )}
                </>
              )}

              {phase === 'completed' && segments.length > 0 && (
                <Timeline
                  segments={segments}
                  chunksAvailable={chunksAvailable}
                  analysisId={analysisId!}
                  waveformData={waveformData}
                  onRetrySegment={retrySegment}
                  onRetryAll={retryAll}
                  onReset={reset}
                  onEditSegment={editSegment}
                  onShare={shareAnalysis}
                />
              )}

              {phase === 'failed' && (
                <div className="text-center space-y-4">
                  <p className="text-destructive">Analysis failed: {error}</p>
                  <Button variant="outline" onClick={reset}>
                    Try again
                  </Button>
                </div>
              )}
            </main>
          </div>
        </div>
      </SignedIn>
    </>
  );
}

function Header({ credits, onLogoClick }: { credits: number | null; onLogoClick: () => void }) {
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
}

interface HomeViewProps {
  credits: number | null;
  onCompare: () => void;
  onManual: () => void;
  onFeed: () => void;
  onSelectAnalysis: (id: string) => void;
  onFileSelected: (file: File, mode: AnalysisMode) => void;
  onUrlSubmitted: (url: string, mode: AnalysisMode) => void;
}

function HomeView({
  credits,
  onCompare,
  onManual,
  onFeed,
  onSelectAnalysis,
  onFileSelected,
  onUrlSubmitted,
}: HomeViewProps) {
  return (
    <>
      <Dashboard onSelectAnalysis={onSelectAnalysis} />
      <div className="flex justify-center gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={onCompare}>
          Compare Mixes
        </Button>
        <Button variant="outline" size="sm" onClick={onManual}>
          Manual Tracklist
        </Button>
        <Button variant="outline" size="sm" onClick={onFeed}>
          Feed
        </Button>
      </div>
      {credits === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="font-medium">No credits remaining</p>
          <p className="text-sm mt-1">Credits reset monthly. Upgrade for more.</p>
        </div>
      ) : (
        <FileUpload onFileSelected={onFileSelected} onUrlSubmitted={onUrlSubmitted} />
      )}
      <div className="mt-8">
        <ProfileSettings />
      </div>
      <div className="mt-4">
        <Analytics />
      </div>
    </>
  );
}

function BackWrapper({ children, onBack }: { children: React.ReactNode; onBack: () => void }) {
  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4" onClick={onBack}>
        &larr; Back
      </Button>
      {children}
    </div>
  );
}

export default App;
