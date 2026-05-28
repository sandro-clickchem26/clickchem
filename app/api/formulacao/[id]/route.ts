import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'ID da fórmula é obrigatório' }, { status: 400 })
    }

    // Verifica se a fórmula existe antes de deletar
    const formula = await prisma.formulacao.findUnique({ where: { id } })
    if (!formula) {
      return NextResponse.json({ error: 'Fórmula não encontrada' }, { status: 404 })
    }

    await prisma.formulacao.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao deletar fórmula'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
