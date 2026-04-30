import {useCallback, useEffect, useRef, useState} from "react";
import type {TrackMatch, Segment, AnalysisMode} from "@mix-match/shared";
import {getAnalysis, subscribeProgress, uploadFile, uploadUrl, retrySegment as retrySegmentApi, retryAllUnknown as retryAllApi, editSegment as editSegmentApi, updateAnalysis} from "../api/client";

type Phase = "idle" | "uploading" | "processing" | "completed" | "failed";

interface AnalysisState {
  phase: Phase;
  analysisId: string | null;
  uploadProgress: number;
  chunksProcessed: number;
  totalChunks: number;
  currentTrack: string | null;
  tracksFound: number;
  results: TrackMatch[] | null;
  segments: Segment[];
  chunksAvailable: boolean;
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
    tracksFound: 0,
    results: null,
    segments: [],
    chunksAvailable: false,
    error: null,
  });

  const cleanupRef = useRef<(() => void) | null>(null);

  const pollResult = useCallback(async (id: string) => {
    try {
      const result = await getAnalysis(id);
      if (result.status === "completed") {
        setState((s) => ({
          ...s,
          phase: "completed",
          results: result.results as TrackMatch[],
          segments: result.segments || [],
          chunksAvailable: result.chunksAvailable || false,
        }));
      } else if (result.status === "failed") {
        setState((s) => ({ ...s, phase: "failed", error: result.error || "Failed" }));
      } else {
        setTimeout(() => pollResult(id), 3000);
      }
    } catch {
      setTimeout(() => pollResult(id), 5000);
    }
  }, []);

  const startAnalysis = useCallback(async (file: File, mode: AnalysisMode = "fast") => {
    setState((s) => ({ ...s, phase: "uploading", uploadProgress: 0, error: null, results: null }));

    try {
      const { analysisId } = await uploadFile(file, (pct) => {
        setState((s) => ({ ...s, uploadProgress: pct }));
      }, mode);

      setState((s) => ({ ...s, phase: "processing", analysisId, uploadProgress: 100 }));

      cleanupRef.current = subscribeProgress(
          analysisId,
          async (data) => {
            if (data.type === "progress") {
              setState((s) => ({
                ...s,
                chunksProcessed: (data.chunksProcessed as number) || s.chunksProcessed,
                totalChunks: (data.totalChunks as number) || s.totalChunks,
                currentTrack: (data.currentTrack as string) || s.currentTrack,
                tracksFound: (data.tracksFound as number) || s.tracksFound,
              }));
            } else if (data.type === "completed") {
              const full = await getAnalysis(analysisId);
              setState((s) => ({
                ...s,
                phase: "completed",
                results: full.results as TrackMatch[],
                segments: full.segments,
                chunksAvailable: full.chunksAvailable,
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
            console.log(err)
            pollResult(analysisId);
          }
      );
    } catch (err) {
      setState((s) => ({
        ...s,
        phase: "failed",
        error: err instanceof Error ? err.message : "Upload failed",
      }));
    }
  }, [pollResult]);

  const startAnalysisFromUrl = useCallback(async (url: string, mode: AnalysisMode = "fast") => {
    setState((s) => ({ ...s, phase: "uploading", uploadProgress: 0, error: null, results: null }));

    try {
      // No progress tracking for URL download — just show indeterminate
      setState((s) => ({ ...s, uploadProgress: -1 })); // -1 = indeterminate

      const { analysisId } = await uploadUrl(url, mode);

      setState((s) => ({ ...s, phase: "processing", analysisId, uploadProgress: 100 }));

      // Same SSE subscription as startAnalysis
      cleanupRef.current = subscribeProgress(
        analysisId,
        async (data) => {
          if (data.type === "progress") {
            setState((s) => ({
              ...s,
              chunksProcessed: (data.chunksProcessed as number) || s.chunksProcessed,
              totalChunks: (data.totalChunks as number) || s.totalChunks,
              currentTrack: (data.currentTrack as string) || s.currentTrack,
              tracksFound: (data.tracksFound as number) || s.tracksFound,
            }));
          } else if (data.type === "completed") {
            const full = await getAnalysis(analysisId);
            setState((s) => ({
              ...s,
              phase: "completed",
              results: full.results as TrackMatch[],
              segments: full.segments,
              chunksAvailable: full.chunksAvailable,
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
          console.log(err);
          pollResult(analysisId);
        }
      );
    } catch (err) {
      setState((s) => ({
        ...s,
        phase: "failed",
        error: err instanceof Error ? err.message : "Failed to process URL",
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
      tracksFound: 0,
      results: null,
      segments: [],
      chunksAvailable: false,
      error: null,
    });
  }, []);

  useEffect(() => () => cleanupRef.current?.(), []);

  const retrySegment = useCallback(async (segmentId: string) => {
    if (!state.analysisId) return;
    setState((s) => ({
      ...s,
      segments: s.segments.map((seg) =>
        seg.id === segmentId ? { ...seg, status: "retrying" as const } : seg
      ),
    }));
    await retrySegmentApi(state.analysisId, segmentId);
    const poll = async () => {
      const full = await getAnalysis(state.analysisId!);
      const seg = full.segments.find((s) => s.id === segmentId);
      if (seg?.status === "retrying") {
        setTimeout(poll, 2000);
      } else {
        setState((s) => ({ ...s, segments: full.segments, results: full.results as TrackMatch[] }));
      }
    };
    setTimeout(poll, 2000);
  }, [state.analysisId]);

  const retryAll = useCallback(async () => {
    if (!state.analysisId) return;
    setState((s) => ({
      ...s,
      segments: s.segments.map((seg) =>
        seg.status === "unknown" ? { ...seg, status: "retrying" as const } : seg
      ),
    }));
    await retryAllApi(state.analysisId);
    const poll = async () => {
      const full = await getAnalysis(state.analysisId!);
      const stillRetrying = full.segments.some((s) => s.status === "retrying");
      if (stillRetrying) {
        setTimeout(poll, 3000);
      } else {
        setState((s) => ({ ...s, segments: full.segments, results: full.results as TrackMatch[] }));
      }
    };
    setTimeout(poll, 3000);
  }, [state.analysisId]);

  const editSegment = useCallback(async (segmentId: string, trackName: string) => {
    if (!state.analysisId) return;
    await editSegmentApi(state.analysisId, segmentId, trackName);
    const full = await getAnalysis(state.analysisId);
    setState((s) => ({ ...s, segments: full.segments }));
  }, [state.analysisId]);

  const shareAnalysis = useCallback(async (): Promise<string | null> => {
    if (!state.analysisId) return null;
    const slug = Math.random().toString(36).slice(2, 10);
    await updateAnalysis(state.analysisId, { isPublic: true, slug });
    return slug;
  }, [state.analysisId]);

  return { ...state, startAnalysis, startAnalysisFromUrl, reset, retrySegment, retryAll, editSegment, shareAnalysis };
}
