import { useCallback, useEffect, useRef, useState } from 'react';
import type { TrackMatch, Segment, AnalysisMode } from '@mix-match/shared';
import {
  getAnalysis,
  subscribeProgress,
  uploadFile,
  uploadUrl,
  retrySegment as retrySegmentApi,
  retryAllUnknown as retryAllApi,
  editSegment as editSegmentApi,
  updateAnalysis,
} from '../api/client';

type Phase = 'idle' | 'loading' | 'uploading' | 'processing' | 'completed' | 'failed';

interface AnalysisState {
  phase: Phase;
  analysisId: string | null;
  filename: string | null;
  sourceUrl: string | null;
  uploadProgress: number;
  chunksProcessed: number;
  totalChunks: number;
  currentTrack: string | null;
  tracksFound: number;
  results: TrackMatch[] | null;
  segments: Segment[];
  chunksAvailable: boolean;
  waveformData: number[] | null;
  slug: string | null;
  isPublic: boolean;
  error: string | null;
}

export function useAnalysis() {
  const savedId = localStorage.getItem('mixmatch_active_analysis');

  const [state, setState] = useState<AnalysisState>({
    phase: savedId ? 'loading' : 'idle',
    analysisId: savedId,
    filename: null,
    sourceUrl: null,
    uploadProgress: 0,
    chunksProcessed: 0,
    totalChunks: 0,
    currentTrack: null,
    tracksFound: 0,
    results: null,
    segments: [],
    chunksAvailable: false,
    waveformData: null,
    slug: null,
    isPublic: false,
    error: null,
  });

  const cleanupRef = useRef<(() => void) | null>(null);

  const pollResult = useCallback(async (id: string) => {
    try {
      const result = await getAnalysis(id);
      if (result.status === 'completed') {
        setState(s => ({
          ...s,
          phase: 'completed',
          filename: result.filename,
          sourceUrl: result.sourceUrl || null,
          results: result.results as TrackMatch[],
          segments: result.segments || [],
          chunksAvailable: result.chunksAvailable || false,
          waveformData: result.waveformData || null,
          slug: result.slug ?? null,
          isPublic: result.isPublic ?? false,
        }));
      } else if (result.status === 'failed') {
        setState(s => ({ ...s, phase: 'failed', error: result.error || 'Failed' }));
      } else {
        setTimeout(() => pollResult(id), 3000);
      }
    } catch {
      setTimeout(() => pollResult(id), 5000);
    }
  }, []);

  const subscribeToAnalysis = useCallback(
    (analysisId: string) => {
      cleanupRef.current = subscribeProgress(
        analysisId,
        async data => {
          if (data.type === 'progress') {
            setState(s => ({
              ...s,
              chunksProcessed: (data.chunksProcessed as number) || s.chunksProcessed,
              totalChunks: (data.totalChunks as number) || s.totalChunks,
              currentTrack: (data.currentTrack as string) || s.currentTrack,
              tracksFound: (data.tracksFound as number) || s.tracksFound,
            }));
            // Fetch partial segments every 5 chunks
            const processed = (data.chunksProcessed as number) || 0;
            if (processed > 0 && processed % 5 === 0) {
              getAnalysis(analysisId)
                .then(full => {
                  if (full.segments && full.segments.length > 0) {
                    setState(s => ({ ...s, segments: full.segments }));
                  }
                })
                .catch(() => {});
            }
          } else if (data.type === 'completed') {
            const full = await getAnalysis(analysisId);
            setState(s => ({
              ...s,
              phase: 'completed',
              filename: full.filename,
              sourceUrl: full.sourceUrl || null,
              results: full.results as TrackMatch[],
              segments: full.segments,
              chunksAvailable: full.chunksAvailable,
              waveformData: full.waveformData || null,
            }));
          } else if (data.type === 'failed') {
            setState(s => ({
              ...s,
              phase: 'failed',
              error: (data.error as string) || 'Analysis failed',
            }));
          }
        },
        () => {
          pollResult(analysisId);
        },
      );
    },
    [pollResult],
  );

  const startAnalysis = useCallback(
    async (file: File, mode: AnalysisMode = 'fast') => {
      setState(s => ({ ...s, phase: 'uploading', uploadProgress: 0, error: null, results: null }));

      try {
        const { analysisId } = await uploadFile(
          file,
          pct => {
            setState(s => ({ ...s, uploadProgress: pct }));
          },
          mode,
        );

        localStorage.setItem('mixmatch_active_analysis', analysisId);
        setState(s => ({ ...s, phase: 'processing', analysisId, uploadProgress: 100 }));

        subscribeToAnalysis(analysisId);
      } catch (err) {
        setState(s => ({
          ...s,
          phase: 'failed',
          error: err instanceof Error ? err.message : 'Upload failed',
        }));
      }
    },
    [subscribeToAnalysis],
  );

  const startAnalysisFromUrl = useCallback(
    async (url: string, mode: AnalysisMode = 'fast') => {
      setState(s => ({ ...s, phase: 'uploading', uploadProgress: 0, error: null, results: null }));

      try {
        // No progress tracking for URL download — just show indeterminate
        setState(s => ({ ...s, uploadProgress: -1 })); // -1 = indeterminate

        const { analysisId } = await uploadUrl(url, mode);

        localStorage.setItem('mixmatch_active_analysis', analysisId);
        setState(s => ({ ...s, phase: 'processing', analysisId, uploadProgress: 100 }));

        subscribeToAnalysis(analysisId);
      } catch (err) {
        setState(s => ({
          ...s,
          phase: 'failed',
          error: err instanceof Error ? err.message : 'Failed to process URL',
        }));
      }
    },
    [subscribeToAnalysis],
  );

  const loadAnalysis = useCallback(async (id: string) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setState(s => ({ ...s, phase: 'loading', analysisId: id }));
    try {
      const full = await getAnalysis(id);
      localStorage.setItem('mixmatch_active_analysis', id);
      if (full.status === 'completed') {
        setState(s => ({
          ...s,
          phase: 'completed',
          analysisId: id,
          filename: full.filename,
          sourceUrl: full.sourceUrl || null,
          segments: full.segments || [],
          chunksAvailable: full.chunksAvailable || false,
          waveformData: full.waveformData || null,
          slug: full.slug ?? null,
          isPublic: full.isPublic ?? false,
        }));
      } else if (full.status === 'failed') {
        setState(s => ({ ...s, phase: 'failed', analysisId: id, error: full.error || 'Failed' }));
      } else {
        setState(s => ({ ...s, phase: 'processing', analysisId: id }));
      }
    } catch {
      // Analysis not found
    }
  }, []);

  const reset = useCallback(() => {
    cleanupRef.current?.();
    localStorage.removeItem('mixmatch_active_analysis');
    setState({
      phase: 'idle',
      analysisId: null,
      filename: null,
      sourceUrl: null,
      uploadProgress: 0,
      chunksProcessed: 0,
      totalChunks: 0,
      currentTrack: null,
      tracksFound: 0,
      results: null,
      segments: [],
      chunksAvailable: false,
      waveformData: null,
      slug: null,
      isPublic: false,
      error: null,
    });
  }, []);

  useEffect(() => {
    const savedId = localStorage.getItem('mixmatch_active_analysis');
    if (!savedId || (state.phase !== 'idle' && state.phase !== 'loading')) return;

    getAnalysis(savedId)
      .then(data => {
        if (data.status === 'completed') {
          setState(s => ({
            ...s,
            phase: 'completed',
            analysisId: savedId,
            filename: data.filename,
            sourceUrl: data.sourceUrl || null,
            segments: data.segments,
            chunksAvailable: data.chunksAvailable,
            waveformData: data.waveformData || null,
            slug: data.slug ?? null,
            isPublic: data.isPublic ?? false,
          }));
        } else if (data.status === 'processing' || data.status === 'pending') {
          setState(s => ({ ...s, phase: 'processing', analysisId: savedId }));
          subscribeToAnalysis(savedId);
        } else if (data.status === 'failed') {
          setState(s => ({ ...s, phase: 'failed', analysisId: savedId, error: data.error || 'Analysis failed' }));
        }
      })
      .catch(() => {
        // Analysis no longer exists, clear saved ID
        localStorage.removeItem('mixmatch_active_analysis');
      });
  }, []);

  useEffect(() => () => cleanupRef.current?.(), []);

  const retrySegment = useCallback(
    async (segmentId: string) => {
      if (!state.analysisId) return;
      setState(s => ({
        ...s,
        segments: s.segments.map(seg => (seg.id === segmentId ? { ...seg, status: 'retrying' as const } : seg)),
      }));
      await retrySegmentApi(state.analysisId, segmentId);
      const poll = async () => {
        const full = await getAnalysis(state.analysisId!);
        const seg = full.segments.find(s => s.id === segmentId);
        if (seg?.status === 'retrying') {
          setTimeout(poll, 2000);
        } else {
          setState(s => ({ ...s, segments: full.segments, results: full.results as TrackMatch[] }));
        }
      };
      setTimeout(poll, 2000);
    },
    [state.analysisId],
  );

  const retryAll = useCallback(async () => {
    if (!state.analysisId) return;
    setState(s => ({
      ...s,
      segments: s.segments.map(seg => (seg.status === 'unknown' ? { ...seg, status: 'retrying' as const } : seg)),
    }));
    await retryAllApi(state.analysisId);
    const poll = async () => {
      const full = await getAnalysis(state.analysisId!);
      const stillRetrying = full.segments.some(s => s.status === 'retrying');
      if (stillRetrying) {
        setTimeout(poll, 3000);
      } else {
        setState(s => ({ ...s, segments: full.segments, results: full.results as TrackMatch[] }));
      }
    };
    setTimeout(poll, 3000);
  }, [state.analysisId]);

  const editSegment = useCallback(
    async (segmentId: string, trackName: string) => {
      if (!state.analysisId) return;
      await editSegmentApi(state.analysisId, segmentId, trackName);
      const full = await getAnalysis(state.analysisId);
      setState(s => ({ ...s, segments: full.segments }));
    },
    [state.analysisId],
  );

  const shareAnalysis = useCallback(async (): Promise<string | null> => {
    if (!state.analysisId) return null;
    // Server generates the slug and ignores any client value, so use the slug it returns.
    const updated = (await updateAnalysis(state.analysisId, { isPublic: true })) as { slug?: string | null };
    const slug = updated.slug ?? null;
    setState(s => ({ ...s, slug, isPublic: true }));
    return slug;
  }, [state.analysisId]);

  return {
    ...state,
    startAnalysis,
    startAnalysisFromUrl,
    reset,
    loadAnalysis,
    retrySegment,
    retryAll,
    editSegment,
    shareAnalysis,
  };
}
