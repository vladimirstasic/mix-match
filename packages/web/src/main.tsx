import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!CLERK_KEY) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY');
}

const clerkAppearance = {
  variables: {
    colorPrimary: '#0f7a3a',
    colorText: '#0e140f',
    colorTextSecondary: 'rgba(14, 20, 15, 0.62)',
    colorBackground: '#f7faf6',
    colorInputBackground: '#ffffff',
    colorInputText: '#0e140f',
    borderRadius: '0',
    fontFamily: '"Space Grotesk", system-ui, sans-serif',
    fontFamilyButtons: '"JetBrains Mono", ui-monospace, monospace',
  },
  elements: {
    formButtonPrimary: 'bg-primary text-primary-foreground font-mono uppercase tracking-[0.08em] hover:brightness-110',
    card: 'border border-border',
    socialButtonsBlockButton: 'border border-border',
  },
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={CLERK_KEY} appearance={clerkAppearance}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ClerkProvider>
  </StrictMode>,
);
