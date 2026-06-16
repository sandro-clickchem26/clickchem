import Anthropic from '@anthropic-ai/sdk'
import { jsonrepair } from 'jsonrepair'
import { SYSTEM_PROMPT, buildFormulacaoPrompt, buildAnalisePrompt, buildTendenciasPrompt, buildKBReferenceTable } from './prompts'
import { prisma } from './db'
import { buscarVariacoesMPs } from './buscar-variacoes'
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
  hasFormulas: boolean  // true se há fórmulas no banco (independente de compatibilidade)
  top10Ids: string[]
}

// Monta o contexto do banco P&D para a IA avaliar compatibilidade
// A IA — não um algoritmo de score — decide qual fórmula usar e se é compatível
async function buildProprietaryContext(segmento: string, descricao: string = '', idsRecentes: string[] = []): Promise<ProprietaryResult> {
  const vazio: ProprietaryResult = { context: '', hasFormulas: false, top10Ids: [] }
  try {
    const formulas = await prisma.formulaProprietaria.findMany({
      where: { ativa: true },
      orderBy: { createdAt: 'desc' },
    })
    console.log(`[buildProprietaryContext] Total de fórmulas ativas no banco: ${formulas.length}`)
    if (formulas.length === 0) return vazio

    // Filtra primeiro por segmento (pré-filtro amplo para não sobrecarregar o contexto)
    // Compatível com segmentos renomeados (ex: "Tintas e Vernizes" ↔ "Tintas, Vernizes, Resinas e Polímeros")
    const norm = (s: string) => removeAccents(s.toLowerCase())
    const segNorm = norm(segmento)
    console.log(`[buildProprietaryContext] Segmento solicitado NORMALIZADO: "${segNorm}" (original: "${segmento}")`)

    const relevantes = formulas.filter(f => {
      const fSeg = norm(f.segmento)
      // Match direto ou palavras em comum
      const matches = fSeg.includes(segNorm) || segNorm.includes(fSeg) ||
        segNorm.split(/\s+/).some(w => w.length > 3 && fSeg.includes(w)) ||
        fSeg.split(/\s+/).some(w => w.length > 3 && segNorm.includes(w))

      if (matches) console.log(`[buildProprietaryContext] ✅ MATCH: "${f.nome_interno}" (${f.segmento})`)
      return matches
    })

    console.log(`[buildProprietaryContext] Fórmulas relevantes encontradas: ${relevantes.length}`)
    // Se não há fórmulas relevantes para o segmento, retorna sem contexto
    // para que o Tavily seja acionado como segunda camada
    if (relevantes.length === 0) {
      console.log(`[buildProprietaryContext] ⚠️ NENHUMA fórmula encontrada — Tavily será usado`)
      return vazio
    }

    // Ranqueia pela relevância ao PRODUTO pedido (descrição), não só pelo segmento:
    // a IA analisa as 5 fórmulas mais parecidas com o que o usuário digitou
    const descNorm = norm(descricao)
    const palavrasBusca = descNorm.split(/\s+/).filter(w => w.length > 3)

    // TIPOS QUÍMICOS são decisivos: se o usuário pede "poliéster", uma fórmula
    // alquídica NÃO serve — palavras genéricas (resina, tinta, verniz) não podem
    // empatar com o tipo. Radicais sem acento para casar variações (alquídica/alquídico).
    const TIPOS_QUIMICOS = [
      'poliester', 'polyester', 'alquidic', 'epoxi', 'acril', 'poliuretan',
      'vinil', 'fenolic', 'melamin', 'silicone', 'nitrocelulose', 'estiren'
    ]
    const tiposPedidos = TIPOS_QUIMICOS.filter(t => descNorm.includes(t))
    if (tiposPedidos.length > 0) {
      console.log(`[buildProprietaryContext] 🎯 Tipo químico exigido na busca: ${tiposPedidos.join(', ')}`)
    }

    const ranqueadas = relevantes
      .map(f => {
        const textoFormula = norm(`${f.nome_interno} ${f.aplicacao} ${f.tags || ''} ${f.composicao}`)
        let score = 0
        for (const palavra of palavrasBusca) {
          if (textoFormula.includes(palavra)) score += 1
        }
        if (tiposPedidos.length > 0) {
          // O tipo da fórmula é o que o NOME e a APLICAÇÃO declaram — tags e composição
          // são ruidosas (ex: alquídicas com "poliéster" nas tags ou "poliesterificação"
          // na composição ganhavam o bônus indevidamente)
          const textoTipo = norm(`${f.nome_interno} ${f.aplicacao}`)
          const temTipoPedido = tiposPedidos.some(t => textoTipo.includes(t))
          const temTipoConflitante = TIPOS_QUIMICOS.some(t => !tiposPedidos.includes(t) && textoTipo.includes(t))
          if (temTipoPedido) {
            score += 10 // tipo certo domina qualquer empate de palavras genéricas
          } else if (temTipoConflitante) {
            score = -1 // tipo errado (ex: alquídica quando pediu poliéster) é excluído
          }
        }
        return { f, score }
      })
      .filter(x => x.score >= 0)
      .sort((a, b) => b.score - a.score)

    if (ranqueadas.length === 0) {
      console.log(`[buildProprietaryContext] ⚠️ Nenhuma fórmula do tipo químico pedido — Tavily será usado`)
      return vazio
    }

    // Pega até 10 fórmulas ranqueadas e passa TODAS para o Claude escolher
    // Exclui fórmulas usadas recentemente se o pool tiver fórmulas suficientes
    const pool = idsRecentes.length > 0 && ranqueadas.length - idsRecentes.length >= 3
      ? ranqueadas.filter(e => !idsRecentes.includes(e.f.id))
      : ranqueadas
    const top10 = pool.slice(0, 10)
    console.log(`[buildProprietaryContext] 📋 Enviando ${top10.length} fórmulas para Claude escolher`)
    top10.forEach(({ f, score }, i) =>
      console.log(`[buildProprietaryContext]   ${i + 1}. Score ${score}: "${f.nome_interno}"`))

    const formatarFormula = (entry: typeof top10[0], idx: number) => {
      const f = entry.f
      let comp: Array<{ materia_prima: string; funcao?: string; percentual?: number | string }> = []
      try { comp = JSON.parse(f.composicao) } catch { /* ignora */ }

      const ingredientes = comp
        .filter(c => c.materia_prima)
        .map(c => `    • ${c.materia_prima}${c.funcao ? ` (${c.funcao})` : ''}: ~${c.percentual ?? '?'}%`)
        .join('\n')

      return `**Fórmula ${idx + 1}: ${f.nome_interno}**
- Aplicação: ${f.aplicacao}
- pH: ${f.ph_final || 'N/A'}
- Performance: ${f.performance_chave || 'Padrão'}
- Ingredientes:
${ingredientes || '  (sem dados de composição)'}`
    }

    const formulasFormatadas = top10.map(formatarFormula).join('\n\n---\n\n')

    const context = `
BASE TÉCNICA INTERNA P&D — ${top10.length} FÓRMULAS DISPONÍVEIS NO BANCO ASTANA QUÍMICA:

${formulasFormatadas}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INSTRUÇÕES OBRIGATÓRIAS:

⭐ FÓRMULA PRINCIPAL (campo "formulacao"):
  Escolha a fórmula acima que MELHOR atende o pedido do usuário.
  Use EXATAMENTE os ingredientes dessa fórmula (ajuste percentuais ±10-15%).
  NUNCA copie percentuais exatos — refine tecnicamente.
  "fonte": "Fonte técnica: P&D Proprietário — sugestão formulativa refinada."
  Informe o número da fórmula escolhida (1, 2, 3...) no campo "formula_base_usada_indice".

✅ VARIAÇÕES ALTERNATIVAS (campo "variacoes_alternativas") — OBRIGATÓRIO:
  Escolha 3 fórmulas DIFERENTES das listadas acima para as variações.
  Cada variação DEVE usar ingredientes de uma fórmula diferente do banco.
  NUNCA repita os mesmos ingredientes entre variações — cada uma deve ser única.
  Se o banco tiver menos de 3 fórmulas diferentes, use conhecimento químico para completar.

IMPORTANTE: Não retorne a mesma fórmula duas vezes. Considere custo, performance e ingredientes alternativos.

SE NENHUMA FÓRMULA FOR COMPATÍVEL:
  Retorne: "viabilidade": "nao_encontrada"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`

    return { context, hasFormulas: true, top10Ids: top10.map(e => e.f.id) }
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
    console.log(`[buildDocumentosContext] Buscando para segmento: "${segmento}" | Total docs ativos: ${docs.length}`)

    // DEBUG: mostra os segmentos dos artigos
    if (docs.length > 0) {
      console.log(`[buildDocumentosContext] Segmentos dos artigos:`, docs.map(d => d.segmento).slice(0, 3))
    }

    if (docs.length === 0) return ''

    const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    const palavras = norm(descricao).split(/\s+/).filter(w => w.length > 3)
    const segmentoPedido = norm(segmento)

    console.log(`[buildDocumentosContext] Segmento normalizado: "${segmentoPedido}"`)

    const comScore = docs.map(doc => {
      let score = 0
      const textoDoc = norm(`${doc.segmento} ${doc.titulo} ${doc.tags} ${doc.resumo || ''}`)
      const segNorm = norm(doc.segmento)

      if (segNorm.includes(segmentoPedido) || segmentoPedido.includes(segNorm)) {
        score += 3
        console.log(`[buildDocumentosContext] ✅ Match: "${doc.titulo.slice(0, 40)}..." (${doc.segmento})`)
      }

      for (const kw of palavras) { if (textoDoc.includes(kw)) score += 1 }
      try {
        const tags = JSON.parse(doc.tags) as string[]
        for (const tag of tags) { if (norm(descricao).includes(norm(tag))) score += 2 }
      } catch { /* ignore */ }
      return { doc, score }
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score)

    console.log(`[buildDocumentosContext] Artigos com score > 0: ${comScore.length} | Retornando top 10 com análise minuciosa`)

    // Top 10 artigos com análise completa: a IA PRECISA de contexto profundo
    // para fazer análise minuciosa e trazer fórmulas corretas correspondentes ao pedido
    const topDocs = comScore.slice(0, 10)

    if (topDocs.length === 0) return ''

    const extrairSecoesMarkdown = (texto: string): string => {
      // ANÁLISE MINUCIOSA: extrai TODAS as seções relevantes
      // Inclui: Introdução, Métodos, Materiais, Resultados, Conclusão, Formulação, Composição
      const secoesRelevantes = [
        'introdução', 'introduction', 'intro',
        'métodos', 'methods', 'methodology', 'metodologia',
        'materiais', 'materials', 'reagentes', 'composição',
        'resultados', 'results', 'findings',
        'conclusão', 'conclusion', 'conclusões',
        'formulação', 'formulation', 'formula',
        'composição', 'composition', 'ingredients'
      ]

      const linhas = texto.split('\n')
      let resultado = ''
      let emSecaoRelevante = false

      for (let i = 0; i < linhas.length; i++) {
        const linha = linhas[i]
        const linhaLower = linha.toLowerCase()

        // Detecta início de seção relevante
        if (secoesRelevantes.some(s => linhaLower.includes(s))) {
          emSecaoRelevante = true
          resultado += linha + '\n'
        }
        // Detecta fim de seção (próximo heading de nível superior)
        else if (emSecaoRelevante && linha.match(/^#{1,2}\s/)) {
          emSecaoRelevante = false
        }
        // Coleta conteúdo da seção
        else if (emSecaoRelevante) {
          resultado += linha + '\n'
        }
      }

      // Se não encontrou seções estruturadas, retorna conteúdo completo (até 8000 chars)
      return resultado.trim() || texto.slice(0, 8000)
    }

    let totalContextoChars = 0
    const linhas = topDocs.map(({ doc, score }) => {
      const textoDisponivel = (doc.conteudo || doc.resumo || '').trim()

      // ANÁLISE COMPLETA: extrai conteúdo integral para análise minuciosa
      // Markdown: todas as seções relevantes
      // Outros: até 5000 caracteres (análise profunda)
      const isMarkdown = doc.arquivo_nome?.toLowerCase().endsWith('.md')
      const trecho = isMarkdown
        ? extrairSecoesMarkdown(textoDisponivel)
        : textoDisponivel.slice(0, 5000)

      totalContextoChars += trecho.length
      const ref = [doc.autores, doc.ano, doc.fonte].filter(Boolean).join(', ')
      const tipo = isMarkdown ? '[MD]' : '[TXT]'
      return `📄 ${tipo} "${doc.titulo}" [SCORE: ${score}][${trecho.length} chars]${ref ? ` (${ref})` : ''}${trecho ? `\n${trecho}` : ''}`
    }).join('\n\n---\n\n')

    console.log(`[buildDocumentosContext] ✅ Contexto total: ${totalContextoChars} caracteres em ${topDocs.length} documentos (média ${Math.round(totalContextoChars / topDocs.length)} chars/doc)`)

    return `\n📚 DOCUMENTAÇÃO CIENTÍFICA RELEVANTE (banco interno Astana Química — use como embasamento técnico):\n${linhas}\n`
  } catch (err) {
    console.error(`[buildDocumentosContext] ERRO:`, err)
    return ''
  }
}

// Garante que a composição final contenha as MPs obrigatórias.
// Estratégia: substitui componentes similares pelo nome exato, adiciona MPs faltantes,
// e MANTÉM os outros componentes da IA para completar a fórmula.
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

    const mpObrigFound = new Set<string>()
    const composicaoFinal: Array<Record<string, unknown>> = []

    // PASSO 1: Percorre a composição da IA e substitui por MPs obrigatórias quando houver match
    for (let i = 0; i < composicao.length; i++) {
      const comp = composicao[i]
      const nomeComp = String(comp.materia_prima || '')

      let foundMatch = false
      for (const mpObrig of obrigatorias) {
        if (mpObrigFound.has(mpObrig)) continue // já foi usada
        const s = score(nomeComp, mpObrig)
        if (s >= 40) {
          // Match encontrado: usa dados técnicos da IA mas com nome exato
          composicaoFinal.push({ ...comp, materia_prima: mpObrig })
          mpObrigFound.add(mpObrig)
          foundMatch = true
          break
        }
      }

      // Se não encontrou match: mantém o componente original (importante!)
      if (!foundMatch) {
        composicaoFinal.push(comp)
      }
    }

    // PASSO 2: Adiciona MPs obrigatórias que não foram encontradas
    for (const mpObrig of obrigatorias) {
      if (!mpObrigFound.has(mpObrig)) {
        console.log(`[enforcarMPsObrigatorias] Adicionando MP obrigatória não encontrada: ${mpObrig}`)
        composicaoFinal.push({
          materia_prima: mpObrig,
          funcao_tecnica: 'Componente obrigatório',
          percentual_minimo: 1.0,
          percentual_maximo: 15.0,
          percentual_recomendado: 5.0,
          justificativa: 'Especificado pelo formulador como obrigatório.',
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

// Enriquece a fórmula com CAS Numbers do banco de dados (otimizado com single query)
async function enriquecerComCASNumbers(resultado: unknown): Promise<unknown> {
  try {
    const r = resultado as Record<string, unknown>
    const formulacao = r.formulacao as Record<string, unknown>
    if (!formulacao) return resultado

    const composicao = formulacao.composicao as Array<Record<string, unknown>>
    if (!Array.isArray(composicao) || composicao.length === 0) return resultado

    // Extrai nomes das MPs
    const nomesMp = composicao
      .map(c => String(c.materia_prima || '').trim())
      .filter(Boolean)

    if (nomesMp.length === 0) return resultado

    // Single query: busca TODAS as MPs de uma vez (com timeout protection)
    let mpsMap: Map<string, string> = new Map()
    try {
      const mpsBanco = await Promise.race([
        prisma.materiaPrima.findMany({
          where: {
            OR: nomesMp.flatMap(nome => [
              { nome_comercial: { contains: nome, mode: 'insensitive' } },
              { nome_quimico: { contains: nome, mode: 'insensitive' } },
            ]),
          },
          select: { nome_comercial: true, numero_cas: true },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout buscando CAS Numbers')), 5000)
        ),
      ])

      // Cria mapa de nome -> CAS para lookup rápido
      for (const mp of mpsBanco) {
        if (mp.numero_cas) {
          mpsMap.set(String(mp.nome_comercial).toLowerCase(), mp.numero_cas)
        }
      }
    } catch (err) {
      console.warn(`[enriquecerComCASNumbers] Aviso ao buscar CAS Numbers:`, err)
      // Continua sem CAS Numbers em vez de falhar
    }

    // Enriquece composição: prioriza CAS já fornecido pelo Claude, banco como fallback
    const composicaoComCAS = composicao.map(comp => {
      const casDoClaudeRaw = String(comp.numero_cas || '').trim()
      const casDoClaudeValido = casDoClaudeRaw && casDoClaudeRaw !== 'N/A' && casDoClaudeRaw !== 'XXXXX-XX-X'
      if (casDoClaudeValido) return comp // Claude já preencheu — mantém
      const nomeMp = String(comp.materia_prima || '').trim().toLowerCase()
      const casBanco = mpsMap.get(nomeMp)
      return { ...comp, numero_cas: casBanco || 'N/A' }
    })

    return {
      ...r,
      formulacao: {
        ...formulacao,
        composicao: composicaoComCAS,
      },
    }
  } catch (err) {
    console.warn(`[enriquecerComCASNumbers] Erro crítico ao enriquecer:`, err)
    return resultado // Fallback: retorna sem CAS Numbers em vez de quebrar
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

// Busca na internet quando não há match no banco proprietário
// Usa Tavily API (TAVILY_API_KEY no .env) — silencioso se chave não configurada
async function buildWebContext(segmento: string, descricao: string, proibidas: string[] = []): Promise<string> {
  try {
    const apiKey = (process.env.TAVILY_API_KEY || '').trim()
    if (!apiKey) return ''

    // Query expandida para trazer mais resultados relevantes
    const exclusoes = proibidas.length > 0
      ? ` -${proibidas.slice(0, 3).join(' -')}`
      : ''
    const query = `${descricao} fórmula composição receita formulação ${segmento}${exclusoes}`

    const controller = new AbortController()
    setTimeout(() => controller.abort(), 5000)

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        search_depth: 'basic',
        max_results: 5,
        include_answer: true,
        include_raw_content: false,
      }),
      signal: controller.signal,
    })

    if (!res.ok) return ''

    const data = await res.json() as {
      answer?: string
      results?: Array<{ title: string; content: string; url: string; score: number }>
    }

    const partes: string[] = []
    let primeiroTitulo = '' // para extrair nome da fórmula

    // Resposta sintetizada pelo Tavily (quando disponível)
    if (data.answer && data.answer.length > 50) {
      partes.push(`Síntese técnica:\n${data.answer.slice(0, 600)}`)
    }

    // Top resultados com conteúdo extraído — filtros mais flexíveis
    const resultados = (data.results ?? [])
      .filter(r => r.score > 0.2 && r.content && r.content.length > 40) // score > 0.2 em vez de 0.3, content > 40 em vez de 80
      .slice(0, 4)
      .map((r, i) => {
        if (i === 0) primeiroTitulo = r.title // captura nome da primeira fórmula encontrada
        return `• ${r.title}\n  ${r.content.slice(0, 300)}`
      })

    if (resultados.length > 0) {
      partes.push(resultados.join('\n'))
    }

    if (partes.length === 0) return ''

    // Aviso explícito para a IA respeitar as proibidas mesmo no contexto externo
    const avisoProibidas = proibidas.length > 0
      ? `\n⛔ ATENÇÃO: Mesmo que as referências abaixo citem estes ingredientes, eles são ABSOLUTAMENTE PROIBIDOS nesta formulação e NÃO devem aparecer na composição: ${proibidas.join(', ')}\n`
      : ''

    // Adiciona metadados de fórmula encontrada para usar em formula_referencia
    const metadados = primeiroTitulo ? `\n<!-- FÓRMULA_ENCONTRADA: ${primeiroTitulo} -->` : ''

    return `\nREFERÊNCIAS TÉCNICAS DA INTERNET (use como base — as restrições do usuário prevalecem sobre qualquer fonte externa):
${avisoProibidas}
${partes.join('\n\n')}${metadados}
`
  } catch {
    return '' // silencioso — busca externa é complemento, não requisito
  }
}

export async function gerarFormulacao(dados: Record<string, unknown>) {
  const startTotal = Date.now()
  const segmento = String(dados.segmento || '')
  const descricao = String(dados.descricao || '')
  const proibidas = Array.isArray(dados.materias_proibidas) ? (dados.materias_proibidas as string[]) : []
  const userObrigatorias = (Array.isArray(dados.materias_obrigatorias)
    ? (dados.materias_obrigatorias as string[])
    : []).flatMap(mp => mp.split(',').map(s => s.trim()).filter(Boolean))

  const isBiosolventes = segmento.includes('Biosolventes, Biolubrificantes e Biodiesel')

  // Todas as consultas em paralelo — reduz tempo total antes da chamada à IA
  console.log(`[gerarFormulacao] ⏱️ INÍCIO | Segmento: "${segmento}" | isBiosolventes: ${isBiosolventes}`)

  const startBuscas = Date.now()

  // Para Biosolventes: SOMENTE Artigos Científicos (sem P&D, sem Google)
  // Para outros (Tintas, Resinas, Cosmético): P&D → Google (sem Artigos Científicos)
  const shouldCallTavily = !isBiosolventes
  const shouldCallDocumentos = isBiosolventes // SOMENTE para Biosolventes

  const [contexto, proprietaryResult, docsContext, webContext] = await Promise.all([
    buildMPContext(segmento, proibidas),
    !isBiosolventes
      ? buildProprietaryContext(segmento, descricao, Array.isArray(dados.idsRecentes) ? (dados.idsRecentes as string[]) : [])
      : Promise.resolve({ context: '', hasFormulas: false, top10Ids: [] }),
    shouldCallDocumentos ? buildDocumentosContext(segmento, descricao) : Promise.resolve(''),
    shouldCallTavily
      ? buildWebContext(segmento, descricao, proibidas).catch(() => '')
      : Promise.resolve(''),
  ])

  const endBuscas = Date.now()
  const tempoBuscas = ((endBuscas - startBuscas) / 1000).toFixed(2)
  console.log(`[gerarFormulacao] ⏱️ BUSCAS COMPLETAS em ${tempoBuscas}s | P&D: ${proprietaryResult.context.length} | Docs: ${docsContext.length} | Web: ${webContext.length}`)
  console.log(`[gerarFormulacao] docsContext length: ${docsContext.length} chars`)

  const dadosFinais: Record<string, unknown> = { ...dados }
  if (webContext) dadosFinais.pesquisa_internet_ativa = true

  // BUSCAR VARIAÇÕES DE MPs DISPONÍVEIS NO BANCO P&D (para uso posterior no post-processing)
  const variacoes = await buscarVariacoesMPs(segmento)
  console.log(`[gerarFormulacao] 📦 Variações encontradas - Tensoativos: ${variacoes.tensoativos.length} | Solventes: ${variacoes.solventes.length}`)

  // Construir contexto conforme segmento
  let contextosParaIA: string
  if (isBiosolventes) {
    // ⚠️ REGRA INVIOLÁVEL: Biosolventes = SOMENTE Artigos Científicos
    // Sem P&D, sem Google, sem contexto de MPs genéricas
    contextosParaIA = docsContext || ''
    console.log(`[gerarFormulacao] Biosolventes: usando SOMENTE artigos científicos`)
  } else if (proprietaryResult.hasFormulas) {
    // Há referências P&D: a LISTA FECHADA são as composições das referências.
    // A lista genérica de MPs (banco de matérias-primas) NÃO entra — ela poluía
    // a fórmula com aditivos alheios ao produto (ex: tensoativos numa resina).
    contextosParaIA = proprietaryResult.context + webContext
    console.log(`[gerarFormulacao] ${segmento}: P&D (composições completas) + Google — sem lista genérica de MPs`)
  } else {
    // Sem P&D: Google + lista de MPs como apoio
    contextosParaIA = contexto + webContext
    console.log(`[gerarFormulacao] ${segmento}: Google + lista de MPs (P&D sem fórmulas compatíveis)`)
  }

  // BUSCAR MPs já usados para FORÇAR VARIAÇÃO desde o prompt
  let mpsJaUsados: string[] = []
  const usuarioEmail = String(dados.usuario_email || '')
  console.log(`[gerarFormulacao] 📧 usuarioEmail: "${usuarioEmail}" | segmento: "${segmento}"`)

  if (usuarioEmail) {
    try {
      console.log(`[gerarFormulacao] 🔍 Buscando fórmulas anteriores...`)
      const formulasAnteriores = await prisma.formulacaoGerada.findMany({
        where: {
          usuarioEmail,
          segmento
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
        select: { composicaoGerada: true }
      })

      console.log(`[gerarFormulacao] ✅ Fórmulas anteriores encontradas: ${formulasAnteriores.length}`)

      // Extrair todos os MPs das fórmulas anteriores
      const mpsSet = new Set<string>()
      for (const formula of formulasAnteriores) {
        try {
          const composicao = JSON.parse(formula.composicaoGerada) as Record<string, number>
          Object.keys(composicao).forEach(mp => mpsSet.add(mp))
        } catch (parseErr) {
          console.warn('[gerarFormulacao] Erro ao parsear composição:', parseErr)
        }
      }
      mpsJaUsados = Array.from(mpsSet)
      console.log(`[gerarFormulacao] 🔄 MPs já usados (${mpsJaUsados.length}):`, mpsJaUsados)
    } catch (err) {
      console.warn('[gerarFormulacao] ❌ Erro ao buscar fórmulas anteriores:', err)
    }
  } else {
    console.log(`[gerarFormulacao] ⚠️ usuarioEmail vazio — variação por prompt não ativa`)
  }

  const prompt = buildFormulacaoPrompt(dadosFinais, contextosParaIA, '', mpsJaUsados)
  const totalContextoSize = contextosParaIA.length
  console.log(`[gerarFormulacao] 📊 CONTEXTO TOTAL: ${totalContextoSize} caracteres (P&D: ${proprietaryResult.context.length} | Web: ${webContext.length} | Docs: ${docsContext.length})`)

  // DEBUG: Mostrar se jaUsadas está no prompt
  if (mpsJaUsados.length > 0) {
    const temVariacaoInstruction = prompt.includes('VARIAÇÃO OBRIGATÓRIA') && prompt.includes('NUNCA reutilize')
    console.log(`[gerarFormulacao] ⚠️ INSTRUÇÃO DE VARIAÇÃO NO PROMPT: ${temVariacaoInstruction ? 'SIM' : 'NÃO'}`)
    console.log(`[gerarFormulacao] ⚠️ MPs PROIBIDOS NO PROMPT: ${mpsJaUsados.slice(0, 3).join(', ')}...`)
  }

  console.log(`[gerarFormulacao] ⏱️ Iniciando chamada IA (tentativa 1)...`)
  const startIA1 = Date.now()

  const message = await getClient().messages.create({
    model: getModel(),
    max_tokens: 3000,
    temperature: 0.3,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const endIA1 = Date.now()
  const tempoIA1 = ((endIA1 - startIA1) / 1000).toFixed(2)
  console.log(`[gerarFormulacao] ✅ IA respondeu (tentativa 1) em ${tempoIA1}s`)

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const resultado = extractJSON(text)

  // Verifica se a IA sinalizou que não encontrou fórmula compatível
  // COMENTADO: Deixar fórmula ser retornada mesmo se viabilidade !== 'encontrada'
  // const analise = (resultado as Record<string, unknown>)?.analise_critica as Record<string, unknown> | undefined
  // if (analise?.viabilidade === 'nao_encontrada') {
  //   throw new Error('FORMULA_NAO_ENCONTRADA')
  // }

  // ⚠️ VALIDAÇÃO REAL OBRIGATÓRIA COM LÓGICA DE CÓDIGO E LOOP DE AJUSTE
  console.log(`[gerarFormulacao] Iniciando VALIDAÇÃO ESTRUTURAL e AJUSTE OBRIGATÓRIO...`)

  const descricaoLower = descricao.toLowerCase()

  // PASSO 1: EXTRAI REQUISITOS ESPECÍFICOS (bicomponente, branco, rápida secagem, etc.)
  const requisitosEspecificos = [
    'bicomponente', 'monocomponente', 'dois componentes', 'a+b',
    'branco', 'preto', 'vermelho', 'azul', 'verde', 'amarelo', 'cinza', 'transparente',
    'brilhante', 'fosco', 'semi-brilho', 'semi-fosco',
    'rápida secagem', 'secagem rápida', 'seco em', 'flash off',
    'longa durabilidade', 'durável', 'resistente', 'durabilidade',
    'esmalte', 'verniz', 'tinta', 'primer', 'fundo',
    'sintético', 'acrílico', 'alquídica', 'epóxi', 'poliuretano', 'pu',
    'baixo voc', 'voc', 'sustentável', 'ecológico', 'bio', 'água'
  ]

  const requisitosDetectados: string[] = []
  for (const req of requisitosEspecificos) {
    if (descricaoLower.includes(req)) {
      requisitosDetectados.push(req)
    }
  }

  console.log(`[gerarFormulacao] ⚡ Requisitos detectados: ${requisitosDetectados.join(', ') || 'nenhum específico'}`)

  // PASSO 2: EXTRAI COMPONENTES-CHAVE do pedido
  const componentesPedidos: string[] = []

  // SOMENTE substâncias/matérias-primas reais.
  // NUNCA incluir tipos de produto (desengraxante, detergente...) nem categorias
  // genéricas (solvente, tensoativo, ácido) — isso causava falso "FORMULA_NAO_ENCONTRADA"
  // porque nenhuma MP da composição se chama "desengraxante".
  const palavrasChave = [
    'óleo de mamona', 'carbonato de propileno',
    'óleo de soja', 'óleo de palma', 'biodiesel', 'terpeno',
    'limoneno', 'acetona', 'metanol', 'etanol',
    'ácido sulfônico', 'sulfônico', 'muriático', 'ácido clorídrico',
    'ácido fluorídrico', 'fluorídrico'
  ]

  for (const palavra of palavrasChave) {
    if (descricaoLower.includes(palavra)) {
      componentesPedidos.push(palavra)
    }
  }

  console.log(`[gerarFormulacao] Componentes pedidos detectados: ${componentesPedidos.join(', ') || 'nenhum específico'}`)

  // FUNÇÃO: Valida se componentes SOLICITADOS estão na fórmula
  function validarComponentes(formulacao: Record<string, unknown>, pedidos: string[]): { valido: boolean; faltando: string[] } {
    const composicao = (formulacao.formulacao as Record<string, unknown>)?.composicao as Array<{ materia_prima: string; justificativa?: string }> | undefined
    const mpsNaFormula = composicao?.map(c => String(c.materia_prima).toLowerCase()) || []

    // Verifica se componentes SOLICITADOS estão presentes
    const faltando = pedidos.filter(pedido =>
      !mpsNaFormula.some(mp => mp.includes(pedido) || pedido.split(' ').some(palavra => mp.includes(palavra)))
    )

    // Verifica se todos os componentes têm justificativa
    const semJustificativa = (composicao || []).filter(c => !c.justificativa || String(c.justificativa).trim().length === 0)

    return {
      valido: faltando.length === 0 && semJustificativa.length === 0,
      faltando
    }
  }

  // FUNÇÃO: Valida se requisitos específicos são atendidos
  function validarRequisitos(formulacao: Record<string, unknown>, requisitos: string[], descricao: string): { valido: boolean; naoAtendidos: string[] } {
    if (requisitos.length === 0) return { valido: true, naoAtendidos: [] }

    const descFormula = JSON.stringify(formulacao).toLowerCase()
    const naoAtendidos: string[] = []

    for (const req of requisitos) {
      const reqNorm = req.toLowerCase()
      // Verifica se o requisito está descrito na fórmula (em justificativas, nome, etc)
      if (!descFormula.includes(reqNorm)) {
        // Exceção: cores podem estar apenas como pigmento
        if (!['branco', 'preto', 'vermelho', 'azul', 'verde', 'amarelo', 'cinza'].includes(reqNorm)) {
          naoAtendidos.push(req)
        }
      }
    }

    return {
      valido: naoAtendidos.length === 0,
      naoAtendidos
    }
  }

  // LOOP DE VALIDAÇÃO E AJUSTE (máx 1 tentativa para velocidade máxima)
  let resultadoFinal: unknown = resultado
  let tentativas = 0
  const maxTentativas = 1

  while (tentativas < maxTentativas) {
    tentativas++
    console.log(`[gerarFormulacao] Tentativa ${tentativas}/${maxTentativas} de validação...`)

    const validacao = validarComponentes(resultadoFinal as Record<string, unknown>, componentesPedidos)
    const validacaoRequisitos = validarRequisitos(resultadoFinal as Record<string, unknown>, requisitosDetectados, descricao)

    if (validacao.valido && validacaoRequisitos.valido) {
      console.log(`[gerarFormulacao] ✅ VALIDAÇÃO OK - Fórmula atende a TODOS os componentes e requisitos!`)
      break
    }

    if (tentativas >= maxTentativas) {
      const problemas = [
        ...validacao.faltando.map(c => `componente: ${c}`),
        ...validacaoRequisitos.naoAtendidos.map(r => `requisito: ${r}`)
      ]
      // Validação heurística (palavras detectadas na descrição) NÃO descarta a fórmula:
      // descartar aqui causava falso "Fórmula Não Encontrada" mesmo com fórmula válida do P&D.
      // MPs obrigatórias explícitas do usuário já são garantidas por enforcarMPsObrigatorias.
      console.log(`[gerarFormulacao] ⚠️ Validação heurística incompleta (${problemas.join(', ')}) — retornando fórmula mesmo assim`)
      break
    }

    // IA REFAZ a fórmula
    const msgProblemas = [
      validacao.faltando.length > 0 ? `Componentes faltando: ${validacao.faltando.join(', ')}` : '',
      validacaoRequisitos.naoAtendidos.length > 0 ? `Requisitos não atendidos: ${validacaoRequisitos.naoAtendidos.join(', ')}` : ''
    ].filter(Boolean).join(' | ')

    console.log(`[gerarFormulacao] ⚠️ ${msgProblemas}. IA vai REFAZER a formulação...`)

    const secaoRequisitos = requisitosDetectados.length > 0
      ? `\nREQUISITOS ESPECÍFICOS SOLICITADOS (OBRIGATÓRIO ATENDER):\n${requisitosDetectados.map(r => `✓ ${r}`).join('\n')}\n`
      : ''

    const secaoRequisitosNaoAtendidos = validacaoRequisitos.naoAtendidos.length > 0
      ? `\nREQUISITOS NÃO ATENDIDOS NA FÓRMULA ANTERIOR:\n${validacaoRequisitos.naoAtendidos.map(r => `✗ ${r}`).join('\n')}\n\nVOCÊ DEVE CORRIGIR ISSO!\n`
      : ''

    const ajustePrompt = `REFAÇA A FORMULAÇÃO - ATENDA TODOS OS REQUISITOS E COMPONENTES

Fórmula anterior (INCOMPLETA/INCORRETA):
${JSON.stringify(resultadoFinal, null, 2)}

PEDIDO DO USUÁRIO:
${descricao}
${secaoRequisitos}${secaoRequisitosNaoAtendidos}
COMPONENTES FALTANDO (OBRIGATÓRIO INCLUIR):
${validacao.faltando.length > 0 ? validacao.faltando.map(c => `- ${c}`).join('\n') : '(nenhum específico além dos requisitos acima)'}

REGRA: Composição Inteligente com Justificativa
1. INCLUA OBRIGATORIAMENTE todos os componentes específicos acima
2. GARANTA que a fórmula atende a TODOS os requisitos específicos listados acima
   Exemplos:
   - Se pediu "bicomponente" → DEVE ter Componente A + Componente B (não monocomponente)
   - Se pediu "branco" → DEVE conter pigmento branco (TiO2 ou similar)
   - Se pediu "rápida secagem" → DEVE mencionar tempo de secagem baixo
3. ADICIONE aditivos TECNICAMENTE NECESSÁRIOS (com justificativa citando referências)
4. JUSTIFIQUE CADA componente no campo "justificativa"
5. Manter percentuais somando 100%
6. RETORNAR JSON válido no mesmo schema

SE NÃO CONSEGUIR:
- Atender TODOS os componentes obrigatórios, OU
- Atender TODOS os requisitos específicos
→ Preencha "viabilidade": "nao_encontrada" no analise_critica`

    const ajusteMessage = await getClient().messages.create({
      model: getModel(),
      max_tokens: 6000,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: ajustePrompt }],
    })

    const ajusteText = ajusteMessage.content[0].type === 'text' ? ajusteMessage.content[0].text : ''

    try {
      resultadoFinal = extractJSON(ajusteText)
      const analiseAjuste = (resultadoFinal as Record<string, unknown>)?.analise_critica as Record<string, unknown> | undefined

      if (analiseAjuste?.viabilidade === 'nao_encontrada') {
        console.log(`[gerarFormulacao] ❌ IA sinalizou viabilidade nao_encontrada após ajuste`)
        throw new Error('FORMULA_NAO_ENCONTRADA')
      }
    } catch (err) {
      console.log(`[gerarFormulacao] ❌ Erro ao processar ajuste: ${err}`)
      throw new Error('FORMULA_NAO_ENCONTRADA')
    }
  }

  // Enriquece a fórmula com CAS Numbers ANTES de fechar os percentuais
  resultadoFinal = await enriquecerComCASNumbers(resultadoFinal)

  const endTotal = Date.now()
  const tempoTotal = ((endTotal - startTotal) / 1000).toFixed(2)
  console.log(`[gerarFormulacao] ⏱️ BREAKDOWN: Buscas=${tempoBuscas}s | IA=${tempoIA1}s | Total=${tempoTotal}s`)
  console.log(`[gerarFormulacao] ✅ CONCLUSÃO | Tempo total: ${tempoTotal}s`)

  // Rótulo de fonte determinístico — não confia no texto da IA, que pode rotular errado.
  // Em Biosolventes o contexto é SOMENTE artigos científicos; nos demais, P&D ou internet.
  if (resultadoFinal && typeof resultadoFinal === 'object') {
    const r = resultadoFinal as Record<string, unknown>
    if (isBiosolventes) {
      r.fonte = 'Fonte técnica: Artigos Científicos (banco interno) — sugestão formulativa derivada.'
    } else if (proprietaryResult.hasFormulas) {
      r.fonte = 'Fonte técnica: P&D Proprietário — sugestão formulativa derivada.'
    } else if (webContext) {
      r.fonte = 'Fonte técnica: Busca Externa (internet) — sugestão formulativa derivada.'
    }
  }

  // Injeta top10Ids no resultado para que route.ts possa salvar formulaBaseId
  if (resultadoFinal && typeof resultadoFinal === 'object' && proprietaryResult.top10Ids.length > 0) {
    (resultadoFinal as Record<string, unknown>)._top10Ids = proprietaryResult.top10Ids
  }

  // MPs obrigatórias definidas pelo usuário têm prioridade máxima
  if (userObrigatorias.length > 0) {
    return fecharPercentuais(enforcarMPsObrigatorias(resultadoFinal, userObrigatorias))
  }

  return fecharPercentuais(resultadoFinal)
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

export async function gerarSugestoesComplementares(formulacao: Record<string, unknown>, segmento: string) {
  try {
    // Extrai MPs já na fórmula
    const mpsNaFormula = new Set<string>()
    const composicao = formulacao.composicao as Array<Record<string, unknown>> | undefined
    if (Array.isArray(composicao)) {
      composicao.forEach(c => {
        const nome = String(c.materia_prima || '').toLowerCase()
        if (nome) mpsNaFormula.add(nome)
      })
    }

    const descricao = String(formulacao.descricao_tecnica || '')
    const aplicacao = String(formulacao.nome_sugerido || '')
    const tabelaKB = buildKBReferenceTable()

    const prompt = `Você é um especialista em química formulada com profundo conhecimento de compatibilidade química.

FÓRMULA ATUAL PARA ANÁLISE MINUCIOSA:
${JSON.stringify(formulacao, null, 2)}

MPs JÁ NA FÓRMULA (NUNCA SUGERIR ESTAS):
${Array.from(mpsNaFormula).join(', ')}

APLICAÇÃO: ${aplicacao}
SEGMENTO: ${segmento}
${tabelaKB}
⚠️ ANÁLISE OBRIGATÓRIA USANDO KAURI-BUTANOL (CRÍTICO - FAÇA ANTES DE SUGERIR):

REGRA ABSOLUTA - NÃO PODE SER VIOLADA:
SE O SOLVENTE PRINCIPAL TEM KB >100 (FORTE):
  🚫 PROIBIDO SUGERIR SOLVENTES COM KB <50 (FRACOS)
  ✅ PERMITIDO SUGERIR: Solventes com KB >100 (fortes) OU agentes não-solventes (antievaporantes, penetradores)

⚠️ PROCEDIMENTO OBRIGATÓRIO - NÃO PODE SER VIOLADO:

1️⃣ IDENTIFIQUE o solvente PRINCIPAL e seu KB
   Exemplo: Cloreto de Metileno = KB 136

2️⃣ SE KB PRINCIPAL > 100:
   🔴 REGRA ABSOLUTA: GERE EXATAMENTE 3 SUGESTÕES DE SOLVENTES FORTES
   - Cada um DEVE ter KB > 200
   - ORDENADOS por KB DESCENDENTE (maior primeiro)
   - NENHUM deles pode ser inferior a KB 200

3️⃣ LISTA OBRIGATÓRIA - USE APENAS ESTES 3:

   🥇 PRIMEIRA (se disponível): Lactato de Etila (KB 1000), Elsol NMPR (KB 600), ou Tetrahidrofurano (KB 579)
   🥈 SEGUNDA (se disponível): Metanol (KB 380), DOWANOL DPM/PM (KB 500), ou NMP (KB 350)
   🥉 TERCEIRA (se disponível): Propanol (KB 250), Isopropanol (KB 230), Butanol (KB 225), ou Álcool Benzílico (KB 200)

4️⃣ CRITÉRIOS DE VALIDAÇÃO (aplicar em ordem):
   ✅ Compatibilidade química com solvente principal
   ✅ Segurança operacional (ponto de ebulição, toxicidade)
   ✅ Disponibilidade no Brasil

5️⃣ RESTRIÇÕES ABSOLUTAS:
   ❌ NÃO SUGIRA: Butilglicol, Nafta, Mineral Spirits, Aguarrás, STPP, ou qualquer aditivo químico
   ❌ NÃO INCLUA: Aditivos, sequastradores, antievaporantes (SOMENTE solventes fortes KB > 200)
   ❌ QUANTIDADE: SEMPRE 3 solventes, NUNCA menos

6️⃣ PARA CADA SUGESTÃO, JUSTIFIQUE:
   • Nome: X (KB XXX)
   • Compatibilidade: Por que é compatível com DCM (ou solvente principal)?
   • Segurança: Ponto de ebulição? Toxicidade? Manuseio?
   • Disponibilidade: Disponível no Brasil? Fornecedor?

   - LISTA DE SOLVENTES PROIBIDOS (NUNCA):
     ❌ Butilglicol (KB ~30) — ABSOLUTAMENTE PROIBIDO
     ❌ Nafta (KB 34-38) — PROIBIDO
     ❌ Mineral Spirits (KB 32-37) — PROIBIDO
     ❌ Etanol (KB 84.2) — PROIBIDO (muito fraco)
     ❌ Glicóis fracos: Etilenoglicol, Propilenoglicol — PROIBIDO
3. SE QUER SUGERIR ALGO QUE NÃO SOLVENTE: use penetradores, antievaporantes, estabilizadores (não solventes)
4. PRIORIZAÇÃO OBRIGATÓRIA DE SUGESTÕES:
   - SE há múltiplos solventes: ORDENE por KB DESCENDENTE (maior KB primeiro)
   - Exemplo: NMP (KB 350) ANTES de Álcool Benzílico (KB 200)
   - JUSTIFIQUE a ordem: "Prioridade: NMP é mais forte (KB 350) para melhor descarbonização"
5. Para CADA sugestão, JUSTIFIQUE COM KB: "Nome (KB XX) — Força forte complementa solvente principal (KB YY)"

1. Identifique CADA componente da fórmula atual:
   - Nome comercial
   - Função técnica específica
   - Percentual e faixa
   - Para SOLVENTES: Identifique o KB (força de dissolução)
   - Qual é o solvente PRINCIPAL (maior %)?

2. Identifique LACUNAS na fórmula:
   - Se solvente principal é fraco (KB <50): ADICIONE solvente forte (KB >100)
   - Se é forte: pode complementar com agente de penetração ou antievaporante
   - O que falta para melhorar poder de remoção?
   - Há proteção anticorrosão/antideposição?

3. Para CADA sugestão, justifique TECNICAMENTE:
   - Por que esta MP? (referencie Kauri-Butanol se for solvente)
   - Como complementa o solvente principal?
   - Qual melhoria específica em desempenho (KB, penetração, evaporação)?
   - Compare com componentes existentes

SUGESTÕES DEVEM SER MINUCIOSAS:
• Nome EXATO do banco técnico
• Função ESPECÍFICA (não genérica)
• BENEFÍCIO DETALHADO — como exatamente melhora a fórmula
• COMPATIBILIDADE com análise de pH, polaridade, densidade
• PERCENTUAL com justificativa (não chute)

RETORNAR JSON:
{
  "sugestoes_mps_complementares": [
    {
      "materia_prima": "Nome exato do banco técnico",
      "funcao": "Função específica (ex: solvente aromático forte, antievaporante, estabilizador de pH)",
      "beneficio": "Análise minuciosa: por que potencializa (ex: aumenta poder solvente em carbonos pesados, reduz 18% de evaporação, melhora penetração em poros compactos)",
      "compatibilidade": "alta|media (justifique: pH, polaridade, densidade, sinergias conhecidas)",
      "percentual_sugerido": "X-Y% (justifique: baseado em relação com solventes presentes)"
    }
  ]
}`

    const message = await getClient().messages.create({
      model: getModel(),
      max_tokens: 2048,
      temperature: 0,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = message.content[0].type === 'text' ? message.content[0].text : ''
    const resultado = extractJSON(text) as Record<string, unknown>
    return (resultado.sugestoes_mps_complementares as Array<Record<string, unknown>>) || []
  } catch (err) {
    console.warn('[gerarSugestoesComplementares] Erro:', err)
    return []
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
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const resultado = extractJSON(text) as Record<string, unknown>

  // Gera sugestões em paralelo (FASE 2)
  const sugestoesPromise = gerarSugestoesComplementares(formula.formulacao as Record<string, unknown> || {}, segmento)

  // Adiciona sugestões ao resultado
  const sugestoes = await sugestoesPromise
  if (sugestoes && sugestoes.length > 0) {
    const analise = resultado.analise_critica as Record<string, unknown>
    if (analise) {
      analise.sugestoes_mps_complementares = sugestoes
    }
  }

  return resultado
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
    temperature: 0,
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
