import { Route, Routes } from 'react-router-dom';
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SignedIn, SignedOut, useAuth } from '@clerk/clerk-react';

import { useAnalysis } from './hooks/useAnalysis';
import { setAuthTokenProvider, getUserProfile } from './api/client';

import { DjProfile, LandingPage, PublicTracklist } from './components/public';

import { PricingPage } from './pages/PricingPage';
import { AccountPage } from './pages/AccountPage';

import { Header, HomeView, PageChrome, ToastContainer, useToast } from './components/layout';

import { ProgressBar } from './components/analysis';

const Timeline = lazy(() => import('./components/analysis/Timeline').then(m => ({ default: m.Timeline })));

const AnalysisLoading = () => (
  <div className="results-scrim space-y-6 animate-pulse">
    <div className="space-y-3">
      <div className="label-comment">SCAN COMPLETE</div>
      <div className="h-7 bg-foreground/10 w-2/3 max-w-md" />
    </div>

    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div className="h-3 bg-foreground/10 w-64" />
      <div className="flex gap-2">
        <div className="h-8 w-28 bg-foreground/10" />
        <div className="h-8 w-24 bg-foreground/10" />
      </div>
    </div>

    <div className="log">
      <div className="log-top">
        <span>RECOGNITION_LOG</span>
        <span>… / …</span>
      </div>
      <div className="log-body p-2 space-y-2">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div
            key={i}
            className="log-row identified"
            style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', height: '3rem' }}
          >
            <div className="bg-foreground/15 h-3 w-24 ml-1" />
            <div className="bg-foreground/10 h-3 flex-1 max-w-md" />
          </div>
        ))}
      </div>
    </div>

    <div className="flex flex-wrap items-center gap-2 pt-5 border-t border-border/50">
      <div className="h-3 w-16 bg-foreground/10" />
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="h-7 w-20 bg-foreground/10" />
      ))}
    </div>
  </div>
);

import { MixCompare } from './components/dashboard';
import { ManualTracklist } from './components/upload';

import { Button } from '@/components/ui/button';

import { PHASE, SEGMENT_STATUS, VIEW } from './constants';

type ViewMode = (typeof VIEW)[keyof typeof VIEW];

const App = () => (
  <Routes>
    <Route path="/t/:slug" element={<PublicTracklist />} />
    <Route path="/dj/:username" element={<DjProfile />} />
    <Route path="/pricing" element={<PricingPage />} />
    <Route path="/account" element={<AccountPage />} />
    <Route path="*" element={<MainApp />} />
  </Routes>
);

