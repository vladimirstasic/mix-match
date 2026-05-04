import type { UploadResponse, AnalysisResult, Segment, AnalysisMode } from '@mix-match/shared';

export interface AnalysisResponse extends AnalysisResult {
  segments: Segment[];
  chunksAvailable: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export async function uploadFile(
  file: File,
  onProgress?: (pct: number) => void,
  mode: AnalysisMode = 'fast',
): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/upload`);
    xhr.withCredentials = true;

    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(xhr.responseText || 'Upload failed'));
      }
    };

    xhr.onerror = () => reject(new Error('Network error'));

    const formData = new FormData();
    formData.append('file', file);
    formData.append('mode', mode);
    xhr.send(formData);
  });
}

export async function uploadUrl(url: string, mode: AnalysisMode = 'fast'): Promise<UploadResponse> {
  const res = await fetch(`${API_BASE}/upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ url, mode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Download failed' }));
    throw new Error(err.error || 'Download failed');
  }
  return res.json();
}

export async function getAnalysis(id: string): Promise<AnalysisResponse> {
  const res = await fetch(`${API_BASE}/analysis/${id}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch analysis');
  return res.json();
}

export function subscribeProgress(
  id: string,
  onEvent: (data: Record<string, unknown>) => void,
  onError?: (err: Error) => void,
): () => void {
  const es = new EventSource(`${API_BASE}/analysis/${id}/progress`);

  es.onmessage = e => {
    try {
      onEvent(JSON.parse(e.data));
    } catch {
      // ignore parse errors
    }
  };

  es.onerror = () => {
    onError?.(new Error('SSE connection lost'));
    es.close();
  };

  return () => es.close();
}

export async function retrySegment(analysisId: string, segmentId: string): Promise<{ jobId: string }> {
  const res = await fetch(`${API_BASE}/analysis/${analysisId}/segments/${segmentId}/retry`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Retry failed');
  return res.json();
}

export async function retryAllUnknown(analysisId: string): Promise<{ jobId: string; segmentCount: number }> {
  const res = await fetch(`${API_BASE}/analysis/${analysisId}/retry-unknown`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) throw new Error('Retry failed');
  return res.json();
}

export async function updateAnalysis(
  analysisId: string,
  data: { isPublic?: boolean; slug?: string },
): Promise<unknown> {
  const res = await fetch(`${API_BASE}/analysis/${analysisId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Update failed');
  return res.json();
}

export interface AnalysisSummary {
  id: string;
  filename: string;
  status: string;
  mode: string | null;
  createdAt: string;
  isPublic: boolean | null;
  isFavorite: boolean | null;
  slug: string | null;
  tags: string[] | null;
}

export async function getUserAnalyses(): Promise<AnalysisSummary[]> {
  const res = await fetch(`${API_BASE}/user/analyses`, { credentials: 'include' });
  if (!res.ok) return [];
  return res.json();
}

export async function deleteAnalysis(id: string): Promise<void> {
  await fetch(`${API_BASE}/analysis/${id}`, { method: 'DELETE', credentials: 'include' });
}

export async function updateAnalysisTags(analysisId: string, tags: string[]): Promise<void> {
  await fetch(`${API_BASE}/analysis/${analysisId}/tags`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ tags }),
  });
}

export async function toggleFavorite(analysisId: string): Promise<{ isFavorite: boolean }> {
  const res = await fetch(`${API_BASE}/analysis/${analysisId}/favorite`, { method: 'PATCH', credentials: 'include' });
  return res.json();
}

export async function toggleBookmark(segmentId: string): Promise<{ isBookmarked: boolean }> {
  const res = await fetch(`${API_BASE}/segments/${segmentId}/bookmark`, { method: 'PATCH', credentials: 'include' });
  return res.json();
}

export interface CompareResult {
  mixA: { id: string; filename: string; totalTracks: number };
  mixB: { id: string; filename: string; totalTracks: number };
  sharedTracks: { trackName: string; inA: string; inB: string }[];
  uniqueToA: number;
  uniqueToB: number;
}

export async function compareMixes(idA: string, idB: string): Promise<CompareResult> {
  const res = await fetch(`${API_BASE}/analysis/compare?a=${idA}&b=${idB}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Compare failed');
  return res.json();
}

export interface Comment {
  id: string;
  segmentId: string;
  userId: string;
  text: string;
  createdAt: string;
}

export async function getComments(segmentId: string): Promise<Comment[]> {
  const res = await fetch(`${API_BASE}/segments/${segmentId}/comments`, { credentials: 'include' });
  return res.ok ? res.json() : [];
}

export async function addComment(segmentId: string, text: string): Promise<Comment> {
  const res = await fetch(`${API_BASE}/segments/${segmentId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ text }),
  });
  return res.json();
}

export async function voteSegment(segmentId: string, value: 1 | -1): Promise<{ score: number }> {
  const res = await fetch(`${API_BASE}/segments/${segmentId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ value }),
  });
  return res.json();
}

export async function editSegment(analysisId: string, segmentId: string, trackName: string): Promise<Segment> {
  const res = await fetch(`${API_BASE}/analysis/${analysisId}/segments/${segmentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ trackName }),
  });
  if (!res.ok) throw new Error('Edit failed');
  return res.json();
}
