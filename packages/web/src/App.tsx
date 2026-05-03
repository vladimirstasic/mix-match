import { Routes, Route } from "react-router-dom";
import { useAnalysis } from "./hooks/useAnalysis";
import { FileUpload } from "./components/FileUpload";
import { ProgressBar } from "./components/ProgressBar";
import { Timeline } from "./components/Timeline";
import { Dashboard } from "./components/Dashboard";
import { LandingPage } from "./components/LandingPage";
import { PublicTracklist } from "./components/PublicTracklist";
import { DjProfile } from "./components/DjProfile";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./components/ThemeToggle";
import { useToast, ToastContainer } from "./components/Toast";
import { SignedIn, SignedOut, UserButton } from "@clerk/clerk-react";
import { useEffect, useRef } from "react";

function App() {
  const { phase, analysisId, uploadProgress, chunksProcessed, totalChunks, currentTrack, tracksFound,
        segments, chunksAvailable, error, startAnalysis, startAnalysisFromUrl, reset, loadAnalysis, retrySegment, retryAll, editSegment, shareAnalysis } =
    useAnalysis();
  const { toasts, addToast, removeToast } = useToast();
  const prevPhase = useRef(phase);

  // Handle Spotify OAuth callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const spotifyStatus = params.get("spotify");
    if (spotifyStatus === "success") {
      const playlistUrl = params.get("playlist");
      if (playlistUrl) {
        addToast(`Spotify playlist created!`);
        window.open(decodeURIComponent(playlistUrl), "_blank");
      }
      window.history.replaceState({}, "", window.location.pathname);
    } else if (spotifyStatus === "error") {
      addToast("Failed to create Spotify playlist", "error");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [addToast]);

  useEffect(() => {
    if (prevPhase.current === "processing" && phase === "completed") {
      const count = segments.filter(s => s.status === "identified").length;
      addToast(`Analysis complete — ${count} track${count !== 1 ? "s" : ""} identified`);
    }
    if (prevPhase.current === "processing" && phase === "failed") {
      addToast(error || "Analysis failed", "error");
    }
    prevPhase.current = phase;
  }, [phase, segments, error, addToast]);

  return (
    <>
    <ToastContainer toasts={toasts} onRemove={removeToast} />
    <Routes>
      <Route path="/t/:slug" element={<PublicTracklist />} />
      <Route path="/dj/:username" element={<DjProfile />} />
      <Route path="*" element={
        <>
          <SignedOut>
            <div className="fixed top-4 right-4 z-50">
              <ThemeToggle />
            </div>
            <LandingPage />
          </SignedOut>

          <SignedIn>
            <div className="min-h-screen bg-background text-foreground">
              <div className="max-w-2xl mx-auto px-4 py-12">
                <header className="text-center mb-12">
                  <div className="flex justify-end items-center gap-2 mb-4">
                    <ThemeToggle />
                    <UserButton />
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight">Mix Match</h1>
                  <p className="text-muted-foreground mt-2">Upload a DJ mix and identify every track</p>
                </header>

                <main>
                  {phase === "idle" && (
                    <>
                      <Dashboard onSelectAnalysis={loadAnalysis} />
                      <FileUpload onFileSelected={startAnalysis} onUrlSubmitted={startAnalysisFromUrl} />
                    </>
                  )}

                  {(phase === "uploading" || phase === "processing") && (
                    <ProgressBar
                      phase={phase}
                      uploadProgress={uploadProgress}
                      chunksProcessed={chunksProcessed}
                      totalChunks={totalChunks}
                      currentTrack={currentTrack}
                      tracksFound={tracksFound}
                    />
                  )}

                  {phase === "completed" && segments.length > 0 && (
                    <Timeline
                      segments={segments}
                      chunksAvailable={chunksAvailable}
                      analysisId={analysisId!}
                      onRetrySegment={retrySegment}
                      onRetryAll={retryAll}
                      onReset={reset}
                      onEditSegment={editSegment}
                      onShare={shareAnalysis}
                    />
                  )}

                  {phase === "failed" && (
                    <div className="text-center space-y-4">
                      <p className="text-destructive">Analysis failed: {error}</p>
                      <Button variant="outline" onClick={reset}>Try again</Button>
                    </div>
                  )}
                </main>
              </div>
            </div>
          </SignedIn>
        </>
      } />
    </Routes>
    </>
  );
}

export default App;
