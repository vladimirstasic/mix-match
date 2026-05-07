import type { UploadResponse, AnalysisResult, Segment, AnalysisMode } from '@mix-match/shared';

export interface AnalysisResponse extends AnalysisResult {
  segments: Segment[];
  chunksAvailable: boolean;
  waveformData: number[] | null;
  sourceUrl?: string | null;
}

const API_BASE = import.meta.env.VITE_API_URL || '/api';

let getTokenFn: (() => Promise<string | null>) | null = null;

export function setAuthTokenProvider(fn: () => Promise<string | null>) {
  getTokenFn = fn;
}

async function authHeaders(): Promise<Record<string, string>> {
  if (!getTokenFn) return {};
  const token = await getTokenFn();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

export async function uploadFile(
  file: File,
  onProgress?: (pct: number) => void,
  mode: AnalysisMode = 'fast',
): Promise<UploadResponse> {
  const headers = await authHeaders();
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/upload`);
    for (const [k, v] of Object.entries(headers)) xhr.setRequestHeader(k, v);

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
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/upload-url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ url, mode }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Download failed' }));
    throw new Error(err.error || 'Download failed');
  }
  return res.json();
}

export async function getAnalysis(id: string): Promise<AnalysisResponse> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/analysis/${id}`, { headers });
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
    } catch {}
  };

  es.onerror = () => {
    onError?.(new Error('SSE connection lost'));
    es.close();
  };

  return () => es.close();
}

export async function retrySegment(analysisId: string, segmentId: string): Promise<{ jobId: string }> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/analysis/${analysisId}/segments/${segmentId}/retry`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) throw new Error('Retry failed');
  return res.json();
}

export async function retryAllUnknown(analysisId: string): Promise<{ jobId: string; segmentCount: number }> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/analysis/${analysisId}/retry-unknown`, {
    method: 'POST',
    headers,
  });
  if (!res.ok) throw new Error('Retry failed');
  return res.json();
}

export async function updateAnalysis(
  analysisId: string,
  data: { isPublic?: boolean; slug?: string },
): Promise<unknown> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/analysis/${analysisId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
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
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/user/analyses`, { headers });
  if (!res.ok) return [];
  return res.json();
}

export async function getUserProfile(): Promise<{ creditsRemaining: number } | null> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/user/profile`, { headers });
  if (!res.ok) return null;
  return res.json();
}

export async function deleteAnalysis(id: string): Promise<void> {
  const headers = await authHeaders();
  await fetch(`${API_BASE}/analysis/${id}`, { method: 'DELETE', headers });
}

export async function updateAnalysisTags(analysisId: string, tags: string[]): Promise<void> {
  const headers = await authHeaders();
  await fetch(`${API_BASE}/analysis/${analysisId}/tags`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ tags }),
  });
}

export async function toggleFavorite(analysisId: string): Promise<{ isFavorite: boolean }> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/analysis/${analysisId}/favorite`, { method: 'PATCH', headers });
  return res.json();
}

export async function toggleBookmark(segmentId: string): Promise<{ isBookmarked: boolean }> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/segments/${segmentId}/bookmark`, { method: 'PATCH', headers });
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
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/analysis/compare?a=${idA}&b=${idB}`, { headers });
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
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/segments/${segmentId}/comments`, { headers });
  return res.ok ? res.json() : [];
}

export async function addComment(segmentId: string, text: string): Promise<Comment> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/segments/${segmentId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ text }),
  });
  return res.json();
}

export async function voteSegment(segmentId: string, value: 1 | -1): Promise<{ score: number }> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/segments/${segmentId}/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ value }),
  });
  return res.json();
}

export async function editSegment(analysisId: string, segmentId: string, trackName: string): Promise<Segment> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}/analysis/${analysisId}/segments/${segmentId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ trackName }),
  });
  if (!res.ok) throw new Error('Edit failed');
  return res.json();
}
