'use client';
import { useState } from 'react';

export function ExportButton({
  mixId,
  disabled,
  reason,
}: {
  mixId: string | null;
  disabled?: boolean;
  reason?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function doExport() {
    if (!mixId || disabled) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/mixes/${mixId}/export`);
      if (!res.ok) {
        setErr(`Export failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const cd = res.headers.get('content-disposition') ?? '';
      const m = /filename="([^"]+)"/.exec(cd);
      const a = document.createElement('a');
      a.href = url;
      a.download = m?.[1] ?? 'mix.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr((e as Error)?.message ?? 'Export failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={doExport}
        disabled={disabled || !mixId || busy}
        title={disabled ? reason : 'Download zip of stems + manifest'}
      >
        {busy ? 'Exporting…' : 'Export'}
      </button>
      {err ? <div className="toast">{err}</div> : null}
    </>
  );
}
