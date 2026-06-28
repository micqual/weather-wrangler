import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) return null

        const farmer = await prisma.farmers.findUnique({
          where: { email: credentials.email as string },
        })

        if (!farmer || !farmer.password_hash || !farmer.active) return null

        const valid = await bcrypt.compare(credentials.password as string, farmer.password_hash)
        if (!valid) return null

        return { id: farmer.id, email: farmer.email ?? undefined, name: farmer.name ?? undefined }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.id = user.id
      return token
    },
    async session({ session, token }) {
      if (session.user) (session.user as any).id = token.id
      return session
    },
  },
  pages: { signIn: '/login' },
})
