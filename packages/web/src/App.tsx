import { useAnalysis } from "./hooks/useAnalysis";
import { FileUpload } from "./components/FileUpload";
import { ProgressBar } from "./components/ProgressBar";
import { Timeline } from "./components/Timeline";
import "./App.css";

function App() {
  const { phase, uploadProgress, chunksProcessed, totalChunks, currentTrack, results, error, startAnalysis, reset } =
    useAnalysis();

  return (
    <div className="app">
      <header>
        <h1>Mix Detective</h1>
        <p>Upload a DJ mix and identify every track</p>
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
          />
        )}

        {phase === "completed" && results && <Timeline results={results} onReset={reset} />}

        {phase === "failed" && (
          <div className="error-state">
            <p>Analysis failed: {error}</p>
            <button onClick={reset} className="btn-reset">Try again</button>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
