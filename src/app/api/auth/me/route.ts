import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ user: null }, { status: 401 });
  return NextResponse.json({
    user: {
      id: (session.user as { id?: string }).id,
      name: session.user.name,
      avatar: (session.user as { avatar?: string }).avatar,
    },
  });
}
