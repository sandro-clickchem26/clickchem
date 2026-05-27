import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as { id?: string })?.id ?? null

    const body = await req.json()
    const { formulacao, segmento } = body

    const nome = (formulacao?.formulacao?.nome_sugerido as string) || 'Formulação sem nome'
    const custo = Number(formulacao?.formulacao?.custo_estimado_total) || null
    const scoreSustentab = Number(formulacao?.sustentabilidade?.pontuacao) || null

    const saved = await prisma.formulacao.create({
      data: {
        userId,
        nome,
        segmento: segmento || 'Não especificado',
        descricao: (formulacao?.formulacao?.descricao_tecnica as string) || '',
        composicao: JSON.stringify(formulacao),
        analise_critica: JSON.stringify(formulacao?.analise_critica || {}),
        processo_fabricacao: JSON.stringify(formulacao?.processo_fabricacao || {}),
        controle_qualidade: JSON.stringify(formulacao?.controle_qualidade || {}),
        riscos_tecnicos: JSON.stringify(formulacao?.riscos_tecnicos || []),
        custo_estimado: custo,
        score_sustentab: scoreSustentab,
      },
    })

    return NextResponse.json({ success: true, id: saved.id })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
