import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.uid = (user as { id?: string }).id;
        token.avatar = (user as { image?: string }).image;
      }
      return token;
    },
    async session({ session, token }) {
      if (token?.uid) {
        (session.user as { id?: string }).id = token.uid as string;
        (session.user as { avatar?: string }).avatar = token.avatar as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
