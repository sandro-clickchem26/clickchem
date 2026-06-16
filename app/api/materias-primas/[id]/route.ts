import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'ID é obrigatório.' },
        { status: 400 }
      )
    }

    // Verificar se a MP foi adicionada pelo usuário
    const mp = await prisma.materiaPrima.findUnique({ where: { id } })

    if (!mp) {
      return NextResponse.json(
        { error: 'Matéria-prima não encontrada.' },
        { status: 404 }
      )
    }

    if (!mp.adicionada_usuario) {
      return NextResponse.json(
        { error: 'Apenas matérias-primas adicionadas pelo usuário podem ser excluídas.' },
        { status: 403 }
      )
    }

    await prisma.materiaPrima.delete({ where: { id } })

    return NextResponse.json({ message: 'Matéria-prima excluída com sucesso.' })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
