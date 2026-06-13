import { prisma } from './db'

export interface VariacoesMPs {
  tensoativos: string[]
  solventes: string[]
  alternativas: Record<string, string[]>
}

/**
 * Busca variações de MPs disponíveis no banco P&D para um segmento específico
 * Extrai diferentes tensoativos e solventes usados em fórmulas similares
 */
export async function buscarVariacoesMPs(segmento: string): Promise<VariacoesMPs> {
  try {
    // Buscar TODAS as fórmulas ativas deste segmento
    const formulas = await prisma.formulaProprietaria.findMany({
      where: {
        segmento: segmento,
        ativa: true
      }
    })

    const tensoativos = new Set<string>()
    const solventes = new Set<string>()
    const alternativas: Record<string, Set<string>> = {}

    // Extrair MPs de cada fórmula
    for (const formula of formulas) {
      try {
        const composicao = JSON.parse(formula.composicao) as Record<string, number>

        for (const mp of Object.keys(composicao)) {
          const mpLower = mp.toLowerCase()

          // Classificar como tensoativo ou solvente
          if (
            mpLower.includes('tensoativo') ||
            mpLower.includes('surfactante') ||
            mpLower.includes('emulsificante') ||
            mpLower.includes('bio-soft') ||
            mpLower.includes('stepan') ||
            mpLower.includes('sulfato') ||
            mpLower.includes('alquilbenzeno')
          ) {
            tensoativos.add(mp)
            if (!alternativas['tensoativos']) alternativas['tensoativos'] = new Set()
            alternativas['tensoativos'].add(mp)
          } else if (
            mpLower.includes('solvente') ||
            mpLower.includes('steposol') ||
            mpLower.includes('limoneno') ||
            mpLower.includes('tolueno') ||
            mpLower.includes('xileno') ||
            mpLower.includes('nafta') ||
            mpLower.includes('álcool') ||
            mpLower.includes('glicol')
          ) {
            solventes.add(mp)
            if (!alternativas['solventes']) alternativas['solventes'] = new Set()
            alternativas['solventes'].add(mp)
          }
        }
      } catch {
        // Ignorar fórmulas com composição inválida
      }
    }

    // Converter Sets para Arrays
    return {
      tensoativos: Array.from(tensoativos),
      solventes: Array.from(solventes),
      alternativas: {
        tensoativos: Array.from(alternativas['tensoativos'] || []),
        solventes: Array.from(alternativas['solventes'] || [])
      }
    }
  } catch (err) {
    console.error('Erro ao buscar variações de MPs:', err)
    return {
      tensoativos: [],
      solventes: [],
      alternativas: { tensoativos: [], solventes: [] }
    }
  }
}

/**
 * Formata as variações de MPs para incluir no prompt da IA
 */
export function formatarVariacoesParaPrompt(variacoes: VariacoesMPs): string {
  const parts: string[] = []

  if (variacoes.tensoativos.length > 0) {
    parts.push(`TENSOATIVOS DISPONÍVEIS NO BANCO P&D:
${variacoes.tensoativos.map((t, i) => `${i + 1}. ${t}`).join('\n')}
👉 USE DIFERENTES tensoativos em cada geração (não sempre o primeiro)`)
  }

  if (variacoes.solventes.length > 0) {
    parts.push(`SOLVENTES DISPONÍVEIS NO BANCO P&D:
${variacoes.solventes.map((s, i) => `${i + 1}. ${s}`).join('\n')}
👉 COMBINE DIFERENTES solventes (não sempre STEPOSOL + Limoneno)`)
  }

  if (parts.length === 0) {
    return ''
  }

  return `\n⚠️ VARIAÇÕES DISPONÍVEIS NO BANCO P&D PARA ESTE SEGMENTO:\n${parts.join('\n\n')}\n`
}