const MainApp = () => {
  const { getToken, isSignedIn } = useAuth();
  setAuthTokenProvider(() => getToken());

  const analysis = useAnalysis();

  const {
    phase,
    analysisId,
    filename,
    sourceUrl,
    uploadProgress,
    chunksProcessed,
    totalChunks,
    currentTrack,
    tracksFound,
    segments,
    chunksAvailable,
    waveformData,
    slug,
    isPublic,
    error,

    startAnalysis,
    startAnalysisFromUrl,
    reset,
    loadAnalysis,
    retrySegment,
    retryAll,
    editSegment,
    shareAnalysis,
  } = analysis;

  const { toasts, addToast, removeToast } = useToast();

  const [view, setView] = useState<ViewMode>(VIEW.HOME);
  const [credits, setCredits] = useState<number | null>(null);
  const [betaMode, setBetaMode] = useState<boolean>(false);

  const previousPhase = useRef(phase);

  const isIdle = phase === PHASE.IDLE;

  const isProcessing = phase === PHASE.UPLOADING || phase === PHASE.PROCESSING;

  const appRoute = (() => {
    if (phase === PHASE.UPLOADING) return 'CONSOLE / UPLOADING';
    if (phase === PHASE.PROCESSING) return 'CONSOLE / SCANNING';
    if (phase === PHASE.LOADING) return 'CONSOLE / LOADING';
    if (phase === PHASE.COMPLETED) return 'CONSOLE / RESULTS';
    if (phase === PHASE.FAILED) return 'CONSOLE / ERROR';
    if (view === VIEW.COMPARE) return 'CONSOLE / COMPARE';
    if (view === VIEW.MANUAL) return 'CONSOLE / MANUAL TRACKLIST';
    return 'CONSOLE / NEW SCAN';
  })();

  const identifiedSegmentsCount = useMemo(
    () => segments.filter(segment => segment.status === SEGMENT_STATUS.IDENTIFIED).length,
    [segments],
  );

  const goHome = useCallback(() => {
    reset();
    setView(VIEW.HOME);
  }, [reset]);

  const handleSelectAnalysis = useCallback(
    (id: string) => {
      setView(VIEW.HOME);
      loadAnalysis(id);
    },
    [loadAnalysis],
  );

  /**
   * Spotify callback handling
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const spotifyStatus = params.get('spotify');

    if (!spotifyStatus) return;

    if (spotifyStatus === 'success') {
      const playlistUrl = params.get('playlist');

      addToast('Spotify playlist created!');

      if (playlistUrl) {
        window.open(decodeURIComponent(playlistUrl), '_blank');
      }
    }

    if (spotifyStatus === 'error') {
      addToast('Failed to create Spotify playlist', 'error');
    }

    window.history.replaceState({}, '', window.location.pathname);
  }, [addToast]);

  /**
   * Notification permission
   */
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  /**
   * Fetch user credits
   */
  useEffect(() => {
    if (!isSignedIn) return;
    getUserProfile().then(data => {
      if (data?.creditsRemaining != null) {
        setCredits(data.creditsRemaining);
      }
      if (data?.betaMode != null) {
        setBetaMode(data.betaMode);
      }
    });
  }, [isSignedIn]);

  /**
   * Analysis phase side effects
   */
  useEffect(() => {
    const wasProcessing = previousPhase.current === PHASE.PROCESSING;

    if (wasProcessing && phase === PHASE.COMPLETED) {
      const message = `Analysis complete — ${identifiedSegmentsCount} track${
        identifiedSegmentsCount !== 1 ? 's' : ''
      } identified`;

      addToast(message);

      if (Notification.permission === 'granted') {
        new Notification('MixMatch', {
          body: message,
          icon: '/favicon.svg',
        });
      }
    }

    if (wasProcessing && phase === PHASE.FAILED) {
      addToast(error || 'Analysis failed', 'error');
    }

    previousPhase.current = phase;
  }, [phase, error, identifiedSegmentsCount, addToast]);

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      <SignedOut>
        <LandingPage />
      </SignedOut>

      <SignedIn>
        <div className="text-foreground text-[16px] overflow-x-clip">
          <PageChrome variant="full" />
          <Header credits={credits} betaMode={betaMode} onLogoClick={goHome} appRoute={appRoute} />
          <div className="mx-auto max-w-5xl px-6 pt-[80px] pb-8">
            <main>
              {isIdle && view === VIEW.HOME && (
                <HomeView
                  credits={credits}
                  onSelectAnalysis={loadAnalysis}
                  onFileSelected={startAnalysis}
                  onUrlSubmitted={startAnalysisFromUrl}
                />
              )}

              {isIdle && view === VIEW.COMPARE && <MixCompare onBack={() => setView(VIEW.HOME)} />}

              {isIdle && view === VIEW.MANUAL && (
                <ManualTracklist onCreated={handleSelectAnalysis} onBack={() => setView(VIEW.HOME)} />
              )}

              {phase === PHASE.LOADING && <AnalysisLoading />}

              {isProcessing && (
                <>
                  <ProgressBar
                    phase={phase as 'uploading' | 'processing'}
                    uploadProgress={uploadProgress}
                    chunksProcessed={chunksProcessed}
                    totalChunks={totalChunks}
                    currentTrack={currentTrack}
                    tracksFound={tracksFound}
                  />

                  {phase === PHASE.PROCESSING && segments.length > 0 && (
                    <div className="mt-6">
                      <Suspense fallback={<AnalysisLoading />}>
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
                      </Suspense>
                    </div>
                  )}
                </>
              )}

              {phase === PHASE.COMPLETED && segments.length > 0 && (
                <Suspense fallback={<AnalysisLoading />}>
                  <Timeline
                    segments={segments}
                    chunksAvailable={chunksAvailable}
                    analysisId={analysisId!}
                    filename={filename}
                    sourceUrl={sourceUrl}
                    waveformData={waveformData}
                    slug={slug}
                    isPublic={isPublic}
                    onRetrySegment={retrySegment}
                    onRetryAll={retryAll}
                    onReset={reset}
                    onEditSegment={editSegment}
                    onShare={shareAnalysis}
                  />
                </Suspense>
              )}

              {phase === PHASE.FAILED && (
                <div className="space-y-4 text-center">
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
