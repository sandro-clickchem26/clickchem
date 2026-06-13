// Regras de compatibilidade química para análise combinatória de formulações

export interface RegraIngrediente {
  nome: string
  faixaConcentracaoMin: number // percentual mínimo
  faixaConcentracaoMax: number // percentual máximo
  categoria: string
  incompatibilidades: string[] // nomes de ingredientes incompatíveis
  restricoesPhMin?: number
  restricoesPhMax?: number
}

export interface RegraSegmento {
  nome: string
  phMinimo: number
  phMaximo: number
  viscosidadeMinima?: number // em cP
  viscosidadeMaxima?: number
  ingredientesObrigatorios?: string[] // devem estar presentes
}

// Matriz de incompatibilidades entre ingredientes
const INCOMPATIBILIDADES: Record<string, string[]> = {
  // Ácidos não misturar com bases fortes
  'ácido cítrico': ['hidróxido de sódio', 'carbonato de sódio'],
  'ácido acético': ['hidróxido de sódio', 'carbonato de sódio'],

  // Surfactantes iônicos e não-iônicos geralmente compatíveis
  // mas alguns anônicos incompatíveis com catiônicos
  'lauril sulfato de sódio': ['cloreto de cetiltrimetilamônio'],
  'dodecilbenzeno sulfonato de sódio': ['cloreto de cetiltrimetilamônio'],

  // Conservantes incompatíveis com certos quelantes
  'benzoato de sódio': ['EDTA'],

  // D-limoneno incompatível com alguns polímeros
  'd-limoneno': ['alguns polímeros sensíveis'],
}

// Faixas de concentração por ingrediente
const FAIXAS_CONCENTRACAO: Record<string, RegraIngrediente> = {
  'ácido cítrico': {
    nome: 'ácido cítrico',
    faixaConcentracaoMin: 0.1,
    faixaConcentracaoMax: 15,
    categoria: 'acidulante',
    incompatibilidades: ['hidróxido de sódio', 'carbonato de sódio'],
  },
  'hidróxido de sódio': {
    nome: 'hidróxido de sódio',
    faixaConcentracaoMin: 0.1,
    faixaConcentracaoMax: 10,
    categoria: 'base',
    incompatibilidades: ['ácido cítrico', 'ácido acético'],
    restricoesPhMin: 9,
  },
  'lauril sulfato de sódio': {
    nome: 'lauril sulfato de sódio',
    faixaConcentracaoMin: 2,
    faixaConcentracaoMax: 30,
    categoria: 'tensoativo aniônico',
    incompatibilidades: ['cloreto de cetiltrimetilamônio'],
  },
  'd-limoneno': {
    nome: 'd-limoneno',
    faixaConcentracaoMin: 5,
    faixaConcentracaoMax: 50,
    categoria: 'solvente natural',
    incompatibilidades: [],
  },
  'glicerina': {
    nome: 'glicerina',
    faixaConcentracaoMin: 0,
    faixaConcentracaoMax: 20,
    categoria: 'umectante',
    incompatibilidades: [],
  },
  'água': {
    nome: 'água',
    faixaConcentracaoMin: 30,
    faixaConcentracaoMax: 95,
    categoria: 'solvente',
    incompatibilidades: [],
  },
}

// Regras por segmento
const REGRAS_SEGMENTO: Record<string, RegraSegmento> = {
  'Biosolventes, Biolubrificantes e Biodiesel': {
    nome: 'Biosolventes, Biolubrificantes e Biodiesel',
    phMinimo: 4,
    phMaximo: 10,
    viscosidadeMinima: 10,
    viscosidadeMaxima: 500,
  },
  'Tintas e Vernizes': {
    nome: 'Tintas e Vernizes',
    phMinimo: 2,
    phMaximo: 10,
  },
  'Resinas Poliéster': {
    nome: 'Resinas Poliéster',
    phMinimo: 3,
    phMaximo: 9,
  },
  'Tensoativos': {
    nome: 'Tensoativos',
    phMinimo: 3,
    phMaximo: 11,
  },
}

