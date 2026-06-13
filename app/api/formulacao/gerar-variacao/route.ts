import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { gerarVariacaoFormula, calcularHashComposicao } from '@/lib/analise-combinatoria'
import { validarCompatibilidade } from '@/lib/regras-compatibilidade'

export const maxDuration = 60

/**
 * Gera uma variação única de uma fórmula proprietária
 * Rastreia para nunca fornecer a mesma combinação duas vezes para o mesmo usuário
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      usuarioEmail,
      formulaBaseId,
      segmento,
      variacao = 20,
      tentativas = 10,
    } = body

    if (!formulaBaseId || !segmento) {
      return NextResponse.json(
        { error: 'formulaBaseId e segmento são obrigatórios' },
        { status: 400 }
      )
    }

    // Buscar fórmula base
    const formulaBase = await prisma.formulaProprietaria.findUnique({
      where: { id: formulaBaseId },
    })

    if (!formulaBase) {
      return NextResponse.json({ error: 'Fórmula base não encontrada' }, { status: 404 })
    }

    let composicaoBase: Record<string, number>
    try {
      composicaoBase = JSON.parse(formulaBase.composicao)
    } catch {
      composicaoBase = {}
    }

    if (Object.keys(composicaoBase).length === 0) {
      return NextResponse.json(
        { error: 'Fórmula base não possui composição válida' },
        { status: 400 }
      )
    }

    // Tentar gerar variações até encontrar uma não repetida
    for (let i = 0; i < tentativas * 2; i++) {
      const variacao_gerada = gerarVariacaoFormula(composicaoBase, segmento, {
        variacao,
        tentativas,
      })

      if (!variacao_gerada) {
        continue
      }

      // Verificar se essa combinação já foi dada ao usuário
      if (usuarioEmail) {
        const jaDada = await prisma.formulacaoGerada.findFirst({
          where: {
            usuarioEmail,
            segmento,
            hash: variacao_gerada.hash,
          },
        })

        if (jaDada) {
          // Já foi dada, tentar gerar outra
          continue
        }
      }

      // Armazenar a variação gerada
      const formulacaoGerada = await prisma.formulacaoGerada.create({
        data: {
          usuarioEmail: usuarioEmail || null,
          formulaBaseId,
          segmento,
          composicaoGerada: JSON.stringify(variacao_gerada.ingredientes),
          hash: variacao_gerada.hash,
          metadata: JSON.stringify({
            variacaoPercentual: variacao,
            notas: variacao_gerada.notas,
            formulaBaseNome: formulaBase.nome_interno,
          }),
        },
      })

      return NextResponse.json({
        sucesso: true,
        formulacaoGerada: {
          id: formulacaoGerada.id,
          composicao: variacao_gerada.ingredientes,
          hash: variacao_gerada.hash,
          notas: variacao_gerada.notas,
          formulaBase: {
            id: formulaBase.id,
            nome: formulaBase.nome_interno,
            aplicacao: formulaBase.aplicacao,
          },
          original: composicaoBase,
          diferenças: Object.entries(variacao_gerada.ingredientes)
            .map(([ing, conc]) => {
              const orig = composicaoBase[ing] || 0
              const diff = conc - orig
              if (Math.abs(diff) < 0.1) return null
              return {
                ingrediente: ing,
                original: orig.toFixed(2),
                variada: conc.toFixed(2),
                diferenca: diff > 0 ? `+${diff.toFixed(2)}%` : `${diff.toFixed(2)}%`,
              }
            })
            .filter(Boolean),
        },
      })
    }

    return NextResponse.json(
      {
        error: 'Não foi possível gerar uma variação válida e única. Tente novamente.',
      },
      { status: 500 }
    )
  } catch (err) {
    console.error('Erro ao gerar variação:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao gerar variação' },
      { status: 500 }
    )
  }
}
