/**
 * REFERÊNCIA OFICIAL DE KAURI-BUTANOL (KB)
 * FONTE: Propriedades dos Solventes - Astana Química
 * Atualizado: 2026-06-16
 *
 * ⚠️ CRÍTICO: Esta é a ÚNICA fonte de verdade para sugestões de solventes.
 * A IA DEVE usar APENAS solventes listados aqui com KB > 100 quando
 * há solvente forte (KB > 100) já na fórmula.
 */

export interface SolventKBData {
  name: string
  commonNames?: string[]
  kb: number | null
  category: "muito-forte" | "forte" | "moderado" | "fraco" | "muito-fraco"
  type: "aromático" | "clorado" | "álcool" | "glicol" | "cetona" | "éster" | "outro"
  notes?: string
}

export const SOLVENTS_KB_REFERENCE: Record<string, SolventKBData> = {
  // ========== SOLVENTES SUPER FORTES (KB >500) ==========
  "elsol-nmpr": { name: "Elsol NMPR", kb: 600, category: "muito-forte", type: "outro", notes: "SOLVENTE EXTREMAMENTE FORTE" },
  "tetrahidrofurano": { name: "Tetrahidrofurano", kb: 579, category: "muito-forte", type: "outro", notes: "SOLVENTE ULTRA FORTE KB >579" },
  "lactato-etila": { name: "Lactato de Etila", kb: 1000, category: "muito-forte", type: "éster", notes: "SOLVENTE SUPER FORTE KB >1000" },

  // ========== SOLVENTES MUITO FORTES (KB 300-500) ==========
  "dowanol-dpm": { name: "DOWANOL DPM", kb: 500, category: "muito-forte", type: "glicol", notes: "Extremamente forte" },
  "dowanol-pm": { name: "DOWANOL PM", kb: 500, category: "muito-forte", type: "glicol", notes: "Extremamente forte" },
  "nmp": { name: "NMP (N-Metil Pirrolidona)", kb: 350, category: "muito-forte", type: "outro", notes: "Muito forte - excelente para polímeros" },
  "metanol": { name: "Metanol", kb: 380, category: "muito-forte", type: "álcool", notes: "Muito forte" },

  // ========== SOLVENTES FORTES (KB 200-300) ==========
  "butanol": { name: "Butanol", kb: 225, category: "muito-forte", type: "álcool", notes: "Forte" },
  "isopropanol": { name: "Isopropanol (IPA)", kb: 230, category: "muito-forte", type: "álcool", notes: "Forte" },
  "propanol": { name: "Propanol", kb: 250, category: "muito-forte", type: "álcool", notes: "Forte" },
  "alcohol-benzilic": { name: "Álcool Benzílico", kb: 200, category: "muito-forte", type: "outro", notes: "Muito forte" },
  "butanol-sec": { name: "2-Butanol (sec-Butanol)", kb: 195, category: "forte", type: "álcool", notes: "Forte" },

  // ========== SOLVENTES FORTE-MODERADOS (KB 100-200) ==========
  "dcm": { name: "Cloreto de Metileno (DCM)", commonNames: ["Dichloromethane"], kb: 136, category: "forte", type: "clorado", notes: "Forte" },
  "dmso": { name: "DMSO", kb: 164, category: "muito-forte", type: "outro", notes: "Forte" },
  "tce": { name: "Tricloroetileno (TCE)", kb: 129, category: "forte", type: "clorado", notes: "Forte" },
  "brometo-n-propila": { name: "Brometo de n-Propila", kb: 125, category: "forte", type: "outro", notes: "Forte" },
  "mibk": { name: "MIBK", kb: 146, category: "forte", type: "cetona", notes: "Forte" },
  "tolueno": { name: "Tolueno", commonNames: ["Toluol"], kb: 105, category: "forte", type: "aromático", notes: "Forte classico" },
  "benzeno": { name: "Benzeno", kb: 107, category: "forte", type: "aromático", notes: "Forte" },
  "acetona": { name: "Acetona", kb: 106, category: "forte", type: "cetona", notes: "Forte" },
  "xileno": { name: "Xileno", commonNames: ["Xilol"], kb: 98, category: "forte", type: "aromático", notes: "Moderado-forte" },

  // ========== SOLVENTES MODERADOS (KB 50-100) ==========
  "ab-10": { name: "AB-10", kb: 90, category: "moderado", type: "outro", notes: "Moderado" },
  "ab-9": { name: "AB-9", kb: 92, category: "moderado", type: "outro", notes: "Moderado" },
  "percloroetileno": { name: "Percloroetileno (PERC)", kb: 90, category: "moderado", type: "clorado", notes: "Moderado" },
  "acetato-etila": { name: "Acetato de Etila", kb: 88, category: "forte", type: "éster", notes: "Moderado-forte" },
  "etanol": { name: "Etanol", kb: 84.2, category: "fraco", type: "álcool", notes: "Fraco-moderado" },
  "rhodiasolv-iris": { name: "Rhodiasolv Iris", kb: 84.5, category: "moderado", type: "outro", notes: "Moderado" },
  "d-limoneno": { name: "d-Limoneno", kb: 67, category: "moderado", type: "outro", notes: "Moderado natural" },
  "ts28": { name: "TS28", kb: 77, category: "moderado", type: "outro", notes: "Moderado industrial" },
  "xylene-naphtha": { name: "Xileno/Nafta", kb: 68, category: "moderado", type: "aromático", notes: "Moderado mistura" },

  // ========== SOLVENTES FRACOS (KB 20-50) - PROIBIDOS COM SOLVENTES FORTES
  "aguarras": { name: "Aguarrás", kb: 37, category: "fraco", type: "aromático", notes: "❌ FRACO - PROIBIDO COM FORTE" },
  "nafta": { name: "Nafta", kb: 34, category: "fraco", type: "aromático", notes: "❌ FRACO - PROIBIDO COM FORTE" },
  "petroleum-naphtha": { name: "Petroleum Naphtha", kb: 38, category: "fraco", type: "aromático", notes: "❌ FRACO - PROIBIDO COM FORTE" },
  "mineral-spirits": { name: "Mineral Spirits", kb: 37, category: "fraco", type: "aromático", notes: "❌ FRACO - PROIBIDO COM FORTE" },
  "querosene": { name: "Querosene", kb: 34, category: "fraco", type: "aromático", notes: "❌ FRACO - PROIBIDO" },
  "solvente-borracha": { name: "Solvente para Borracha", kb: 28, category: "fraco", type: "aromático", notes: "❌ FRACO - PROIBIDO" },

  // ========== SOLVENTES MUY FRACOS (KB <20) - SEMPRE PROIBIDOS
  "butilglicol": { name: "Butilglicol", kb: null, category: "fraco", type: "glicol", notes: "❌ FRACO - ABSOLUTAMENTE PROIBIDO" },
  "propilenoglicol": { name: "Propilenoglicol", kb: null, category: "fraco", type: "glicol", notes: "❌ FRACO - PROIBIDO" },
  "etilenoglicol": { name: "Etilenoglicol", kb: null, category: "fraco", type: "glicol", notes: "❌ FRACO - PROIBIDO" },
  "agua": { name: "Água", kb: 0, category: "muito-fraco", type: "outro", notes: "Não é solvente" }
}

