import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

const ADMIN_PIN = process.env.ADMIN_PIN || 'astana2025'

function auth(req: NextRequest) {
  return req.headers.get('x-admin-pin') === ADMIN_PIN
}

export async function POST(req: NextRequest) {
  if (!auth(req)) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  try {
    // Corrigir Documentos Científicos
    const docsAtualizados = await prisma.documentoCientifico.updateMany({
      where: { segmento: 'Biosolventes, Biolubrificantes e Biodiesel' },
      data: { segmento: 'Biosolventes, Biolubrificantes e Biodiesel' },
    })

    // Corrigir Fórmulas Proprietárias
    const formulasAtualizadas = await prisma.formulaProprietaria.updateMany({
      where: { segmento: 'Biosolventes, Biolubrificantes e Biodiesel' },
      data: { segmento: 'Biosolventes, Biolubrificantes e Biodiesel' },
    })

    return NextResponse.json({
      sucesso: true,
      documentos_cientificos: docsAtualizados.count,
      formulas_proprietarias: formulasAtualizadas.count,
      total: docsAtualizados.count + formulasAtualizadas.count,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
