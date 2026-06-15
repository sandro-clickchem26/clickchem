'use client'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { toxicidadeBadge } from '@/lib/utils'
import { BookOpen, Search, X, Plus, UserCircle } from 'lucide-react'
import { NovaMP } from '@/components/NovaMP'

interface MP {
  id: string
  nome_comercial: string
  nome_quimico: string
  numero_cas?: string
  categoria: string
  subcategoria: string
  funcao_principal: string
  faixa_uso_tipica?: string
  nivel_toxicidade: string
  biodegradabilidade?: string
  origem: string
  disponibilidade: string
  custo_min?: number
  custo_max?: number
  sinergias: string[]
  incompatibilidades: string[]
  certificacoes: string[]
  fornecedores: string[]
  aplicacoes_tipicas: string[]
  ph_estabilidade?: string
  notas_tecnicas?: string
  restricoes_anvisa?: string
  restricoes_reach?: string
  aparencia?: string
  solubilidade_agua?: string
  adicionada_usuario?: boolean
}

interface BancoTecnicoClientProps {
  mps: Array<Record<string, unknown>>
  categorias: string[]
  categoriaAtiva: string
}

const ORIGENS: Record<string, string> = {
  petroleo: 'Petroquímica',
  vegetal: 'Vegetal / Bio',
  mineral: 'Mineral',
  'bio-sintetico': 'Bio-sintético',
}

