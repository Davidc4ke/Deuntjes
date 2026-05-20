import { notFound } from 'next/navigation';
import { requireUser } from '@/components/shared/AuthGate';
import { AppBar } from '@/components/app/AppBar';
import { db } from '@/db/client';
import {
  sections as sectionsTable,
  slots as slotsTable,
  songs,
  songVersions,
  takes as takesTable,
} from '@/db/schema';
import { asc, eq } from 'drizzle-orm';
import { NewTakeForm } from './NewTakeForm';
import { SLOT_LABELS } from '@/components/song/types';
import type { SlotKind } from '@/db/schema';
import type { ChordBuilderInitial } from '@/components/editors/Chord/ChordBuilder';
import type { TrackerInitial } from '@/components/editors/Tracker/Tracker';
import type { ChordPayload } from '@/lib/render/chordTake';
import type { TrackerPayload } from '@/lib/render/trackerTake';

export const dynamic = 'force-dynamic';

export default async function NewTakePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; versionId: string; slotId: string }>;
  searchParams: Promise<{ sectionId?: string; fromTakeId?: string }>;
}) {
  await requireUser();
  const { id, versionId, slotId } = await params;
  const { sectionId: initialSectionId, fromTakeId } = await searchParams;

  const [song] = await db.select().from(songs).where(eq(songs.id, id)).limit(1);
  if (!song) notFound();

  const [version] = await db
    .select()
    .from(songVersions)
    .where(eq(songVersions.id, versionId))
    .limit(1);
  if (!version || version.songId !== id) notFound();

  const [slot] = await db
    .select()
    .from(slotsTable)
    .where(eq(slotsTable.id, slotId))
    .limit(1);
  if (!slot || slot.songVersionId !== versionId) notFound();

  const sectionRows = await db
    .select()
    .from(sectionsTable)
    .where(eq(sectionsTable.songVersionId, versionId))
    .orderBy(asc(sectionsTable.orderIdx));

  let chordInitial: ChordBuilderInitial | undefined;
  let trackerInitial: TrackerInitial | undefined;
  let parentTakeId: string | null = null;
  let effectiveInitialSectionId = initialSectionId ?? null;

  if (fromTakeId) {
    const [parent] = await db
      .select()
      .from(takesTable)
      .where(eq(takesTable.id, fromTakeId))
      .limit(1);
    if (parent && parent.slotId === slotId && parent.source === 'native' && parent.payloadJson) {
      parentTakeId = parent.id;
      effectiveInitialSectionId = parent.sectionId ?? null;
      if (slot.kind === 'chords') {
        const p = parent.payloadJson as ChordPayload;
        const sectionBars = effectiveInitialSectionId
          ? sectionRows.find((s) => s.id === effectiveInitialSectionId)?.lengthBars ?? version.barCount
          : version.barCount;
        const filled: ChordBuilderInitial['bars'] = new Array(sectionBars).fill(null);
        for (const c of p.chords ?? []) {
          if (c.start_bar >= 0 && c.start_bar < sectionBars) {
            filled[c.start_bar] = { root: c.root, quality: c.quality };
          }
        }
        chordInitial = {
          bars: filled,
          voicingOctave: p.voicing_octave ?? 4,
          name: `${parent.name} (fork)`,
          notes: parent.notes ?? '',
        };
      } else if (slot.kind === 'melody' || slot.kind === 'bass') {
        const p = parent.payloadJson as TrackerPayload;
        trackerInitial = {
          notes: p.notes ?? [],
          granularity: p.granularity ?? 16,
          name: `${parent.name} (fork)`,
          notesText: parent.notes ?? '',
        };
      }
    }
  }

  const titlePrefix = parentTakeId ? 'Edit (fork) — ' : '+ ';

  return (
    <>
      <AppBar
        back={`/songs/${id}/v/${versionId}`}
        title={`${titlePrefix}${SLOT_LABELS[slot.kind as SlotKind]} take`}
      />
      <main className="page">
        <NewTakeForm
          songId={id}
          versionId={versionId}
          slotId={slotId}
          slotKind={slot.kind as SlotKind}
          sections={sectionRows.map((s) => ({
            id: s.id,
            name: s.name,
            startBar: s.startBar,
            lengthBars: s.lengthBars,
          }))}
          initialSectionId={effectiveInitialSectionId}
          version={{
            id: version.id,
            tempoBpm: version.tempoBpm,
            keyRoot: version.keyRoot,
            keyMode: version.keyMode as 'major' | 'minor',
            timeSigNum: version.timeSigNum,
            timeSigDen: version.timeSigDen,
            barCount: version.barCount,
          }}
          chordInitial={chordInitial}
          trackerInitial={trackerInitial}
          parentTakeId={parentTakeId}
        />
      </main>
    </>
  );
}
