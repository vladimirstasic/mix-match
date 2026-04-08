import type { UploadResponse, AnalysisResult } from "@mix-detective/shared";

const API_BASE = import.meta.env.VITE_API_URL || "/api";

export async function uploadFile(file: File, onProgress?: (pct: number) => void): Promise<UploadResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE}/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(JSON.parse(xhr.responseText));
      } else {
        reject(new Error(xhr.responseText || "Upload failed"));
      }
    };

    xhr.onerror = () => reject(new Error("Network error"));

    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });
}

export async function getAnalysis(id: string): Promise<AnalysisResult> {
  const res = await fetch(`${API_BASE}/analysis/${id}`);
  if (!res.ok) throw new Error("Failed to fetch analysis");
  return res.json();
}

export function subscribeProgress(
  id: string,
  onEvent: (data: Record<string, unknown>) => void,
  onError?: (err: Error) => void
): () => void {
  const es = new EventSource(`${API_BASE}/analysis/${id}/progress`);

  es.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data));
    } catch {
      // ignore parse errors
    }
  };

  es.onerror = () => {
    onError?.(new Error("SSE connection lost"));
    es.close();
  };

  return () => es.close();
}
