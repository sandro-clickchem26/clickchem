import { NextRequest, NextResponse } from 'next/server'
import { gerarFormulacao } from '@/lib/ai'
import { prisma } from '@/lib/db'
import { gerarVariacaoFormula } from '@/lib/analise-combinatoria'
import { createHash } from 'crypto'

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
    const usuarioEmail = body.usuario_email || null
    const segmento = String(body.segmento)

    // SEMPRE aplicar análise combinatória automaticamente
    // Extrair composição da resposta da IA
    const formulacao = (resultado as Record<string, unknown>)?.formulacao as Record<string, unknown> | undefined
    const composicao = formulacao?.composicao as Array<{ materia_prima: string; percentual: number }> | undefined

    if (composicao && Array.isArray(composicao) && composicao.length > 0) {
      try {
        // Converter para formato que análise combinatória entende
        const composicaoBase: Record<string, number> = {}
        for (const comp of composicao) {
          const mp = String(comp.materia_prima || '')
          const perc = Number(comp.percentual || 0)
          if (mp && perc > 0) {
            composicaoBase[mp] = perc
          }
        }

        if (Object.keys(composicaoBase).length > 0) {
          // Gerar variação SEMPRE (não condicional)
          const variacao = gerarVariacaoFormula(composicaoBase, segmento, {
            variacao: 25, // Aumentar variação para mais diferença
            tentativas: 15 // Mais tentativas para encontrar boa variação
          })

          if (variacao) {
            // Identificador de usuário/sessão para rastreamento
            const identificador = usuarioEmail || `session-${createHash('sha256').update(req.headers.get('user-agent') || '').digest('hex').slice(0, 16)}`

            // Verificar se já foi dada
            const jaDada = await prisma.formulacaoGerada.findFirst({
              where: {
                usuarioEmail: identificador,
                segmento,
                hash: variacao.hash
              }
            })

            if (!jaDada) {
              // Armazenar variação gerada
              await prisma.formulacaoGerada.create({
                data: {
                  usuarioEmail: identificador,
                  formulaBaseId: null, // Não há fórmula de referência, é da IA
                  segmento,
                  composicaoGerada: JSON.stringify(variacao.ingredientes),
                  hash: variacao.hash,
                  metadata: JSON.stringify({
                    fonte: 'IA',
                    descricaoPedido: body.descricao,
                    notas: variacao.notas
                  })
                }
              })

              // SUBSTITUIR a composição da IA com a variação
              if (resultado && typeof resultado === 'object') {
                const r = resultado as Record<string, unknown>
                const form = r.formulacao as Record<string, unknown> | undefined

                if (form && typeof form === 'object') {
                  // Atualizar composição com valores variados
                  const novaComposicao = Object.entries(variacao.ingredientes).map(([mp, perc]) => ({
                    materia_prima: mp,
                    percentual: perc,
                    justificativa: `Variação automatizada via análise combinatória - ${perc.toFixed(2)}%`
                  }))

                  form.composicao = novaComposicao
                  r.formulacao = form
                }
              }
            }
          }
        }
      } catch (err) {
        // Log mas não falha — análise combinatória é automática mas opcional
        console.warn('[formulacao/route] Erro ao aplicar análise combinatória automática:', err)
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
