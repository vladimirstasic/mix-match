import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { Segment, ExternalLinks } from '@mix-match/shared';
import { formatTime } from '@mix-match/shared';
import { Card, CardContent } from '@/components/ui/card';
import { ExportModal } from './ExportModal';
import { Button } from '@/components/ui/button';
import {
  RotateCw,
  Check,
  HelpCircle,
  Loader2,
  Pencil,
  Share2,
  EyeOff,
  Eye,
  Search,
  Bookmark,
  ThumbsUp,
  ThumbsDown,
  Link2,
} from 'lucide-react';
import { Waveform } from './Waveform';
import { Recommendations } from './Recommendations';
import { SpotifyPlaylistModal } from './SpotifyPlaylistModal';
import { toggleBookmark, voteSegment } from '../../api/client';

interface Props {
  segments: Segment[];
  chunksAvailable: boolean;
  analysisId: string;
  filename?: string | null;
  sourceUrl?: string | null;
  waveformData?: number[] | null;
  slug?: string | null;
  isPublic?: boolean;
  onRetrySegment: (segmentId: string) => void;
  onRetryAll: () => void;
  onReset: () => void;
  onEditSegment: (segmentId: string, trackName: string) => void;
  onShare: () => Promise<string | null>;
}

const LINK_LABELS: { key: keyof ExternalLinks; label: string }[] = [
  { key: 'spotify', label: 'SPF' },
  { key: 'appleMusic', label: 'AP' },
  { key: 'beatport', label: 'BP' },
  { key: 'youtube', label: 'YT' },
  { key: 'deezer', label: 'DZ' },
];

