import { NextRequest, NextResponse } from 'next/server'
import { gerarFormulacao } from '@/lib/ai'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    console.log('🔵 API: POST /api/formulacao recebido')
    console.log('Body keys:', Object.keys(body))
    console.log('Body:', body)

    if (!body.segmento || !body.descricao) {
      console.log('🔴 API: Faltam segmento ou descrição!')
      return NextResponse.json({ error: 'Segmento e descrição são obrigatórios.' }, { status: 400 })
    }

    console.log('🟢 API: Chamando gerarFormulacao...')
    const resultado = await gerarFormulacao(body)
    return NextResponse.json(resultado)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno do servidor'
    console.error('🔴 ERRO API /formulacao:', err)
    console.error('🔴 Mensagem:', msg)
    if (err instanceof Error && err.stack) console.error('🔴 Stack:', err.stack)

    if (msg.includes('API key') || msg.includes('authentication')) {
      return NextResponse.json(
        { error: 'Chave de API inválida. Configure ANTHROPIC_API_KEY no arquivo .env' },
        { status: 401 }
      )
    }

    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
