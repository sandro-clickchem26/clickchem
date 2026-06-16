import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'ID é obrigatório.' },
        { status: 400 }
      )
    }

    // Verificar se a MP foi adicionada pelo usuário
    const mp = await prisma.materiaPrima.findUnique({ where: { id } })

    if (!mp) {
      return NextResponse.json(
        { error: 'Matéria-prima não encontrada.' },
        { status: 404 }
      )
    }

    await prisma.materiaPrima.delete({ where: { id } })

    return NextResponse.json({ message: 'Matéria-prima excluída com sucesso.' })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'ID é obrigatório.' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const {
      nome_comercial, nome_quimico, numero_cas, categoria, subcategoria,
      funcao_principal, faixa_uso_tipica, nivel_toxicidade, biodegradabilidade,
      origem, custo_min, custo_max, disponibilidade, ph_estabilidade,
      restricoes_anvisa, restricoes_reach, notas_tecnicas,
      sinergias, incompatibilidades, aplicacoes_tipicas, aparencia,
      solubilidade_agua,
    } = body

    console.log(`[PUT /api/materias-primas/${id}] Atualizando MP:`, { nivel_toxicidade, custo_min, custo_max })

    const mp = await prisma.materiaPrima.findUnique({ where: { id } })

    if (!mp) {
      return NextResponse.json(
        { error: 'Matéria-prima não encontrada.' },
        { status: 404 }
      )
    }

    const updatedMP = await prisma.materiaPrima.update({
      where: { id },
      data: {
        nome_comercial: nome_comercial || mp.nome_comercial,
        nome_quimico: nome_quimico || mp.nome_quimico,
        numero_cas: numero_cas || mp.numero_cas,
        categoria: categoria || mp.categoria,
        subcategoria: subcategoria || mp.subcategoria,
        funcao_principal: funcao_principal || mp.funcao_principal,
        faixa_uso_tipica: faixa_uso_tipica || mp.faixa_uso_tipica,
        nivel_toxicidade: nivel_toxicidade || mp.nivel_toxicidade,
        biodegradabilidade: biodegradabilidade || mp.biodegradabilidade,
        origem: origem || mp.origem,
        custo_min: custo_min ? parseFloat(custo_min) : mp.custo_min,
        custo_max: custo_max ? parseFloat(custo_max) : mp.custo_max,
        disponibilidade: disponibilidade || mp.disponibilidade,
        ph_estabilidade: ph_estabilidade || mp.ph_estabilidade,
        restricoes_anvisa: restricoes_anvisa || mp.restricoes_anvisa,
        restricoes_reach: restricoes_reach || mp.restricoes_reach,
        notas_tecnicas: notas_tecnicas || mp.notas_tecnicas,
        aparencia: aparencia || mp.aparencia,
        solubilidade_agua: solubilidade_agua || mp.solubilidade_agua,
        sinergias: Array.isArray(sinergias) ? JSON.stringify(sinergias) : mp.sinergias,
        incompatibilidades: Array.isArray(incompatibilidades) ? JSON.stringify(incompatibilidades) : mp.incompatibilidades,
        aplicacoes_tipicas: Array.isArray(aplicacoes_tipicas) ? JSON.stringify(aplicacoes_tipicas) : mp.aplicacoes_tipicas,
      },
    })

    return NextResponse.json(updatedMP, { status: 200 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