/**
 * VALIDAÇÃO CRÍTICA: Se há solvente forte (KB >100), APENAS estes são permitidos
 */
export const APPROVED_SOLVENTS_FOR_STRONG = [
  "elsol-nmpr", "tetrahidrofurano", "lactato-etila",
  "dowanol-dpm", "dowanol-pm", "nmp", "metanol",
  "butanol", "isopropanol", "propanol", "alcohol-benzilic", "butanol-sec",
  "dcm", "dmso", "tce", "brometo-n-propila", "mibk",
  "tolueno", "benzeno", "acetona"
]

/**
 * SOLVENTES ABSOLUTAMENTE PROIBIDOS quando há solvente forte
 */
export const BANNED_SOLVENTS_WITH_STRONG = [
  "butilglicol", "nafta", "petroleum-naphtha", "mineral-spirits",
  "aguarras", "querosene", "solvente-borracha",
  "propilenoglicol", "etilenoglicol"
]

/**
 * VALIDAÇÃO OBRIGATÓRIA: Verifica se solvente pode ser sugerido com solvente forte
 */
export function isSolventApprovedForStrong(solventName: string, mainSolventKB: number | null): boolean {
  if (!mainSolventKB || mainSolventKB <= 100) return true // Sem restrição se não há solvente forte

  const lowerName = solventName.toLowerCase()
  const isBanned = BANNED_SOLVENTS_WITH_STRONG.some(s =>
    lowerName.includes(s) ||
    Object.values(SOLVENTS_KB_REFERENCE).some(sv =>
      sv.name.toLowerCase() === lowerName && BANNED_SOLVENTS_WITH_STRONG.includes(s)
    )
  )

  return !isBanned // Retorna true se NÃO está na lista de banidos
}

/**
 * LISTA para IA consultar: Solventes recomendados quando há solvente forte
 */
export function getApprovedSolventsTable(): string {
  return `
TABELA OFICIAL DE SOLVENTES APROVADOS (KB > 100 - Uso obrigatório com solvente forte existente):
- Elsol NMPR (KB 600) ✅
- Tetrahidrofurano (KB 579) ✅
- Lactato de Etila (KB 1000) ✅
- DOWANOL DPM (KB 500) ✅
- DOWANOL PM (KB 500) ✅
- NMP (KB 350) ✅
- Metanol (KB 380) ✅
- Butanol (KB 225) ✅
- Isopropanol (KB 230) ✅
- Propanol (KB 250) ✅
- Álcool Benzílico (KB 200) ✅
- 2-Butanol (KB 195) ✅
- Cloreto de Metileno DCM (KB 136) ✅
- DMSO (KB 164) ✅
- Tricloroetileno TCE (KB 129) ✅
- Brometo de n-Propila (KB 125) ✅
- MIBK (KB 146) ✅
- Tolueno (KB 105) ✅
- Benzeno (KB 107) ✅
- Acetona (KB 106) ✅

SOLVENTES ABSOLUTAMENTE PROIBIDOS com solvente forte (KB >100):
❌ Butilglicol (KB ~30) - NÃO USE
❌ Nafta (KB 34) - NÃO USE
❌ Mineral Spirits (KB 37) - NÃO USE
❌ Aguarrás (KB 37) - NÃO USE
❌ Petroleum Naphtha (KB 38) - NÃO USE
❌ Querosene (KB 34) - NÃO USE
❌ Propilenoglicol - NÃO USE
❌ Etilenoglicol - NÃO USE
`
}
