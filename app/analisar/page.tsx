'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { Card, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { MoleculeLoader } from '@/components/MoleculeLoader'
import { Microscope, Plus, Trash2, AlertTriangle, CheckCircle2, TrendingUp, BookOpen, PenLine, FlaskConical, Wrench, ArrowRight, AlertCircle } from 'lucide-react'

const SEGMENTOS = [
  { value: '', label: 'Selecione...' },
  { value: 'Limpeza e Manutenção Industrial', label: 'Limpeza e Manutenção Industrial' },
  { value: 'Automotivo', label: 'Automotivo' },
  { value: 'Saneantes e Domissanitários', label: 'Saneantes e Domissanitários' },
  { value: 'Tintas, Vernizes, Resinas e Polímeros', label: 'Tintas, Vernizes, Resinas e Polímeros' },
  { value: 'Biossolventes e Biolubrificantes', label: 'Biossolventes e Biolubrificantes' },
]

const SEG_CORES: Record<string, string> = {
  'Limpeza e Manutenção Industrial': 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  'Automotivo': 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  'Saneantes e Domissanitários': 'text-green-400 bg-green-500/10 border-green-500/30',
  'Tintas, Vernizes, Resinas e Polímeros': 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  'Biossolventes e Biolubrificantes': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
}

interface Componente {
  nome: string
  percentual: string
}

interface FormulaSalva {
  id: string
  nome: string
  segmento: string
  createdAt: string
  composicao: {
    formulacao?: {
      descricao_tecnica?: string
      composicao?: Array<{ materia_prima: string; percentual_recomendado?: number; percentual_minimo?: number }>
    }
  }
}

type Modo = 'banco' | 'manual'

