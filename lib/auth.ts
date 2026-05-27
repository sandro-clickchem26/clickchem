import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/db'

export const authOptions: NextAuthOptions = {
  providers: [
    // Login com Google (apenas se as chaves estiverem configuradas)
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          }),
        ]
      : []),

    // Login com email e senha
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        senha: { label: 'Senha', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.senha) return null

        const user = await prisma.usuario.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        })

        if (!user || !user.ativo) return null

        const senhaValida = await bcrypt.compare(credentials.senha, user.senha)
        if (!senhaValida) return null

        return {
          id: user.id,
          email: user.email,
          name: user.nome,
          role: user.role,
        }
      },
    }),
  ],

  pages: {
    signIn: '/login',
  },

  callbacks: {
    // Ao fazer login via Google: cria o usuário no banco se ainda não existir
    async signIn({ user, account }) {
      if (account?.provider === 'google') {
        const email = user.email?.toLowerCase().trim()
        if (!email) return false

        const existente = await prisma.usuario.findUnique({ where: { email } })

        if (!existente) {
          // Primeiro acesso via Google — cria como tester
          await prisma.usuario.create({
            data: {
              email,
              nome: user.name ?? email.split('@')[0],
              senha: '', // sem senha local
              role: 'tester',
              ativo: true,
            },
          })
        } else if (!existente.ativo) {
          // Conta desativada pelo admin
          return false
        }
      }
      return true
    },

    async jwt({ token, user, account }) {
      if (user) {
        // Login com credentials: user já tem id e role
        const u = user as { id?: string; role?: string }
        if (u.role) {
          token.id = u.id
          token.role = u.role
        }
      }

      // Login com Google: busca id e role do banco
      if (account?.provider === 'google' && token.email) {
        const dbUser = await prisma.usuario.findUnique({
          where: { email: token.email },
        })
        if (dbUser) {
          token.id = dbUser.id
          token.role = dbUser.role
        }
      }

      return token
    },

    async session({ session, token }) {
      if (session.user) {
        (session.user as { id?: string; role?: string }).id = token.id as string
        ;(session.user as { id?: string; role?: string }).role = token.role as string
      }
      return session
    },
  },

  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 horas
  },

  secret: process.env.NEXTAUTH_SECRET,
}
