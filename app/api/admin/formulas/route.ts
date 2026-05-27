import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function checkAdmin(req: NextRequest) {
  const pin = req.headers.get('x-admin-pin')
  return pin === process.env.ADMIN_PIN
}

export async function GET(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  const formulas = await prisma.formulaProprietaria.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(formulas)
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const { nome_interno, segmento, aplicacao, composicao, ph_final, viscosidade, processo, performance_chave, tags } = body

    if (!nome_interno || !segmento || !aplicacao || !composicao) {
      return NextResponse.json({ error: 'Campos obrigatórios: nome_interno, segmento, aplicacao, composicao' }, { status: 400 })
    }

    const formula = await prisma.formulaProprietaria.create({
      data: {
        nome_interno,
        segmento,
        aplicacao,
        composicao: JSON.stringify(composicao),
        ph_final: ph_final || null,
        viscosidade: viscosidade || null,
        processo: processo || null,
        performance_chave: performance_chave || null,
        tags: tags || null,
      },
    })
    return NextResponse.json(formula, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }
  try {
    const body = await req.json()
    const { id, ativa } = body
    const updated = await prisma.formulaProprietaria.update({
      where: { id },
      data: { ativa },
    })
    return NextResponse.json(updated)
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro interno' }, { status: 500 })
  }
}
