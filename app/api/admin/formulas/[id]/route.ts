import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function checkAdmin(req: NextRequest) {
  return req.headers.get('x-admin-pin') === process.env.ADMIN_PIN
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { id } = await params
  try {
    const body = await req.json()
    const { nome_interno, segmento, aplicacao, composicao, ph_final, viscosidade, processo, performance_chave, tags } = body
    const updated = await prisma.formulaProprietaria.update({
      where: { id },
      data: {
        ...(nome_interno !== undefined && { nome_interno }),
        ...(segmento !== undefined && { segmento }),
        ...(aplicacao !== undefined && { aplicacao }),
        ...(composicao !== undefined && { composicao: JSON.stringify(composicao) }),
        ...(ph_final !== undefined && { ph_final: ph_final || null }),
        ...(viscosidade !== undefined && { viscosidade: viscosidade || null }),
        ...(processo !== undefined && { processo: processo || null }),
        ...(performance_chave !== undefined && { performance_chave: performance_chave || null }),
        ...(tags !== undefined && { tags: tags || null }),
      },
    })
    return NextResponse.json(updated)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const { id } = await params
  await prisma.formulaProprietaria.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
