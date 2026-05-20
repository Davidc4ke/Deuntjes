'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UploadDropzone } from '@/components/editors/UploadDropzone';
import { SLOT_LABELS } from '@/components/song/types';
import type { SlotKind } from '@/db/schema';

type Section = { id: string; name: string; startBar: number; lengthBars: number };

type Scope = { kind: 'whole' } | { kind: 'section'; sectionId: string };

export function NewTakeForm({
  songId,
  versionId,
  slotId,
  slotKind,
  sections,
  initialSectionId,
}: {
  songId: string;
  versionId: string;
  slotId: string;
  slotKind: SlotKind;
  sections: Section[];
  initialSectionId: string | null;
}) {
  const router = useRouter();
  const [scope, setScope] = useState<Scope>(
    initialSectionId ? { kind: 'section', sectionId: initialSectionId } : { kind: 'whole' },
  );
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (slotKind === 'lyrics') {
    return (
      <div className="card">
        <p>Lyrics takes land in ticket #6. For now use the chord/melody/bass/drum slots.</p>
      </div>
    );
  }

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
        Drop a .mid file for this {SLOT_LABELS[slotKind].toLowerCase()} take.
      </p>

      <div className="card stack">
        <strong>Scope</strong>
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
          <label
            key={s.id}
            style={{ display: 'flex', gap: 8, alignItems: 'center' }}
          >
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
          placeholder={file ? file.name.replace(/\.(mid|midi)$/i, '') : 'e.g. Sleepy hook'}
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
          placeholder="Anything the others should know about this take"
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
        style={{
          background: 'var(--accent)',
          color: '#1a1024',
          borderColor: 'transparent',
        }}
      >
        {pending ? 'Uploading…' : 'Upload take'}
      </button>
    </div>
  );
}
