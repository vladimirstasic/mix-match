import React, { useState } from "react";
import type { Segment, ExternalLinks } from "@mix-match/shared";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RotateCw, Check, HelpCircle, Loader2, Pencil, Share2, EyeOff, Eye, Copy } from "lucide-react";

interface Props {
  segments: Segment[];
  chunksAvailable: boolean;
  analysisId: string;
  onRetrySegment: (segmentId: string) => void;
  onRetryAll: () => void;
  onReset: () => void;
  onEditSegment: (segmentId: string, trackName: string) => void;
  onShare: () => Promise<string | null>;
}

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const LINK_LABELS: { key: keyof ExternalLinks; label: string; color: string }[] = [
  { key: "spotify", label: "Spotify", color: "text-green-500 hover:text-green-400" },
  { key: "appleMusic", label: "Apple Music", color: "text-pink-500 hover:text-pink-400" },
  { key: "beatport", label: "Beatport", color: "text-blue-500 hover:text-blue-400" },
  { key: "youtube", label: "YouTube", color: "text-red-500 hover:text-red-400" },
  { key: "deezer", label: "Deezer", color: "text-purple-500 hover:text-purple-400" },
];

function StreamingLinks({ links, segmentId, expandedService, onToggleEmbed }: {
  links: ExternalLinks;
  segmentId: string;
  expandedService: string | null;
  onToggleEmbed: (id: string, service: string) => void;
}) {
  const available = LINK_LABELS.filter(({ key }) => links[key]);
  if (available.length === 0) return null;

  const embeddable = new Set(["spotify", "deezer"]);

  return (
    <span className="inline-flex items-center gap-1 ml-2">
      {available.map(({ key, label, color }) => {
        if (embeddable.has(key) && links[key]) {
          const isExpanded = expandedService === key;
          return (
            <button
              key={key}
              onClick={(e) => { e.stopPropagation(); onToggleEmbed(segmentId, key); }}
              title={isExpanded ? `Hide ${label} player` : `Show ${label} player`}
              className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${color} ${isExpanded ? "ring-1 ring-current/40 bg-current/10" : "bg-muted/50 hover:bg-muted"} transition-colors cursor-pointer`}
            >
              {label}
            </button>
          );
        }
        return (
          <a
            key={key}
            href={links[key]}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open on ${label}`}
            className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${color} bg-muted/50 hover:bg-muted transition-colors`}
          >
            {label}
          </a>
        );
      })}
    </span>
  );
}

function getSpotifyEmbedUrl(spotifyUrl: string): string | null {
  const match = spotifyUrl.match(/track\/([a-zA-Z0-9]+)/);
  if (!match) return null;
  return `https://open.spotify.com/embed/track/${match[1]}?utm_source=generator&theme=0`;
}

function getDeezerEmbedUrl(deezerUrl: string): string | null {
  const match = deezerUrl.match(/track\/(\d+)/);
  if (!match) return null;
  return `https://widget.deezer.com/widget/dark/track/${match[1]}`;
}

export function Timeline({ segments, chunksAvailable, analysisId, onRetrySegment, onRetryAll, onReset, onEditSegment, onShare }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [hideUnknown, setHideUnknown] = useState(false);
  const [expandedEmbed, setExpandedEmbed] = useState<{ segId: string; service: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const copyTracklist = (format: "text" | "youtube") => {
    const identified = segments.filter(s => s.status === "identified");
    let text: string;
    if (format === "text") {
      text = identified.map((s, i) => `${i + 1}. ${formatTime(s.startSec)} - ${formatTime(s.endSec)}  ${s.trackName}`).join("\n");
    } else {
      text = identified.map(s => `${formatTime(s.startSec)} ${s.trackName}`).join("\n");
    }
    navigator.clipboard.writeText(text);
    setCopied(format);
    setTimeout(() => setCopied(null), 2000);
  };

  const identified = segments.filter((s) => s.status === "identified");
  const unknown = segments.filter((s) => s.status === "unknown");
  const retrying = segments.filter((s) => s.status === "retrying");
  const visibleSegments = hideUnknown ? segments.filter((s) => s.status !== "unknown") : segments;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">
          Found {identified.length} track{identified.length !== 1 ? "s" : ""}
          {unknown.length > 0 && (
            <span className="text-muted-foreground font-normal text-base ml-2">
              ({unknown.length} unidentified)
            </span>
          )}
        </h2>
        <div className="flex gap-2">
          {unknown.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHideUnknown(!hideUnknown)}
            >
              {hideUnknown ? <Eye className="w-4 h-4 mr-1" /> : <EyeOff className="w-4 h-4 mr-1" />}
              {hideUnknown ? "Show unknown" : "Hide unknown"}
            </Button>
          )}
          {unknown.length > 0 && chunksAvailable && (
            <Button variant="outline" size="sm" onClick={onRetryAll} disabled={retrying.length > 0}>
              <RotateCw className="w-4 h-4 mr-1" />
              Retry all unknown
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onReset}>
            New analysis
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {visibleSegments.map((seg) => (
          <React.Fragment key={seg.id}>
          <Card
            className={`border-l-4 ${
              seg.status === "identified"
                ? "border-l-green-500"
                : seg.status === "retrying"
                ? "border-l-yellow-500"
                : "border-l-muted-foreground/30"
            }`}
          >
            <CardContent className="flex items-center gap-4 py-3">
              <span className="font-mono text-sm text-muted-foreground whitespace-nowrap min-w-[120px]">
                {formatTime(seg.startSec)} — {formatTime(seg.endSec)}
              </span>

              {seg.status === "identified" && (
                <>
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                  {editingId === seg.id ? (
                    <div className="flex items-center gap-2 flex-1">
                      <input
                        className="flex-1 bg-transparent border-b border-foreground/30 outline-none text-sm font-medium px-1 py-0.5"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            onEditSegment(seg.id, editValue);
                            setEditingId(null);
                          } else if (e.key === "Escape") {
                            setEditingId(null);
                          }
                        }}
                        autoFocus
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          onEditSegment(seg.id, editValue);
                          setEditingId(null);
                        }}
                      >
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium">{seg.trackName}</span>
                      {seg.externalLinks && (
                        <StreamingLinks
                          links={seg.externalLinks}
                          segmentId={seg.id}
                          expandedService={expandedEmbed?.segId === seg.id ? expandedEmbed.service : null}
                          onToggleEmbed={(id, svc) => setExpandedEmbed(
                            expandedEmbed?.segId === id && expandedEmbed.service === svc ? null : { segId: id, service: svc }
                          )}
                        />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-auto"
                        onClick={() => {
                          setEditingId(seg.id);
                          setEditValue(seg.trackName ?? "");
                        }}
                      >
                        <Pencil className="w-3 h-3" />
                      </Button>
                    </>
                  )}
                </>
              )}

              {seg.status === "unknown" && (
                <>
                  <HelpCircle className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground italic">Unknown track</span>
                  <div className="ml-auto">
                    {chunksAvailable ? (
                      <Button variant="ghost" size="sm" onClick={() => onRetrySegment(seg.id)}>
                        <RotateCw className="w-3 h-3 mr-1" />
                        Retry
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">Chunks expired</span>
                    )}
                  </div>
                </>
              )}

              {seg.status === "retrying" && (
                <>
                  <Loader2 className="w-4 h-4 text-yellow-500 animate-spin shrink-0" />
                  <span className="text-muted-foreground italic">Retrying...</span>
                </>
              )}

              {seg.attempts > 1 && (
                <span className="text-xs text-muted-foreground ml-auto">
                  attempt {seg.attempts}
                </span>
              )}
            </CardContent>
            {expandedEmbed?.segId === seg.id && seg.externalLinks && (
              <div className="px-4 pb-4">
                {expandedEmbed.service === "spotify" && seg.externalLinks.spotify && (
                  <iframe
                    src={getSpotifyEmbedUrl(seg.externalLinks.spotify) || ""}
                    width="100%"
                    height="152"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    className="rounded-lg"
                    style={{ border: "none" }}
                  />
                )}
                {expandedEmbed.service === "deezer" && seg.externalLinks.deezer && (
                  <iframe
                    src={getDeezerEmbedUrl(seg.externalLinks.deezer) || ""}
                    width="100%"
                    height="130"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    className="rounded-lg"
                    style={{ border: "none" }}
                  />
                )}
              </div>
            )}
          </Card>
        </React.Fragment>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-4 border-t">
        <span className="text-sm text-muted-foreground">Export:</span>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/analysis/${analysisId}/export/text`} download>Text</a>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/analysis/${analysisId}/export/mixcloud`} download>Mixcloud</a>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/analysis/${analysisId}/export/soundcloud`} download>SoundCloud</a>
        </Button>
        <Button variant="outline" size="sm" onClick={() => copyTracklist("text")}>
          <Copy className="w-4 h-4 mr-1" />
          {copied === "text" ? "Copied!" : "Copy Text"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => copyTracklist("youtube")}>
          <Copy className="w-4 h-4 mr-1" />
          {copied === "youtube" ? "Copied!" : "YT Chapters"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={sharing || !!shareUrl}
          onClick={async () => {
            setSharing(true);
            try {
              const slug = await onShare();
              if (slug) {
                setShareUrl(`${window.location.origin}/t/${slug}`);
              }
            } finally {
              setSharing(false);
            }
          }}
        >
          <Share2 className="w-4 h-4 mr-1" />
          {sharing ? "Sharing..." : "Share"}
        </Button>
      </div>

      {shareUrl && (
        <p className="text-sm text-muted-foreground pt-2">
          Shareable link:{" "}
          <a href={shareUrl} className="underline text-foreground" target="_blank" rel="noopener noreferrer">
            {shareUrl}
          </a>
        </p>
      )}
    </div>
  );
}
