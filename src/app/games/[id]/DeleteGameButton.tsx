'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SkullGlyph } from '../glyphs';

// Creator-only: raze the dungeon (game + rooms + its song) after a grim
// confirm. Lives at the foot of the map page.
export function DeleteGameButton({ gameId }: { gameId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const raze = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/games/${gameId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `status ${res.status}`);
      }
      router.push('/');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The dungeon resisted — try again.');
      setBusy(false);
      setConfirming(false);
    }
  }, [busy, gameId, router]);

  return (
    <>
      <button
        className="gbtn ghost"
        style={{ marginTop: 26, color: 'var(--blood-lit)', borderColor: 'rgba(212,33,33,.4)' }}
        onClick={() => setConfirming(true)}
      >
        ✕ Raze this dungeon
      </button>
      {error && (
        <p className="deal-intro" style={{ color: 'var(--blood-lit)', marginTop: 8 }}>
          {error}
        </p>
      )}
      {confirming && (
        <div className="grim-modal-veil" onClick={() => !busy && setConfirming(false)}>
          <div className="grim-modal" onClick={(e) => e.stopPropagation()}>
            <SkullGlyph size={34} stroke="#151210" eyes="#151210" />
            <h3>Raze the dungeon?</h3>
            <p>
              The dungeon, its rooms and its song burn together. Every carved layer is lost.
              There is no way back from ash.
            </p>
            <button className="gbtn rite" onClick={raze} disabled={busy}>
              {busy ? 'Burning…' : 'Burn it all'}
            </button>
            <button className="gbtn ghost dark" onClick={() => setConfirming(false)} disabled={busy}>
              No — spare it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
