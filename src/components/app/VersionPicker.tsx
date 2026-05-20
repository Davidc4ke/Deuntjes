'use client';
import { useRouter } from 'next/navigation';

export type VersionPickerItem = {
  id: string;
  versionNumber: number;
  label: string | null;
};

export function VersionPicker({
  songId,
  versions,
  currentId,
}: {
  songId: string;
  versions: VersionPickerItem[];
  currentId: string;
}) {
  const router = useRouter();
  return (
    <select
      value={currentId}
      onChange={(e) => router.push(`/songs/${songId}/v/${e.target.value}`)}
      style={{ padding: '4px 8px', maxWidth: 180 }}
      aria-label="Select version"
    >
      {versions.map((v) => (
        <option key={v.id} value={v.id}>
          v{v.versionNumber}
          {v.label ? ` · ${v.label}` : ''}
        </option>
      ))}
    </select>
  );
}
