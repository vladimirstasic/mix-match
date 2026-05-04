import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, ArrowLeft, Music, Check } from 'lucide-react';
import { compareMixes, getUserAnalyses, type CompareResult, type AnalysisSummary } from '../api/client';

interface Props {
  onBack: () => void;
}

export function MixCompare({ onBack }: Props) {
  const [analyses, setAnalyses] = useState<AnalysisSummary[]>([]);
  const [selectedA, setSelectedA] = useState<string | null>(null);
  const [selectedB, setSelectedB] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getUserAnalyses().then(a => setAnalyses(a.filter(x => x.status === 'completed')));
  }, []);

  const runCompare = async () => {
    if (!selectedA || !selectedB) return;
    setLoading(true);
    try {
      const data = await compareMixes(selectedA, selectedB);
      setResult(data);
    } catch {
      // handle error
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setResult(null)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <h2 className="text-xl font-semibold">Mix Comparison</h2>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="font-medium text-sm truncate">{result.mixA.filename}</p>
              <p className="text-2xl font-bold mt-1">{result.mixA.totalTracks}</p>
              <p className="text-xs text-muted-foreground">tracks</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 text-center">
              <p className="font-medium text-sm truncate">{result.mixB.filename}</p>
              <p className="text-2xl font-bold mt-1">{result.mixB.totalTracks}</p>
              <p className="text-xs text-muted-foreground">tracks</p>
            </CardContent>
          </Card>
        </div>

        <Card className="border-primary/30">
          <CardContent className="pt-4">
            <h3 className="font-semibold mb-3">
              {result.sharedTracks.length} shared track{result.sharedTracks.length !== 1 ? 's' : ''}
            </h3>
            {result.sharedTracks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tracks in common</p>
            ) : (
              <div className="space-y-2">
                {result.sharedTracks.map((t, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm">
                    <Check className="w-4 h-4 text-green-500 shrink-0" />
                    <span className="font-medium flex-1">{t.trackName}</span>
                    <span className="text-xs text-muted-foreground">A@{t.inA}</span>
                    <span className="text-xs text-muted-foreground">B@{t.inB}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-2 gap-4 text-center text-sm text-muted-foreground">
          <p>{result.uniqueToA} unique to A</p>
          <p>{result.uniqueToB} unique to B</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <h2 className="text-xl font-semibold">Compare Mixes</h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm font-medium mb-2">Mix A</p>
          <div className="space-y-1">
            {analyses.map(a => (
              <Card
                key={a.id}
                className={`cursor-pointer transition-colors ${selectedA === a.id ? 'border-primary bg-primary/5' : 'hover:border-primary/30'}`}
                onClick={() => setSelectedA(a.id)}
              >
                <CardContent className="py-2">
                  <p className="text-sm truncate">{a.filename}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
        <div>
          <p className="text-sm font-medium mb-2">Mix B</p>
          <div className="space-y-1">
            {analyses.map(a => (
              <Card
                key={a.id}
                className={`cursor-pointer transition-colors ${selectedB === a.id ? 'border-primary bg-primary/5' : 'hover:border-primary/30'}`}
                onClick={() => setSelectedB(a.id)}
              >
                <CardContent className="py-2">
                  <p className="text-sm truncate">{a.filename}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>

      <Button
        onClick={runCompare}
        disabled={!selectedA || !selectedB || selectedA === selectedB || loading}
        className="w-full"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Music className="w-4 h-4 mr-2" />}
        Compare
      </Button>
    </div>
  );
}
