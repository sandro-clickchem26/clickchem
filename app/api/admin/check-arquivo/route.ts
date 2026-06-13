import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'

function checkAdmin(req: NextRequest) {
  const pin = req.headers.get('x-admin-pin')
  return pin === process.env.ADMIN_PIN
}

export async function POST(req: NextRequest) {
  if (!checkAdmin(req)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    const { arquivo_nome } = await req.json() as { arquivo_nome: string }

    if (!arquivo_nome) {
      return NextResponse.json({ error: 'arquivo_nome é obrigatório' }, { status: 400 })
    }

    // Conta quantas fórmulas vieram deste arquivo
    const count = await prisma.formulaProprietaria.count({
      where: { arquivo_origem: arquivo_nome }
    })

    // Se houver, retorna também a data de quando foi processado
    const data = count > 0
      ? await prisma.formulaProprietaria.findFirst({
          where: { arquivo_origem: arquivo_nome },
          select: { createdAt: true },
          orderBy: { createdAt: 'asc' }
        })
      : null

    return NextResponse.json({ count, data })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
