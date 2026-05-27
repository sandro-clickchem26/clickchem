import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as { id?: string })?.id ?? null

    const formulacoes = await prisma.formulacao.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        nome: true,
        segmento: true,
        status: true,
        custo_estimado: true,
        score_sustentab: true,
        createdAt: true,
        composicao: true,
        processo_fabricacao: true,
        controle_qualidade: true,
        riscos_tecnicos: true,
      },
    })

    function tryParse(s: string | null | undefined, fallback: unknown = null) {
      try { return s ? JSON.parse(s) : fallback } catch { return fallback }
    }

    return NextResponse.json({
      formulacoes: formulacoes.map(f => ({
        ...f,
        composicao: tryParse(f.composicao, {}),
        _processo_fabricacao: tryParse(f.processo_fabricacao, null),
        _controle_qualidade: tryParse(f.controle_qualidade, null),
        _riscos_tecnicos: tryParse(f.riscos_tecnicos, null),
      })),
    })
  } catch (err) {
    return NextResponse.json({ formulacoes: [], error: String(err) })
  }
}
