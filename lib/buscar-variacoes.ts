import { prisma } from './db'

export interface VariacoesMPs {
  tensoativos: string[]
  solventes: string[]
  outros: string[]
}

/**
 * Busca variações de MPs disponíveis no banco P&D para um segmento específico
 * Extrai diferentes matérias-primas usadas em fórmulas similares
 */
export async function buscarVariacoesMPs(segmento: string): Promise<VariacoesMPs> {
  try {
    console.log(`[buscarVariacoesMPs] Buscando fórmulas para segmento: "${segmento}"`)

    // Buscar TODAS as fórmulas ativas deste segmento (case-insensitive)
    const formulas = await prisma.formulaProprietaria.findMany({
      where: {
        segmento: {
          mode: 'insensitive',
          equals: segmento
        },
        ativa: true
      }
    })

    console.log(`[buscarVariacoesMPs] Fórmulas encontradas: ${formulas.length}`)

    // Se não encontrou, tentar busca com contains
    if (formulas.length === 0) {
      console.log(`[buscarVariacoesMPs] Nenhuma fórmula encontrada com match exato, tentando contains...`)

      // Tentar sem filtro ativa - buscar tudo o que contém o segmento
      const formulasContainsSemFiltro = await prisma.formulaProprietaria.findMany({
        where: {
          segmento: {
            contains: segmento,
            mode: 'insensitive'
          }
        },
        take: 50
      })
      console.log(`[buscarVariacoesMPs] Contains "${segmento}" encontrou: ${formulasContainsSemFiltro.length}`)

      // Também tentar with just "Limpeza" if  searching for "Limpeza e Manutenção"
      if (formulasContainsSemFiltro.length === 0 && segmento.includes('Limpeza')) {
        console.log(`[buscarVariacoesMPs] Tentando busca simplificada: "Limpeza"`)
        const formulasLimpeza = await prisma.formulaProprietaria.findMany({
          where: {
            segmento: {
              contains: 'Limpeza',
              mode: 'insensitive'
            }
          },
          take: 50
        })
        console.log(`[buscarVariacoesMPs] Busca por "Limpeza" encontrou: ${formulasLimpeza.length}`)
        const formulasAtivas = formulasLimpeza.filter(f => f.ativa)
        console.log(`[buscarVariacoesMPs] Dessas, ${formulasAtivas.length} estão ativas`)
        return extrairMPsDeFórmulas(formulasAtivas, segmento)
      }

      const formulasContains = formulasContainsSemFiltro.filter(f => f.ativa)
      console.log(`[buscarVariacoesMPs] Dessas, ${formulasContains.length} estão ativas`)
      return extrairMPsDeFórmulas(formulasContains, segmento)
    }

    return extrairMPsDeFórmulas(formulas, segmento)
  } catch (err) {
    console.error('Erro ao buscar variações de MPs:', err)
    return {
      tensoativos: [],
      solventes: [],
      outros: []
    }
  }
}

/**
 * Extrai MPs das fórmulas encontradas
 */
function extrairMPsDeFórmulas(
  formulas: any[],
  segmento: string
): VariacoesMPs {
  const tensoativos = new Set<string>()
  const solventes = new Set<string>()
  const outros = new Set<string>()

  console.log(`[extrairMPsDeFórmulas] Processando ${formulas.length} fórmulas para "${segmento}"`)

  // Extrair MPs de cada fórmula
  for (let i = 0; i < Math.min(3, formulas.length); i++) {
    const formula = formulas[i]
    console.log(`[extrairMPsDeFórmulas] DEBUG Fórmula ${i}: nome="${formula.nome_interno}", composicao type="${typeof formula.composicao}", length=${formula.composicao?.length}`)
  }

  for (let idx = 0; idx < formulas.length; idx++) {
    const formula = formulas[idx]
    try {
      const composicao = JSON.parse(formula.composicao) as any

      // A composição é um ARRAY de objetos com {materia_prima, percentual, funcao}
      if (!Array.isArray(composicao)) {
        console.warn(`[extrairMPsDeFórmulas] AVISO: Composição esperada é array, recebida: ${typeof composicao}`)
        continue
      }

      for (const item of composicao) {
        const mp = item.materia_prima as string
        if (!mp) continue

        const mpLower = mp.toLowerCase()

        // Classificar com busca mais ampla
        if (
          mpLower.includes('tensoativo') ||
          mpLower.includes('surfactante') ||
          mpLower.includes('emulsificante') ||
          mpLower.includes('bio-soft') ||
          mpLower.includes('stepan') ||
          mpLower.includes('sulfato') ||
          mpLower.includes('alquil') ||
          mpLower.includes('sabão') ||
          mpLower.includes('sabao') ||
          mpLower.includes('noniônico') ||
          mpLower.includes('nonionico') ||
          mpLower.includes('aniônico') ||
          mpLower.includes('anionico')
        ) {
          tensoativos.add(mp)
        } else if (
          mpLower.includes('solvente') ||
          mpLower.includes('steposol') ||
          mpLower.includes('limoneno') ||
          mpLower.includes('tolueno') ||
          mpLower.includes('xileno') ||
          mpLower.includes('nafta') ||
          mpLower.includes('álcool') ||
          mpLower.includes('alcool') ||
          mpLower.includes('glicol') ||
          mpLower.includes('querosene') ||
          mpLower.includes('parafina') ||
          mpLower.includes('alifático') ||
          mpLower.includes('alifatico')
        ) {
          solventes.add(mp)
        } else {
          // Também adicionar tudo à lista geral para force variation
          outros.add(mp)
        }
      }
    } catch {
      // Ignorar fórmulas com composição inválida
    }
  }

  console.log(`[extrairMPsDeFórmulas] Segmento: ${segmento}`)
  console.log(`[extrairMPsDeFórmulas] Total MPs encontradas: ${tensoativos.size + solventes.size + outros.size}`)
  console.log(`[extrairMPsDeFórmulas] Tensoativos: ${tensoativos.size}, Solventes: ${solventes.size}, Outros: ${outros.size}`)
  console.log(`[extrairMPsDeFórmulas] Exemplos - Tensoativos:`, Array.from(tensoativos).slice(0, 3))
  console.log(`[extrairMPsDeFórmulas] Exemplos - Solventes:`, Array.from(solventes).slice(0, 3))
  console.log(`[extrairMPsDeFórmulas] Exemplos - Outros:`, Array.from(outros).slice(0, 3))

  // Converter Sets para Arrays
  return {
    tensoativos: Array.from(tensoativos),
    solventes: Array.from(solventes),
    outros: Array.from(outros)
  }
}

