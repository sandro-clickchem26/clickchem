import { NextRequest, NextResponse } from 'next/server'
import { gerarFormulacao } from '@/lib/ai'
import { prisma } from '@/lib/db'
import { gerarVariacaoFormula } from '@/lib/analise-combinatoria'

// Aumenta o timeout máximo da função para 60s (limite do plano Hobby da Vercel)
// A geração de fórmula pela IA pode levar 30-45 segundos
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    if (!body.segmento || !body.descricao) {
      return NextResponse.json({ error: 'Segmento e descrição são obrigatórios.' }, { status: 400 })
    }

    const resultado = await gerarFormulacao(body)

    // Tentar aplicar análise combinatória se houver formulaId de referência
    const usuarioEmail = body.usuario_email || null
    const formulaReferenciaId = body.formula_referencia_id || null

    if (formulaReferenciaId && usuarioEmail) {
      try {
        // Buscar a fórmula de referência
        const formulaReferencia = await prisma.formulaProprietaria.findUnique({
          where: { id: formulaReferenciaId }
        })

        if (formulaReferencia) {
          let composicaoBase: Record<string, number>
          try {
            composicaoBase = JSON.parse(formulaReferencia.composicao)
          } catch {
            composicaoBase = {}
          }

          if (Object.keys(composicaoBase).length > 0) {
            // Gerar variação única para este usuário
            const variacao = gerarVariacaoFormula(composicaoBase, body.segmento, {
              variacao: 20,
              tentativas: 10
            })

            if (variacao) {
              // Verificar se já foi dada ao usuário
              const jaDada = await prisma.formulacaoGerada.findFirst({
                where: {
                  usuarioEmail,
                  segmento: body.segmento,
                  hash: variacao.hash
                }
              })

              if (!jaDada) {
                // Armazenar a variação gerada
                await prisma.formulacaoGerada.create({
                  data: {
                    usuarioEmail,
                    formulaBaseId: formulaReferenciaId,
                    segmento: body.segmento,
                    composicaoGerada: JSON.stringify(variacao.ingredientes),
                    hash: variacao.hash,
                    metadata: JSON.stringify({
                      formulaBaseNome: formulaReferencia.nome_interno,
                      notas: variacao.notas
                    })
                  }
                })

                // Enriquecer resultado com informação de variação
                if (resultado && typeof resultado === 'object') {
                  const r = resultado as Record<string, unknown>
                  r.analise_combinatoria = {
                    original: composicaoBase,
                    variada: variacao.ingredientes,
                    hash: variacao.hash,
                    notas: variacao.notas,
                    diferenças: Object.entries(variacao.ingredientes)
                      .map(([ing, conc]) => {
                        const orig = composicaoBase[ing] || 0
                        const diff = conc - orig
                        if (Math.abs(diff) < 0.1) return null
                        return {
                          ingrediente: ing,
                          original: orig.toFixed(2),
                          variada: conc.toFixed(2),
                          diferenca: diff > 0 ? `+${diff.toFixed(2)}%` : `${diff.toFixed(2)}%`
                        }
                      })
                      .filter(Boolean)
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        // Log mas não falha — análise combinatória é optional
        console.warn('[formulacao/route] Erro ao aplicar análise combinatória:', err)
      }
    }

    return NextResponse.json(resultado)
  } catch (err) {
    console.error('[formulacao/route] ERRO:', err)

    let msg: string
    if (err instanceof Error) {
      msg = err.message
    } else if (typeof err === 'string') {
      msg = err
    } else {
      try { msg = JSON.stringify(err) } catch { msg = 'Erro interno do servidor' }
    }

    if (msg === 'FORMULA_NAO_ENCONTRADA') {
      return NextResponse.json(
        { error: 'Fórmula de Referência Não Encontrada' },
        { status: 404 }
      )
    }

    if (msg.includes('API key') || msg.includes('authentication')) {
      return NextResponse.json(
        { error: 'Chave de API inválida. Configure ANTHROPIC_API_KEY no arquivo .env' },
        { status: 401 }
      )
    }

    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