function StreamingLinks({
  links,
  segmentId,
  expandedService,
  onToggleEmbed,
}: {
  links: ExternalLinks;
  segmentId: string;
  expandedService: string | null;
  onToggleEmbed: (id: string, service: string) => void;
}) {
  const available = LINK_LABELS.filter(({ key }) => links[key]);
  if (available.length === 0) return null;

  const embeddable = new Set(['spotify', 'deezer', 'youtube']);
  const baseChip =
    'inline-flex items-center px-2 py-0.5 text-[10px] font-mono uppercase tracking-[0.08em] border border-border text-primary hover:border-primary transition-colors cursor-pointer';

  return (
    <span className="inline-flex items-center gap-1">
      {available.map(({ key, label }) => {
        if (embeddable.has(key) && links[key]) {
          const isExpanded = expandedService === key;
          return (
            <button
              key={key}
              onClick={e => {
                e.stopPropagation();
                onToggleEmbed(segmentId, key);
              }}
              className={`${baseChip} ${isExpanded ? 'bg-primary text-primary-foreground border-primary' : ''}`}
            >
              {label}
            </button>
          );
        }
        return (
          <a key={key} href={links[key]} target="_blank" rel="noopener noreferrer" className={baseChip}>
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

function getYoutubeEmbedUrl(youtubeUrl: string): string | null {
  const match = youtubeUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (!match) return null;
  return `https://www.youtube.com/embed/${match[1]}`;
}

function getDeezerEmbedUrl(deezerUrl: string): string | null {
  const match = deezerUrl.match(/track\/(\d+)/);
  if (!match) return null;
  return `https://widget.deezer.com/widget/dark/track/${match[1]}`;
}

function getSourceEmbedUrl(url: string): { src: string; height: number } | null {
  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytMatch) return { src: `https://www.youtube.com/embed/${ytMatch[1]}`, height: 200 };

  // SoundCloud — use widget with encoded URL
  if (url.includes('soundcloud.com/')) {
    return {
      src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%237c3aed&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=false`,
      height: 166,
    };
  }

  // Mixcloud
  if (url.includes('mixcloud.com/')) {
    return {
      src: `https://player-widget.mixcloud.com/widget/iframe/?feed=${encodeURIComponent(url)}&hide_cover=1&light=0`,
      height: 120,
    };
  }

  return null;
}

function SourceEmbed({ url }: { url: string }) {
  const embed = getSourceEmbedUrl(url);
  if (!embed) return null;

  return (
    <iframe
      src={embed.src}
      width="100%"
      height={embed.height}
      allow="autoplay; clipboard-write; encrypted-media"
      loading="lazy"
      className="border border-border/50"
      style={{ border: 'none' }}
    />
  );
}

export function Timeline({
  segments,
  chunksAvailable,
  analysisId,
  filename,
  sourceUrl,
  waveformData,
  slug,
  isPublic,
  onRetrySegment,
  onRetryAll,
  onReset,
  onEditSegment,
  onShare,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [hideUnknown, setHideUnknown] = useState(true);
  const [expandedEmbed, setExpandedEmbed] = useState<{ segId: string; service: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [exportModal, setExportModal] = useState<{ title: string; content: string } | null>(null);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(() => {
    return new Set(segments.filter(s => s.isBookmarked).map(s => s.id));
  });
  const [summary, setSummary] = useState<{ summary: string; stats: any; artists: string[] } | null>(null);
  const [showSpotifyModal, setShowSpotifyModal] = useState(false);

  useEffect(() => {
    fetch(`/api/analysis/${analysisId}/summary`)
      .then(r => (r.ok ? r.json() : null))
      .then(setSummary)
      .catch(() => {});
  }, [analysisId]);

  // Hydrate the share link only for an already-public analysis (slug alone can linger on legacy private rows).
  useEffect(() => {
    setShareUrl(slug && isPublic ? `${window.location.origin}/t/${slug}` : null);
  }, [slug, isPublic]);

  const segmentRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const scrollToSegment = useCallback((segmentId: string) => {
    const el = segmentRefs.current.get(segmentId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-primary');
      setTimeout(() => el.classList.remove('ring-2', 'ring-primary'), 2000);
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

  const openExport = (format: 'text' | 'mixcloud' | 'soundcloud' | 'youtube' | 'markdown') => {
    const identified = segments.filter(s => s.status === 'identified');
    let title: string;
    let content: string;
    switch (format) {
      case 'text':
        title = 'Text Tracklist';
        content = identified
          .map((s, i) => `${i + 1}. ${formatTime(s.startSec)} - ${formatTime(s.endSec)}  ${s.trackName}`)
          .join('\n');
        break;
      case 'mixcloud':
        title = 'Mixcloud Format';
        content = identified.map(s => `${s.artist} - ${s.title} @ ${formatTime(s.startSec)}`).join('\n');
        break;
      case 'soundcloud':
        title = 'SoundCloud Format';
        content = ['Tracklist:', ...identified.map(s => `${formatTime(s.startSec)} ${s.trackName}`)].join('\n');
        break;
      case 'youtube':
        title = 'YouTube Chapters';
        content = identified.map(s => `${formatTime(s.startSec)} ${s.trackName}`).join('\n');
        break;
      case 'markdown':
        title = 'Markdown';
        content = [
          `## Tracklist`,
          '',
          ...identified.map((s, i) => `${i + 1}. **${formatTime(s.startSec)}** — ${s.trackName}`),
          '',
          `_Identified by MixMatch_`,
        ].join('\n');
        break;
    }
    setExportModal({ title, content });
  };

  const exportAsImage = () => {
    const identified = segments.filter(s => s.status === 'identified');
    const canvas = document.createElement('canvas');
    const width = 800;
    const lineHeight = 30;
    const padding = 40;
    const headerHeight = 60;
    const height = headerHeight + padding * 2 + identified.length * lineHeight;

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 20px system-ui';
    ctx.fillText('MixMatch Tracklist', padding, padding + 20);

    ctx.font = '14px system-ui';
    identified.forEach((seg, i) => {
      const y = headerHeight + padding + i * lineHeight;
      ctx.fillStyle = '#71717a';
      ctx.fillText(`${formatTime(seg.startSec)}`, padding, y + 16);
      ctx.fillStyle = '#e4e4e7';
      ctx.fillText(`${seg.trackName}`, padding + 70, y + 16);
    });

    ctx.fillStyle = '#52525b';
    ctx.font = '12px system-ui';
    ctx.fillText('Generated by MixMatch', padding, height - 15);

    const link = document.createElement('a');
    link.download = 'tracklist.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const totalDuration = segments.length > 0 ? Math.max(...segments.map(s => s.endSec)) : 0;

  const identified = segments.filter(s => s.status === 'identified');
  const unknown = segments.filter(s => s.status === 'unknown');
  const retrying = segments.filter(s => s.status === 'retrying');
  const visibleSegments = segments.filter(s => {
    if (hideUnknown && s.status === 'unknown') return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const name = (s.trackName || '').toLowerCase();
      const artist = (s.artist || '').toLowerCase();
      const title = (s.title || '').toLowerCase();
      return name.includes(q) || artist.includes(q) || title.includes(q);
    }
    return true;
  });

  const trackCounts = new Map<string, number>();
  segments
    .filter(s => s.status === 'identified' && s.acrid)
    .forEach(s => {
      trackCounts.set(s.acrid!, (trackCounts.get(s.acrid!) || 0) + 1);
    });
  const isDuplicate = (acrid: string | null) => (acrid ? (trackCounts.get(acrid) || 0) > 1 : false);

  return (
    <div className="results-scrim space-y-6">
      <button type="button" className="ctrl" onClick={onReset}>
        ← BACK TO HISTORY
      </button>
      {filename && (
        <div className="space-y-3">
          {sourceUrl ? (
            <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="r-title-link block">
              <div className="label-comment">SCAN COMPLETE</div>
              <h1 className="r-title break-words">{filename}</h1>
            </a>
          ) : (
            <>
              <div className="label-comment">SCAN COMPLETE</div>
              <h1 className="r-title break-words">{filename}</h1>
            </>
          )}
          {sourceUrl && (
            <div className="overflow-x-clip">
              <SourceEmbed url={sourceUrl} />
            </div>
          )}
        </div>
      )}

      <div className="results-head">
        <div>
          <p className="r-meta">
            {identified.length} / {segments.length} identified
            {totalDuration > 0 && ` · ${Math.round((identified.length / segments.length) * 100)}% coverage`}
            {unknown.length > 0 && ` · ${unknown.length} unknown`}
          </p>
        </div>
        <div className="r-actions">
          {unknown.length > 0 && (
            <button type="button" className="ctrl" onClick={() => setHideUnknown(!hideUnknown)}>
              {hideUnknown ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
              {hideUnknown ? 'SHOW UNKNOWN' : 'HIDE UNKNOWN'}
            </button>
          )}
          {unknown.length > 0 && chunksAvailable && (
            <button type="button" className="ctrl" onClick={onRetryAll} disabled={retrying.length > 0}>
              <RotateCw className="w-3 h-3" />
              RETRY ALL
            </button>
          )}
          <button type="button" className="btn-demo" onClick={onReset}>
            NEW SCAN
          </button>
        </div>
      </div>

      <div className="min-h-[140px]">
        {summary && (
          <Card>
            <CardContent className="py-4">
              <p className="text-sm text-muted-foreground">{summary.summary}</p>
              <div className="flex flex-wrap gap-6 mt-4">
                {[
                  { value: summary.stats.totalTracks, label: 'Tracks' },
                  { value: summary.stats.totalArtists, label: 'Artists' },
                  { value: `${summary.stats.coveragePercent}%`, label: 'Coverage' },
                  { value: `${summary.stats.durationMin}m`, label: 'Duration' },
                ].map(stat => (
                  <div key={stat.label} className="text-center">
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {totalDuration > 0 && (
        <Waveform
          segments={segments}
          totalDuration={totalDuration}
          waveformData={waveformData}
          onSegmentClick={scrollToSegment}
        />
      )}

      {segments.some(s => s.status === 'identified') && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tracks..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-border bg-glass-bg backdrop-blur-sm text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition-all"
          />
        </div>
      )}

      <div className="log">
        <div className="log-top">
          <span>RECOGNITION_LOG</span>
          <span>
            {identified.length} / {segments.length}
            {segments.length > 0 && ` · ${Math.round((identified.length / segments.length) * 100)}%`}
          </span>
        </div>
        <div className="log-body space-y-2 p-2">
          {visibleSegments.map(seg => (
            <React.Fragment key={seg.id}>
              <div
                ref={(el: HTMLDivElement | null) => {
                  if (el) segmentRefs.current.set(seg.id, el);
                  else segmentRefs.current.delete(seg.id);
                }}
                className={`log-row ${
                  seg.status === 'identified' ? 'identified' : seg.status === 'retrying' ? 'retrying' : 'unknown'
                } ${bookmarkedIds.has(seg.id) ? 'bookmarked' : ''}`}
                style={{ display: 'block' }}
              >
                <div className="py-1 space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <span className="font-mono text-[11px] text-muted-foreground whitespace-nowrap sm:min-w-[110px]">
                      {formatTime(seg.startSec)} — {formatTime(seg.endSec)}
                    </span>

                    {seg.status === 'identified' && editingId === seg.id && (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          className="flex-1 bg-glass-bg border border-border rounded-lg outline-none text-sm font-medium px-2 py-1 focus:ring-2 focus:ring-primary/50"
                          value={editValue}
                          onChange={e => setEditValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              onEditSegment(seg.id, editValue);
                              setEditingId(null);
                            } else if (e.key === 'Escape') {
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
                        <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                          Cancel
                        </Button>
                      </div>
                    )}

                    {seg.status === 'identified' && editingId !== seg.id && (
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-4 h-4 bg-primary/15 flex items-center justify-center shrink-0">
                          <Check className="w-2.5 h-2.5 text-primary" />
                        </div>
                        <span className="font-medium text-sm flex-1 min-w-0 truncate">{seg.trackName}</span>
                        {isDuplicate(seg.acrid) && (
                          <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-accent border border-accent/40 bg-accent/10 px-1.5 py-0.5 shrink-0">
                            x{trackCounts.get(seg.acrid!)}
                          </span>
                        )}
                        {seg.bpm && (
                          <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-muted-foreground border border-border px-1.5 py-0.5 shrink-0 hidden sm:inline">
                            {seg.bpm} BPM
                          </span>
                        )}
                        {seg.genre && (
                          <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-muted-foreground border border-border px-1.5 py-0.5 shrink-0 hidden sm:inline">
                            {seg.genre}
                          </span>
                        )}
                        {seg.musicalKey && (
                          <span className="text-[10px] font-mono uppercase tracking-[0.08em] text-muted-foreground border border-border px-1.5 py-0.5 shrink-0 hidden sm:inline">
                            {seg.musicalKey}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {seg.status === 'identified' && editingId !== seg.id && (
                    <div className="flex items-center gap-1.5 sm:ml-[110px] flex-wrap">
                      {seg.externalLinks && (
                        <StreamingLinks
                          links={seg.externalLinks}
                          segmentId={seg.id}
                          expandedService={expandedEmbed?.segId === seg.id ? expandedEmbed.service : null}
                          onToggleEmbed={(id, svc) =>
                            setExpandedEmbed(
                              expandedEmbed?.segId === id && expandedEmbed.service === svc
                                ? null
                                : { segId: id, service: svc },
                            )
                          }
                        />
                      )}
                      <div className="flex items-center gap-0.5 ml-auto opacity-60 hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => {
                            setEditingId(seg.id);
                            setEditValue(seg.trackName ?? '');
                          }}
                        >
                          <Pencil className="w-3 h-3" />
                        </Button>
                        {shareUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={e => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(
                                `${seg.trackName} @ ${formatTime(seg.startSec)} — ${shareUrl}#t=${seg.startSec}`,
                              );
                              setCopied(`share-${seg.id}`);
                              setTimeout(() => setCopied(null), 2000);
                            }}
                          >
                            {copied === `share-${seg.id}` ? (
                              <Check className="w-3 h-3 text-primary" />
                            ) : (
                              <Link2 className="w-3 h-3" />
                            )}
                          </Button>
                        )}
                        <button
                          className={`p-1 transition-colors ${bookmarkedIds.has(seg.id) ? 'text-accent' : 'text-muted-foreground/40 hover:text-accent'}`}
                          onClick={e => handleToggleBookmark(e, seg.id)}
                        >
                          <Bookmark className={`w-3 h-3 ${bookmarkedIds.has(seg.id) ? 'fill-current' : ''}`} />
                        </button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-primary"
                          onClick={e => {
                            e.stopPropagation();
                            voteSegment(seg.id, 1);
                          }}
                        >
                          <ThumbsUp className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-destructive"
                          onClick={e => {
                            e.stopPropagation();
                            voteSegment(seg.id, -1);
                          }}
                        >
                          <ThumbsDown className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  )}

                  {seg.status === 'unknown' && (
                    <div className="flex items-center gap-3">
                      <HelpCircle className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                      <span className="text-muted-foreground/70 italic text-sm">Unknown section</span>
                      <div className="ml-auto">
                        {chunksAvailable ? (
                          <Button variant="ghost" size="sm" onClick={() => onRetrySegment(seg.id)}>
                            <RotateCw className="w-3 h-3 mr-1" />
                            Retry
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">Chunks expired</span>
                        )}
                      </div>
                    </div>
                  )}

                  {seg.status === 'retrying' && (
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                      <span className="text-muted-foreground italic text-sm">Retrying...</span>
                    </div>
                  )}

                  {seg.attempts > 1 && (
                    <span className="text-[10px] text-muted-foreground/50 ml-auto">attempt {seg.attempts}</span>
                  )}
                </div>
                {expandedEmbed?.segId === seg.id && seg.externalLinks && (
                  <div className="px-4 pb-4">
                    {expandedEmbed.service === 'spotify' && seg.externalLinks.spotify && (
                      <iframe
                        src={getSpotifyEmbedUrl(seg.externalLinks.spotify) || ''}
                        width="100%"
                        height="152"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                        className="border border-border/50"
                        style={{ border: 'none' }}
                      />
                    )}
                    {expandedEmbed.service === 'youtube' && seg.externalLinks.youtube && (
                      <iframe
                        src={getYoutubeEmbedUrl(seg.externalLinks.youtube) || ''}
                        width="100%"
                        height="200"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                        className="border border-border/50"
                        style={{ border: 'none' }}
                      />
                    )}
                    {expandedEmbed.service === 'deezer' && seg.externalLinks.deezer && (
                      <iframe
                        src={getDeezerEmbedUrl(seg.externalLinks.deezer) || ''}
                        width="100%"
                        height="130"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                        className="border border-border/50"
                        style={{ border: 'none' }}
                      />
                    )}
                  </div>
                )}
              </div>
            </React.Fragment>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-5 border-t border-border/50">
        <span className="label-mono">EXPORT</span>
        {(['text', 'mixcloud', 'soundcloud', 'youtube', 'markdown'] as const).map(fmt => (
          <button key={fmt} type="button" className="ctrl" onClick={() => openExport(fmt)}>
            {fmt === 'text'
              ? 'TEXT'
              : fmt === 'mixcloud'
                ? 'MIXCLOUD'
                : fmt === 'soundcloud'
                  ? 'SOUNDCLOUD'
                  : fmt === 'youtube'
                    ? 'YOUTUBE'
                    : 'MARKDOWN'}
          </button>
        ))}
        <button type="button" className="ctrl" onClick={exportAsImage}>
          IMAGE
        </button>
        {segments.some(
          s => s.status === 'identified' && s.externalLinks && (s.externalLinks as Record<string, string>).spotify,
        ) && (
          <button
            type="button"
            className="ctrl"
            style={{ color: 'var(--spotify)', borderColor: 'var(--spotify)' }}
            onClick={() => {
              const links = segments
                .filter(
                  s =>
                    s.status === 'identified' && s.externalLinks && (s.externalLinks as Record<string, string>).spotify,
                )
                .map(s => (s.externalLinks as Record<string, string>).spotify);
              const unique = [...new Set(links)];
              navigator.clipboard.writeText(unique.join('\n'));
              setCopied('spotify');
              setTimeout(() => setCopied(null), 2000);
            }}
          >
            {copied === 'spotify' ? 'COPIED!' : 'SPOTIFY LINKS'}
          </button>
        )}
        {segments.some(
          s => s.status === 'identified' && s.externalLinks && (s.externalLinks as Record<string, string>).spotify,
        ) && (
          <Button variant="spotify" size="sm" onClick={() => setShowSpotifyModal(true)}>
            SPOTIFY PLAYLIST
          </Button>
        )}
        <button
          type="button"
          className="ctrl"
          disabled={sharing || !!shareUrl}
          onClick={async () => {
            setSharing(true);
            try {
              const slug = await onShare();
              if (slug) setShareUrl(`${window.location.origin}/t/${slug}`);
            } finally {
              setSharing(false);
            }
          }}
        >
          <Share2 className="w-3 h-3" />
          {sharing ? 'SHARING…' : 'SHARE'}
        </button>
      </div>

      {shareUrl && (
        <p className="text-sm text-muted-foreground">
          <a href={shareUrl} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
            {shareUrl}
          </a>
        </p>
      )}

      <Recommendations analysisId={analysisId} />

      {exportModal && (
        <ExportModal title={exportModal.title} content={exportModal.content} onClose={() => setExportModal(null)} />
      )}

      <SpotifyPlaylistModal
        open={showSpotifyModal}
        onClose={() => setShowSpotifyModal(false)}
        segments={segments}
        analysisId={analysisId}
        filename={filename}
      />
    </div>
  );
}
