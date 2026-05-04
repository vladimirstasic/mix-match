import { useState, useCallback } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

let toastId = 0;

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    const id = ++toastId;
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts(t => t.filter(toast => toast.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(t => t.filter(toast => toast.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}

export function ToastContainer({ toasts, onRemove }: { toasts: Toast[]; onRemove: (id: number) => void }) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm animate-in slide-in-from-right ${
            toast.type === 'success'
              ? 'bg-green-500/10 border border-green-500/30 text-green-500'
              : 'bg-destructive/10 border border-destructive/30 text-destructive'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle className="w-4 h-4 shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 shrink-0" />
          )}
          <span>{toast.message}</span>
          <button onClick={() => onRemove(toast.id)} className="ml-2 opacity-60 hover:opacity-100">
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
