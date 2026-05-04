import { useEffect } from "react";

interface Shortcuts {
  onNewAnalysis?: () => void;
  onToggleUnknown?: () => void;
}

export function useKeyboardShortcuts(shortcuts: Shortcuts) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "n" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        shortcuts.onNewAnalysis?.();
      }
      if (e.key === "u" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        shortcuts.onToggleUnknown?.();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcuts]);
}
