import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const userId = (session?.user as { id?: string })?.id
    if (!userId) {
      return NextResponse.json({ error: 'Usuário inválido' }, { status: 401 })
    }

    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'ID da fórmula é obrigatório' }, { status: 400 })
    }

    const formula = await prisma.formulacao.findUnique({ where: { id } })

    if (!formula) {
      return NextResponse.json({ error: 'Fórmula não encontrada' }, { status: 404 })
    }

    if (formula.userId !== userId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    return NextResponse.json({
      formulacao: {
        ...formula,
        composicao: formula.composicao ? JSON.parse(formula.composicao) : {},
        analise_critica: formula.analise_critica ? JSON.parse(formula.analise_critica) : {},
        processo_fabricacao: formula.processo_fabricacao ? JSON.parse(formula.processo_fabricacao) : {},
        controle_qualidade: formula.controle_qualidade ? JSON.parse(formula.controle_qualidade) : {},
        riscos_tecnicos: formula.riscos_tecnicos ? JSON.parse(formula.riscos_tecnicos) : [],
      }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao buscar fórmula'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const userId = (session?.user as { id?: string })?.id
    if (!userId) {
      return NextResponse.json({ error: 'Usuário inválido' }, { status: 401 })
    }

    const { id } = await params

    if (!id) {
      return NextResponse.json({ error: 'ID da fórmula é obrigatório' }, { status: 400 })
    }

    // Verifica se a fórmula existe E pertence ao usuário
    const formula = await prisma.formulacao.findUnique({ where: { id } })
    if (!formula) {
      return NextResponse.json({ error: 'Fórmula não encontrada' }, { status: 404 })
    }

    if (formula.userId !== userId) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    await prisma.formulacao.delete({ where: { id } })

    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao deletar fórmula'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
