import Anthropic from '@anthropic-ai/sdk'
import { jsonrepair } from 'jsonrepair'
import { SYSTEM_PROMPT, buildFormulacaoPrompt, buildAnalisePrompt, buildTendenciasPrompt } from './prompts'
import { prisma } from './db'
import fs from 'fs'
import path from 'path'

// Lê variável do .env diretamente via fs — bypassa qualquer comportamento do Turbopack
function readDotEnv(varName: string): string {
  try {
    const envPath = path.join(process.cwd(), '.env')
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n')
    for (const line of lines) {
      const m = line.trim().match(/^([^=]+)=(.*)$/)
      if (m && m[1].trim() === varName) {
        return m[2].trim().replace(/^["']|["']$/g, '')
      }
    }
  } catch { /* ignore */ }
  return ''
}

let _anthropicClient: Anthropic | null = null

function getClient(): Anthropic {
  if (!_anthropicClient) {
    const key = (process.env.ANTHROPIC_API_KEY || readDotEnv('ANTHROPIC_API_KEY')).trim().replace(/^["']|["']$/g, '')
    if (!key) throw new Error('ANTHROPIC_API_KEY não configurada no .env')
    _anthropicClient = new Anthropic({ apiKey: key })
  }
  return _anthropicClient
}

function getModel(): string {
  return (process.env.CLAUDE_MODEL || readDotEnv('CLAUDE_MODEL') || 'claude-3-5-haiku-20241022').trim().replace(/^["']|["']$/g, '')
}

function extractJSON(text: string): unknown {
  // Remove markdown code blocks if present
  const stripped = text.replace(/```(?:json)?\s*/g, '').replace(/```\s*/g, '').trim()

  // Find start of first JSON object
  const start = stripped.indexOf('{')
  if (start === -1) throw new Error('IA não retornou JSON válido')

  // Find end by counting balanced braces from start
  let depth = 0
  let end = -1
  for (let i = start; i < stripped.length; i++) {
    if (stripped[i] === '{') depth++
    else if (stripped[i] === '}') {
      depth--
      if (depth === 0) { end = i; break }
    }
  }

  const candidate = end !== -1 ? stripped.slice(start, end + 1) : stripped.slice(start)

  try {
    return JSON.parse(jsonrepair(candidate))
  } catch {
    throw new Error('IA não retornou JSON válido')
  }
}

async function buildMPContext(segmento: string, restricoes: string[] = []): Promise<string> {
  try {
    const mps = await prisma.materiaPrima.findMany({
      where: {
        disponibilidade: { in: ['alta', 'media'] },
        NOT: restricoes.length > 0 ? { nome_comercial: { in: restricoes } } : undefined,
      },
      take: 25,
      orderBy: { disponibilidade: 'asc' },
    })

    return mps
      .map(mp => `- ${mp.nome_comercial} (${mp.funcao_principal}): uso ${mp.faixa_uso_tipica || 'variável'}, toxicidade ${mp.nivel_toxicidade}, custo R$${mp.custo_min ?? '?'}-${mp.custo_max ?? '?'}/kg`)
      .join('\n')
  } catch {
    return 'Banco de matérias-primas não disponível no momento.'
  }
}

interface ProprietaryResult {
  context: string
  mandatoryMPs: string[]  // nomes das MPs a injetar como obrigatórias (vazio se sem match forte)
}

async function buildProprietaryContext(segmento: string, descricao = ''): Promise<ProprietaryResult> {
  const vazio: ProprietaryResult = { context: '', mandatoryMPs: [] }
  try {
    const formulas = await prisma.formulaProprietaria.findMany({
      where: { ativa: true },
    })
    if (formulas.length === 0) return vazio

    // Normaliza acentos para matching robusto em português (ex: "elétrico" → "eletrico")
    const norm = (s: string) => removeAccents(s.toLowerCase())

    // Palavras-chave da descrição normalizadas (> 2 chars)
    const palavrasChave = norm(descricao).split(/\s+/).filter(w => w.length > 2)

    // Score de relevância com normalização de acentos
    const comScore = formulas.map(f => {
      let score = 0
      const textoFormula = norm(`${f.segmento} ${f.aplicacao} ${f.nome_interno} ${f.tags || ''}`)

      // Match de segmento (normalizado)
      if (norm(f.segmento).includes(norm(segmento)) ||
          norm(segmento).includes(norm(f.segmento))) score += 3

      // Match de cada palavra-chave da descrição (normalizado)
      for (const kw of palavrasChave) {
        if (textoFormula.includes(kw)) score += 2
      }

      return { formula: f, score }
    })

    comScore.sort((a, b) => b.score - a.score)

    const melhor = comScore[0]
    // Threshold 4 = segmento + pelo menos 1 palavra-chave (ex: "decapante")
    const temMatchForte = melhor && melhor.score >= 4

    if (!temMatchForte) {
      // Sem match forte: passa MPs únicas como referência leve (sem obrigatórias)
      const pool = comScore.filter(x => x.score > 0).slice(0, 3).map(x => x.formula)
      if (pool.length === 0) return vazio
      const mpSet = new Map<string, string>()
      for (const f of pool) {
        try {
          const comps = JSON.parse(f.composicao) as Array<{ materia_prima: string; funcao: string }>
          for (const c of comps) {
            if (!mpSet.has(c.materia_prima)) mpSet.set(c.materia_prima, c.funcao)
          }
        } catch { /* ignora */ }
      }
      const linhas = Array.from(mpSet.entries()).map(([mp, fn]) => `• ${mp} — ${fn}`).join('\n')
      return {
        context: `\nMPs UTILIZADAS EM PRODUTOS APROVADOS DA ASTANA (considere como candidatas):\n${linhas}\n`,
        mandatoryMPs: [],
      }
    }

    // Match forte: formula específica encontrada
    const f = melhor.formula
    let composicao: Array<{ materia_prima: string; funcao: string }> = []
    try {
      composicao = JSON.parse(f.composicao) as Array<{ materia_prima: string; funcao: string }>
    } catch { /* ignora */ }

    // Nomes das MPs para injetar como obrigatórias (sem percentuais — confidencialidade mantida)
    const mpNames = composicao.map(c => c.materia_prima).filter(Boolean)

    const linhasComp = composicao.map(c => `  • ${c.materia_prima} — ${c.funcao}`).join('\n')

    const context = `\n🔒 BASE TÉCNICA APROVADA PARA ESTE PRODUTO (banco interno Astana Química):
Aplicação: ${f.aplicacao}
Matérias-primas aprovadas e comprovadas para este tipo de produto:
${linhasComp}
${f.ph_final ? `pH alvo comprovado: ${f.ph_final}` : ''}
${f.viscosidade ? `Viscosidade esperada: ${f.viscosidade}` : ''}
${f.performance_chave ? `Performance comprovada: ${f.performance_chave}` : ''}
`

    return { context, mandatoryMPs: mpNames }
  } catch {
    return vazio
  }
}

// Extrai MPs únicas das fórmulas proprietárias para uso em análise —
// expõe apenas nome e função, SEM revelar qual fórmula usa cada MP nem seus percentuais
async function buildMPsProprietariasParaAnalise(segmento: string): Promise<string> {
  try {
    const formulas = await prisma.formulaProprietaria.findMany({
      where: { ativa: true },
    })
    if (formulas.length === 0) return ''

    // Filtra por segmento se possível, senão usa todas
    const relevantes = formulas.filter(f =>
      !segmento ||
      f.segmento.toLowerCase().includes(segmento.toLowerCase()) ||
      segmento.toLowerCase().includes(f.segmento.toLowerCase())
    )
    const pool = relevantes.length > 0 ? relevantes : formulas

    // Extrai MPs únicas agrupadas por função
    const mpMap = new Map<string, string>() // nome → funcao
    for (const f of pool) {
      try {
        const composicao = JSON.parse(f.composicao) as Array<{ materia_prima: string; funcao: string }>
        for (const c of composicao) {
          if (c.materia_prima && !mpMap.has(c.materia_prima)) {
            mpMap.set(c.materia_prima, c.funcao || 'função não especificada')
          }
        }
      } catch { /* ignora */ }
    }

    if (mpMap.size === 0) return ''

    const linhas = Array.from(mpMap.entries())
      .map(([mp, funcao]) => `• ${mp} — ${funcao}`)
      .join('\n')

    return `\nMPs UTILIZADAS EM FÓRMULAS APROVADAS DA ASTANA QUÍMICA (banco interno — use como alternativas prioritárias nas sugestões):
${linhas}\n`
  } catch {
    return ''
  }
}

async function buildDocumentosContext(segmento: string, descricao = ''): Promise<string> {
  try {
    const docs = await prisma.documentoCientifico.findMany({ where: { ativo: true } })
    if (docs.length === 0) return ''

    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const palavras = norm(descricao).split(/\s+/).filter(w => w.length > 3)

    const comScore = docs.map(doc => {
      let score = 0
      const textoDoc = norm(`${doc.segmento} ${doc.titulo} ${doc.tags} ${doc.resumo || ''}`)
      if (norm(doc.segmento).includes(norm(segmento)) || norm(segmento).includes(norm(doc.segmento))) score += 3
      for (const kw of palavras) { if (textoDoc.includes(kw)) score += 1 }
      try {
        const tags = JSON.parse(doc.tags) as string[]
        for (const tag of tags) { if (norm(descricao).includes(norm(tag))) score += 2 }
      } catch { /* ignore */ }
      return { doc, score }
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 3)

    if (comScore.length === 0) return ''

    const linhas = comScore.map(({ doc }) => {
      const trecho = doc.conteudo.slice(0, 1500).replace(/\s+/g, ' ').trim()
      const ref = [doc.autores, doc.ano, doc.fonte].filter(Boolean).join(', ')
      return `📄 "${doc.titulo}"${ref ? ` (${ref})` : ''}\n${trecho}`
    }).join('\n\n---\n\n')

    return `\n📚 DOCUMENTAÇÃO CIENTÍFICA RELEVANTE (banco interno Astana Química — use como embasamento técnico):\n${linhas}\n`
  } catch {
    return ''
  }
}

// Garante que a composição final contenha EXATAMENTE as MPs obrigatórias.
// Estratégia: faz matching de cada MP obrigatória com o componente mais parecido da IA,
// preservando os dados técnicos (%, justificativa, etc.) da IA quando encontra match.
// Componentes não associados a nenhuma MP obrigatória são descartados.
function enforcarMPsObrigatorias(resultado: unknown, obrigatorias: string[]): unknown {
  if (!obrigatorias || obrigatorias.length === 0) return resultado
  try {
    const r = resultado as Record<string, unknown>
    const formulacao = r.formulacao as Record<string, unknown>
    if (!formulacao) return resultado

    const composicao = formulacao.composicao as Array<Record<string, unknown>>
    if (!Array.isArray(composicao) || composicao.length === 0) return resultado

    const norm = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim()

    // Calcula score de similaridade entre nome do componente da IA e MP obrigatória
    function score(nomeComp: string, mpObrig: string): number {
      const a = norm(nomeComp)
      const b = norm(mpObrig)
      if (a === b) return 100
      if (a.includes(b) || b.includes(a)) return 80
      // Overlap por palavras significativas (>2 chars)
      const bWords = b.split(/\s+/).filter(w => w.length > 2)
      if (bWords.length === 0) return 0
      const matches = bWords.filter(w => a.includes(w)).length
      return Math.round((matches / bWords.length) * 60)
    }

    const usedIdx = new Set<number>()
    const composicaoFinal: Array<Record<string, unknown>> = []

    for (const mp of obrigatorias) {
      // Encontra o componente com maior score para esta MP obrigatória
      let bestIdx = -1
      let bestScore = -1
      for (let i = 0; i < composicao.length; i++) {
        if (usedIdx.has(i)) continue
        const s = score(String(composicao[i].materia_prima || ''), mp)
        if (s > bestScore) { bestScore = s; bestIdx = i }
      }

      if (bestIdx >= 0 && bestScore >= 40) {
        // Match encontrado: usa dados técnicos da IA mas com nome exato da lista
        usedIdx.add(bestIdx)
        composicaoFinal.push({ ...composicao[bestIdx], materia_prima: mp })
      } else {
        // MP obrigatória ausente ou substituída: adiciona com % proporcional como base
        const percBase = parseFloat((100 / obrigatorias.length).toFixed(2))
        composicaoFinal.push({
          materia_prima: mp,
          funcao_tecnica: 'Componente obrigatório — percentual redistribuído',
          percentual_minimo: 1.0,
          percentual_maximo: 99.0,
          percentual_recomendado: percBase,
          justificativa: 'Especificado pelo formulador. Ajuste o percentual conforme necessidade técnica.',
          alternativas: [],
          nivel_toxicidade: 'medio',
          custo_estimado_kg: 0,
          disponibilidade_comercial: 'alta',
        })
      }
    }

    return { ...r, formulacao: { ...formulacao, composicao: composicaoFinal } }
  } catch {
    return resultado // nunca quebra
  }
}

// Garante que a soma dos percentual_recomendado fecha EXATAMENTE em 100%
// O componente com maior percentual (normalmente o solvente/veículo base) absorve a diferença
function fecharPercentuais(resultado: unknown): unknown {
  try {
    const r = resultado as Record<string, unknown>
    const formulacao = r.formulacao as Record<string, unknown>
    if (!formulacao) return resultado

    const composicao = formulacao.composicao as Array<Record<string, unknown>>
    if (!Array.isArray(composicao) || composicao.length === 0) return resultado

    const perc = (c: Record<string, unknown>) =>
      typeof c.percentual_recomendado === 'number' ? c.percentual_recomendado : 0

    const soma = composicao.reduce((s, c) => s + perc(c), 0)
    const diff = parseFloat((100 - soma).toFixed(4))

    if (Math.abs(diff) < 0.05) return resultado // já fechado

    // Prefere ajustar solvente/veículo base; senão usa o componente de maior percentual
    const keywords = ['água', 'agua', 'water', 'solvente', 'solvent', 'veículo', 'veiculo', 'diluente', 'q.s.p', 'qsp', 'base']
    let idxAlvo = -1
    for (let i = 0; i < composicao.length; i++) {
      const nome = String(composicao[i].materia_prima || '').toLowerCase()
      if (keywords.some(k => nome.includes(k))) { idxAlvo = i; break }
    }
    if (idxAlvo === -1) {
      // Usa o componente com maior percentual
      idxAlvo = composicao.reduce((best, c, i) => perc(c) > perc(composicao[best]) ? i : best, 0)
    }

    const novoPerc = parseFloat((perc(composicao[idxAlvo]) + diff).toFixed(2))

    if (novoPerc < 0) {
      // Caso extremo: redistribui proporcionalmente
      const fator = 100 / soma
      return {
        ...r,
        formulacao: {
          ...formulacao,
          composicao: composicao.map(c => ({
            ...c,
            percentual_recomendado: parseFloat((perc(c) * fator).toFixed(2)),
          })),
        },
      }
    }

    return {
      ...r,
      formulacao: {
        ...formulacao,
        composicao: composicao.map((c, i) =>
          i === idxAlvo
            ? {
                ...c,
                percentual_recomendado: novoPerc,
                percentual_minimo: Math.min(novoPerc, typeof c.percentual_minimo === 'number' ? c.percentual_minimo : novoPerc),
                percentual_maximo: Math.max(novoPerc, typeof c.percentual_maximo === 'number' ? c.percentual_maximo : novoPerc),
              }
            : c
        ),
      },
    }
  } catch {
    return resultado // nunca quebra — retorna original se algo falhar
  }
}

export async function gerarFormulacao(dados: Record<string, unknown>) {
  const segmento = String(dados.segmento || '')
  const descricao = String(dados.descricao || '')
  const proibidas = Array.isArray(dados.materias_proibidas) ? (dados.materias_proibidas as string[]) : []
  // Garante array de MPs individuais — separa caso venha como "A, B, C" num único item
  const userObrigatorias = (Array.isArray(dados.materias_obrigatorias)
    ? (dados.materias_obrigatorias as string[])
    : []).flatMap(mp => mp.split(',').map(s => s.trim()).filter(Boolean))

  const [contexto, proprietaryResult, docsContext] = await Promise.all([
    buildMPContext(segmento, proibidas),
    buildProprietaryContext(segmento, descricao),
    buildDocumentosContext(segmento, descricao),
  ])

  // Quando há match forte no banco proprietário e o usuário não especificou MPs obrigatórias,
  // injeta as MPs da fórmula aprovada como obrigatórias no prompt — ativa a regra INVIOLÁVEL
  // que garante que a IA use exatamente estas MPs (apenas nomes, sem percentuais — confidencialidade mantida)
  const dadosFinais: Record<string, unknown> = { ...dados }
  if (proprietaryResult.mandatoryMPs.length > 0 && userObrigatorias.length === 0) {
    dadosFinais.materias_obrigatorias = proprietaryResult.mandatoryMPs
  }

  const prompt = buildFormulacaoPrompt(dadosFinais, contexto + proprietaryResult.context + docsContext)

  const message = await getClient().messages.create({
    model: getModel(),
    max_tokens: 6000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const resultado = extractJSON(text)

  // Se o usuário definiu MPs obrigatórias, garante que APENAS elas apareçam na composição
  if (userObrigatorias.length > 0) {
    return fecharPercentuais(enforcarMPsObrigatorias(resultado, userObrigatorias))
  }

  return fecharPercentuais(resultado)
}

async function buildMPContextParaAnalise(formula: Record<string, unknown>): Promise<string> {
  try {
    const componentes = (formula.componentes || []) as Array<{ nome: string }>
    const nomes = componentes.map(c => c.nome).filter(Boolean)
    if (nomes.length === 0) return ''

    // Busca o perfil técnico completo das MPs que estão na fórmula
    const mpsNaFormula = await prisma.materiaPrima.findMany({
      where: {
        OR: nomes.flatMap(nome => [
          { nome_comercial: { contains: nome, mode: 'insensitive' as const } },
          { nome_quimico: { contains: nome, mode: 'insensitive' as const } },
        ]),
      },
      take: 20,
    })

    // Busca alternativas disponíveis nas mesmas categorias funcionais
    const categorias = [...new Set(mpsNaFormula.map(mp => mp.categoria))]
    const alternativas = categorias.length > 0
      ? await prisma.materiaPrima.findMany({
          where: {
            categoria: { in: categorias },
            disponibilidade: { in: ['alta', 'media'] },
            NOT: { id: { in: mpsNaFormula.map(mp => mp.id) } },
          },
          take: 20,
          orderBy: { nivel_toxicidade: 'asc' },
        })
      : []

    // Busca MPs de baixa toxicidade como opções de substituição sustentável
    const mpsVerdes = await prisma.materiaPrima.findMany({
      where: {
        nivel_toxicidade: 'baixo',
        disponibilidade: 'alta',
        NOT: { id: { in: [...mpsNaFormula.map(mp => mp.id), ...alternativas.map(mp => mp.id)] } },
      },
      take: 10,
    })

    const secaoPerfil = mpsNaFormula.length > 0
      ? `\nPERFIL TÉCNICO DAS MPs NA FORMULAÇÃO:\n` + mpsNaFormula.map(mp => {
          const incompat = (() => { try { return JSON.parse(mp.incompatibilidades) } catch { return [] } })()
          const sinerg = (() => { try { return JSON.parse(mp.sinergias) } catch { return [] } })()
          return `• ${mp.nome_comercial} | ${mp.funcao_principal}
  - Faixa de uso: ${mp.faixa_uso_tipica || 'variável'}
  - pH estável: ${mp.ph_estabilidade || 'não especificado'}
  - Incompatibilidades: ${incompat.length > 0 ? incompat.join(', ') : 'nenhuma registrada'}
  - Sinergias: ${sinerg.length > 0 ? sinerg.join(', ') : 'não especificadas'}
  - Toxicidade: ${mp.nivel_toxicidade} | Custo: R$${mp.custo_min ?? '?'}–${mp.custo_max ?? '?'}/kg
  - Biodegradabilidade: ${mp.biodegradabilidade || 'não especificada'}`
        }).join('\n')
      : ''

    const secaoAlternativas = alternativas.length > 0
      ? `\nALTERNATIVAS DISPONÍVEIS NO BANCO (para substituição fundamentada):\n` + alternativas.map(mp =>
          `• ${mp.nome_comercial} (${mp.funcao_principal}) — uso ${mp.faixa_uso_tipica || 'variável'}, toxicidade ${mp.nivel_toxicidade}, custo R$${mp.custo_min ?? '?'}–${mp.custo_max ?? '?'}/kg, disponibilidade ${mp.disponibilidade}`
        ).join('\n')
      : ''

    const secaoVerdes = mpsVerdes.length > 0
      ? `\nMPs DE BAIXA TOXICIDADE DISPONÍVEIS (opções sustentáveis):\n` + mpsVerdes.map(mp =>
          `• ${mp.nome_comercial} (${mp.funcao_principal}) — ${mp.faixa_uso_tipica || 'uso variável'}, custo R$${mp.custo_min ?? '?'}–${mp.custo_max ?? '?'}/kg`
        ).join('\n')
      : ''

    return secaoPerfil + secaoAlternativas + secaoVerdes
  } catch {
    return ''
  }
}

export async function analisarFormula(formula: Record<string, unknown>) {
  const segmento = String(formula.segmento || '')

  // Consulta os dois bancos antes de montar o prompt
  const [contextoMPs, contextoMPsProprietarias] = await Promise.all([
    buildMPContextParaAnalise(formula),
    buildMPsProprietariasParaAnalise(segmento),
  ])

  const prompt = buildAnalisePrompt(formula, contextoMPs + contextoMPsProprietarias)

  const message = await getClient().messages.create({
    model: getModel(),
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  return extractJSON(text)
}

// Variantes plurais/acentuadas em português para cada atributo negativo
// Ex: fenol → fenóis (isento de fenóis), solvente → solventes
const VARIANTES_NEG: Record<string, string[]> = {
  fenol:    ['fenol', 'fenóis', 'fenois', 'fenólicos', 'fenolicos'],
  solvente: ['solvente', 'solventes'],
  cloro:    ['cloro', 'cloros'],
  fosfato:  ['fosfato', 'fosfatos'],
}

// Remove acentos para comparação normalizada (cobre caracteres do português)
function removeAccents(s: string): string {
  return s
    .replace(/[àáâãä]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[ñ]/g, 'n')
}

// Variantes de confirmação positiva para "sem X" (pt + en)
// Cobre plurais acentuados: fenol → fenóis (Allchem, etc.)
function confirmaAtributo(content: string, neg: string): boolean {
  const cn = removeAccents(content.toLowerCase())
  const variants = (VARIANTES_NEG[neg] || [neg]).map(removeAccents)

  return variants.some(v =>
    cn.includes(`sem ${v}`) ||
    cn.includes(`isento de ${v}`) ||
    cn.includes(`livre de ${v}`) ||
    cn.includes(`nao contem ${v}`) ||
    cn.includes(`${v} free`) ||
    cn.includes(`${v}-free`) ||
    cn.includes(`without ${v}`) ||
    cn.includes(`free of ${v}`) ||
    cn.includes(`no ${v}`)
  )
}

export interface ResultadoBusca {
  titulo: string
  url: string
  site: string
  snippet: string
}

interface TavilyBusca {
  contexto: string
  confirmados: Set<string>
  todos: Set<string>
  resultadosBrutos: ResultadoBusca[]  // resultados diretos do Tavily para exibir na UI
}

async function buscarWebTavily(queries: string[], descricao: string): Promise<TavilyBusca> {
  const vazio: TavilyBusca = { contexto: '', confirmados: new Set(), todos: new Set(), resultadosBrutos: [] }
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) return vazio

  const resultados: string[] = []
  const resultadosBrutos: ResultadoBusca[] = []
  const dominiosConfirmados = new Set<string>()
  const dominiosBloqueados = new Set<string>()
  const todosDominios = new Set<string>()
  const urlsVistas = new Set<string>()

  const negativos = (descricao.match(/sem\s+(\S+)/gi) || [])
    .map(m => m.replace(/^sem\s+/i, '').toLowerCase())
  const temFiltro = negativos.length > 0

  // Termos específicos do produto (sem stopwords e sem os atributos negativos)
  // Ex: "descarbonizante sem fenol por imersão motores flex diesel"
  //   → ["descarbonizante", "imersão", "motores", "flex", "diesel"]
  const produtoTermos = descricao
    .replace(/sem\s+\S+/gi, '')
    .toLowerCase()
    .replace(/\b(para|com|de|do|da|por|que|uma|um|e|o|a|em|no|na|os|as)\b/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 3)

  for (const query of queries.slice(0, 3)) {
    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query,
          search_depth: 'advanced',
          include_answer: true,
          max_results: 6,
        }),
      })
      if (!res.ok) continue
      const data = await res.json() as { results?: Array<{ title: string; url: string; content: string }>; answer?: string }
      if (data.answer) resultados.push(`[Busca: "${query}"]\nResumo: ${data.answer}`)
      if (data.results) {
        for (const r of data.results.slice(0, 5)) {
          resultados.push(`• ${r.title}\n  URL: ${r.url}\n  ${r.content?.slice(0, 400)}`)
          try {
            const hostname = new URL(r.url).hostname.replace('www.', '')
            // Coleta resultado bruto (deduplicado por URL)
            if (!urlsVistas.has(r.url)) {
              urlsVistas.add(r.url)
              resultadosBrutos.push({
                titulo: r.title || '',
                url: r.url,
                site: hostname,
                snippet: (r.content || '').slice(0, 300),
              })
            }
            todosDominios.add(hostname)

            if (!temFiltro) {
              dominiosConfirmados.add(hostname)
            } else {
              const contentLower = ((r.title || '') + ' ' + (r.content || '')).toLowerCase()
              let confirmaAtribNeg = false
              let hasNegTerm = false
              for (const neg of negativos) {
                if (confirmaAtributo(contentLower, neg)) confirmaAtribNeg = true
                if (contentLower.includes(neg)) hasNegTerm = true
              }

              if (confirmaAtribNeg) {
                // "sem fenol" confirmado — exige TAMBÉM pelo menos um termo específico do produto
                // (evita falsos positivos onde "sem fenol" aparece em contexto genérico)
                const temTermoEspecifico = produtoTermos.length === 0 ||
                  produtoTermos.some(t => contentLower.includes(t))
                if (temTermoEspecifico) {
                  dominiosConfirmados.add(hostname)
                }
                // sem termo específico → não autoriza (muito genérico)
              } else if (hasNegTerm) {
                dominiosBloqueados.add(hostname)
              }
            }
          } catch { /* ignore */ }
        }
      }
    } catch { continue }
  }

  if (resultados.length === 0) {
    return {
      contexto: '\nNenhum resultado encontrado na busca web. Não cite nenhuma empresa.\n',
      confirmados: new Set(),
      todos: new Set(),
      resultadosBrutos: [],
    }
  }

  const confirmadosStr = [...dominiosConfirmados].join(', ')
  const bloqueadosStr = [...dominiosBloqueados].join(', ')

  const confirmadosInfo = confirmadosStr
    ? `✅ DOMÍNIOS AUTORIZADOS: ${confirmadosStr}`
    : `✅ DOMÍNIOS AUTORIZADOS: NENHUM confirmado para este produto específico`

  const bloqueadosInfo = bloqueadosStr
    ? `\n⛔ DOMÍNIOS BLOQUEADOS (produto errado): ${bloqueadosStr}` : ''

  const contexto = `\nRESULTADOS DE BUSCA WEB (dados em tempo real para: "${descricao}"):\n${resultados.join('\n\n')}\n
${confirmadosInfo}${bloqueadosInfo}
REGRA: Cite APENAS empresas dos DOMÍNIOS AUTORIZADOS. Se vazio: informe que não foram encontradas empresas confirmadas.\n`

  return { contexto, confirmados: dominiosConfirmados, todos: todosDominios, resultadosBrutos }
}

// Normaliza um valor de site para hostname comparável
function normalizaSite(valor: unknown): string {
  return String(valor || '')
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .split('?')[0]
    .trim()
}

// Filtra empresas e produtos de referência que não estão nos domínios confirmados pelo Tavily.
// Garante em código que Claude não pode citar empresas não encontradas na busca.
// Quando confirmados está vazio: nenhuma empresa passa (melhor que mostrar empresas erradas).
function filtrarEmpresasTavily(resultado: unknown, confirmados: Set<string>, todos: Set<string>): unknown {
  if (!resultado || typeof resultado !== 'object') return resultado

  // Se Tavily não retornou absolutamente nada, não filtra
  if (todos.size === 0) return resultado

  // Usa SOMENTE confirmados — sem fallback para todos.
  // Para buscas sem filtros negativos, confirmados == todos (todos os domínios são autorizados).
  // Para buscas com "sem X", confirmados só tem domínios que confirmaram o atributo.
  function isAutorizado(site: unknown): boolean {
    if (confirmados.size === 0) return false  // nenhum domínio confirmado → nada passa
    const d = normalizaSite(site)
    if (!d) return false
    return confirmados.has(d) || confirmados.has('www.' + d)
  }

  const r = { ...(resultado as Record<string, unknown>) }

  // Filtra empresas_destaque
  if (Array.isArray(r.empresas_destaque)) {
    r.empresas_destaque = (r.empresas_destaque as Array<Record<string, unknown>>)
      .filter(emp => isAutorizado(emp.site))
  }

  // Filtra produtos_referencia dentro de cada oportunidade
  if (Array.isArray(r.oportunidades)) {
    r.oportunidades = (r.oportunidades as Array<Record<string, unknown>>).map(op => {
      const o = { ...op }
      if (Array.isArray(o.produtos_referencia)) {
        o.produtos_referencia = (o.produtos_referencia as Array<Record<string, unknown>>)
          .filter(prod => isAutorizado(prod.site))
      }
      return o
    })
  }

  return r
}

// Mapa de sinônimos para atributos negativos comuns
const SINONIMOS_ATRIBUTOS: Record<string, string[]> = {
  fenol:    ['sem fenol', 'isento de fenol', 'isento de fenóis', 'livre de fenol', 'livre de fenóis', 'fenol free', 'fenol-free', 'sem compostos fenólicos', 'não contém fenol', 'free of phenol'],
  solvente: ['sem solvente', 'isento de solvente', 'livre de solvente', 'solvent free'],
  cloro:    ['sem cloro', 'isento de cloro', 'livre de cloro', 'chlorine free'],
  fosfato:  ['sem fosfato', 'isento de fosfato', 'phosphate free'],
}

function buildSearchQueries(segmento: string, tipo: string, descricao: string): string[] {
  const geo = tipo === 'mercado_nacional' ? 'Brasil fabricante'
            : tipo === 'mercado_latam' ? 'América Latina fabricante'
            : 'fabricante'

  // Base do produto sem stopwords (preserva "sem fenol" e demais atributos)
  const palavrasChave = descricao
    .replace(/\b(para|com|de|do|da|que|uma|um|e|o|a|por)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  // Extrai termos negativos e expande com sinônimos para enriquecer as queries
  const negativosExpandidos: string[] = []
  for (const match of descricao.matchAll(/sem\s+(\S+)/gi)) {
    const termo = match[1].toLowerCase()
    const sinonimos = SINONIMOS_ATRIBUTOS[termo]
    if (sinonimos) negativosExpandidos.push(...sinonimos.slice(0, 3))
    else negativosExpandidos.push(`sem ${termo}`, `isento de ${termo}`, `livre de ${termo}`)
  }

  // Base sem os atributos negativos (ex: "descarbonizante imersão motores flex diesel")
  const produtoBase = descricao
    .replace(/sem\s+\S+/gi, '')
    .replace(/\b(para|com|de|do|da|que|uma|um|e|o|a|por)\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim()

  const queries: string[] = [
    // Query 1: descrição completa com "sem fenol" original
    `${palavrasChave} ${geo} produto comercial 2024 2025`,
    // Query 2: fabricante no site oficial
    `fabricante ${palavrasChave} ${geo} site oficial`,
  ]

  // Query 3+: sinônimos expandidos (isento de fenol, livre de fenol, etc.)
  if (negativosExpandidos.length > 0) {
    const variacoes = negativosExpandidos.slice(0, 4).join(' OR ')
    queries.push(`${produtoBase} (${variacoes}) ${geo}`)
  }

  // Query final: tendências do segmento
  queries.push(`tendências ${segmento} ${geo} novos produtos inovação química 2024 2025`)

  return queries.slice(0, 4)  // máximo 4 queries
}

// Segunda passagem: busca "sem fenol + produto" DENTRO DO SITE da empresa (include_domains).
// Isso confirma que a empresa realmente tem esse produto em seu próprio site.
async function verificarEmpresaNoSite(
  site: string,
  descricao: string,
  negativos: string[],
  apiKey: string
): Promise<boolean> {
  if (!negativos.length || !site.trim()) return true

  const dominio = normalizaSite(site)
  if (!dominio) return false

  try {
    const atributos = negativos.map(n => `sem ${n}`).join(' ')
    const produtoBase = descricao
      .replace(/sem\s+\S+/gi, '')
      .replace(/\b(para|com|de|do|da|por)\b/gi, '')
      .trim()

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        query: `${atributos} ${produtoBase}`,
        include_domains: [dominio],   // busca apenas no site da empresa
        search_depth: 'advanced',
        include_answer: false,
        max_results: 5,
      }),
    })
    if (!res.ok) return false

    const data = await res.json() as {
      results?: Array<{ title: string; url: string; content: string }>
    }

    if (!data.results?.length) return false

    // Verifica se algum resultado (do próprio site) confirma "sem fenol"
    for (const r of data.results) {
      const contentLower = `${r.title || ''} ${r.content || ''}`.toLowerCase()
      if (negativos.some(neg => confirmaAtributo(contentLower, neg))) {
        return true
      }
    }
    return false
  } catch {
    return false
  }
}

export async function analisarTendencias(segmento: string, tipo: string, descricao: string, pesquisaAtivada = false) {
  const vazio = { contexto: '', confirmados: new Set<string>(), todos: new Set<string>(), resultadosBrutos: [] }
  const queries = buildSearchQueries(segmento, tipo, descricao)
  const { contexto, confirmados, todos, resultadosBrutos } = pesquisaAtivada
    ? await buscarWebTavily(queries, descricao)
    : vazio

  const prompt = buildTendenciasPrompt(segmento, tipo, descricao, contexto)

  const message = await getClient().messages.create({
    model: getModel(),
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const resultado = extractJSON(text)

  // 1ª passagem: filtro por domínio (remove empresas cujo site não veio do Tavily)
  const filtrado = filtrarEmpresasTavily(resultado, confirmados, todos) as Record<string, unknown>

  // 2ª passagem: verificação direcionada por empresa (busca específica no Tavily)
  // Evita que empresas que aparecem em resultados genéricos passem sem confirmação do produto
  const apiKey = process.env.TAVILY_API_KEY || ''
  const negativos = (descricao.match(/sem\s+(\S+)/gi) || [])
    .map(m => m.replace(/^sem\s+/i, '').toLowerCase())

  // (A verificação por include_domains foi removida — era muito restritiva e bloqueava
  //  empresas corretas cujos sites não estavam indexados pelo Tavily dessa forma.
  //  O filtro por confirmados já garante que só passam domínios com "sem fenol" nos snippets.)

  // Inclui resultados brutos do Tavily na resposta para exibição direta na UI
  // (evita que Claude alucine empresas — os cards mostram o que o Tavily realmente encontrou)
  return {
    ...filtrado,
    _busca_resultados: resultadosBrutos,
    _modo_fechado: !pesquisaAtivada,
  }
}

export async function chatContextual(
  mensagens: { role: 'user' | 'assistant'; content: string }[],
  contexto: string
) {
  const systemWithContext = `Você é o assistente técnico do Click Chem, plataforma de P&D da Astana Química.
Responda em português, de forma técnica e direta.

CONTEXTO ATUAL DA SESSÃO:
${contexto}`

  const message = await getClient().messages.create({
    model: getModel(),
    max_tokens: 2048,
    system: systemWithContext,
    messages: mensagens,
  })

  return message.content[0].type === 'text' ? message.content[0].text : ''
}
