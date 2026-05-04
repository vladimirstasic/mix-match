import { Button } from '@/components/ui/button';

interface BackWrapperProps {
  children: React.ReactNode;
  onBack: () => void;
}

export const BackWrapper = ({ children, onBack }: BackWrapperProps) => {
  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4" onClick={onBack}>
        &larr; Back
      </Button>
      {children}
    </div>
  );
};
