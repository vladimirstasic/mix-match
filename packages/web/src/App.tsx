import { useAnalysis } from "./hooks/useAnalysis";
import { FileUpload } from "./components/FileUpload";
import { ProgressBar } from "./components/ProgressBar";
import { Timeline } from "./components/Timeline";
import { Button } from "@/components/ui/button";

function App() {
  const { phase, uploadProgress, chunksProcessed, totalChunks, currentTrack, tracksFound,
        segments, chunksAvailable, error, startAnalysis, reset, retrySegment, retryAll } =
    useAnalysis();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <header className="text-center mb-12">
          <h1 className="text-3xl font-bold tracking-tight">Mix Match</h1>
          <p className="text-muted-foreground mt-2">Upload a DJ mix and identify every track</p>
        </header>

        <main>
          {phase === "idle" && <FileUpload onFileSelected={startAnalysis} />}

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
              onRetrySegment={retrySegment}
              onRetryAll={retryAll}
              onReset={reset}
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
  );
}

export default App;
