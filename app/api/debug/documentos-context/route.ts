import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

async function testBuildDocumentosContext(segmento: string, descricao: string = ''): Promise<string> {
  try {
    const docs = await prisma.documentoCientifico.findMany({ where: { ativo: true } })
    console.log(`[TEST] Total docs ativos: ${docs.length}`)

    if (docs.length === 0) return 'VAZIO: Nenhum doc ativo'

    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const palavras = norm(descricao).split(/\s+/).filter(w => w.length > 3)
    const segmentoPedido = norm(segmento)

    console.log(`[TEST] Segmento normalizado: "${segmentoPedido}"`)

    const comScore = docs.map(doc => {
      let score = 0
      const textoDoc = norm(`${doc.segmento} ${doc.titulo} ${doc.tags} ${doc.resumo || ''}`)
      const segNorm = norm(doc.segmento)

      if (segNorm.includes(segmentoPedido) || segmentoPedido.includes(segNorm)) {
        score += 3
        console.log(`[TEST] ✅ Match: "${doc.titulo.slice(0, 40)}..."`)
      }

      for (const kw of palavras) {
        if (textoDoc.includes(kw)) score += 1
      }

      try {
        const tags = JSON.parse(doc.tags) as string[]
        for (const tag of tags) {
          if (norm(descricao).includes(norm(tag))) score += 2
        }
      } catch {}

      return { doc, score }
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 3)

    console.log(`[TEST] Artigos com score > 0: ${comScore.length}`)

    if (comScore.length === 0) return 'VAZIO: Nenhum artigo com score > 0'

    const linhas = comScore.map(({ doc, score }) => {
      const textoDisponivel = (doc.conteudo || doc.resumo || '').trim()
      const trecho = textoDisponivel.slice(0, 500).replace(/\s+/g, ' ').trim()
      const ref = [doc.autores, doc.ano, doc.fonte].filter(Boolean).join(', ')
      return `[SCORE: ${score}] "${doc.titulo}" (${ref})\n${trecho?.slice(0, 100)}...`
    }).join('\n\n---\n\n')

    return `SUCESSO: ${comScore.length} artigos encontrados\n\n${linhas}`
  } catch (err) {
    return `ERRO: ${String(err)}`
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const segmento = url.searchParams.get('segmento') || 'Biossolventes e Biolubrificantes'
  const descricao = url.searchParams.get('descricao') || 'biolubricante óleo de mamona'

  const resultado = await testBuildDocumentosContext(segmento, descricao)

  return NextResponse.json({
    segmento,
    descricao,
    resultado,
  })
}
