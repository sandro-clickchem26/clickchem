import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const ADMIN_PIN = process.env.ADMIN_PIN || 'astana2025'

function auth(req: NextRequest) {
  return req.headers.get('x-admin-pin') === ADMIN_PIN
}

export async function GET(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const docs = await prisma.documentoCientifico.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return NextResponse.json({ documentos: docs })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const { id } = await req.json()
    await prisma.documentoCientifico.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  try {
    const { id, ativo } = await req.json()
    const doc = await prisma.documentoCientifico.update({
      where: { id },
      data: { ativo },
    })
    return NextResponse.json(doc)
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