/**
 * Valida se uma composição respeita as regras de compatibilidade
 */
export function validarCompatibilidade(
  composicao: Record<string, number>, // {ingrediente: concentração}
  segmento: string,
  phFinal?: number,
  viscosidade?: number
): { valido: boolean; erro?: string } {
  try {
    // Validar soma total de concentrações
    const totalConcentracao = Object.values(composicao).reduce((a, b) => a + b, 0)
    if (Math.abs(totalConcentracao - 100) > 1) {
      return {
        valido: false,
        erro: `Concentração total deve ser 100%. Atual: ${totalConcentracao.toFixed(1)}%`,
      }
    }

    // Validar cada ingrediente individualmente
    for (const [ingrediente, concentracao] of Object.entries(composicao)) {
      const regra = FAIXAS_CONCENTRACAO[ingrediente]
      if (regra) {
        if (concentracao < regra.faixaConcentracaoMin || concentracao > regra.faixaConcentracaoMax) {
          return {
            valido: false,
            erro: `${ingrediente}: concentração ${concentracao}% fora do intervalo [${regra.faixaConcentracaoMin}%-${regra.faixaConcentracaoMax}%]`,
          }
        }
      }
    }

    // Validar incompatibilidades
    const ingredientes = Object.keys(composicao)
    for (const ingrediente of ingredientes) {
      const incomp = INCOMPATIBILIDADES[ingrediente] || []
      for (const incompativel of incomp) {
        if (ingredientes.includes(incompativel)) {
          return {
            valido: false,
            erro: `Incompatibilidade detectada: ${ingrediente} não é compatível com ${incompativel}`,
          }
        }
      }
    }

    // Validar pH se fornecido
    if (phFinal !== undefined) {
      const regraSegmento = REGRAS_SEGMENTO[segmento]
      if (regraSegmento) {
        if (phFinal < regraSegmento.phMinimo || phFinal > regraSegmento.phMaximo) {
          return {
            valido: false,
            erro: `pH ${phFinal} fora do intervalo para ${segmento} [${regraSegmento.phMinimo}-${regraSegmento.phMaximo}]`,
          }
        }
      }
    }

    // Validar viscosidade se fornecida
    if (viscosidade !== undefined) {
      const regraSegmento = REGRAS_SEGMENTO[segmento]
      if (regraSegmento && regraSegmento.viscosidadeMinima && regraSegmento.viscosidadeMaxima) {
        if (viscosidade < regraSegmento.viscosidadeMinima || viscosidade > regraSegmento.viscosidadeMaxima) {
          return {
            valido: false,
            erro: `Viscosidade ${viscosidade}cP fora do intervalo para ${segmento}`,
          }
        }
      }
    }

    return { valido: true }
  } catch (erro) {
    return {
      valido: false,
      erro: `Erro ao validar: ${erro instanceof Error ? erro.message : String(erro)}`,
    }
  }
}

/**
 * Retorna faixas de concentração permitidas para um ingrediente
 */
export function obterFaixaConcentracao(ingrediente: string): RegraIngrediente | undefined {
  return FAIXAS_CONCENTRACAO[ingrediente]
}

/**
 * Retorna regras de pH/viscosidade para um segmento
 */
export function obterRegrasSegmento(segmento: string): RegraSegmento | undefined {
  return REGRAS_SEGMENTO[segmento]
}

/**
 * Lista ingredientes incompatíveis com um dado ingrediente
 */
export function obterIncompatibilidades(ingrediente: string): string[] {
  return INCOMPATIBILIDADES[ingrediente] || []
}

/**
 * Retorna todos os ingredientes conhecidos
 */
export function obterTodosIngredientes(): string[] {
  return Object.keys(FAIXAS_CONCENTRACAO)
}
