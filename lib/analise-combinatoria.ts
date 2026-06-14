import crypto from 'crypto'
import { validarCompatibilidade, obterFaixaConcentracao } from './regras-compatibilidade'

export interface ComposicaoVariada {
  ingredientes: Record<string, number> // {ingrediente: concentração%}
  hash: string // SHA256 da composição
  phEstimado?: number
  viscosidadeEstimada?: number
  notas: string
}

/**
 * Gera variações de uma fórmula base alterando proporções
 * Respeita regras de compatibilidade
 */
export function gerarVariacaoFormula(
  formulaBase: Record<string, number>, // {ingrediente: concentração%}
  segmento: string,
  opcoes?: {
    variacao?: number // percentual de variação (0-50), padrão 20%
    tentativas?: number // quantas tentativas fazer, padrão 10
  }
): ComposicaoVariada | null {
  const variacao = opcoes?.variacao ?? 20
  const tentativas = opcoes?.tentativas ?? 10

  const ingredientes = Object.keys(formulaBase)

  for (let t = 0; t < tentativas; t++) {
    const novaComposicao: Record<string, number> = {}

    // Copiar base
    for (const ingrediente of ingredientes) {
      novaComposicao[ingrediente] = formulaBase[ingrediente]
    }

    // Aplicar variações aleatórias respeitando faixas
    let ajusteTotal = 0
    const ajustes: Record<string, number> = {}

    for (const ingrediente of ingredientes) {
      const faixa = obterFaixaConcentracao(ingrediente)
      if (!faixa) continue

      const concentracaoAtual = novaComposicao[ingrediente]
      const variacaoAleatoria = (Math.random() - 0.5) * 2 * variacao // -variacao até +variacao
      const novaConcentracao = concentracaoAtual * (1 + variacaoAleatoria / 100)

      // Respeitar faixa permitida
      const concentracaoLimitada = Math.max(
        faixa.faixaConcentracaoMin,
        Math.min(faixa.faixaConcentracaoMax, novaConcentracao)
      )

      const ajuste = concentracaoLimitada - concentracaoAtual
      ajustes[ingrediente] = ajuste
      ajusteTotal += Math.abs(ajuste)

      novaComposicao[ingrediente] = concentracaoLimitada
    }

    // Normalizar para 100%
    const soma = Object.values(novaComposicao).reduce((a, b) => a + b, 0)
    if (soma > 0) {
      for (const ingrediente of ingredientes) {
        novaComposicao[ingrediente] = (novaComposicao[ingrediente] / soma) * 100
      }
    }

    // Validar compatibilidade
    const validacao = validarCompatibilidade(novaComposicao, segmento)
    if (!validacao.valido) {
      continue
    }

    // Calcular hash para evitar duplicatas
    const hash = calcularHashComposicao(novaComposicao)

    // Verificar se é significativamente diferente da original
    if (!ehVariacaoSignificativa(formulaBase, novaComposicao, variacao / 2)) {
      continue
    }

    return {
      ingredientes: novaComposicao,
      hash,
      notas: `Variação gerada com ${(ajusteTotal / ingredientes.length).toFixed(1)}% de ajuste médio`,
    }
  }

  return null
}

/**
 * Calcula hash SHA256 de uma composição
 */
export function calcularHashComposicao(composicao: Record<string, number>): string {
  // Arredondar para 2 casas decimais para evitar diferenças mínimas
  const composicaoArredondada = Object.entries(composicao)
    .map(([ing, conc]) => `${ing}:${conc.toFixed(2)}`)
    .sort()
    .join('|')

  return crypto.createHash('sha256').update(composicaoArredondada).digest('hex')
}

/**
 * Verifica se uma variação é significativamente diferente da original
 */
export function ehVariacaoSignificativa(
  formulaOriginal: Record<string, number>,
  formulaVariada: Record<string, number>,
  limiteVariacao: number = 10 // percentual mínimo
): boolean {
  const diferencaMedia = Object.keys(formulaOriginal)
    .map(ing => {
      const original = formulaOriginal[ing] || 0
      const variada = formulaVariada[ing] || 0
      const diff = Math.abs(variada - original) / Math.max(original, 0.1)
      return diff * 100
    })
    .reduce((a, b) => a + b, 0) / Object.keys(formulaOriginal).length

  return diferencaMedia >= limiteVariacao
}

/**
 * Gera múltiplas variações da mesma fórmula base
 */
export function gerarMultiplasVariacoes(
  formulaBase: Record<string, number>,
  segmento: string,
  quantidade: number = 3,
  variacao: number = 20
): ComposicaoVariada[] {
  const variacoes: ComposicaoVariada[] = []
  const hashesJaGerados = new Set<string>()

  for (let i = 0; i < quantidade * 3; i++) {
    // Tentar 3x a quantidade desejada
    const variacaoGerada = gerarVariacaoFormula(formulaBase, segmento, { variacao })

    if (!variacaoGerada) continue

    // Evitar duplicatas
    if (hashesJaGerados.has(variacaoGerada.hash)) continue

    hashesJaGerados.add(variacaoGerada.hash)
    variacoes.push(variacaoGerada)

    if (variacoes.length >= quantidade) break
  }

  return variacoes
}

/**
 * Otimiza uma fórmula variada para atingir um pH alvo
 */
export function otimizarPhFormula(
  composicao: Record<string, number>,
  phAlvo: number,
  phAtual: number
): Record<string, number> | null {
  const novaComposicao = { ...composicao }

  // Simplificado: ajustar ingredientes acidulantes/básicos
  const diferencaph = phAlvo - phAtual

  if (diferencaph > 0) {
    // Precisa aumentar pH (menos ácido, mais base)
    if (novaComposicao['ácido cítrico'] && novaComposicao['ácido cítrico'] > 0.5) {
      novaComposicao['ácido cítrico'] *= 0.8
    }
  } else {
    // Precisa diminuir pH (mais ácido, menos base)
    if (novaComposicao['hidróxido de sódio'] && novaComposicao['hidróxido de sódio'] > 0.5) {
      novaComposicao['hidróxido de sódio'] *= 0.8
    }
  }

  // Normalizar
  const soma = Object.values(novaComposicao).reduce((a, b) => a + b, 0)
  if (soma > 0) {
    for (const ing of Object.keys(novaComposicao)) {
      novaComposicao[ing] = (novaComposicao[ing] / soma) * 100
    }
  }

  return novaComposicao
}

/**
 * Compara duas composições e retorna diferenças
 */
export function compararComposicoes(
  comp1: Record<string, number>,
  comp2: Record<string, number>
): { ingrediente: string; comp1: number; comp2: number; diferenca: number }[] {
  const todos = new Set([...Object.keys(comp1), ...Object.keys(comp2)])
  const diferenças = []

  for (const ing of todos) {
    const v1 = comp1[ing] || 0
    const v2 = comp2[ing] || 0
    const diff = Math.abs(v2 - v1)

    if (diff > 0.1) {
      diferenças.push({
        ingrediente: ing,
        comp1: v1,
        comp2: v2,
        diferenca: diff,
      })
    }
  }

  return diferenças.sort((a, b) => b.diferenca - a.diferenca)
}
