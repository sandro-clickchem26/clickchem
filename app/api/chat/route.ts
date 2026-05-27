import { NextRequest, NextResponse } from 'next/server'
import { chatContextual } from '@/lib/ai'

export async function POST(req: NextRequest) {
  try {
    const { mensagens, contexto } = await req.json()

    if (!mensagens || mensagens.length === 0) {
      return NextResponse.json({ error: 'Mensagens vazias.' }, { status: 400 })
    }

    const resposta = await chatContextual(mensagens, contexto || '')
    return NextResponse.json({ resposta })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
