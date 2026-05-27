import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

// Endpoint único de migração: atribui todas as fórmulas sem dono ao usuário logado.
// Chamar uma vez pelo admin para recuperar fórmulas criadas antes da separação por usuário.
export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as { id?: string; role?: string })?.id
    const role = (session?.user as { id?: string; role?: string })?.role

    if (!userId || role !== 'admin') {
      return NextResponse.json({ error: 'Apenas admins podem executar esta migração.' }, { status: 403 })
    }

    const resultado = await prisma.formulacao.updateMany({
      where: { userId: null },
      data: { userId },
    })

    return NextResponse.json({
      success: true,
      formulacoes_migradas: resultado.count,
      mensagem: `${resultado.count} fórmula(s) atribuída(s) ao seu usuário.`,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
