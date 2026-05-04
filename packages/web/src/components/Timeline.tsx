import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Segment, ExternalLinks } from "@mix-match/shared";
import { Card, CardContent } from "@/components/ui/card";
import { ExportModal } from "./ExportModal";
import { Button } from "@/components/ui/button";
import { RotateCw, Check, HelpCircle, Loader2, Pencil, Share2, EyeOff, Eye, Search, Bookmark, ThumbsUp, ThumbsDown, Link2 } from "lucide-react";
import { Waveform } from "./Waveform";
import { Recommendations } from "./Recommendations";
import { toggleBookmark, voteSegment } from "../api/client";

interface Props {
  segments: Segment[];
  chunksAvailable: boolean;
  analysisId: string;
  waveformData?: number[] | null;
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

export function Timeline({ segments, chunksAvailable, analysisId, waveformData, onRetrySegment, onRetryAll, onReset, onEditSegment, onShare }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [hideUnknown, setHideUnknown] = useState(false);
  const [expandedEmbed, setExpandedEmbed] = useState<{ segId: string; service: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [exportModal, setExportModal] = useState<{ title: string; content: string } | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() => {
    return new Set(segments.filter(s => s.isBookmarked).map(s => s.id));
  });
  const [summary, setSummary] = useState<{ summary: string; stats: any; artists: string[] } | null>(null);

  useEffect(() => {
    fetch(`/api/analysis/${analysisId}/summary`)
      .then(r => r.ok ? r.json() : null)
      .then(setSummary)
      .catch(() => {});
  }, [analysisId]);

  const segmentRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const scrollToSegment = useCallback((segmentId: string) => {
    const el = segmentRefs.current.get(segmentId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("ring-2", "ring-primary");
      setTimeout(() => el.classList.remove("ring-2", "ring-primary"), 2000);
    }
  }, []);

  const handleToggleBookmark = async (e: React.MouseEvent, segmentId: string) => {
    e.stopPropagation();
    const { isBookmarked } = await toggleBookmark(segmentId);
    setBookmarkedIds(prev => {
      const next = new Set(prev);
      if (isBookmarked) next.add(segmentId);
      else next.delete(segmentId);
      return next;
    });
  };

  const openExport = (format: "text" | "mixcloud" | "soundcloud" | "youtube" | "markdown") => {
    const identified = segments.filter(s => s.status === "identified");
    let title: string;
    let content: string;
    switch (format) {
      case "text":
        title = "Text Tracklist";
        content = identified.map((s, i) => `${i + 1}. ${formatTime(s.startSec)} - ${formatTime(s.endSec)}  ${s.trackName}`).join("\n");
        break;
      case "mixcloud":
        title = "Mixcloud Format";
        content = identified.map(s => `${s.artist} - ${s.title} @ ${formatTime(s.startSec)}`).join("\n");
        break;
      case "soundcloud":
        title = "SoundCloud Format";
        content = ["Tracklist:", ...identified.map(s => `${formatTime(s.startSec)} ${s.trackName}`)].join("\n");
        break;
      case "youtube":
        title = "YouTube Chapters";
        content = identified.map(s => `${formatTime(s.startSec)} ${s.trackName}`).join("\n");
        break;
      case "markdown":
        title = "Markdown";
        content = [`## Tracklist`, "", ...identified.map((s, i) => `${i + 1}. **${formatTime(s.startSec)}** — ${s.trackName}`), "", `_Identified by MixMatch_`].join("\n");
        break;
    }
    setExportModal({ title, content });
  };

  const exportAsImage = () => {
    const identified = segments.filter(s => s.status === "identified");
    const canvas = document.createElement("canvas");
    const width = 800;
    const lineHeight = 30;
    const padding = 40;
    const headerHeight = 60;
    const height = headerHeight + padding * 2 + identified.length * lineHeight;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Background
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 20px system-ui";
    ctx.fillText("MixMatch Tracklist", padding, padding + 20);

    // Tracks
    ctx.font = "14px system-ui";
    identified.forEach((seg, i) => {
      const y = headerHeight + padding + i * lineHeight;
      ctx.fillStyle = "#71717a";
      ctx.fillText(`${formatTime(seg.startSec)}`, padding, y + 16);
      ctx.fillStyle = "#e4e4e7";
      ctx.fillText(`${seg.trackName}`, padding + 70, y + 16);
    });

    // Footer
    ctx.fillStyle = "#52525b";
    ctx.font = "12px system-ui";
    ctx.fillText("Generated by MixMatch", padding, height - 15);

    // Download
    const link = document.createElement("a");
    link.download = "tracklist.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  const totalDuration = segments.length > 0 ? Math.max(...segments.map(s => s.endSec)) : 0;

  const identified = segments.filter((s) => s.status === "identified");
  const unknown = segments.filter((s) => s.status === "unknown");
  const retrying = segments.filter((s) => s.status === "retrying");
  const visibleSegments = segments.filter((s) => {
    if (hideUnknown && s.status === "unknown") return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = (s.trackName || "").toLowerCase();
      const artist = (s.artist || "").toLowerCase();
      const title = (s.title || "").toLowerCase();
      return name.includes(q) || artist.includes(q) || title.includes(q);
    }
    return true;
  });

  // Detect duplicate tracks
  const trackCounts = new Map<string, number>();
  segments.filter(s => s.status === "identified" && s.acrid).forEach(s => {
    trackCounts.set(s.acrid!, (trackCounts.get(s.acrid!) || 0) + 1);
  });
  const isDuplicate = (acrid: string | null) => acrid ? (trackCounts.get(acrid) || 0) > 1 : false;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
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

      {summary && (
        <Card className="bg-muted/30">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">{summary.summary}</p>
            <div className="flex flex-wrap gap-4 mt-3 text-center">
              <div>
                <p className="text-2xl font-bold">{summary.stats.totalTracks}</p>
                <p className="text-xs text-muted-foreground">Tracks</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.stats.totalArtists}</p>
                <p className="text-xs text-muted-foreground">Artists</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.stats.coveragePercent}%</p>
                <p className="text-xs text-muted-foreground">Identified</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{summary.stats.durationMin}m</p>
                <p className="text-xs text-muted-foreground">Duration</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {totalDuration > 0 && (
        <Waveform segments={segments} totalDuration={totalDuration} waveformData={waveformData} onSegmentClick={scrollToSegment} />
      )}

      {segments.some(s => s.status === "identified") && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tracks..."
            className="w-full pl-9 pr-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      )}

      <div className="space-y-2">
        {visibleSegments.map((seg) => (
          <React.Fragment key={seg.id}>
          <Card
            ref={(el: HTMLDivElement | null) => {
              if (el) segmentRefs.current.set(seg.id, el);
              else segmentRefs.current.delete(seg.id);
            }}
            className={`border-l-4 transition-shadow ${
              seg.status === "identified"
                ? bookmarkedIds.has(seg.id) ? "border-l-green-500 ring-1 ring-green-500/20 bg-green-500/5" : "border-l-green-500"
                : seg.status === "retrying"
                ? "border-l-yellow-500"
                : "border-l-muted-foreground/30"
            }`}
          >
            <CardContent className="py-3 space-y-2">
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs sm:text-sm text-muted-foreground whitespace-nowrap min-w-[100px] sm:min-w-[120px]">
                  {formatTime(seg.startSec)} — {formatTime(seg.endSec)}
                </span>

              {seg.status === "identified" && editingId === seg.id && (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    className="flex-1 bg-transparent border-b border-foreground/30 outline-none text-sm font-medium px-1 py-0.5"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { onEditSegment(seg.id, editValue); setEditingId(null); }
                      else if (e.key === "Escape") { setEditingId(null); }
                    }}
                    autoFocus
                  />
                  <Button variant="ghost" size="sm" onClick={() => { onEditSegment(seg.id, editValue); setEditingId(null); }}>Save</Button>
                  <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
                </div>
              )}

              {seg.status === "identified" && editingId !== seg.id && (
                <>
                  <Check className="w-4 h-4 text-green-500 shrink-0" />
                  <span className="font-medium flex-1 min-w-0">{seg.trackName}</span>
                  {isDuplicate(seg.acrid) && (
                    <span className="text-xs bg-yellow-500/10 text-yellow-500 rounded px-1.5 py-0.5 shrink-0">x{trackCounts.get(seg.acrid!)}</span>
                  )}
                  {seg.bpm && <span className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">{seg.bpm} BPM</span>}
                  {seg.genre && <span className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">{seg.genre}</span>}
                  {seg.musicalKey && <span className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5 shrink-0">{seg.musicalKey}</span>}
                </>
              )}
              </div>

              {seg.status === "identified" && editingId !== seg.id && (
                <div className="flex items-center gap-1 ml-[100px] sm:ml-[120px] flex-wrap">
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
                  <div className="flex items-center gap-0.5 ml-auto">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingId(seg.id); setEditValue(seg.trackName ?? ""); }}><Pencil className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="sm" title="Copy link" onClick={(e) => {
                      e.stopPropagation();
                      const base = shareUrl || `${window.location.origin}/t/share`;
                      navigator.clipboard.writeText(`${seg.trackName} @ ${formatTime(seg.startSec)} — ${base}#t=${seg.startSec}`);
                      setCopied(`share-${seg.id}`); setTimeout(() => setCopied(null), 2000);
                    }}>{copied === `share-${seg.id}` ? <Check className="w-3 h-3" /> : <Link2 className="w-3 h-3" />}</Button>
                    <button className={`p-1 rounded transition-colors ${bookmarkedIds.has(seg.id) ? "text-blue-500" : "text-muted-foreground/40 hover:text-blue-500"}`} onClick={(e) => handleToggleBookmark(e, seg.id)}>
                      <Bookmark className={`w-3 h-3 ${bookmarkedIds.has(seg.id) ? "fill-blue-500" : ""}`} />
                    </button>
                    <Button variant="ghost" size="sm" className="text-green-500" onClick={(e) => { e.stopPropagation(); voteSegment(seg.id, 1); }}><ThumbsUp className="w-3 h-3" /></Button>
                    <Button variant="ghost" size="sm" className="text-red-500" onClick={(e) => { e.stopPropagation(); voteSegment(seg.id, -1); }}><ThumbsDown className="w-3 h-3" /></Button>
                  </div>
                </div>
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
        <Button variant="outline" size="sm" onClick={() => openExport("text")}>Text</Button>
        <Button variant="outline" size="sm" onClick={() => openExport("mixcloud")}>Mixcloud</Button>
        <Button variant="outline" size="sm" onClick={() => openExport("soundcloud")}>SoundCloud</Button>
        <Button variant="outline" size="sm" onClick={() => openExport("youtube")}>YouTube</Button>
        <Button variant="outline" size="sm" onClick={() => openExport("markdown")}>Markdown</Button>
        <Button variant="outline" size="sm" onClick={exportAsImage}>Image</Button>
        {segments.some(s => s.status === "identified" && s.externalLinks && (s.externalLinks as Record<string, string>).spotify) && (
          <Button
            variant="outline"
            size="sm"
            className="text-green-500 border-green-500/30 hover:bg-green-500/10"
            onClick={() => {
              const links = segments
                .filter(s => s.status === "identified" && s.externalLinks && (s.externalLinks as Record<string, string>).spotify)
                .map(s => (s.externalLinks as Record<string, string>).spotify);
              const unique = [...new Set(links)];
              navigator.clipboard.writeText(unique.join("\n"));
              setCopied("spotify");
              setTimeout(() => setCopied(null), 2000);
            }}
          >
            {copied === "spotify" ? "Copied!" : "Copy Spotify Links"}
          </Button>
        )}
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

      <Recommendations analysisId={analysisId} />

      {exportModal && (
        <ExportModal
          title={exportModal.title}
          content={exportModal.content}
          onClose={() => setExportModal(null)}
        />
      )}
    </div>
  );
}
