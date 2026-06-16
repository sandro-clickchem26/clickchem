/**
 * Referência de Kauri-Butanol (KB) para solventes
 * Fonte: Base técnica de propriedades de solventes + Cloverdale Paint
 *
 * KB classifica a força do solvente (capacidade de dissolução):
 * - KB >150: Muito Forte (DCM, Álcool Benzílico, DMSO)
 * - KB 100-150: Forte (Tolueno, Xileno, Acetona, TCE)
 * - KB 50-100: Moderado (Butilglicol, Ésteres)
 * - KB 20-50: Fraco (Álcoois, Glicóis)
 * - KB <20: Muito Fraco (Água)
 */

export interface SolventKBData {
  name: string;
  commonNames?: string[];
  kb: number | null;
  category: "muito-forte" | "forte" | "moderado" | "fraco" | "muito-fraco";
  type: "aromático" | "clorado" | "álcool" | "glicol" | "cetona" | "éster" | "outro";
  notes?: string;
}

export const SOLVENTS_KB_REFERENCE: Record<string, SolventKBData> = {
  // ========== MUITO FORTE (KB >150) ==========
  "alcohol-benzilic": {
    name: "Álcool Benzílico",
    kb: 200,
    category: "muito-forte",
    type: "outro",
    notes: "Excelente poder de solvência, aplicação em vernizes e lacas"
  },
  "dcm": {
    name: "Cloreto de Metileno (DCM)",
    commonNames: ["Methylene Chloride"],
    kb: 136,
    category: "forte",
    type: "clorado",
    notes: "Solvente clorado muito agressivo, para limpeza e remoção"
  },
  "dmso": {
    name: "DMSO (Dimetilsulfóxido)",
    kb: 164,
    category: "muito-forte",
    type: "outro",
    notes: "Excelente poder de dissolução, penetração profunda"
  },
  "dowanol-dpm": {
    name: "DOWANOL DPM",
    kb: 500,
    category: "muito-forte",
    type: "glicol",
    notes: "Solvente extremamente forte, para aplicações especiais"
  },
  "dowanol-pm": {
    name: "DOWANOL PM",
    kb: 500,
    category: "muito-forte",
    type: "glicol",
    notes: "Solvente extremamente forte, compatível com lacas"
  },
  "elsol-nmpr": {
    name: "Elsol NMPR",
    kb: 600,
    category: "muito-forte",
    type: "outro",
    notes: "Solvente propriedade de alta solvência"
  },
  "nmp": {
    name: "NMP (N-Metil Pirrolidona)",
    kb: 350,
    category: "muito-forte",
    type: "outro",
    notes: "Excelente para borrachas e polímeros"
  },
  "metanol": {
    name: "Metanol",
    kb: 380,
    category: "muito-forte",
    type: "álcool",
    notes: "Álcool com excelente solvência, evaporação rápida"
  },
  "tetrahidrofurano": {
    name: "Tetrahidrofurano (THF)",
    kb: 579,
    category: "muito-forte",
    type: "outro",
    notes: "Solvente EXTREMAMENTE forte, para lacas especiais"
  },

  // ========== FORTE (KB 100-150) ==========
  "tolueno": {
    name: "Tolueno",
    commonNames: ["Toluol"],
    kb: 105,
    category: "forte",
    type: "aromático",
    notes: "Solvente aromático, excelente para enamels e primers"
  },
  "xileno": {
    name: "Xileno",
    commonNames: ["Xilol"],
    kb: 98,
    category: "forte",
    type: "aromático",
    notes: "Solvente aromático similar ao tolueno, uso industrial"
  },
  "acetona": {
    name: "Acetona",
    kb: 106,
    category: "forte",
    type: "cetona",
    notes: "Cetona com alto poder de dissolução, evaporação muito rápida"
  },
  "tce": {
    name: "Tricloroetileno (TCE)",
    commonNames: ["Tricloroethylene"],
    kb: 129,
    category: "forte",
    type: "clorado",
    notes: "Solvente clorado forte, para limpeza profunda"
  },
  "mibk": {
    name: "MIBK (Metil Isobutil Cetona)",
    kb: 146,
    category: "forte",
    type: "cetona",
    notes: "Cetona para aplicações de alto desempenho"
  },
  "butanol": {
    name: "Butanol",
    commonNames: ["n-Butanol"],
    kb: 225,
    category: "muito-forte",
    type: "álcool",
    notes: "Álcool com poder de solvência elevado"
  },
  "isopropanol": {
    name: "Isopropanol (IPA)",
    commonNames: ["2-Propanol"],
    kb: 230,
    category: "muito-forte",
    type: "álcool",
    notes: "Álcool com boa solvência, evaporação moderada"
  },
  "propanol": {
    name: "Propanol",
    commonNames: ["n-Propanol"],
    kb: 250,
    category: "muito-forte",
    type: "álcool",
    notes: "Álcool com poder de solvência bom"
  },
  "benzeno": {
    name: "Benzeno",
    kb: 107,
    category: "forte",
    type: "aromático",
    notes: "Solvente aromático (uso histórico, restrito)"
  },
  "brometo-n-propila": {
    name: "Brometo de n-Propila",
    kb: 125,
    category: "forte",
    type: "outro",
    notes: "Solvente halogenado para lacas"
  },

  // ========== MODERADO (KB 50-100) ==========
  "dbe": {
    name: "DBE (Dibasic Ester)",
    kb: null,
    category: "moderado",
    type: "éster",
    notes: "Éster com poder moderado, para lacas"
  },
  "eep": {
    name: "EEP (2-Etoxietil Acetato)",
    kb: null,
    category: "moderado",
    type: "éster",
    notes: "Éster com evaporação lenta"
  },
  "percloroetileno": {
    name: "Percloroetileno (PERC)",
    kb: 90,
    category: "moderado",
    type: "clorado",
    notes: "Solvente clorado, limpeza a seco"
  },
  "d-limoneno": {
    name: "d-Limoneno",
    kb: 67,
    category: "moderado",
    type: "outro",
    notes: "Solvente natural, para desengordurante"
  },
  "ts28": {
    name: "TS28 (Thinner)",
    kb: 77,
    category: "moderado",
    type: "outro",
    notes: "Solvente industrial moderado"
  },
  "xylene-naphtha": {
    name: "Xileno/Nafta (mistura)",
    kb: 68,
    category: "moderado",
    type: "aromático",
    notes: "Mistura aromática/alifática"
  },

  // ========== FRACO (KB 20-50) ==========
  "butilglicol": {
    name: "Butilglicol",
    commonNames: ["Butil Glicol", "2-Butoxietanol"],
    kb: null,
    category: "fraco",
    type: "glicol",
    notes: "Glicol fraco, agente de penetração e emulsificante"
  },
  "etanol": {
    name: "Etanol",
    commonNames: ["Álcool Etílico"],
    kb: 84.2,
    category: "fraco",
    type: "álcool",
    notes: "Álcool com solvência moderada"
  },
  "nafta": {
    name: "Nafta",
    kb: 34,
    category: "fraco",
    type: "aromático",
    notes: "Hidrocarboneto alifático, evaporação muito rápida"
  },
  "querosene": {
    name: "Querosene",
    kb: 34,
    category: "fraco",
    type: "aromático",
    notes: "Solvente alifático leve"
  },
  "mineral-spirits": {
    name: "Mineral Spirits",
    kb: 37,
    category: "fraco",
    type: "aromático",
    notes: "Solvente destilado, para tintas arquitetônicas"
  },
  "mineral-spirits-low-odor": {
    name: "Low Odour Mineral Spirits",
    kb: 32.5,
    category: "fraco",
    type: "aromático",
    notes: "Mineral spirits com odor reduzido"
  },
  "petroleum-naphtha": {
    name: "Petroleum Naphtha",
    kb: 38,
    category: "fraco",
    type: "aromático",
    notes: "Nafta de petróleo, evaporação muito rápida"
  },
  "solvente-borracha": {
    name: "Solvente para Borracha",
    kb: 28,
    category: "fraco",
    type: "aromático",
    notes: "Solvente específico para borrachas"
  },
  "aguarras": {
    name: "Aguarrás (Turpentine)",
    kb: 37,
    category: "fraco",
    type: "aromático",
    notes: "Solvente natural de resinas"
  },
  "propilenoglicol": {
    name: "Propilenoglicol",
    kb: null,
    category: "fraco",
    type: "glicol",
    notes: "Glicol com solvência baixa, agente penetrador"
  },
  "etilenoglicol": {
    name: "Etilenoglicol",
    kb: null,
    category: "fraco",
    type: "glicol",
    notes: "Glicol com solvência muito baixa"
  },

  // ========== MUITO FRACO (KB <20) ==========
  "agua": {
    name: "Água",
    kb: 0,
    category: "muito-fraco",
    type: "outro",
    notes: "Não é solvente para a maioria das aplicações químicas"
  }
};

