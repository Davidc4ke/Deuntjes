import Link from 'next/link';

export type SongCardData = {
  id: string;
  title: string;
  createdBy: { displayName: string; avatarEmoji: string };
  latestVersionNumber: number;
  unreadCount: number;
};

export function SongCard({ song }: { song: SongCardData }) {
  return (
    <Link href={`/songs/${song.id}`} className="song-card">
      <div style={{ fontSize: 28 }}>{song.createdBy.avatarEmoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {song.title}
        </div>
        <div className="muted" style={{ fontSize: 13 }}>
          v{song.latestVersionNumber} · by {song.createdBy.displayName}
        </div>
      </div>
      {song.unreadCount > 0 ? <div className="unread-dot" aria-label="new activity" /> : null}
    </Link>
  );
}
