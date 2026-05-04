import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export function ProfileSettings() {
  const [username, setUsername] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/user/profile`, { credentials: 'include' })
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.username) {
          setCurrentUsername(data.username);
          setUsername(data.username);
        }
      })
      .catch(() => {});
  }, []);

  const save = async () => {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/user/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save');
        return;
      }
      const data = await res.json();
      setCurrentUsername(data.username);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError('Failed to save');
    }
  };

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <h3 className="font-semibold">DJ Profile</h3>
        <div className="space-y-2">
          <label className="text-sm text-muted-foreground">Username</label>
          <div className="flex gap-2">
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="your-dj-name"
              className="flex-1 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button onClick={save} disabled={!username.trim() || username === currentUsername}>
              {saved ? 'Saved!' : 'Save'}
            </Button>
          </div>
          {currentUsername && (
            <p className="text-xs text-muted-foreground">
              Your profile:{' '}
              <a href={`/dj/${currentUsername}`} className="underline">
                /dj/{currentUsername}
              </a>
            </p>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
