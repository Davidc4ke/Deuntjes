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
      {song.unreadCount > 0 ? (
        <div
          aria-label={`${song.unreadCount} new`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'var(--accent-2)',
            color: '#1a1024',
            borderRadius: 12,
            padding: '2px 8px',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          <span className="unread-dot" style={{ background: '#1a1024' }} />
          {song.unreadCount > 99 ? '99+' : song.unreadCount}
        </div>
      ) : null}
    </Link>
  );
}
