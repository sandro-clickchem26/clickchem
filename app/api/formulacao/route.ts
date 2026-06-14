import { NextRequest, NextResponse } from 'next/server'
import { gerarFormulacao } from '@/lib/ai'
import { prisma } from '@/lib/db'
import { gerarVariacaoFormula, calcularHashComposicao } from '@/lib/analise-combinatoria'
import { buscarVariacoesMPs, forcarVariacaoMPs } from '@/lib/buscar-variacoes'
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

    console.log('[formulacao/route.ts] Iniciando gerarFormulacao...')
    const resultado = await gerarFormulacao(body)
    console.log('[formulacao/route.ts] gerarFormulacao concluída!')
    const usuarioEmail = body.usuario_email || null
    const segmento = String(body.segmento)

    // SEMPRE aplicar análise combinatória automaticamente
    // Extrair composição da resposta da IA
    const formulacao = (resultado as Record<string, unknown>)?.formulacao as Record<string, unknown> | undefined
    const composicao = formulacao?.composicao as Array<{ materia_prima: string; percentual: number }> | undefined

    console.log('[formulacao/route.ts] Composição extraída?', composicao ? `SIM (${composicao.length} itens)` : 'NÃO')
    console.log('[formulacao/route.ts] Tipo de composicao:', typeof composicao)
    console.log('[formulacao/route.ts] É array?', Array.isArray(composicao))
    console.log('[formulacao/route.ts] Comprimento:', composicao?.length)

    if (composicao && Array.isArray(composicao) && composicao.length > 0) {
      console.log('[formulacao] 🔥 ENTRANDO NO BLOCO DE FORÇA VARIAÇÃO')
    } else {
      console.error('[formulacao] ❌ NÃO ENTROU NO IF - Condições:')
      console.error('  - composicao existe?', !!composicao)
      console.error('  - é array?', Array.isArray(composicao))
      console.error('  - tem length > 0?', composicao?.length > 0)
    }

    if (composicao && Array.isArray(composicao) && composicao.length > 0) {
      console.log('[formulacao] 🔥 ENTRANDO NO BLOCO DE FORÇA VARIAÇÃO (segunda entrada)')
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
          console.log('[formulacao] composicaoBase extraída com', Object.keys(composicaoBase).length, 'MPs')
          // Gerar variação SEMPRE (não condicional)
          const variacao = gerarVariacaoFormula(composicaoBase, segmento, {
            variacao: 25, // Aumentar variação para mais diferença
            tentativas: 15 // Mais tentativas para encontrar boa variação
          })

          console.log('[formulacao] Variação gerada?', variacao ? 'SIM' : 'NÃO')

          if (variacao) {
            // Identificador de usuário/sessão para rastreamento
            const identificador = usuarioEmail || `session-${createHash('sha256').update(req.headers.get('user-agent') || '').digest('hex').slice(0, 16)}`

            console.log('[formulacao] ⚡ INICIANDO FORÇA VARIAÇÃO para segmento:', segmento)

            try {
              // FORÇA VARIAÇÃO: Buscar MPs disponíveis e últimas composições
              console.log('[formulacao] Buscando variações de MPs...')
              const variacoesMPs = await buscarVariacoesMPs(segmento)
              console.log('[formulacao] Variações obtidas: tensoativos=', variacoesMPs.tensoativos.length, ', solventes=', variacoesMPs.solventes.length)

              // Buscar últimas 5 formulas geradas para este usuário neste segmento
              const ultimasFormulas = await prisma.formulacaoGerada.findMany({
                where: {
                  usuarioEmail: identificador,
                  segmento
                },
                orderBy: { createdAt: 'desc' },
                take: 5,
                select: { composicaoGerada: true }
              })

              console.log('[formulacao] Últimas fórmulas encontradas:', ultimasFormulas.length)

              // Converter para formato esperado por forcarVariacaoMPs
              const ultimasComposicoes = ultimasFormulas
                .map(f => {
                  try {
                    const comp = JSON.parse(f.composicaoGerada) as Record<string, number>
                    const mps = Object.keys(comp).map(mp => ({ materia_prima: mp }))
                    console.log('[formulacao] Fórmula anterior tem', mps.length, 'MPs:', mps.map(m => m.materia_prima).slice(0, 3))
                    return mps
                  } catch (e) {
                    console.warn('[formulacao] Erro ao parsear composição anterior:', e)
                    return []
                  }
                })
                .flat()

              console.log('[formulacao] Total de MPs das últimas fórmulas:', ultimasComposicoes.length)

              // Converter variação para array com estrutura esperada
              const composicaoComJustificativa = Object.entries(variacao.ingredientes).map(
                ([mp, perc]) => ({
                  materia_prima: mp,
                  percentual: perc,
                  justificativa: `Variação automatizada - ${perc.toFixed(2)}%`
                })
              )

              // APLICAR FORÇA VARIAÇÃO para garantir MPs diferentes
              console.log('[formulacao] Aplicando FORÇA VARIAÇÃO...')
              const composicaoForçada = forcarVariacaoMPs(
                composicaoComJustificativa,
                variacoesMPs.tensoativos,
                variacoesMPs.solventes,
                [ultimasComposicoes],
                variacoesMPs.outros
              )

              const mpsVariados = composicaoForçada.filter(c => c.justificativa?.includes('Substituída')).length
              console.log('[formulacao] ✅ Força variação aplicada: ', mpsVariados, 'MPs foram substituídas')
              console.log('[formulacao] Composição final:', composicaoForçada.map(c => c.materia_prima).slice(0, 4))

              // Converter de volta para Record<string, number> para hash
              const variacao_forcada: Record<string, number> = {}
              for (const comp of composicaoForçada) {
                variacao_forcada[comp.materia_prima] = comp.percentual
              }

              // Recalcular hash com composição forçada
              const hashForcado = calcularHashComposicao(variacao_forcada)
              console.log('[formulacao] Hash da composição:', hashForcado.slice(0, 8) + '...')

              // Verificar se já foi dada
              const jaDada = await prisma.formulacaoGerada.findFirst({
                where: {
                  usuarioEmail: identificador,
                  segmento,
                  hash: hashForcado
                }
              })

              if (!jaDada) {
                // Armazenar variação forçada
                await prisma.formulacaoGerada.create({
                  data: {
                    usuarioEmail: identificador,
                    formulaBaseId: null,
                    segmento,
                    composicaoGerada: JSON.stringify(variacao_forcada),
                    hash: hashForcado,
                    metadata: JSON.stringify({
                      fonte: 'IA',
                      descricaoPedido: body.descricao,
                      notas: variacao.notas,
                      mpVariadas: composicaoForçada.filter(c => c.justificativa?.includes('Substituída')).length
                    })
                  }
                })

                // SUBSTITUIR a composição da IA com a variação FORÇADA
                if (resultado && typeof resultado === 'object') {
                  const r = resultado as Record<string, unknown>
                  const form = r.formulacao as Record<string, unknown> | undefined

                  if (form && typeof form === 'object') {
                    form.composicao = composicaoForçada
                    r.formulacao = form
                    console.log('[formulacao] ✅ COMPOSIÇÃO SUBSTITUÍDA na resposta com MPs variados!')
                  } else {
                    console.warn('[formulacao] ⚠️ Não conseguiu substituir - formulacao/composicao não é object')
                  }
                } else {
                  console.warn('[formulacao] ⚠️ Não conseguiu substituir - resultado não é object')
                }

                console.log(
                  `[formulacao] ✅ SUCESSO: Variação FORÇADA aplicada para ${segmento}. ${mpsVariados} MPs substituídas.`
                )
              } else {
                console.log(`[formulacao] ⚠️ Essa variação já foi dada ao usuário (hash duplicado). Retornando mesmo assim...`)
              }
            } catch (err) {
              console.warn('[formulacao/route] Erro ao forçar variação de MPs:', err)
              // Continuar mesmo se a força variação falhar (fallback para variação normal)
            }
          }
        }
      } catch (err) {
        // Log mas não falha — análise combinatória é automática mas opcional
        console.error('[formulacao/route] ❌ ERRO ao aplicar força variação:', err)
        if (err instanceof Error) {
          console.error('[formulacao/route] Stack:', err.stack)
        }
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
