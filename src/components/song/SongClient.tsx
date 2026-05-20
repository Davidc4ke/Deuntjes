'use client';
import { useMemo, useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { ContextBar } from '@/components/app/ContextBar';
import { SectionTimeline } from '@/components/song/SectionTimeline';
import { VersionMeta } from '@/components/song/VersionMeta';
import { SlotRow } from './SlotRow';
import { TakeSheet, type TakeSheetSelection } from './TakeSheet';
import { MixPicker } from './MixPicker';
import { ExportButton } from './ExportButton';
import { usePlayback } from '@/lib/playback/usePlayback';
import type { EngineSelection } from '@/lib/playback/engine';
import { SLOT_ORDER, type SongData, type Slot } from './types';
import type { SlotKind } from '@/db/schema';

// Map of (slotId + sectionIdOrWhole) -> takeId for the in-memory working mix.
type SelectionMap = Map<string, string>; // key = `${slotId}|${sectionId ?? 'whole'}`

function keyFor(slotId: string, sectionId: string | null) {
  return `${slotId}|${sectionId ?? 'whole'}`;
}

function initialSelections(data: SongData): SelectionMap {
  const m: SelectionMap = new Map();
  const mix = data.mixes.find((mx) => mx.id === data.version.activeMixId);
  if (mix) {
    for (const sel of mix.selections) {
      m.set(keyFor(sel.slotId, sel.sectionId), sel.takeId);
    }
  }
  return m;
}

export function SongClient({ data, canDelete }: { data: SongData; canDelete: boolean }) {
  const router = useRouter();
  const [selections, setSelections] = useState<SelectionMap>(() => initialSelections(data));
  const [openSlot, setOpenSlot] = useState<Slot | null>(null);
  const [pending, start] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  // Whenever the parent active mix changes, reset selections to it. This runs
  // after router.refresh() (e.g. when active mix is changed via the picker).
  const activeMixId = data.version.activeMixId;
  useEffect(() => {
    setSelections(initialSelections(data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMixId, data.mixes.length]);

  const slotsByKind = useMemo(() => {
    const m: Partial<Record<SlotKind, Slot>> = {};
    for (const s of data.slots) m[s.kind] = s;
    return m;
  }, [data.slots]);

  const takesBySlotId = useMemo(() => {
    const m = new Map<string, typeof data.takes>();
    for (const slot of data.slots) m.set(slot.id, []);
    for (const t of data.takes) m.get(t.slotId)?.push(t);
    return m;
  }, [data.takes, data.slots]);

  // For each slot, derive a Map<sectionId|'whole', takeId> for the active selections.
  const selectionsForSlot = (slotId: string): Map<string | 'whole', string> => {
    const m = new Map<string | 'whole', string>();
    for (const [key, takeId] of selections) {
      const [sId, sec] = key.split('|');
      if (sId !== slotId) continue;
      m.set(sec === 'whole' ? 'whole' : sec, takeId);
    }
    return m;
  };

  // Compose engine selections from the selection map. We pass both whole-song
  // and per-section selections to the engine — the engine prefers section-scoped
  // per section, with fallback to whole-song.
  const engineSelections: EngineSelection[] = useMemo(() => {
    const out: EngineSelection[] = [];
    for (const [key, takeId] of selections) {
      const [slotId, sec] = key.split('|');
      const slot = data.slots.find((s) => s.id === slotId);
      if (!slot) continue;
      if (slot.kind === 'lyrics') continue;
      const take = data.takes.find((t) => t.id === takeId);
      out.push({
        slotKind: slot.kind,
        sectionId: sec === 'whole' ? null : sec,
        takeId,
        takeName: take?.name ?? '',
      });
    }
    return out;
  }, [selections, data.slots, data.takes]);

  const playback = usePlayback({
    versionId: data.version.id,
    tempoBpm: data.version.tempoBpm,
    timeSigNum: data.version.timeSigNum,
    timeSigDen: data.version.timeSigDen,
    barCount: data.version.barCount,
    sections: data.sections,
    selections: engineSelections,
    drumPads: data.drumPads,
  });

  // Mute by slot kind for the engine
  const slotMuted = (kind: SlotKind) => !!playback.muted[kind];

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }

  function pickTake(slotId: string, sel: TakeSheetSelection) {
    setSelections((prev) => {
      const next = new Map(prev);
      next.set(keyFor(slotId, sel.sectionId), sel.takeId);
      return next;
    });
  }

  function clearSelection(slotId: string, sectionId: string | null) {
    setSelections((prev) => {
      const next = new Map(prev);
      next.delete(keyFor(slotId, sectionId));
      return next;
    });
  }

  // Compute the canonical "saved" selection map for diff detection
  const savedSelectionMap = useMemo(() => {
    const mix = data.mixes.find((m) => m.id === activeMixId);
    const m: SelectionMap = new Map();
    if (mix) {
      for (const sel of mix.selections) {
        m.set(keyFor(sel.slotId, sel.sectionId), sel.takeId);
      }
    }
    return m;
  }, [data.mixes, activeMixId]);

  const dirty = useMemo(() => {
    if (savedSelectionMap.size !== selections.size) return true;
    for (const [k, v] of selections) {
      if (savedSelectionMap.get(k) !== v) return true;
    }
    return false;
  }, [savedSelectionMap, selections]);

  async function saveAsMix(name: string) {
    const payload = {
      name,
      selections: Array.from(selections.entries()).map(([k, takeId]) => {
        const [slotId, sec] = k.split('|');
        return {
          slot_id: slotId,
          section_id: sec === 'whole' ? null : sec,
          take_id: takeId,
        };
      }),
    };
    const res = await fetch(`/api/versions/${data.version.id}/mixes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(j.error ?? 'save failed');
    }
    const { mixId } = await res.json();
    // Immediately set as active mix.
    await fetch(`/api/versions/${data.version.id}/active-mix`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mixId }),
    });
    router.refresh();
  }

  const playLabel = playback.status === 'playing' ? '■' : playback.status === 'loading' ? '…' : '▶';
  const playDisabled = engineSelections.length === 0;

  const orderedSlots = SLOT_ORDER.map((kind) => slotsByKind[kind]).filter(Boolean) as Slot[];

  return (
    <>
      <div className="stack">
        <VersionMeta
          songId={data.song.id}
          version={{
            id: data.version.id,
            versionNumber: data.version.versionNumber,
            label: data.version.label,
            tempoBpm: data.version.tempoBpm,
            keyRoot: data.version.keyRoot,
            keyMode: data.version.keyMode,
            timeSigNum: data.version.timeSigNum,
            timeSigDen: data.version.timeSigDen,
            barCount: data.version.barCount,
          }}
          canDelete={canDelete}
        />
        <SectionTimeline
          sections={data.sections.map((s) => ({
            name: s.name,
            startBar: s.startBar,
            lengthBars: s.lengthBars,
          }))}
        />
        {playback.totalBars > 0 ? (
          <div className="muted" style={{ fontSize: 12 }}>
            Bar {playback.positionBar + 1} / {playback.totalBars}
          </div>
        ) : null}
        <div className="stack">
          {orderedSlots.map((slot) => {
            const takes = takesBySlotId.get(slot.id) ?? [];
            const sels = selectionsForSlot(slot.id);
            return (
              <SlotRow
                key={slot.id}
                slot={slot}
                sections={data.sections}
                takes={takes}
                selections={sels}
                onBrowse={() => setOpenSlot(slot)}
                muted={slotMuted(slot.kind)}
                onToggleMute={() => playback.toggleMute(slot.kind)}
              />
            );
          })}
        </div>
      </div>

      {openSlot ? (
        <TakeSheet
          open={openSlot !== null}
          onClose={() => setOpenSlot(null)}
          songId={data.song.id}
          versionId={data.version.id}
          slot={openSlot}
          sections={data.sections}
          takes={takesBySlotId.get(openSlot.id) ?? []}
          selections={selectionsForSlot(openSlot.id)}
          canSelect
          onSelectTake={(sel) => {
            const current = selectionsForSlot(openSlot.id).get(sel.sectionId ?? 'whole');
            if (current === sel.takeId) {
              clearSelection(openSlot.id, sel.sectionId);
            } else {
              pickTake(openSlot.id, sel);
            }
          }}
        />
      ) : null}

      <ContextBar>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <MixPicker
            versionId={data.version.id}
            mixes={data.mixes}
            activeMixId={data.version.activeMixId}
            dirty={dirty}
            onSaveCurrent={saveAsMix}
          />
          <ExportButton
            mixId={data.version.activeMixId}
            disabled={!data.version.activeMixId || dirty}
            reason={
              !data.version.activeMixId
                ? 'Save a mix first'
                : dirty
                  ? 'Save selections to export'
                  : undefined
            }
          />
        </div>
      </ContextBar>

      <TransportButton
        status={playback.status}
        label={playLabel}
        disabled={playDisabled}
        onPlay={playback.play}
        onStop={playback.stop}
      />

      {toast ? <div className="toast">{toast}</div> : null}
      {pending ? null : null /* reserved for spinner */}
    </>
  );
}

function TransportButton({
  status,
  label,
  disabled,
  onPlay,
  onStop,
}: {
  status: 'idle' | 'loading' | 'playing' | 'stopped';
  label: string;
  disabled: boolean;
  onPlay: () => void;
  onStop: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  const target = document.getElementById('transport-portal');
  if (!target) return null;
  const playing = status === 'playing';
  return createPortal(
    <button
      className="floating-transport"
      aria-label={playing ? 'Stop' : 'Play'}
      disabled={disabled || status === 'loading'}
      onClick={() => (playing ? onStop() : onPlay())}
      style={disabled ? { opacity: 0.5 } : undefined}
    >
      {label}
    </button>,
    target,
  );
}
