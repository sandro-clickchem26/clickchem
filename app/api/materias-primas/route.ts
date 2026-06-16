import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function GET(req: NextRequest) {
  try {
    const nome = req.nextUrl.searchParams.get('nome')
    if (!nome) {
      return NextResponse.json({ exists: false })
    }

    const mp = await prisma.materiaPrima.findFirst({
      where: {
        nome_comercial: {
          equals: nome,
          mode: 'insensitive'
        }
      }
    })

    return NextResponse.json({ exists: !!mp })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      nome_comercial, nome_quimico, numero_cas, categoria, subcategoria,
      funcao_principal, faixa_uso_tipica, nivel_toxicidade, biodegradabilidade,
      origem, custo_min, custo_max, disponibilidade, ph_estabilidade,
      restricoes_anvisa, restricoes_reach, notas_tecnicas,
      sinergias, incompatibilidades, aplicacoes_tipicas, aparencia,
      solubilidade_agua,
    } = body

    if (!nome_comercial) {
      return NextResponse.json(
        { error: 'Nome comercial é obrigatório.' },
        { status: 400 }
      )
    }

    const cat = categoria || 'Outros'
    const mp = await prisma.materiaPrima.create({
      data: {
        nome_comercial,
        nome_quimico: nome_quimico || nome_comercial,
        numero_cas: numero_cas || null,
        categoria: cat,
        subcategoria: subcategoria || cat,
        funcao_principal: funcao_principal || cat,
        faixa_uso_tipica: faixa_uso_tipica || null,
        nivel_toxicidade: nivel_toxicidade || 'medio',
        biodegradabilidade: biodegradabilidade || null,
        origem: origem || 'petroleo',
        custo_min: custo_min ? parseFloat(custo_min) : null,
        custo_max: custo_max ? parseFloat(custo_max) : null,
        disponibilidade: disponibilidade || 'media',
        ph_estabilidade: ph_estabilidade || null,
        restricoes_anvisa: restricoes_anvisa || null,
        restricoes_reach: restricoes_reach || null,
        notas_tecnicas: notas_tecnicas || null,
        aparencia: aparencia || null,
        solubilidade_agua: solubilidade_agua || null,
        sinergias: JSON.stringify(Array.isArray(sinergias) ? sinergias : []),
        incompatibilidades: JSON.stringify(Array.isArray(incompatibilidades) ? incompatibilidades : []),
        aplicacoes_tipicas: JSON.stringify(Array.isArray(aplicacoes_tipicas) ? aplicacoes_tipicas : []),
        adicionada_usuario: true,
      },
    })

    return NextResponse.json(mp, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
