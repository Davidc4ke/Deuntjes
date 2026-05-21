'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UploadDropzone } from '@/components/editors/UploadDropzone';
import { ChordBuilder, type ChordBuilderInitial } from '@/components/editors/Chord/ChordBuilder';
import { Tracker, type TrackerInitial } from '@/components/editors/Tracker/Tracker';
import { SLOT_LABELS } from '@/components/song/types';
import type { SlotKind } from '@/db/schema';

type Section = { id: string; name: string; startBar: number; lengthBars: number };

type Scope = { kind: 'whole' } | { kind: 'section'; sectionId: string };

type VersionInfo = {
  id: string;
  tempoBpm: number;
  keyRoot: string;
  keyMode: 'major' | 'minor';
  timeSigNum: number;
  timeSigDen: number;
  barCount: number;
};

export function NewTakeForm({
  songId,
  versionId,
  slotId,
  slotKind,
  sections,
  initialSectionId,
  version,
  chordInitial,
  trackerInitial,
  parentTakeId,
}: {
  songId: string;
  versionId: string;
  slotId: string;
  slotKind: SlotKind;
  sections: Section[];
  initialSectionId: string | null;
  version: VersionInfo;
  chordInitial?: ChordBuilderInitial;
  trackerInitial?: TrackerInitial;
  parentTakeId?: string | null;
}) {
  const [scope, setScope] = useState<Scope>(
    initialSectionId
      ? { kind: 'section', sectionId: initialSectionId }
      : { kind: 'whole' },
  );

  if (slotKind === 'lyrics') {
    return (
      <div className="card">
        <p>Lyrics takes land in ticket #6. For now use the chord/melody/bass/drum slots.</p>
      </div>
    );
  }

  const scopedBars =
    scope.kind === 'whole'
      ? version.barCount
      : sections.find((s) => s.id === scope.sectionId)?.lengthBars ?? version.barCount;
  const startBar =
    scope.kind === 'whole'
      ? 0
      : sections.find((s) => s.id === scope.sectionId)?.startBar ?? 0;
  const sectionId = scope.kind === 'section' ? scope.sectionId : null;
  const sectionName =
    scope.kind === 'section'
      ? sections.find((s) => s.id === scope.sectionId)?.name ?? null
      : null;

  // When editing/forking, hide the scope picker — the new take inherits the
  // parent's scope so MIDI bar math stays consistent.
  const lockScope = !!parentTakeId;

  return (
    <div className="stack">
      {lockScope ? null : (
        <ScopePicker
          slotKind={slotKind}
          scope={scope}
          setScope={setScope}
          sections={sections}
        />
      )}

      {slotKind === 'chords' ? (
        <ChordBuilder
          songId={songId}
          versionId={versionId}
          slotId={slotId}
          slotKind="chords"
          sectionId={sectionId}
          sectionName={sectionName}
          scopedBars={scopedBars}
          startBar={startBar}
          tempoBpm={version.tempoBpm}
          keyRoot={version.keyRoot}
          keyMode={version.keyMode}
          timeSigNum={version.timeSigNum}
          timeSigDen={version.timeSigDen}
          initial={chordInitial}
          parentTakeId={parentTakeId ?? null}
        />
      ) : slotKind === 'melody' || slotKind === 'bass' ? (
        <Tracker
          songId={songId}
          versionId={versionId}
          slotId={slotId}
          slotKind={slotKind}
          sectionId={sectionId}
          sectionName={sectionName}
          scopedBars={scopedBars}
          startBar={startBar}
          tempoBpm={version.tempoBpm}
          timeSigNum={version.timeSigNum}
          timeSigDen={version.timeSigDen}
          initial={trackerInitial}
          parentTakeId={parentTakeId ?? null}
        />
      ) : (
        <UploadOnlyFallback
          songId={songId}
          versionId={versionId}
          slotId={slotId}
          slotKind={slotKind}
          scope={scope}
        />
      )}
    </div>
  );
}

function ScopePicker({
  slotKind,
  scope,
  setScope,
  sections,
}: {
  slotKind: SlotKind;
  scope: Scope;
  setScope: (s: Scope) => void;
  sections: Section[];
}) {
  return (
    <div className="card stack">
      <strong>
        New {SLOT_LABELS[slotKind].toLowerCase()} take — scope
      </strong>
      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="radio"
          name="scope"
          checked={scope.kind === 'whole'}
          onChange={() => setScope({ kind: 'whole' })}
          style={{ width: 'auto' }}
        />
        Whole song
      </label>
      {sections.map((s) => (
        <label key={s.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="radio"
            name="scope"
            checked={scope.kind === 'section' && scope.sectionId === s.id}
            onChange={() => setScope({ kind: 'section', sectionId: s.id })}
            style={{ width: 'auto' }}
          />
          {s.name}{' '}
          <span className="muted" style={{ fontSize: 12 }}>
            ({s.lengthBars} {s.lengthBars === 1 ? 'bar' : 'bars'})
          </span>
        </label>
      ))}
    </div>
  );
}

function UploadOnlyFallback({
  songId,
  versionId,
  slotId,
  slotKind,
  scope,
}: {
  songId: string;
  versionId: string;
  slotId: string;
  slotKind: SlotKind;
  scope: Scope;
}) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    if (!file) {
      setErr('Pick a .mid file');
      return;
    }
    const form = new FormData();
    form.append('file', file);
    form.append('name', name.trim() || file.name.replace(/\.(mid|midi)$/i, ''));
    if (notes.trim()) form.append('notes', notes.trim());
    if (scope.kind === 'section') form.append('section_id', scope.sectionId);
    start(async () => {
      const res = await fetch(`/api/slots/${slotId}/takes`, {
        method: 'POST',
        body: form,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error ?? `Upload failed (${res.status})`);
        return;
      }
      const { takeId } = await res.json();
      router.replace(`/songs/${songId}/v/${versionId}/slots/${slotId}/takes/${takeId}`);
      router.refresh();
    });
  }

  return (
    <div className="stack">
      <p className="muted" style={{ marginTop: 0 }}>
        Drop a .mid file for this {SLOT_LABELS[slotKind].toLowerCase()} take. (Native{' '}
        {slotKind} editor is in ticket #6.)
      </p>
      <UploadDropzone onFile={(f) => setFile(f)} disabled={pending} />
      {file ? (
        <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{file.name}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {(file.size / 1024).toFixed(1)} KB
            </div>
          </div>
          <button type="button" onClick={() => setFile(null)} disabled={pending}>
            Clear
          </button>
        </div>
      ) : null}
      <label className="stack">
        <div className="muted" style={{ marginBottom: 6 }}>
          Name
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={file ? file.name.replace(/\.(mid|midi)$/i, '') : 'e.g. Beat A'}
        />
      </label>
      <label className="stack">
        <div className="muted" style={{ marginBottom: 6 }}>
          Notes (optional)
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder="Anything the others should know"
        />
      </label>
      {err ? (
        <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>
          {err}
        </div>
      ) : null}
      <button
        type="button"
        onClick={submit}
        disabled={pending || !file}
        style={{ background: 'var(--accent)', color: '#1a1024', borderColor: 'transparent' }}
      >
        {pending ? 'Uploading…' : 'Upload take'}
      </button>
    </div>
  );
}
