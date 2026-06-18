import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { jsonrepair } from 'jsonrepair'

// Polyfill de APIs de browser necessárias por pdfjs-dist/xlsx no Node.js
if (typeof globalThis.DOMMatrix === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).DOMMatrix = class DOMMatrix {
    a=1;b=0;c=0;d=1;e=0;f=0
    m11=1;m12=0;m13=0;m14=0
    m21=0;m22=1;m23=0;m24=0
    m31=0;m32=0;m33=1;m34=0
    m41=0;m42=0;m43=0;m44=1
    is2D=true;isIdentity=true
    constructor(_init?: string | number[]) {}
    static fromMatrix() { return new (globalThis as any).DOMMatrix() }
    static fromFloat32Array() { return new (globalThis as any).DOMMatrix() }
    static fromFloat64Array() { return new (globalThis as any).DOMMatrix() }
    multiply() { return this }
    translate() { return this }
    scale() { return this }
    rotate() { return this }
    inverse() { return this }
    transformPoint(p: {x?:number;y?:number}) { return {x:p.x??0,y:p.y??0,z:0,w:1} }
    toFloat32Array() { return new Float32Array(16) }
    toFloat64Array() { return new Float64Array(16) }
    toString() { return 'matrix(1,0,0,1,0,0)' }
  }
}

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'pdf') {
    // Usar lib/pdf-parse.js diretamente evita o código de debug do index.js
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse/lib/pdf-parse.js')
    const data = await pdfParse(buffer)
    return data.text
  } else if (ext === 'docx' || ext === 'doc') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammothModule = require('mammoth')
    const mammoth = mammothModule.default ?? mammothModule
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  } else if (ext === 'xlsx' || ext === 'xls') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XLSX = require('xlsx')
    const workbook = XLSX.read(buffer, { type: 'buffer', cellStyles: false })
    let text = ''
    for (const sheetName of workbook.SheetNames) {
      text += `\n=== ${sheetName} ===\n`
      text += XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName])
    }
    return text
  }
  throw new Error('Formato não suportado. Use PDF, Word (.docx) ou Excel (.xlsx).')
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })

    const texto = await extractText(file)
    if (!texto.trim()) return NextResponse.json({ error: 'Não foi possível extrair texto do arquivo.' }, { status: 400 })

    const message = await client.messages.create({
      model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
      max_tokens: 3000,
      system: `Você é um especialista em química industrial. Extrai dados técnicos de boletins de matérias-primas e retorna JSON válido.`,
      messages: [{
        role: 'user',
        content: `Leia o boletim técnico abaixo e extraia os dados da matéria-prima.

Retorne APENAS este JSON (sem texto fora do JSON):
{
  "nome_comercial": "nome comercial exato do produto",
  "nome_quimico": "nome IUPAC ou químico",
  "numero_cas": "número CAS (apenas números e hífens, sem texto extra)",
  "categoria": "categoria principal: Solventes | Tensoativos Aniônicos | Tensoativos Não-iônicos | Tensoativos Catiônicos | Tensoativos Anfóteros | Espessantes | Sequestrantes | Neutralizantes | Conservantes | Dispersante | Umectante | Inibidores de Corrosão | Resinas | Biossolventes | Antiespumantes | Emulsificantes | Outros",
  "subcategoria": "subcategoria mais específica",
  "funcao_principal": "função principal em formulações",
  "faixa_uso_tipica": "faixa de uso típica em % (ex: 1-5%)",
  "nivel_toxicidade": "baixo | medio | alto",
  "biodegradabilidade": "facilmente biodegradável | biodegradável | não biodegradável | não informado",
  "origem": "petroleo | vegetal | mineral | bio-sintetico",
  "aparencia": "aspecto físico (ex: líquido amarelado, pó branco)",
  "solubilidade_agua": "solubilidade em água",
  "ph_estabilidade": "faixa de pH de estabilidade",
  "custo_min": 0.0,
  "custo_max": 0.0,
  "disponibilidade": "alta | media | baixa",
  "sinergias": ["MP compatível 1", "MP compatível 2"],
  "incompatibilidades": ["MP incompatível 1"],
  "aplicacoes_tipicas": ["aplicação 1", "aplicação 2"],
  "restricoes_anvisa": "restrições ANVISA relevantes ou null",
  "restricoes_reach": "restrições REACH relevantes ou null",
  "notas_tecnicas": "observações técnicas importantes do boletim"
}

Regras:
- custo_min e custo_max: se não informado, use 0
- Se algum campo não estiver no boletim, use null ou array vazio []
- Para categoria, escolha a mais adequada dos valores listados

BOLETIM TÉCNICO (${file.name}):
${texto.slice(0, 12000)}`
      }]
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start === -1 || end === -1) throw new Error('Não foi possível extrair dados do boletim.')

    const mp = JSON.parse(jsonrepair(raw.slice(start, end + 1)))
    return NextResponse.json({ mp, arquivo: file.name })

  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro ao processar boletim.' },
      { status: 500 }
    )
  }
}
