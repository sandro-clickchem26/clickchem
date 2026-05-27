import { prisma } from '@/lib/db'
import BancoTecnicoClient from './BancoTecnicoClient'

export default async function BancoTecnico({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>
}) {
  const { categoria } = await searchParams
  let mps: Array<Record<string, unknown>> = []
  let categorias: string[] = []

  try {
    const rawMps = await prisma.materiaPrima.findMany({ orderBy: { nome_comercial: 'asc' } })
    categorias = [...new Set(rawMps.map(mp => mp.categoria))].sort()

    const filtradas = categoria
      ? rawMps.filter(mp => mp.categoria === categoria)
      : rawMps

    mps = filtradas.map(mp => ({
      ...mp,
      sinergias: JSON.parse(mp.sinergias as string || '[]'),
      incompatibilidades: JSON.parse(mp.incompatibilidades as string || '[]'),
      certificacoes: JSON.parse(mp.certificacoes as string || '[]'),
      fornecedores: JSON.parse(mp.fornecedores as string || '[]'),
      aplicacoes_tipicas: JSON.parse(mp.aplicacoes_tipicas as string || '[]'),
    }))
  } catch {
    // Banco não inicializado ainda
  }

  return (
    <BancoTecnicoClient
      mps={mps}
      categorias={categorias}
      categoriaAtiva={categoria || ''}
    />
  )
}
