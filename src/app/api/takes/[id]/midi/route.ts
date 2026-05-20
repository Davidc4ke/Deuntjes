import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { storage } from '@/storage';
import { getTakeWithAuthor } from '@/lib/takeQueries';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse('unauthorized', { status: 401 });
  const { id } = await params;
  const take = await getTakeWithAuthor(id);
  if (!take || !take.midiPath) return new NextResponse('not found', { status: 404 });
  try {
    const buf = await storage.get(take.midiPath);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'content-type': 'audio/midi',
        'cache-control': 'private, max-age=300',
      },
    });
  } catch {
    return new NextResponse('not found', { status: 404 });
  }
}
