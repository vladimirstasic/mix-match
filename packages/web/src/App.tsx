import { Routes, Route } from 'react-router-dom';
import { useEffect, useRef, useState, useCallback } from 'react';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { useAnalysis } from './hooks/useAnalysis';
import { LandingPage, PublicTracklist, DjProfile } from './components/public';
import { Header, HomeView, BackWrapper, ThemeToggle, ToastContainer, useToast } from './components/layout';
import { Timeline, ProgressBar } from './components/analysis';
import { MixCompare, Feed } from './components/dashboard';
import { ManualTracklist } from './components/upload';
import { Button } from '@/components/ui/button';
import { API_BASE, VIEW, PHASE, SEGMENT_STATUS } from './constants';

type ViewMode = (typeof VIEW)[keyof typeof VIEW];

const App = () => {
  return (
    <Routes>
      <Route path="/t/:slug" element={<PublicTracklist />} />
      <Route path="/dj/:username" element={<DjProfile />} />
      <Route path="*" element={<MainApp />} />
    </Routes>
  );
};

const MainApp = () => {
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
  const [view, setView] = useState<ViewMode>(VIEW.HOME);
  const [credits, setCredits] = useState<number | null>(null);
  const prevPhase = useRef(phase);

  const resetToHome = useCallback(() => {
    reset();
    setView(VIEW.HOME);
  }, [reset]);

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

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/user/profile`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.creditsRemaining != null) setCredits(data.creditsRemaining);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (prevPhase.current === PHASE.PROCESSING && phase === PHASE.COMPLETED) {
      const count = segments.filter(s => s.status === SEGMENT_STATUS.IDENTIFIED).length;
      const msg = `Analysis complete — ${count} track${count !== 1 ? 's' : ''} identified`;
      addToast(msg);
      if (Notification.permission === 'granted') new Notification('MixMatch', { body: msg, icon: '/favicon.svg' });
    }
    if (prevPhase.current === PHASE.PROCESSING && phase === PHASE.FAILED) addToast(error || 'Analysis failed', 'error');
    prevPhase.current = phase;
  }, [phase, segments, error, addToast]);

  const isIdle = phase === PHASE.IDLE;
  const isProcessing = phase === PHASE.UPLOADING || phase === PHASE.PROCESSING;

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
              {isIdle && view === VIEW.HOME && (
                <HomeView
                  credits={credits}
                  onCompare={() => setView(VIEW.COMPARE)}
                  onManual={() => setView(VIEW.MANUAL)}
                  onFeed={() => setView(VIEW.FEED)}
                  onSelectAnalysis={loadAnalysis}
                  onFileSelected={startAnalysis}
                  onUrlSubmitted={startAnalysisFromUrl}
                />
              )}
              {isIdle && view === VIEW.FEED && (
                <BackWrapper onBack={() => setView(VIEW.HOME)}>
                  <Feed
                    onSelectAnalysis={id => {
                      setView(VIEW.HOME);
                      loadAnalysis(id);
                    }}
                  />
                </BackWrapper>
              )}
              {isIdle && view === VIEW.COMPARE && <MixCompare onBack={() => setView(VIEW.HOME)} />}
              {isIdle && view === VIEW.MANUAL && (
                <ManualTracklist
                  onCreated={id => {
                    setView(VIEW.HOME);
                    loadAnalysis(id);
                  }}
                  onBack={() => setView(VIEW.HOME)}
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
                  {phase === PHASE.PROCESSING && segments.length > 0 && (
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
              {phase === PHASE.COMPLETED && segments.length > 0 && (
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
              {phase === PHASE.FAILED && (
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
};

export default App;
