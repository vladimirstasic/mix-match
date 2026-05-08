import { Route, Routes } from 'react-router-dom';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SignedIn, SignedOut, useAuth } from '@clerk/clerk-react';

import { useAnalysis } from './hooks/useAnalysis';
import { setAuthTokenProvider, getUserProfile } from './api/client';

import { DjProfile, LandingPage, PublicTracklist } from './components/public';

import { Header, HomeView, ThemeToggle, ToastContainer, useToast } from './components/layout';

import { ProgressBar, Timeline } from './components/analysis';

import { MixCompare } from './components/dashboard';
import { ManualTracklist } from './components/upload';

import { Button } from '@/components/ui/button';

import { PHASE, SEGMENT_STATUS, VIEW } from './constants';

type ViewMode = (typeof VIEW)[keyof typeof VIEW];

const App = () => (
  <Routes>
    <Route path="/t/:slug" element={<PublicTracklist />} />
    <Route path="/dj/:username" element={<DjProfile />} />
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

  const previousPhase = useRef(phase);

  const isIdle = phase === PHASE.IDLE;

  const isProcessing = phase === PHASE.UPLOADING || phase === PHASE.PROCESSING;

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
        <div className="fixed top-4 right-4 z-50">
          <ThemeToggle />
        </div>

        <LandingPage />
      </SignedOut>

      <SignedIn>
        <div className="min-h-screen bg-background text-foreground text-[16px]">
          <div className="mx-auto max-w-5xl px-6 py-8">
            <Header credits={credits} onLogoClick={goHome} />

            <main>
              {isIdle && view === VIEW.HOME && (
                <HomeView
                  credits={credits}
                  onCompare={() => setView(VIEW.COMPARE)}
                  onManual={() => setView(VIEW.MANUAL)}
                  onSelectAnalysis={loadAnalysis}
                  onFileSelected={startAnalysis}
                  onUrlSubmitted={startAnalysisFromUrl}
                />
              )}

              {isIdle && view === VIEW.COMPARE && <MixCompare onBack={() => setView(VIEW.HOME)} />}

              {isIdle && view === VIEW.MANUAL && (
                <ManualTracklist onCreated={handleSelectAnalysis} onBack={() => setView(VIEW.HOME)} />
              )}

              {phase === PHASE.LOADING && (
                <div className="space-y-4 animate-pulse">
                  <div className="h-8 bg-muted rounded-lg w-2/3" />
                  <div className="h-4 bg-muted/50 rounded w-1/3" />
                  <div className="h-20 bg-muted/30 rounded-2xl" />
                  <div className="space-y-2">
                    {[1, 2, 3, 4].map(i => (
                      <div key={i} className="h-16 bg-muted/30 rounded-xl" />
                    ))}
                  </div>
                </div>
              )}

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
                  filename={filename}
                  sourceUrl={sourceUrl}
                  waveformData={waveformData}
                  onRetrySegment={retrySegment}
                  onRetryAll={retryAll}
                  onReset={reset}
                  onEditSegment={editSegment}
                  onShare={shareAnalysis}
                />
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
