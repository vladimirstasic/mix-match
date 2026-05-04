import type { AnalysisMode } from '@mix-match/shared';
import { Dashboard } from './Dashboard';
import { FileUpload } from './FileUpload';
import { ProfileSettings } from './ProfileSettings';
import { Analytics } from './Analytics';
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
    <>
      <Dashboard onSelectAnalysis={onSelectAnalysis} />
      <div className="flex justify-center gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={onCompare}>
          Compare Mixes
        </Button>
        <Button variant="outline" size="sm" onClick={onManual}>
          Manual Tracklist
        </Button>
        <Button variant="outline" size="sm" onClick={onFeed}>
          Feed
        </Button>
      </div>
      {credits === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="font-medium">No credits remaining</p>
          <p className="text-sm mt-1">Credits reset monthly. Upgrade for more.</p>
        </div>
      ) : (
        <FileUpload onFileSelected={onFileSelected} onUrlSubmitted={onUrlSubmitted} />
      )}
      <div className="mt-8">
        <ProfileSettings />
      </div>
      <div className="mt-4">
        <Analytics />
      </div>
    </>
  );
};
