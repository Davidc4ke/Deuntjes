import { redirect, notFound } from 'next/navigation';
import { requireUser } from '@/components/shared/AuthGate';
import { db } from '@/db/client';
import { songVersions, songs } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';

export default async function SongRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const [song] = await db.select().from(songs).where(eq(songs.id, id)).limit(1);
  if (!song) notFound();
  const [latest] = await db
    .select({ id: songVersions.id })
    .from(songVersions)
    .where(eq(songVersions.songId, id))
    .orderBy(desc(songVersions.versionNumber))
    .limit(1);
  if (!latest) notFound();
  redirect(`/songs/${id}/v/${latest.id}`);
}
