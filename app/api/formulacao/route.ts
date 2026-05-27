import { NextRequest, NextResponse } from 'next/server'
import { gerarFormulacao } from '@/lib/ai'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (!body.segmento || !body.descricao) {
      return NextResponse.json({ error: 'Segmento e descrição são obrigatórios.' }, { status: 400 })
    }

    const resultado = await gerarFormulacao(body)
    return NextResponse.json(resultado)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno do servidor'

    if (msg.includes('API key') || msg.includes('authentication')) {
      return NextResponse.json(
        { error: 'Chave de API inválida. Configure ANTHROPIC_API_KEY no arquivo .env' },
        { status: 401 }
      )
    }

    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
