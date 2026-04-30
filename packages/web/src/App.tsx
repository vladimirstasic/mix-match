import { useAnalysis } from "./hooks/useAnalysis";
import { FileUpload } from "./components/FileUpload";
import { ProgressBar } from "./components/ProgressBar";
import { Timeline } from "./components/Timeline";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "./components/ThemeToggle";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/clerk-react";

function App() {
  const { phase, analysisId, uploadProgress, chunksProcessed, totalChunks, currentTrack, tracksFound,
        segments, chunksAvailable, error, startAnalysis, startAnalysisFromUrl, reset, retrySegment, retryAll, editSegment, shareAnalysis } =
    useAnalysis();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <header className="text-center mb-12">
          <div className="flex justify-end items-center gap-2 mb-4">
            <ThemeToggle />
            <SignedIn>
              <UserButton />
            </SignedIn>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Mix Match</h1>
          <p className="text-muted-foreground mt-2">Upload a DJ mix and identify every track</p>
        </header>

        <main>
          <SignedOut>
            <div className="text-center space-y-4">
              <p className="text-muted-foreground">Sign in to start identifying tracks in your mixes</p>
              <SignInButton mode="modal">
                <Button>Sign in</Button>
              </SignInButton>
            </div>
          </SignedOut>

          <SignedIn>
            {phase === "idle" && <FileUpload onFileSelected={startAnalysis} onUrlSubmitted={startAnalysisFromUrl} />}

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
          </SignedIn>
        </main>
      </div>
    </div>
  );
}

export default App;
