import { useState, useCallback, useEffect, useRef } from "react";
import type { TrackMatch } from "@mix-detective/shared";
import { uploadFile, subscribeProgress, getAnalysis } from "../api/client";

type Phase = "idle" | "uploading" | "processing" | "completed" | "failed";

interface AnalysisState {
  phase: Phase;
  analysisId: string | null;
  uploadProgress: number;
  chunksProcessed: number;
  totalChunks: number;
  currentTrack: string | null;
  results: TrackMatch[] | null;
  error: string | null;
}

export function useAnalysis() {
  const [state, setState] = useState<AnalysisState>({
    phase: "idle",
    analysisId: null,
    uploadProgress: 0,
    chunksProcessed: 0,
    totalChunks: 0,
    currentTrack: null,
    results: null,
    error: null,
  });

  const cleanupRef = useRef<(() => void) | null>(null);

  const pollResult = useCallback(async (id: string) => {
    try {
      const result = await getAnalysis(id);
      if (result.status === "completed") {
        setState((s) => ({ ...s, phase: "completed", results: result.results as TrackMatch[] }));
      } else if (result.status === "failed") {
        setState((s) => ({ ...s, phase: "failed", error: result.error || "Failed" }));
      } else {
        setTimeout(() => pollResult(id), 3000);
      }
    } catch {
      setTimeout(() => pollResult(id), 5000);
    }
  }, []);

  const startAnalysis = useCallback(async (file: File) => {
    setState((s) => ({ ...s, phase: "uploading", uploadProgress: 0, error: null, results: null }));

    try {
      const { analysisId } = await uploadFile(file, (pct) => {
        setState((s) => ({ ...s, uploadProgress: pct }));
      });

      setState((s) => ({ ...s, phase: "processing", analysisId, uploadProgress: 100 }));

      const unsub = subscribeProgress(
        analysisId,
        (data) => {
          if (data.type === "progress") {
            setState((s) => ({
              ...s,
              chunksProcessed: (data.chunksProcessed as number) || s.chunksProcessed,
              totalChunks: (data.totalChunks as number) || s.totalChunks,
              currentTrack: (data.currentTrack as string) || s.currentTrack,
            }));
          } else if (data.type === "completed") {
            setState((s) => ({
              ...s,
              phase: "completed",
              results: data.results as TrackMatch[],
            }));
          } else if (data.type === "failed") {
            setState((s) => ({
              ...s,
              phase: "failed",
              error: (data.error as string) || "Analysis failed",
            }));
          }
        },
        (err) => {
          pollResult(analysisId);
        }
      );

      cleanupRef.current = unsub;
    } catch (err) {
      setState((s) => ({
        ...s,
        phase: "failed",
        error: err instanceof Error ? err.message : "Upload failed",
      }));
    }
  }, [pollResult]);

  const reset = useCallback(() => {
    cleanupRef.current?.();
    setState({
      phase: "idle",
      analysisId: null,
      uploadProgress: 0,
      chunksProcessed: 0,
      totalChunks: 0,
      currentTrack: null,
      results: null,
      error: null,
    });
  }, []);

  useEffect(() => () => cleanupRef.current?.(), []);

  return { ...state, startAnalysis, reset };
}
