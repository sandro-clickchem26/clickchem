import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import Anthropic from '@anthropic-ai/sdk'
import { jsonrepair } from 'jsonrepair'

export const maxDuration = 60

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

function checkAdmin(req: NextRequest) {
  return req.headers.get('x-admin-pin') === process.env.ADMIN_PIN
}

const SYSTEM_PROMPT = `Você é um especialista em formulação química industrial com décadas de experiência.
Sua única função agora é extrair dados estruturados de documentos técnicos de formulação e retornar JSON válido.`

const USER_PROMPT = (fileName: string, extra = '') => `Analise o documento abaixo e extraia TODAS as formulações/fórmulas presentes.

Retorne APENAS este JSON (sem texto fora do JSON):
{
  "formulas": [
    {
      "nome_interno": "nome ou código da fórmula",
      "segmento": "um dos valores exatos: Limpeza e Manutenção Industrial | Automotivo | Saneantes e Domissanitários | Tintas, Vernizes, Resinas e Polímeros | Biossolventes e Biolubrificantes",
      "aplicacao": "descrição do produto e sua aplicação",
      "composicao": [
        {"materia_prima": "nome exato da MP", "percentual": 0.0, "funcao": "função técnica"}
      ],
      "ph_final": "pH ou faixa (null se não informado)",
      "viscosidade": "viscosidade (null se não informado)",
      "processo": "observações de processo e ordem de adição (null se não informado)",
      "performance_chave": "resultados e performance observados (null se não informado)",
      "tags": "palavras-chave separadas por vírgula (null se não informado)"
    }
  ],
  "aviso": "mensagem caso nenhuma fórmula seja encontrada (null caso contrário)"
}

Regras:
- percentual deve ser número (ex: 5.5, não "5.5%")
- Se um ingrediente aparece sem percentual definido, use 0
- Inclua TODAS as fórmulas encontradas no documento
- Se houver apenas uma fórmula, ainda assim coloque em array
- Para segmento: analise a aplicação e escolha o mais adequado dos 5 valores permitidos
${extra ? `\nDOCUMENTO (${fileName}):\n${extra}` : `\nArquivo: ${fileName}`}`

async function extractText(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())
  const ext = file.name.split('.').pop()?.toLowerCase()

  if (ext === 'docx' || ext === 'doc') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mammoth = require('mammoth')
    const result = await mammoth.extractRawText({ buffer })
    return result.value

  } else if (ext === 'xlsx' || ext === 'xls') {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    let text = ''
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName]
      text += `\n=== Aba: ${sheetName} ===\n`
      text += XLSX.utils.sheet_to_csv(sheet)
    }
    return text
  } else if (ext === 'md') {
    return buffer.toString('utf-8')
  }

  throw new Error('Formato não suportado. Use PDF, Word (.docx), Excel (.xlsx) ou Markdown (.md).')
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 })

    const ext = file.name.split('.').pop()?.toLowerCase()
    const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6'

    let message: Awaited<ReturnType<typeof client.messages.create>>

    if (ext === 'pdf') {
      // PDFs: envia diretamente para o Claude como documento (sem pdf-parse)
      const buffer = Buffer.from(await file.arrayBuffer())
      const base64 = buffer.toString('base64')

      message = await client.messages.create({
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            } as never,
            {
              type: 'text',
              text: USER_PROMPT(file.name),
            },
          ],
        }],
      })
    } else {
      // DOCX / XLSX: extrai texto e envia como prompt
      const texto = await extractText(file)
      if (!texto.trim()) return NextResponse.json({ error: 'Não foi possível extrair texto do arquivo.' }, { status: 400 })

      message = await client.messages.create({
        model,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: USER_PROMPT(file.name, texto.slice(0, 14000)),
        }],
      })
    }

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''

    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    if (start === -1 || end === -1) throw new Error('IA não retornou JSON válido.')
    const candidate = raw.slice(start, end + 1)
    const result = JSON.parse(jsonrepair(candidate))

    return NextResponse.json({ ...result, arquivo: file.name })

  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro ao processar arquivo.'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
