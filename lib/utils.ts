export function cn(...classes: (string | undefined | null | boolean)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatCurrency(value: number, decimais = 3): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: decimais,
    maximumFractionDigits: decimais,
  }).format(value)
}

export function toxicidadeBadge(nivel: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    baixo: { label: 'Baixa', color: 'bg-green-500/20 text-green-400 border border-green-500/30' },
    medio: { label: 'Média', color: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
    alto: { label: 'Alta', color: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  }
  return map[nivel] ?? map['medio']
}

export function viabilidadeBadge(nivel: string): { label: string; color: string } {
  const map: Record<string, { label: string; color: string }> = {
    alta: { label: 'Alta Viabilidade', color: 'bg-green-500/20 text-green-400 border border-green-500/30' },
    media: { label: 'Viabilidade Média', color: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
    baixa: { label: 'Baixa Viabilidade', color: 'bg-red-500/20 text-red-400 border border-red-500/30' },
  }
  return map[nivel] ?? map['media']
}

export function probabilidadeBadge(nivel: string): { color: string } {
  const map: Record<string, { color: string }> = {
    alta: { color: 'text-red-400' },
    media: { color: 'text-yellow-400' },
    baixa: { color: 'text-green-400' },
  }
  return map[nivel] ?? { color: 'text-gray-400' }
}

export function gerarCodigoRelatorio(): string {
  const ts = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `CC-${ts}-${rand}`
}