/**
 * Classifica a força do solvente baseado no KB
 */
export function getSolventStrengthCategory(kb: number | null): string {
  if (kb === null) return "desconhecido";
  if (kb > 150) return "muito-forte";
  if (kb >= 100) return "forte";
  if (kb >= 50) return "moderado";
  if (kb >= 20) return "fraco";
  return "muito-fraco";
}

/**
 * Retorna solventes fortes (KB > 100) que podem complementar um solvente fraco
 */
export function getStrongSolvents(): SolventKBData[] {
  return Object.values(SOLVENTS_KB_REFERENCE)
    .filter(s => s.kb !== null && s.kb > 100)
    .sort((a, b) => (b.kb as number) - (a.kb as number));
}

/**
 * Retorna solventes fracos (KB < 50) que podem ser agentes penetradores
 */
export function getWeakSolvents(): SolventKBData[] {
  return Object.values(SOLVENTS_KB_REFERENCE)
    .filter(s => s.kb !== null && s.kb < 50)
    .sort((a, b) => (b.kb as number) - (a.kb as number));
}

/**
 * Procura um solvente pela base de dados
 */
export function findSolvent(query: string): SolventKBData | null {
  const lower = query.toLowerCase();

  // Procura por nome exato
  const found = Object.values(SOLVENTS_KB_REFERENCE).find(
    s => s.name.toLowerCase() === lower ||
         s.commonNames?.some(cn => cn.toLowerCase() === lower)
  );

  if (found) return found;

  // Procura por nome parcial
  return Object.values(SOLVENTS_KB_REFERENCE).find(
    s => s.name.toLowerCase().includes(lower) ||
         s.commonNames?.some(cn => cn.toLowerCase().includes(lower))
  ) || null;
}
