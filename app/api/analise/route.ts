import { NextRequest, NextResponse } from 'next/server'
import { analisarFormula } from '@/lib/ai'

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
