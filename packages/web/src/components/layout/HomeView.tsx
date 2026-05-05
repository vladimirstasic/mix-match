import type { AnalysisMode } from '@mix-match/shared';
import { Dashboard, Analytics } from '../dashboard';
import { FileUpload } from '../upload';
import { ProfileSettings } from '../profile';
import { Button } from '@/components/ui/button';

interface HomeViewProps {
  credits: number | null;
  onCompare: () => void;
  onManual: () => void;
  onFeed: () => void;
  onSelectAnalysis: (id: string) => void;
  onFileSelected: (file: File, mode: AnalysisMode) => void;
  onUrlSubmitted: (url: string, mode: AnalysisMode) => void;
}

export const HomeView = ({
  credits,
  onCompare,
  onManual,
  onFeed,
  onSelectAnalysis,
  onFileSelected,
  onUrlSubmitted,
}: HomeViewProps) => {
  return (
    <div className="space-y-6">
      <Dashboard onSelectAnalysis={onSelectAnalysis} />
      <div className="flex justify-center gap-2">
        <Button variant="outline" size="sm" onClick={onCompare}>
          Compare
        </Button>
        <Button variant="outline" size="sm" onClick={onManual}>
          Manual
        </Button>
        <Button variant="outline" size="sm" onClick={onFeed}>
          Feed
        </Button>
      </div>
      {credits === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-border/50 bg-muted/30">
          <p className="font-medium">No credits remaining</p>
          <p className="text-sm text-muted-foreground mt-1">Credits reset monthly. Upgrade for more.</p>
        </div>
      ) : (
        <FileUpload onFileSelected={onFileSelected} onUrlSubmitted={onUrlSubmitted} />
      )}
      <div className="pt-4">
        <ProfileSettings />
      </div>
      <Analytics />
    </div>
  );
};
