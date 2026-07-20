'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SequencerEditor } from '@/components/sequencer/SequencerEditor';
import { RingSequencer } from '@/components/ring/RingSequencer';
import type { SequencerState } from '@/lib/sequencerState';
import { isRingState, type RingSongState } from '@/lib/ringState';
import type { Curse } from '@/lib/curses';
import { CHANNEL_ALLOWED_PRESETS } from '@/lib/gameLogic';
import { CHANNEL_PATTERNS, LockGlyph, LuteGlyph, SkullGlyph, SwordsGlyph, toRoman } from '../../glyphs';

// Same autosave tuning as SongPageClient, targeting the game turn endpoint.
const AUTOSAVE_MS = 800;
const RETRY_MS = 3000;
const KEEPALIVE_MAX_BYTES = 60 * 1024;

type Phase = 'deal' | 'compose' | 'sealed';

// Ring-format games edit through the Ritual Ring; older games keep the
// legacy grid editor. Both feed the same autosave/lock machinery.
type SongBlob = SequencerState | RingSongState;

export function GameRoomClient({
  gameId,
  gameTitle,
  roomIndex,
  roomCount,
  channelId,
  channelName,
  curse,
  initialState,
  nextPlayer,
}: {
  gameId: string;
  gameTitle: string;
  roomIndex: number;
  roomCount: number;
  channelId: number;
  channelName: string;
  curse: Curse;
  initialState: SongBlob;
  nextPlayer: { displayName: string; avatarEmoji: string } | null;
}) {
  const router = useRouter();
  const roman = toRoman(roomIndex + 1);

  const [phase, setPhase] = useState<Phase>('deal');
  const [trackRevealed, setTrackRevealed] = useState(false);
  const [curseRevealed, setCurseRevealed] = useState(false);
  const [confirmingSeal, setConfirmingSeal] = useState(false);
  const [locking, setLocking] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [gameComplete, setGameComplete] = useState(false);

  // ----- turn autosave (clone of SongPageClient's machinery) -----
  const latestStateRef = useRef<SongBlob>(initialState);
  const pendingRef = useRef<SongBlob | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Once the room is sealed, nothing may save again — the server would 409,
  // and a 3s retry loop on a dead turn helps no one.
  const lockedRef = useRef(false);

  const flushRef = useRef<(opts?: { keepalive?: boolean }) => Promise<void>>(async () => {});
  flushRef.current = async (opts) => {
    if (lockedRef.current) return;
    const data = pendingRef.current;
    if (!data) return;
    pendingRef.current = null;
    const useKeepalive = opts?.keepalive === true;
    let body: string;
    try {
      body = JSON.stringify({ sequencerData: data });
    } catch {
      return;
    }
    if (useKeepalive && body.length > KEEPALIVE_MAX_BYTES) {
      try {
        // The turn route exports POST for exactly this path.
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(`/api/games/${gameId}/turn`, blob);
        return;
      } catch {
        /* fall through to fetch */
      }
    }
    try {
      const res = await fetch(`/api/games/${gameId}/turn`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body,
        keepalive: useKeepalive,
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
    } catch {
      if (lockedRef.current) return;
      if (pendingRef.current === null) pendingRef.current = data;
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => void flushRef.current(), RETRY_MS);
    }
  };

  const handleChange = useCallback((next: SongBlob) => {
    if (lockedRef.current) return;
    latestStateRef.current = next;
    pendingRef.current = next;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => void flushRef.current(), AUTOSAVE_MS);
  }, []);

  useEffect(() => {
    const trigger = () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      void flushRef.current({ keepalive: true });
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') trigger();
    };
    window.addEventListener('pagehide', trigger);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', trigger);
      document.removeEventListener('visibilitychange', onVisibility);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  // ----- lock the room -----
  const handleLock = useCallback(async () => {
    if (locking || lockedRef.current) return;
    setConfirmingSeal(false);
    setLocking(true);
    setLockError(null);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    pendingRef.current = null;
    try {
      const res = await fetch(`/api/games/${gameId}/lock`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // The lock carries the final snapshot so no debounced save can be lost.
        body: JSON.stringify({ sequencerData: latestStateRef.current }),
      });
      if (res.status === 409) {
        lockedRef.current = true;
        router.push(`/games/${gameId}`);
        return;
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? `status ${res.status}`);
      }
      const data = (await res.json()) as { complete: boolean };
      lockedRef.current = true;
      setGameComplete(data.complete);
      setPhase('sealed');
    } catch (err) {
      setLockError(err instanceof Error ? err.message : 'The seal failed — try again.');
      setLocking(false);
    }
  }, [gameId, locking, router]);

  const backToMap = useCallback(() => {
    router.push(`/games/${gameId}`);
  }, [router, gameId]);

  const bothRevealed = trackRevealed && curseRevealed;

  // ---------- deal ----------
  if (phase === 'deal') {
    return (
      <main className="grim-page">
        <div className="grim-bar">
          <button className="grim-back" onClick={backToMap} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            ‹
          </button>
          <span className="grim-title">{gameTitle}</span>
          <span className="grim-crumb">Room {roman} · {toRoman(roomCount)}</span>
        </div>
        <p className="deal-intro">The Room deals your fate. Tap each card to reveal it.</p>
        <div className="cards">
          <div className={`flip${trackRevealed ? ' revealed' : ''}`} onClick={() => setTrackRevealed(true)}>
            <div className="flip-inner">
              <div className="face back">
                <span className="ring" />
                <span className="ring2" />
                <span style={{ position: 'relative', zIndex: 1 }}>
                  <LuteGlyph size={52} stroke="#f2ede3" />
                </span>
                <div className="kindlab">Track</div>
                <div className="tap">· Tap to reveal ·</div>
              </div>
              <div className="face front">
                <div className="kind">— Track Type —</div>
                <div className="icon">
                  <LuteGlyph size={40} stroke="#151210" />
                </div>
                <div className="name">{channelName}</div>
                <div className="rule">
                  Forge the <b>{channelName.toLowerCase()}</b> layer of the song.
                </div>
                <div className={`ch-band ${CHANNEL_PATTERNS[channelId] ?? ''}`} />
              </div>
            </div>
          </div>
          <div className={`flip${curseRevealed ? ' revealed' : ''}`} onClick={() => setCurseRevealed(true)}>
            <div className="flip-inner">
              <div className="face back">
                <span className="ring" />
                <span className="ring2" />
                <span style={{ position: 'relative', zIndex: 1 }}>
                  <SkullGlyph size={52} stroke="#f2ede3" eyes="#f2ede3" />
                </span>
                <div className="kindlab">Curse</div>
                <div className="tap">· Tap to reveal ·</div>
              </div>
              <div className="face front curse-card">
                <div className="kind">— Curse —</div>
                <div className="icon">
                  <SkullGlyph size={40} stroke="#151210" eyes="#151210" />
                </div>
                <div className="name">{curse.name}</div>
                <div className="rule">{curse.rule}</div>
                <div className="flavor">&ldquo;{curse.flavor}&rdquo;</div>
              </div>
            </div>
          </div>
        </div>
        <button className="gbtn rite" onClick={() => setPhase('compose')} disabled={!bothRevealed}>
          {bothRevealed ? (
            <>
              <SwordsGlyph size={20} stroke="#f2ede3" /> Begin — enter the crypt
            </>
          ) : (
            'Reveal both cards to begin'
          )}
        </button>
        <button className="gbtn ghost" onClick={backToMap}>
          ‹ Retreat to the map
        </button>
      </main>
    );
  }

  // ---------- sealed ----------
  if (phase === 'sealed') {
    return (
      <main className="grim-page">
        <div className="sealed">
          <div className="seal-wrap">
            <div className="splat" />
            <div className="seal">
              <SkullGlyph size={58} stroke="#4a0808" eyes="#4a0808" />
            </div>
          </div>
          <h2 className="misprint" data-text={`Room ${roman} sealed`}>
            Room <span className="rn">{roman}</span> sealed
          </h2>
          <p>
            Your <b>{channelName}</b> line is bound into the song in blood and iron.
            {gameComplete ? ' The dungeon is cleared.' : ' The crypt deepens.'}
          </p>
          <div className="next">
            {gameComplete || !nextPlayer ? (
              <span className="who">The song is complete ✦</span>
            ) : (
              <>
                <span style={{ fontSize: 22 }}>{nextPlayer.avatarEmoji}</span>
                <span>
                  Passed to <span className="who">{nextPlayer.displayName}</span>
                </span>
              </>
            )}
          </div>
          <div style={{ maxWidth: 310, margin: '0 auto' }}>
            <button className="gbtn rite" onClick={backToMap}>
              Back to the dungeon map
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ---------- compose ----------
  return (
    <div className="room-shell">
      <div className="room-top">
        <div className="curse-pin">
          <span className="nail a" />
          <span className="nail b" />
          <SkullGlyph size={26} stroke="#151210" eyes="#151210" />
          <div className="txt">
            <div className="n">{curse.name}</div>
            <div className="r">{curse.rule}</div>
          </div>
        </div>
        <div className="row2">
          <button className="gbtn ghost" onClick={backToMap} title="Save & flee">
            ‹
          </button>
          <button className="gbtn rite" onClick={() => setConfirmingSeal(true)} disabled={locking}>
            <LockGlyph size={18} stroke="#f2ede3" /> {locking ? 'Sealing…' : 'Lock the Room & pass'}
          </button>
        </div>
        {lockError && (
          <div className="deal-intro" style={{ color: 'var(--blood-lit)', margin: 0 }}>
            {lockError}
          </div>
        )}
      </div>
      {confirmingSeal && (
        <div className="grim-modal-veil" onClick={() => setConfirmingSeal(false)}>
          <div className="grim-modal" onClick={(e) => e.stopPropagation()}>
            <LockGlyph size={34} stroke="#151210" />
            <h3>Seal this room?</h3>
            <p>Your carving becomes permanent and the turn passes on. There is no way back through a sealed door.</p>
            <button className="gbtn rite" onClick={handleLock}>
              Seal it
            </button>
            <button className="gbtn ghost dark" onClick={() => setConfirmingSeal(false)}>
              Not yet — keep carving
            </button>
          </div>
        </div>
      )}
      <div className="room-editor">
        {isRingState(initialState) ? (
          <RingSequencer
            initialState={initialState}
            onChange={handleChange}
            editableChannelId={channelId}
          />
        ) : (
          <SequencerEditor
            initialState={initialState}
            onChange={handleChange}
            onBack={backToMap}
            songTitle={`${gameTitle} — Room ${roman}`}
            onRenameTitle={() => {}}
            isOwner
            creatorDisplay={`Room ${roman} · ${channelName}`}
            lockedChannelId={channelId}
            allowedPresets={CHANNEL_ALLOWED_PRESETS[channelId]}
          />
        )}
      </div>
    </div>
  );
}
