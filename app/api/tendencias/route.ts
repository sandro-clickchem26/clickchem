import { NextRequest, NextResponse } from 'next/server'
import { analisarTendencias } from '@/lib/ai'

export async function POST(req: NextRequest) {
  try {
    const { segmento, tipo, descricao, pesquisa_ativa } = await req.json()

    if (!segmento || !tipo || !descricao) {
      return NextResponse.json({ error: 'Preencha todos os campos.' }, { status: 400 })
    }

    const resultado = await analisarTendencias(segmento, tipo, descricao, Boolean(pesquisa_ativa))
    return NextResponse.json(resultado)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
