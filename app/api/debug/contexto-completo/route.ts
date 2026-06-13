import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

async function buildDocumentosContextDebug(segmento: string, descricao: string = ''): Promise<{contexto: string, count: number}> {
  try {
    const docs = await prisma.documentoCientifico.findMany({ where: { ativo: true } })

    if (docs.length === 0) return { contexto: '', count: 0 }

    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const palavras = norm(descricao).split(/\s+/).filter(w => w.length > 3)
    const segmentoPedido = norm(segmento)

    const comScore = docs.map(doc => {
      let score = 0
      const textoDoc = norm(`${doc.segmento} ${doc.titulo} ${doc.tags} ${doc.resumo || ''}`)
      const segNorm = norm(doc.segmento)

      if (segNorm.includes(segmentoPedido) || segmentoPedido.includes(segNorm)) {
        score += 3
      }

      for (const kw of palavras) {
        if (textoDoc.includes(kw)) score += 1
      }

      try {
        const tags = JSON.parse(doc.tags) as string[]
        for (const tag of tags) {
          if (norm(descricao).includes(norm(tag))) score += 2
        }
      } catch { }

      return { doc, score }
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score)

    const linhas = comScore.map(({ doc, score }) => {
      const textoDisponivel = (doc.conteudo || doc.resumo || '').trim()
      const trecho = textoDisponivel.slice(0, 1500).replace(/\s+/g, ' ').trim()
      const ref = [doc.autores, doc.ano, doc.fonte].filter(Boolean).join(', ')
      return `📄 "${doc.titulo}" [SCORE: ${score}]${ref ? ` (${ref})` : ''}${trecho ? `\n${trecho}` : ''}`
    }).join('\n\n---\n\n')

    const contexto = comScore.length > 0
      ? `\n📚 DOCUMENTAÇÃO CIENTÍFICA RELEVANTE (banco interno Astana Química — use como embasamento técnico):\n${linhas}\n`
      : ''

    return { contexto, count: comScore.length }
  } catch (err) {
    return { contexto: `ERRO: ${String(err)}`, count: 0 }
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const segmento = url.searchParams.get('segmento') || 'Biosolventes, Biolubrificantes e Biodiesel'
  const descricao = url.searchParams.get('descricao') || 'biolubrificante carbonatação óleo de mamona'

  const { contexto, count } = await buildDocumentosContextDebug(segmento, descricao)

  return NextResponse.json({
    segmento,
    descricao,
    artigos_encontrados: count,
    contexto_length: contexto.length,
    contexto_preview: contexto.substring(0, 500) + (contexto.length > 500 ? '...' : ''),
    contexto_completo: contexto,
  })
}
