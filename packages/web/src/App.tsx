import { Routes, Route } from 'react-router-dom';
import { useAnalysis } from './hooks/useAnalysis';
import { FileUpload } from './components/FileUpload';
import { ProgressBar } from './components/ProgressBar';
import { Timeline } from './components/Timeline';
import { Dashboard } from './components/Dashboard';
import { ProfileSettings } from './components/ProfileSettings';
import { LandingPage } from './components/LandingPage';
import { PublicTracklist } from './components/PublicTracklist';
import { DjProfile } from './components/DjProfile';
import { MixCompare } from './components/MixCompare';
import { ManualTracklist } from './components/ManualTracklist';
import { Feed } from './components/Feed';
import { Analytics } from './components/Analytics';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from './components/ThemeToggle';
import { useToast, ToastContainer } from './components/Toast';
import { SignedIn, SignedOut, UserButton } from '@clerk/clerk-react';
import { useState, useEffect, useRef } from 'react';

function App() {
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
  const [showCompare, setShowCompare] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [showFeed, setShowFeed] = useState(false);
  const [credits, setCredits] = useState<number | null>(null);
  const prevPhase = useRef(phase);

  // Handle Spotify OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const spotifyStatus = params.get('spotify');
    if (spotifyStatus === 'success') {
      const playlistUrl = params.get('playlist');
      if (playlistUrl) {
        addToast(`Spotify playlist created!`);
        window.open(decodeURIComponent(playlistUrl), '_blank');
      }
      window.history.replaceState({}, '', window.location.pathname);
    } else if (spotifyStatus === 'error') {
      addToast('Failed to create Spotify playlist', 'error');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [addToast]);

  // Request browser notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Fetch user credits on mount
  useEffect(() => {
    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    fetch(`${API_BASE}/user/profile`)
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data && data.creditsRemaining != null) {
          setCredits(data.creditsRemaining);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (prevPhase.current === 'processing' && phase === 'completed') {
      const count = segments.filter(s => s.status === 'identified').length;
      addToast(`Analysis complete — ${count} track${count !== 1 ? 's' : ''} identified`);

      // Browser notification
      if (Notification.permission === 'granted') {
        new Notification('MixMatch', {
          body: `Analysis complete — ${count} track${count !== 1 ? 's' : ''} identified`,
          icon: '/favicon.svg',
        });
      }
    }
    if (prevPhase.current === 'processing' && phase === 'failed') {
      addToast(error || 'Analysis failed', 'error');
    }
    prevPhase.current = phase;
  }, [phase, segments, error, addToast]);

  return (
    <>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <Routes>
        <Route path="/t/:slug" element={<PublicTracklist />} />
        <Route path="/dj/:username" element={<DjProfile />} />
        <Route
          path="*"
          element={
            <>
              <SignedOut>
                <div className="fixed top-4 right-4 z-50">
                  <ThemeToggle />
                </div>
                <LandingPage />
              </SignedOut>

              <SignedIn>
                <div className="min-h-screen bg-background text-foreground">
                  <div className="max-w-4xl mx-auto px-4 py-12">
                    <header className="text-center mb-12">
                      <div className="flex justify-end items-center gap-2 mb-4">
                        <ThemeToggle />
                        {credits !== null && <span className="text-xs text-muted-foreground">{credits} credits</span>}
                        <UserButton />
                      </div>
                      <h1
                        className="text-3xl font-bold tracking-tight cursor-pointer hover:text-primary transition-colors"
                        onClick={() => {
                          reset();
                          setShowCompare(false);
                          setShowManual(false);
                          setShowFeed(false);
                        }}
                      >
                        Mix Match
                      </h1>
                      <p className="text-muted-foreground mt-2">Upload a DJ mix and identify every track</p>
                    </header>

                    <main>
                      {phase === 'idle' && !showCompare && !showManual && !showFeed && (
                        <>
                          <Dashboard onSelectAnalysis={loadAnalysis} />
                          <div className="flex justify-center gap-2 mb-4">
                            <Button variant="outline" size="sm" onClick={() => setShowCompare(true)}>
                              Compare Mixes
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setShowManual(true)}>
                              Manual Tracklist
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setShowFeed(true)}>
                              Feed
                            </Button>
                          </div>
                          {credits === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <p className="font-medium">No credits remaining</p>
                              <p className="text-sm mt-1">Credits reset monthly. Upgrade for more.</p>
                            </div>
                          ) : (
                            <FileUpload onFileSelected={startAnalysis} onUrlSubmitted={startAnalysisFromUrl} />
                          )}
                          <div className="mt-8">
                            <ProfileSettings />
                          </div>
                          <div className="mt-4">
                            <Analytics />
                          </div>
                        </>
                      )}

                      {phase === 'idle' && showFeed && (
                        <div>
                          <Button variant="ghost" size="sm" className="mb-4" onClick={() => setShowFeed(false)}>
                            &larr; Back
                          </Button>
                          <Feed
                            onSelectAnalysis={id => {
                              setShowFeed(false);
                              loadAnalysis(id);
                            }}
                          />
                        </div>
                      )}

                      {phase === 'idle' && showCompare && <MixCompare onBack={() => setShowCompare(false)} />}

                      {phase === 'idle' && showManual && (
                        <ManualTracklist
                          onCreated={id => {
                            setShowManual(false);
                            loadAnalysis(id);
                          }}
                          onBack={() => setShowManual(false)}
                        />
                      )}

                      {(phase === 'uploading' || phase === 'processing') && (
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
          }
        />
      </Routes>
    </>
  );
}

export default App;