export default function BancoTecnicoClient({ mps, categorias, categoriaAtiva }: BancoTecnicoClientProps) {
  const [busca, setBusca] = useState('')
  const [toxicidadeFiltro, setToxicidadeFiltro] = useState('')
  const [origemFiltro, setOrigemFiltro] = useState('')
  const [mpSelecionada, setMpSelecionada] = useState<MP | null>(null)
  const [comparar, setComparar] = useState<string[]>([])
  const [showNovaMP, setShowNovaMP] = useState(false)

  const mpsList = mps as unknown as MP[]

  const filtradas = useMemo(() => {
    return mpsList.filter(mp => {
      const matchBusca = !busca || [mp.nome_comercial, mp.nome_quimico, mp.funcao_principal, mp.numero_cas]
        .some(f => f?.toLowerCase().includes(busca.toLowerCase()))
      const matchTox = !toxicidadeFiltro || mp.nivel_toxicidade === toxicidadeFiltro
      const matchOrigem = !origemFiltro || mp.origem === origemFiltro
      return matchBusca && matchTox && matchOrigem
    })
  }, [mpsList, busca, toxicidadeFiltro, origemFiltro])

  function toggleComparar(id: string) {
    setComparar(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : prev.length < 4 ? [...prev, id] : prev
    )
  }

  const mpParaComparar = mpsList.filter(mp => comparar.includes(mp.id))

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <BookOpen className="text-green-400" size={24} />
            Banco Matérias-Primas
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            {mpsList.length} matérias-primas · <span className="text-green-400">{mpsList.filter(m => (m as unknown as { adicionada_usuario?: boolean }).adicionada_usuario).length} adicionadas por usuários</span>
          </p>
        </div>
        <Button variant="gold" size="sm" onClick={() => setShowNovaMP(true)}>
          <Plus size={14} /> Nova Matéria-Prima
        </Button>
      </div>

      {/* Drawer Nova MP */}
      {showNovaMP && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/50" onClick={() => setShowNovaMP(false)} />
          <div className="w-full max-w-xl bg-[#0d1f3c] border-l border-[#1B3A6B]/60 flex flex-col overflow-hidden">
            <NovaMP onFechar={() => setShowNovaMP(false)} />
          </div>
        </div>
      )}

      {mpsList.length === 0 && (
        <div className="p-6 bg-yellow-500/10 border border-yellow-500/20 rounded-xl">
          <p className="text-yellow-300 text-sm">
            Banco de dados não inicializado. Execute <code className="bg-black/30 px-1.5 py-0.5 rounded">npm run db:push && npm run db:seed</code> para popular o banco.
          </p>
        </div>
      )}

      {mpsList.length > 0 && (
        <div className="flex flex-col gap-4 md:flex-row md:gap-6">

          {/* Filtros — sidebar no desktop, chips horizontais no mobile */}
          <div className="md:w-52 md:shrink-0 md:space-y-4">
            {/* Busca */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar MP, CAS..."
                className="w-full bg-[#111f3a] border border-white/8 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
              />
              {busca && (
                <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Categoria — Links (funcionam em qualquer dispositivo) */}
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Categoria</p>
              {/* Mobile: chips em múltiplas linhas */}
              <div className="md:hidden flex flex-wrap gap-2">
                {[{ cat: '', label: 'Todas' }, ...categorias.map(cat => ({ cat, label: cat }))].map(({ cat, label }) => (
                  <Link
                    key={cat}
                    href={cat ? `/banco-tecnico?categoria=${encodeURIComponent(cat)}` : '/banco-tecnico'}
                    className={`text-xs px-3 py-2 rounded-full border font-medium ${
                      categoriaAtiva === cat
                        ? 'bg-blue-500 text-white border-blue-400'
                        : 'bg-[#1B3A6B]/40 text-gray-300 border-white/20'
                    }`}
                  >
                    {label}
                  </Link>
                ))}
              </div>
              {/* Desktop: links laterais */}
              <div className="hidden md:block space-y-1">
                <Link
                  href="/banco-tecnico"
                  className={`block w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${!categoriaAtiva ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                  Todas ({(mps as unknown as MP[]).length})
                </Link>
                {categorias.map(cat => (
                  <Link
                    key={cat}
                    href={`/banco-tecnico?categoria=${encodeURIComponent(cat)}`}
                    className={`block w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${categoriaAtiva === cat ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  >
                    {cat}
                  </Link>
                ))}
              </div>
            </div>

            {/* Toxicidade */}
            <div className="hidden md:block">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Toxicidade</p>
              <div className="space-y-1">
                {[{ value: '', label: 'Todas' }, { value: 'baixo', label: '🟢 Baixa' }, { value: 'medio', label: '🟡 Média' }, { value: 'alto', label: '🔴 Alta' }].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setToxicidadeFiltro(value === toxicidadeFiltro ? '' : value)}
                    className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${toxicidadeFiltro === value ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Origem */}
            <div className="hidden md:block">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Origem</p>
              <div className="space-y-1">
                <button onClick={() => setOrigemFiltro('')} className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${!origemFiltro ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}>
                  Todas
                </button>
                {Object.entries(ORIGENS).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setOrigemFiltro(value === origemFiltro ? '' : value)}
                    className={`w-full text-left text-xs px-2 py-1.5 rounded transition-colors ${origemFiltro === value ? 'bg-blue-500/20 text-blue-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Grid de cards */}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 mb-3">{filtradas.length} resultado(s){categoriaAtiva ? ` em "${categoriaAtiva}"` : ''}</p>

            {/* Comparação */}
            {comparar.length > 1 && (
              <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-blue-400 font-medium">Comparando {comparar.length} MPs</span>
                  <button onClick={() => setComparar([])} className="text-xs text-gray-500 hover:text-white">Limpar</button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-blue-500/20">
                        <th className="text-left text-gray-500 pb-2 pr-3">Atributo</th>
                        {mpParaComparar.map(mp => (
                          <th key={mp.id} className="text-left text-white pb-2 pr-3 font-medium">{mp.nome_comercial}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-blue-500/10">
                      {[
                        ['Função', 'funcao_principal'],
                        ['Uso típico', 'faixa_uso_tipica'],
                        ['Toxicidade', 'nivel_toxicidade'],
                        ['Origem', 'origem'],
                        ['Custo (R$/kg)', 'custo'],
                        ['Disponibilidade', 'disponibilidade'],
                      ].map(([label, field]) => (
                        <tr key={field}>
                          <td className="py-1.5 pr-3 text-gray-500">{label}</td>
                          {mpParaComparar.map(mp => (
                            <td key={mp.id} className="py-1.5 pr-3 text-gray-300">
                              {field === 'custo'
                                ? mp.custo_min ? `R$${mp.custo_min}–${mp.custo_max}` : '—'
                                : String((mp as unknown as Record<string, unknown>)[field] || '—')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filtradas.map(mp => {
                const tox = toxicidadeBadge(mp.nivel_toxicidade)
                const isSelected = comparar.includes(mp.id)

                return (
                  <div
                    key={mp.id}
                    className={`bg-[#111f3a] border rounded-xl p-4 cursor-pointer transition-all duration-150 hover:shadow-lg ${
                      isSelected ? 'border-blue-500/50' : 'border-white/8 hover:border-white/15'
                    }`}
                    onClick={() => setMpSelecionada(mp)}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <h3 className="font-semibold text-white text-sm truncate">{mp.nome_comercial}</h3>
                          {(mp as unknown as { adicionada_usuario?: boolean }).adicionada_usuario && (
                            <span title="Adicionada pelo usuário" className="shrink-0">
                              <UserCircle size={13} className="text-green-400" />
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{mp.nome_quimico}</p>
                        {mp.numero_cas && <p className="text-xs text-gray-600">CAS: {mp.numero_cas}</p>}
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full shrink-0 ${tox.color}`}>
                        {tox.label}
                      </span>
                    </div>
                    <p className="text-xs text-blue-300 mb-2">{mp.funcao_principal}</p>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-1.5 flex-wrap">
                        <Badge variant="gray">{mp.subcategoria}</Badge>
                        {mp.origem === 'vegetal' && <Badge variant="green">Bio</Badge>}
                        {mp.nivel_toxicidade === 'alto' && <Badge variant="red">Restrito</Badge>}
                      </div>
                      <div className="text-xs text-gray-500">
                        {mp.custo_min ? `R$${mp.custo_min}–${mp.custo_max}/kg` : ''}
                      </div>
                    </div>
                    <div className="mt-2 flex justify-between items-center">
                      {mp.faixa_uso_tipica && (
                        <span className="text-xs text-gray-500">Uso: {mp.faixa_uso_tipica}</span>
                      )}
                      <button
                        onClick={e => { e.stopPropagation(); toggleComparar(mp.id) }}
                        className={`text-xs px-2 py-0.5 rounded transition-colors ${isSelected ? 'bg-blue-500/30 text-blue-400' : 'bg-white/5 text-gray-500 hover:text-white'}`}
                      >
                        {isSelected ? '✓ Comparar' : '+ Comparar'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal de ficha completa */}
      {mpSelecionada && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setMpSelecionada(null)}
        >
          <div
            className="bg-[#0d1f3c] border border-[#1B3A6B] rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-[#0d1f3c] border-b border-[#1B3A6B]/60 px-6 py-4 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-bold text-white">{mpSelecionada.nome_comercial}</h2>
                <p className="text-sm text-gray-400">{mpSelecionada.nome_quimico}</p>
                {mpSelecionada.numero_cas && <p className="text-xs text-gray-500">CAS: {mpSelecionada.numero_cas}</p>}
              </div>
              <button
                onClick={() => setMpSelecionada(null)}
                className="text-gray-500 hover:text-white transition-colors mt-1"
              >
                <X size={20} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-5">
              {/* Classificação */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="blue">{mpSelecionada.categoria}</Badge>
                <Badge variant="gray">{mpSelecionada.subcategoria}</Badge>
                {mpSelecionada.origem === 'vegetal' && <Badge variant="green">Origem Vegetal</Badge>}
                {mpSelecionada.nivel_toxicidade === 'alto' && <Badge variant="red">Alta Toxicidade</Badge>}
                <Badge variant={mpSelecionada.disponibilidade === 'alta' ? 'green' : mpSelecionada.disponibilidade === 'media' ? 'yellow' : 'red'}>
                  Disponibilidade {mpSelecionada.disponibilidade}
                </Badge>
              </div>

              {/* Função e uso */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Função Principal</p>
                <p className="text-sm text-white">{mpSelecionada.funcao_principal}</p>
              </div>

              {/* Propriedades */}
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Propriedades Físico-Químicas</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['Faixa de uso típica', mpSelecionada.faixa_uso_tipica],
                    ['Aparência', mpSelecionada.aparencia],
                    ['pH estabilidade', mpSelecionada.ph_estabilidade],
                    ['Solubilidade em água', mpSelecionada.solubilidade_agua],
                    ['Origem', ORIGENS[mpSelecionada.origem] || mpSelecionada.origem],
                    ['Custo estimado', mpSelecionada.custo_min ? `R$ ${mpSelecionada.custo_min} – ${mpSelecionada.custo_max}/kg` : undefined],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={String(label)} className="bg-[#0A1628] p-2.5 rounded-lg">
                      <div className="text-xs text-gray-500">{label}</div>
                      <div className="text-sm text-white mt-0.5">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sinergias e incompatibilidades */}
              <div className="grid grid-cols-2 gap-4">
                {mpSelecionada.sinergias.length > 0 && (
                  <div>
                    <p className="text-xs text-green-400 uppercase tracking-wide mb-2">Sinergias</p>
                    <div className="flex flex-wrap gap-1.5">
                      {mpSelecionada.sinergias.map((s, i) => (
                        <span key={i} className="text-xs bg-green-500/15 text-green-400 rounded-full px-2 py-0.5">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
                {mpSelecionada.incompatibilidades.length > 0 && (
                  <div>
                    <p className="text-xs text-red-400 uppercase tracking-wide mb-2">Incompatibilidades</p>
                    <div className="flex flex-wrap gap-1.5">
                      {mpSelecionada.incompatibilidades.map((s, i) => (
                        <span key={i} className="text-xs bg-red-500/15 text-red-400 rounded-full px-2 py-0.5">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Restrições */}
              {(mpSelecionada.restricoes_anvisa || mpSelecionada.restricoes_reach) && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                  <p className="text-xs font-medium text-red-400 uppercase tracking-wide mb-2">Restrições Regulatórias</p>
                  {mpSelecionada.restricoes_anvisa && (
                    <p className="text-xs text-red-300 mb-1"><strong>ANVISA:</strong> {mpSelecionada.restricoes_anvisa}</p>
                  )}
                  {mpSelecionada.restricoes_reach && (
                    <p className="text-xs text-red-300"><strong>REACH:</strong> {mpSelecionada.restricoes_reach}</p>
                  )}
                </div>
              )}

              {/* Certificações */}
              {mpSelecionada.certificacoes.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Certificações</p>
                  <div className="flex flex-wrap gap-1.5">
                    {mpSelecionada.certificacoes.map((c, i) => (
                      <Badge key={i} variant="gold">{c}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Notas técnicas */}
              {mpSelecionada.notas_tecnicas && (
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                  <p className="text-xs font-medium text-blue-400 uppercase tracking-wide mb-2">Notas Técnicas</p>
                  <p className="text-sm text-blue-200">{mpSelecionada.notas_tecnicas}</p>
                </div>
              )}

              {/* Fornecedores */}
              {mpSelecionada.fornecedores.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Fornecedores Típicos (Brasil)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {mpSelecionada.fornecedores.map((f, i) => (
                      <Badge key={i} variant="gray">{f}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
