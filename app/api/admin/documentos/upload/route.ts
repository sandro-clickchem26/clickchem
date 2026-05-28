import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export const maxDuration = 60

const ADMIN_PIN = process.env.ADMIN_PIN || 'astana2025'

async function extrairTextoPDF(buffer: Buffer): Promise<string> {
  // Usa o caminho direto para evitar problema com arquivos de teste no Next.js
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

function limitarConteudo(texto: string, maxChars = 15000): string {
  if (texto.length <= maxChars) return texto
  return texto.slice(0, maxChars) + '\n\n[... conteúdo truncado para armazenamento ...]'
}

export async function POST(req: NextRequest) {
  if (req.headers.get('x-admin-pin') !== ADMIN_PIN) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const titulo = String(formData.get('titulo') || '').trim()
    const segmento = String(formData.get('segmento') || '').trim()
    const autores = String(formData.get('autores') || '').trim()
    const ano = formData.get('ano') ? parseInt(String(formData.get('ano'))) : null
    const fonte = String(formData.get('fonte') || '').trim()
    const resumo = String(formData.get('resumo') || '').trim()
    const tagsRaw = String(formData.get('tags') || '').trim()
    const tags = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : []

    if (!file) return NextResponse.json({ error: 'Arquivo obrigatório' }, { status: 400 })
    if (!titulo) return NextResponse.json({ error: 'Título obrigatório' }, { status: 400 })
    if (!segmento) return NextResponse.json({ error: 'Segmento obrigatório' }, { status: 400 })

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const fileName = file.name.toLowerCase()

    let conteudo = ''
    if (fileName.endsWith('.pdf')) {
      conteudo = await extrairTextoPDF(buffer)
    } else if (fileName.endsWith('.docx') || fileName.endsWith('.doc')) {
      conteudo = await extrairTextoWord(buffer)
    } else {
      return NextResponse.json({ error: 'Formato não suportado. Use PDF ou Word (.docx)' }, { status: 400 })
    }

    conteudo = limitarConteudo(conteudo)

    const doc = await prisma.documentoCientifico.create({
      data: {
        titulo,
        autores: autores || null,
        ano: ano || null,
        fonte: fonte || null,
        segmento,
        tags: JSON.stringify(tags),
        resumo: resumo || null,
        conteudo,
        arquivo_nome: file.name,
        ativo: true,
      },
    })

    return NextResponse.json({ success: true, documento: doc })
  } catch (err) {
    console.error('Erro no upload:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
