import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export const maxDuration = 30

const ADMIN_PIN = process.env.ADMIN_PIN || 'astana2025'

async function extrairTextoPDF(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pdfParse = require('pdf-parse/lib/pdf-parse.js')
  const data = await pdfParse(buffer)
  return data.text || ''
}

async function extrairTextoWord(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth')
  const result = await mammoth.extractRawText({ buffer })
  return result.value || ''
}

export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-pin') !== ADMIN_PIN) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileName = file.name.toLowerCase()

    let texto = ''
    if (fileName.endsWith('.pdf')) {
      texto = await extrairTextoPDF(buffer)
    } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      texto = await extrairTextoWord(buffer)
    }

    const trecho = texto.slice(0, 3000).replace(/\s+/g, ' ').trim()
    if (!trecho) return NextResponse.json({})

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const model = process.env.CLAUDE_MODEL || 'claude-haiku-4-5'

    const response = await client.messages.create({
      model,
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: `Analise este documento técnico/científico e extraia os metadados. Retorne APENAS JSON válido (sem markdown, sem explicações):
{
  "titulo": "título completo do documento",
  "autores": "autores no formato 'Sobrenome, A. B.; Sobrenome, C. D.' ou null se não encontrado",
  "ano": 2024,
  "fonte": "nome do journal, revista, norma ou instituição ou null",
  "tags": ["palavra-chave1", "palavra-chave2", "palavra-chave3"],
  "resumo": "2-3 frases objetivas sobre os principais achados relevantes para formulação química industrial"
}

DOCUMENTO:
${trecho}`,
      }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : ''
    let meta: Record<string, unknown> = {}
    try {
      const cleaned = raw.replace(/^```json\n?/i, '').replace(/\n?```$/i, '').trim()
      meta = JSON.parse(cleaned)
    } catch { /* retorna vazio */ }

    return NextResponse.json(meta)
  } catch (err) {
    console.error('Erro ao extrair metadados:', err)
    return NextResponse.json({})
  }
}
