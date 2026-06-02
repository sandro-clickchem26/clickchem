import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const docs = await prisma.documentoCientifico.findMany({ where: { ativo: true } })

    const segmentos = Array.from(new Set(docs.map(d => d.segmento)))

    return NextResponse.json({
      total_ativos: docs.length,
      segmentos_unicos: segmentos,
      artigos_por_segmento: Object.fromEntries(
        segmentos.map(seg => [
          seg,
          docs.filter(d => d.segmento === seg).map(d => ({
            titulo: d.titulo,
            conteudo_chars: d.conteudo?.length || 0,
            resumo_chars: d.resumo?.length || 0
          }))
        ])
      )
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
