import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { storage } from '@/storage';

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const session = await auth();
  if (!session?.user) return new NextResponse('unauthorized', { status: 401 });
  const { path } = await params;
  const joined = path.join('/');
  try {
    const buf = await storage.get(joined);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'content-type': joined.endsWith('.mid') ? 'audio/midi' : 'application/octet-stream',
        'cache-control': 'private, max-age=60',
      },
    });
  } catch {
    return new NextResponse('not found', { status: 404 });
  }
}