export default function AnalisarFormula() {
  const [modo, setModo] = useState<Modo>('banco')
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Fórmulas salvas
  const [formulasSalvas, setFormulasSalvas] = useState<FormulaSalva[]>([])
  const [carregandoLista, setCarregandoLista] = useState(false)
  const [listaCarregada, setListaCarregada] = useState(false)
  const [busca, setBusca] = useState('')

  // Campos do formulário
  const [nome, setNome] = useState('')
  const [segmento, setSegmento] = useState('')
  const [aplicacao, setAplicacao] = useState('')
  const [problemas, setProblemas] = useState('')
  const [componentes, setComponentes] = useState<Componente[]>([
    { nome: '', percentual: '' },
    { nome: '', percentual: '' },
  ])

  const totalPerc = componentes.reduce((acc, c) => acc + (Number(c.percentual) || 0), 0)

  async function carregarLista() {
    if (listaCarregada) return
    setCarregandoLista(true)
    try {
      const res = await fetch('/api/formulacao/listar')
      const data = await res.json()
      setFormulasSalvas(data.formulacoes || [])
      setListaCarregada(true)
    } catch { /* ignore */ } finally {
      setCarregandoLista(false)
    }
  }

  function trocarModo(m: Modo) {
    setModo(m)
    if (m === 'banco') carregarLista()
  }

  function usarFormula(f: FormulaSalva) {
    // Preenche os campos com os dados da fórmula
    setNome(f.nome)
    setSegmento(f.segmento)
    const descTecnica = f.composicao?.formulacao?.descricao_tecnica || ''
    setAplicacao(descTecnica)
    setProblemas('')

    const comps = f.composicao?.formulacao?.composicao || []
    if (comps.length > 0) {
      setComponentes(comps.map(c => ({
        nome: c.materia_prima || '',
        percentual: String(c.percentual_recomendado ?? c.percentual_minimo ?? 0),
      })))
    }

    // Vai para o modo manual com o formulário preenchido
    setModo('manual')
    setError(null)
    setResultado(null)
  }

  function addComponente() {
    setComponentes(prev => [...prev, { nome: '', percentual: '' }])
  }

  function removeComponente(i: number) {
    setComponentes(prev => prev.filter((_, j) => j !== i))
  }

  function updateComponente(i: number, field: keyof Componente, value: string) {
    setComponentes(prev => prev.map((c, j) => j === i ? { ...c, [field]: value } : c))
  }

  async function analisar() {
    const compsFilled = componentes.filter(c => c.nome.trim() && c.percentual)
    if (compsFilled.length < 2) {
      setError('Adicione pelo menos 2 componentes com nome e percentual.')
      return
    }
    setError(null)
    setLoading(true)
    setResultado(null)

    try {
      const res = await fetch('/api/analise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome, segmento, aplicacao, problemas,
          componentes: compsFilled,
        }),
      })
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Erro na análise')
      }
      const data = await res.json()
      setResultado(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  const formulasFiltradas = formulasSalvas.filter(f =>
    f.nome.toLowerCase().includes(busca.toLowerCase()) ||
    f.segmento.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Microscope className="text-yellow-400" size={24} />
          Analisar Fórmula Existente
        </h1>
        <p className="text-gray-400 mt-1 text-sm">
          Insira uma formulação e receba diagnóstico técnico completo com compatibilidade, estabilidade e sugestões.
        </p>
      </div>

      {!resultado && !loading && (
        <div className="space-y-6">

          {/* Seletor de modo */}
          <div className="flex gap-1 bg-[#0d1f3c] border border-[#1B3A6B]/60 rounded-xl p-1">
            <button
              onClick={() => trocarModo('banco')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${modo === 'banco' ? 'bg-[#D4A017]/15 text-[#D4A017] border border-[#D4A017]/30' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <BookOpen size={14} /> Carregar Fórmula Salva
            </button>
            <button
              onClick={() => trocarModo('manual')}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${modo === 'manual' ? 'bg-[#2563EB]/15 text-blue-400 border border-blue-500/30' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <PenLine size={14} /> Entrada Manual
            </button>
          </div>

          {/* MODO BANCO */}
          {modo === 'banco' && (
            <div className="bg-[#111f3a] border border-white/8 rounded-xl p-6">
              <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
                <FlaskConical size={16} className="text-[#D4A017]" />
                Fórmulas Geradas e Salvas
              </h2>
              <p className="text-gray-500 text-xs mb-4">Selecione uma fórmula para pré-preencher o formulário de análise.</p>

              {carregandoLista ? (
                <div className="flex items-center justify-center py-10 gap-3 text-gray-400 text-sm">
                  <div className="w-5 h-5 border-2 border-[#D4A017]/30 border-t-[#D4A017] rounded-full animate-spin" />
                  Carregando fórmulas...
                </div>
              ) : formulasSalvas.length === 0 ? (
                <div className="text-center py-12 text-gray-600">
                  <FlaskConical size={36} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Nenhuma fórmula salva ainda.</p>
                  <p className="text-xs mt-1">Gere uma em <span className="text-blue-400">Nova Formulação</span> e salve para aparecer aqui.</p>
                </div>
              ) : (
                <>
                  {/* Busca */}
                  {formulasSalvas.length > 4 && (
                    <div className="mb-4">
                      <input
                        type="text"
                        value={busca}
                        onChange={e => setBusca(e.target.value)}
                        placeholder="Buscar por nome ou segmento..."
                        className="w-full bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-500"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    {formulasFiltradas.map(f => {
                      const numComps = f.composicao?.formulacao?.composicao?.length ?? 0
                      const data = new Date(f.createdAt).toLocaleDateString('pt-BR')
                      const corSeg = SEG_CORES[f.segmento] || 'text-gray-400 bg-white/5 border-white/10'
                      return (
                        <div key={f.id} className="flex items-center gap-3 bg-[#0A1628] rounded-xl px-4 py-3 border border-white/6 hover:border-white/15 transition-colors group">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-white text-sm truncate">{f.nome}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${corSeg}`}>
                                {f.segmento.split(' e ')[0].split(',')[0]}
                              </span>
                              {numComps > 0 && <span className="text-xs text-gray-600">{numComps} MPs</span>}
                              <span className="text-xs text-gray-700">{data}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => usarFormula(f)}
                            className="shrink-0 text-xs font-medium text-[#D4A017] border border-[#D4A017]/40 hover:bg-[#D4A017]/10 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Usar esta →
                          </button>
                        </div>
                      )
                    })}
                    {formulasFiltradas.length === 0 && busca && (
                      <p className="text-center text-gray-600 text-sm py-6">Nenhuma fórmula encontrada para &quot;{busca}&quot;</p>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          {/* MODO MANUAL (sempre disponível, aparece também após carregar do banco) */}
          {modo === 'manual' && (
            <>
              {/* Aviso se veio do banco */}
              {nome && (
                <div className="p-3 bg-[#D4A017]/10 border border-[#D4A017]/30 rounded-xl flex items-center gap-2">
                  <CheckCircle2 size={14} className="text-[#D4A017] shrink-0" />
                  <p className="text-xs text-[#D4A017]">
                    Fórmula <strong>&quot;{nome}&quot;</strong> carregada — revise os dados e clique em Analisar.
                  </p>
                </div>
              )}

              <div className="bg-[#111f3a] border border-white/8 rounded-xl p-6">
                <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">
                  Dados da Fórmula
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Nome / Código do Produto"
                    id="nome"
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    placeholder="Ex: Desengraxante AX-200"
                  />
                  <Select
                    label="Segmento de Aplicação"
                    id="segmento"
                    options={SEGMENTOS}
                    value={segmento}
                    onChange={e => setSegmento(e.target.value)}
                  />
                  <div className="md:col-span-2">
                    <Textarea
                      label="Aplicação do Produto"
                      id="aplicacao"
                      value={aplicacao}
                      onChange={e => setAplicacao(e.target.value)}
                      placeholder="Descreva como e onde o produto é aplicado..."
                      rows={2}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Textarea
                      label="Problemas Observados (opcional)"
                      id="problemas"
                      value={problemas}
                      onChange={e => setProblemas(e.target.value)}
                      placeholder="Ex: Separação de fases após 30 dias, pH cai com o tempo, baixa eficiência a frio..."
                      rows={2}
                    />
                  </div>
                </div>
              </div>

              {/* Componentes */}
              <div className="bg-[#111f3a] border border-white/8 rounded-xl p-6">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/8">
                  <h2 className="text-base font-semibold text-white">Componentes da Fórmula</h2>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-mono ${Math.abs(totalPerc - 100) < 0.1 ? 'text-green-400' : totalPerc > 100 ? 'text-red-400' : 'text-yellow-400'}`}>
                      Total: {totalPerc.toFixed(1)}%
                    </span>
                    {Math.abs(totalPerc - 100) < 0.1 && <CheckCircle2 size={16} className="text-green-400" />}
                  </div>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 font-medium px-1">
                    <div className="col-span-7">Matéria-prima</div>
                    <div className="col-span-3">% (peso)</div>
                    <div className="col-span-2"></div>
                  </div>
                  {componentes.map((comp, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-center">
                      <input
                        type="text"
                        value={comp.nome}
                        onChange={e => updateComponente(i, 'nome', e.target.value)}
                        placeholder={`Componente ${i + 1}...`}
                        className="col-span-7 bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
                      />
                      <input
                        type="number"
                        value={comp.percentual}
                        onChange={e => updateComponente(i, 'percentual', e.target.value)}
                        placeholder="0.0"
                        step="0.1"
                        min="0"
                        max="100"
                        className="col-span-3 bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
                      />
                      <button
                        onClick={() => removeComponente(i)}
                        className="col-span-2 flex justify-center text-gray-600 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                <Button variant="ghost" size="sm" onClick={addComponente}>
                  <Plus size={14} />
                  Adicionar Componente
                </Button>
              </div>

              {error && (
                <div className="p-4 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 text-sm">
                  {error}
                </div>
              )}

              <Button variant="secondary" size="lg" onClick={analisar} className="w-full border-yellow-600/40 hover:border-yellow-500/60">
                <Microscope size={18} />
                Analisar Formulação
              </Button>
            </>
          )}
        </div>
      )}

      {loading && <MoleculeLoader message="Analisando formulação existente..." />}

      {resultado && !loading && (
        <div className="animate-fade-in-up">
          <button
            onClick={() => { setResultado(null); setError(null) }}
            className="mb-6 text-sm text-gray-400 hover:text-white flex items-center gap-2 transition-colors"
          >
            ← Nova análise
          </button>
          <AnaliseResultado data={resultado} />
        </div>
      )}
    </div>
  )
}

function AnaliseResultado({ data }: { data: Record<string, unknown> }) {
  const scores = data.scores as Record<string, number> | undefined

  return (
    <div className="space-y-4">
      {/* Scores */}
      {scores && (
        <Card gold>
          <CardTitle className="mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-[#D4A017]" />
            Pontuação Geral
          </CardTitle>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(scores).map(([key, val]) => (
              <div key={key} className="text-center">
                <div className="text-2xl font-bold text-white">{val}</div>
                <div className="text-xs text-gray-400 mt-1 capitalize">{key}</div>
                <div className="w-full bg-[#0A1628] rounded-full h-1.5 mt-2">
                  <div
                    className="h-1.5 rounded-full"
                    style={{
                      width: `${val}%`,
                      background: val >= 70 ? '#10B981' : val >= 40 ? '#F59E0B' : '#EF4444'
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Funções dos componentes */}
      {Array.isArray(data.funcao_componentes) && (
        <Card>
          <CardTitle className="mb-4">Função de Cada Componente</CardTitle>
          <div className="space-y-3">
            {(data.funcao_componentes as Array<Record<string, unknown>>).map((comp, i) => (
              <div key={i} className="flex items-start justify-between gap-3 p-3 bg-[#0A1628] rounded-lg">
                <div>
                  <p className="font-medium text-white text-sm">{String(comp.componente)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{String(comp.funcao)}</p>
                  {comp.observacao ? (
                    <p className="text-xs text-yellow-400 mt-0.5">{String(comp.observacao)}</p>
                  ) : null}
                </div>
                <Badge variant={comp.percentual_adequado ? 'green' : 'red'}>
                  {comp.percentual_adequado ? 'OK' : 'Revisar'}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Compatibilidade */}
      {!!data.compatibilidade_quimica && (
        <Card>
          <CardTitle className="mb-4 flex items-center gap-2">
            <AlertTriangle size={15} className="text-yellow-400" />
            Compatibilidade Química
          </CardTitle>
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div className="text-center bg-[#0A1628] p-3 rounded-lg">
              <div className="text-xl font-bold text-white">{(data.compatibilidade_quimica as Record<string, unknown>).score as number}/100</div>
              <div className="text-xs text-gray-500">Score de Compatibilidade</div>
            </div>
          </div>
          {Array.isArray((data.compatibilidade_quimica as Record<string, unknown>).pares_problematicos) && (
            <div className="mb-3">
              <p className="text-xs font-medium text-red-400 mb-2">Pares Problemáticos</p>
              {((data.compatibilidade_quimica as Record<string, unknown>).pares_problematicos as string[]).map((p, i) => (
                <p key={i} className="text-sm text-red-300 flex items-start gap-2">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />{p}
                </p>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Diagnóstico de problemas + Soluções */}
      {Array.isArray(data.diagnostico_problemas) && (data.diagnostico_problemas as Array<Record<string, unknown>>).length > 0 && (
        <Card>
          <CardTitle className="mb-4 flex items-center gap-2">
            <AlertCircle size={15} className="text-red-400" />
            Diagnóstico e Soluções
          </CardTitle>
          <div className="space-y-4">
            {(data.diagnostico_problemas as Array<Record<string, unknown>>).map((d, i) => {
              const urgencia = String(d.urgencia || 'media')
              const acoes = Array.isArray(d.acoes) ? d.acoes as string[] : []
              return (
                <div key={i} className="rounded-xl overflow-hidden border border-red-500/20">
                  {/* Cabeçalho do problema */}
                  <div className="p-3 bg-red-500/10">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="font-semibold text-white text-sm">{String(d.problema)}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${
                        urgencia === 'alta' ? 'text-red-400 border-red-500/40 bg-red-500/10' :
                        urgencia === 'media' ? 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10' :
                        'text-gray-400 border-white/20 bg-white/5'
                      }`}>
                        {urgencia === 'alta' ? '⚠️ Alta' : urgencia === 'media' ? '⚡ Média' : '💡 Baixa'}
                      </span>
                    </div>
                    <p className="text-xs text-red-300"><strong>Causa:</strong> {String(d.causa_provavel)}</p>
                  </div>

                  {/* Solução */}
                  <div className="p-4 bg-green-950/60 border-t border-green-500/30">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Wrench size={13} className="text-green-400 shrink-0" />
                      <p className="text-xs font-bold text-green-400 uppercase tracking-wide">Como resolver</p>
                    </div>

                    {/* Solução resumida */}
                    {!!(d.solucao) && String(d.solucao) !== 'undefined' && String(d.solucao) !== 'null' && (
                      <p className="text-sm text-green-300 font-medium mb-3 leading-relaxed">{String(d.solucao)}</p>
                    )}

                    {/* Ações passo a passo */}
                    {acoes.length > 0 && (
                      <div className="space-y-2">
                        {acoes.map((acao, ai) => (
                          <div key={ai} className="flex items-start gap-2.5 text-sm text-green-200 bg-green-900/30 rounded-lg px-3 py-2">
                            <span className="shrink-0 w-5 h-5 rounded-full bg-green-500/30 border border-green-500/40 flex items-center justify-center text-[10px] font-bold text-green-400 mt-0.5">
                              {ai + 1}
                            </span>
                            <span className="leading-snug">{acao}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Plano Corretivo */}
      {!!(data.plano_corretivo as Record<string, unknown> | undefined) && (
        (() => {
          const plano = data.plano_corretivo as Record<string, unknown>
          const ajustes = Array.isArray(plano.ajustes) ? plano.ajustes as Array<Record<string, unknown>> : []
          if (!plano.resumo && ajustes.length === 0) return null
          return (
            <Card>
              <CardTitle className="mb-4 flex items-center gap-2">
                <Wrench size={15} className="text-blue-400" />
                Plano Corretivo — Ajustes na Fórmula
              </CardTitle>
              {!!plano.resumo && (
                <p className="text-sm text-gray-300 mb-4 leading-relaxed">{String(plano.resumo)}</p>
              )}
              {ajustes.length > 0 && (
                <div className="space-y-2">
                  {ajustes.map((a, i) => {
                    const acao = String(a.acao || '')
                    const corAcao =
                      acao === 'adicionar' ? 'text-green-400 bg-green-500/10 border-green-500/30' :
                      acao === 'remover' ? 'text-red-400 bg-red-500/10 border-red-500/30' :
                      acao === 'substituir' ? 'text-purple-400 bg-purple-500/10 border-purple-500/30' :
                      'text-yellow-400 bg-yellow-500/10 border-yellow-500/30'
                    return (
                      <div key={i} className="flex items-start gap-3 p-3 bg-[#0A1628] rounded-lg border border-white/6">
                        <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 mt-0.5 font-medium ${corAcao}`}>
                          {acao}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-white">{String(a.mp || '')}</span>
                            {!!(a.de) && !!(a.para) && (
                              <span className="flex items-center gap-1 text-xs text-gray-400">
                                <span className="text-red-400 font-mono">{String(a.de)}</span>
                                <ArrowRight size={10} />
                                <span className="text-green-400 font-mono">{String(a.para)}</span>
                              </span>
                            )}
                            {!(a.de) && !!(a.para) && (
                              <span className="text-xs text-green-400 font-mono">{String(a.para)}</span>
                            )}
                          </div>
                          {!!(a.motivo) && (
                            <p className="text-xs text-gray-500 mt-0.5">{String(a.motivo)}</p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>
          )
        })()
      )}

      {/* Sugestões de melhoria */}
      {Array.isArray(data.sugestoes_melhoria) && (data.sugestoes_melhoria as Array<Record<string, unknown>>).length > 0 && (
        <Card>
          <CardTitle className="mb-4 flex items-center gap-2">
            <CheckCircle2 size={15} className="text-green-400" />
            Sugestões de Melhoria
          </CardTitle>
          <div className="space-y-3">
            {(data.sugestoes_melhoria as Array<Record<string, unknown>>).map((s, i) => (
              <div key={i} className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-white text-sm">{String(s.sugestao)}</p>
                  <Badge variant={String(s.impacto) === 'alto' ? 'green' : String(s.impacto) === 'medio' ? 'yellow' : 'gray'}>
                    {String(s.impacto)}
                  </Badge>
                </div>
                <p className="text-xs text-gray-400 mt-1">{String(s.justificativa)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
