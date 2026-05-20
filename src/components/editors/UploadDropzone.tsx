'use client';
import { useState, type ChangeEvent, type DragEvent } from 'react';

export function UploadDropzone({
  onFile,
  accept = '.mid,.midi,audio/midi',
  disabled,
}: {
  onFile: (file: File) => void;
  accept?: string;
  disabled?: boolean;
}) {
  const [dragOver, setDragOver] = useState(false);

  function handleInput(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) onFile(f);
  }

  function handleDrop(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    const f = e.dataTransfer.files?.[0];
    if (f) onFile(f);
  }

  return (
    <label
      htmlFor="upload-input"
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        padding: 24,
        textAlign: 'center',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        outline: dragOver ? '2px dashed var(--accent)' : '2px dashed transparent',
        outlineOffset: -2,
        background: dragOver ? 'var(--bg-elev-2)' : undefined,
      }}
    >
      <div style={{ fontSize: 32 }} aria-hidden>
        🎼
      </div>
      <div style={{ fontWeight: 600 }}>Tap to pick or drop a .mid file</div>
      <div className="muted" style={{ fontSize: 13 }}>
        Up to 2 MB. Files from your DAW or MPC work directly.
      </div>
      <input
        id="upload-input"
        type="file"
        accept={accept}
        onChange={handleInput}
        disabled={disabled}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      />
    </label>
  );
}
