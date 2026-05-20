import { redirect } from 'next/navigation';
import { auth } from '@/auth';

export async function requireUser() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) redirect('/login');
  return { userId, session: session! };
}

export async function optionalUser() {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}
