import { notFound } from 'next/navigation';
import { requireUser } from '@/components/shared/AuthGate';
import { AppBar } from '@/components/app/AppBar';
import { ContextBar } from '@/components/app/ContextBar';
import { FloatingTransport } from '@/components/app/FloatingTransport';
import { VersionPicker } from '@/components/app/VersionPicker';
import { SectionTimeline } from '@/components/song/SectionTimeline';
import { SlotList } from '@/components/song/SlotList';
import { VersionMeta } from '@/components/song/VersionMeta';
import { db } from '@/db/client';
import {
  sections as sectionsTable,
  slots as slotsTable,
  songVersions,
  songs,
} from '@/db/schema';
import { asc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export default async function SongVersionView({
  params,
}: {
  params: Promise<{ id: string; versionId: string }>;
}) {
  await requireUser();
  const { id, versionId } = await params;

  const [song] = await db.select().from(songs).where(eq(songs.id, id)).limit(1);
  if (!song) notFound();

  const versions = await db
    .select({
      id: songVersions.id,
      versionNumber: songVersions.versionNumber,
      label: songVersions.label,
      tempoBpm: songVersions.tempoBpm,
      keyRoot: songVersions.keyRoot,
      keyMode: songVersions.keyMode,
      timeSigNum: songVersions.timeSigNum,
      timeSigDen: songVersions.timeSigDen,
      barCount: songVersions.barCount,
      songId: songVersions.songId,
    })
    .from(songVersions)
    .where(eq(songVersions.songId, id))
    .orderBy(asc(songVersions.versionNumber));

  const current = versions.find((v) => v.id === versionId);
  if (!current) notFound();

  const sections = await db
    .select()
    .from(sectionsTable)
    .where(eq(sectionsTable.songVersionId, versionId))
    .orderBy(asc(sectionsTable.orderIdx));

  const slots = await db
    .select()
    .from(slotsTable)
    .where(eq(slotsTable.songVersionId, versionId));

  return (
    <>
      <AppBar
        back="/"
        title={
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
              flex: 1,
            }}
          >
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 160,
              }}
            >
              {song.title}
            </span>
            <VersionPicker
              songId={id}
              currentId={versionId}
              versions={versions.map((v) => ({
                id: v.id,
                versionNumber: v.versionNumber,
                label: v.label,
              }))}
            />
          </span>
        }
      />
      <main className="page">
        <div className="stack">
          <VersionMeta
            songId={id}
            version={{
              id: current.id,
              versionNumber: current.versionNumber,
              label: current.label,
              tempoBpm: current.tempoBpm,
              keyRoot: current.keyRoot,
              keyMode: current.keyMode,
              timeSigNum: current.timeSigNum,
              timeSigDen: current.timeSigDen,
              barCount: current.barCount,
            }}
            canDelete={versions.length > 1}
          />
          <SectionTimeline
            sections={sections.map((s) => ({
              name: s.name,
              startBar: s.startBar,
              lengthBars: s.lengthBars,
            }))}
          />
          <SlotList slots={slots.map((s) => ({ id: s.id, kind: s.kind }))} />
        </div>
      </main>
      <ContextBar>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" disabled style={{ flex: 1 }} aria-disabled title="Mixes land in #3">
            Mix ▾
          </button>
          <button type="button" disabled aria-disabled title="Takes land in #3">
            + Add take
          </button>
        </div>
      </ContextBar>
      <FloatingTransport />
    </>
  );
}
