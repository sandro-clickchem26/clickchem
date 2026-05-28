import { NextRequest, NextResponse } from 'next/server'
import { analisarFormula } from '@/lib/ai'

// Aumenta o timeout máximo para 60s (limite do plano Hobby da Vercel)
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    const { componentes, nome, segmento, aplicacao, problemas } = body

    if (!componentes || componentes.length < 2) {
      return NextResponse.json({ error: 'Insira pelo menos 2 componentes.' }, { status: 400 })
    }

    const resultado = await analisarFormula({ nome, segmento, aplicacao, problemas, componentes })
    return NextResponse.json(resultado)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
