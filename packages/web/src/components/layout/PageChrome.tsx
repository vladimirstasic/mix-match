import { GridOverlay } from './GridOverlay';
import { Scanlines } from './Scanlines';
import { WaveformBackdrop } from './WaveformBackdrop';

type Variant = 'full' | 'grid' | 'none';

export const PageChrome = ({ variant = 'grid' }: { variant?: Variant }) => {
  if (variant === 'none') return null;
  return (
    <>
      <GridOverlay />
      {variant === 'full' && <Scanlines />}
      {variant === 'full' && <WaveformBackdrop />}
    </>
  );
};