/**
 * FORÇA AGRESSIVA substituição de MPs repetidas para garantir variação REAL
 * Substitui QUALQUER MP que já foi usada por alternativas diferentes
 */
export function forcarVariacaoMPs(
  composicao: Array<{ materia_prima: string; percentual: number; justificativa?: string }>,
  tensoativosDisponiveis: string[] = [],
  solvEntesDisponiveis: string[] = [],
  ultimasComposicoes: Array<{ materia_prima: string }[]> = [],
  outrosDisponiveis: string[] = []
): Array<{ materia_prima: string; percentual: number; justificativa?: string }> {

  if (!composicao || composicao.length === 0) return composicao

  // Extrair base (marca) das MPs já usadas nas últimas fórmulas
  const basesJaUsadas = new Set<string>()
  for (const comp of ultimasComposicoes.flat()) {
    const base = extrairBaseMP(comp.materia_prima)
    basesJaUsadas.add(base)
  }

  console.log(`[forcarVariacaoMPs] Bases já usadas:`, Array.from(basesJaUsadas))
  console.log(`[forcarVariacaoMPs] Tensoativos disponíveis: ${tensoativosDisponiveis.length}`)
  console.log(`[forcarVariacaoMPs] Solventes disponíveis: ${solvEntesDisponiveis.length}`)
  console.log(`[forcarVariacaoMPs] Outros disponíveis: ${outrosDisponiveis.length}`)

  // Agrupar por tipo de MP
  const todosDisponiveis = {
    tensoativos: tensoativosDisponiveis.map(t => ({ mp: t, tipo: 'tensoativo' })),
    solventes: solvEntesDisponiveis.map(s => ({ mp: s, tipo: 'solvente' })),
    outros: outrosDisponiveis.map(o => ({ mp: o, tipo: 'outro' }))
  }

  // Forçar substituição AGRESSIVA
  const novaComposicao = composicao.map(comp => {
    const baseAtual = extrairBaseMP(comp.materia_prima)
    let mpSubstituida = false
    let mpNova = comp.materia_prima

    // Se a base já foi usada, OBRIGATORIAMENTE substituir
    if (basesJaUsadas.has(baseAtual)) {
      console.log(`[forcarVariacaoMPs] MP "${comp.materia_prima}" já foi usada (base: ${baseAtual}), procurando substituto...`)

      // Buscar alternativa que NÃO tenha a mesma base
      const alternativasDisponiveis = [
        ...todosDisponiveis.tensoativos,
        ...todosDisponiveis.solventes,
        ...todosDisponiveis.outros
      ]

      for (const alt of alternativasDisponiveis) {
        const baseAlt = extrairBaseMP(alt.mp)

        // Substituir se:
        // 1. A base é diferente (evita usar mesma marca)
        // 2. Ainda não foi usada
        if (baseAlt !== baseAtual && !basesJaUsadas.has(baseAlt)) {
          mpNova = alt.mp
          mpSubstituida = true
          console.log(`[forcarVariacaoMPs] ✅ Substituída: "${comp.materia_prima}" → "${mpNova}"`)
          break
        }
      }

      if (!mpSubstituida) {
        // Se não conseguir encontrar alternativa SEM usar base conhecida, usar qualquer uma diferente
        const alternativasQualquer = [
          ...todosDisponiveis.tensoativos,
          ...todosDisponiveis.solventes,
          ...todosDisponiveis.outros
        ].filter(alt => extrairBaseMP(alt.mp) !== baseAtual)

        if (alternativasQualquer.length > 0) {
          // Pegar a primeira que seja diferente
          mpNova = alternativasQualquer[0].mp
          mpSubstituida = true
          console.log(`[forcarVariacaoMPs] ✅ Substituída (fallback): "${comp.materia_prima}" → "${mpNova}"`)
        }
      }
    }

    if (mpSubstituida) {
      // Recalcular percentual para manter soma = 100%
      return {
        ...comp,
        materia_prima: mpNova,
        justificativa: `[VARIAÇÃO FORÇADA] Substituída para garantir fórmula diferente`
      }
    }

    return comp
  })

  const quantidadeVariada = novaComposicao.filter((_, i) => novaComposicao[i].materia_prima !== composicao[i].materia_prima).length
  console.log(`[forcarVariacaoMPs] Total de MPs variadas: ${quantidadeVariada}/${composicao.length}`)

  return novaComposicao
}

/**
 * Extrai a MARCA/BASE de uma MP (ex: "STEPOSOL" de "STEPOSOL® SC (Solvente...)")
 * Considera "STEPOSOL SB-W" como mesma marca que "STEPOSOL SC"
 */
function extrairBaseMP(mp: string): string {
  // Extrair primeira palavra (antes de ®, espaço ou parêntese)
  const match = mp.match(/^([A-Za-z0-9\-]+)/i)
  const base = match ? match[1].toUpperCase() : mp.toUpperCase()
  return base
}
