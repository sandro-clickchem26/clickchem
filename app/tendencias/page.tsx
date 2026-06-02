'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Textarea, Select } from '@/components/ui/Input'
import { Card, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { MoleculeLoader } from '@/components/MoleculeLoader'
import { TrendingUp, Zap, Target, Search, AlertCircle, ExternalLink, Lock, Globe } from 'lucide-react'

const SEGMENTOS = [
  { value: '', label: 'Selecione...' },
  { value: 'Limpeza e Manutenção Industrial', label: 'Limpeza e Manutenção Industrial' },
  { value: 'Automotivo', label: 'Automotivo' },
  { value: 'Saneantes e Domissanitários', label: 'Saneantes e Domissanitários' },
  { value: 'Tintas, Vernizes, Resinas e Polímeros', label: 'Tintas, Vernizes, Resinas e Polímeros' },
  { value: 'Biosolventes e Biolubrificantes', label: 'Biosolventes e Biolubrificantes' },
  { value: 'Geral / Múltiplos segmentos', label: 'Geral / Múltiplos segmentos' },
]

const TIPOS_ANALISE = [
  { value: '', label: 'Selecione...' },
  { value: 'radar_mercado', label: '📡 Radar de Mercado — tendências globais' },
  { value: 'mercado_nacional', label: '🇧🇷 Mercado Nacional — foco no Brasil' },
  { value: 'mercado_latam', label: '🌎 Mercado LATAM — América Latina' },
  { value: 'detector_lacunas', label: '🔍 Detector de Lacunas — gaps no portfólio' },
  { value: 'gerador_oportunidades', label: '💡 Gerador de Oportunidades — novos produtos' },
  { value: 'analise_competicao', label: '⚔️ Análise de Concorrência' },
]

export default function Tendencias() {
  const [segmento, setSegmento] = useState('')
  const [tipo, setTipo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Pesquisa na internet desativada por padrão — modo fechado
  const [pesquisaAtivada, setPesquisaAtivada] = useState(false)
  const [comandoInternet, setComandoInternet] = useState('')

  function handleComandoInternet() {
    if (comandoInternet.trim().toUpperCase() === 'ATIVAR PESQUISA NA INTERNET') {
      setPesquisaAtivada(true)
      setComandoInternet('')
    }
  }

  async function analisar() {
    if (!segmento || !tipo || !descricao) {
      setError('Preencha todos os campos.')
      return
    }
    setError(null)
    setLoading(true)
    setResultado(null)

    try {
      const res = await fetch('/api/tendencias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segmento, tipo, descricao, pesquisa_ativa: pesquisaAtivada }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Erro na análise')
      }
      const data = await res.json()
      setResultado(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <TrendingUp className="text-purple-400" size={24} />
            Modo Tendências
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Radar de mercado, gaps de portfólio e oportunidades de inovação química.
          </p>
        </div>

        {/* Badge de modo */}
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium ${
          pesquisaAtivada
            ? 'bg-orange-500/15 border-orange-500/40 text-orange-400'
            : 'bg-green-500/10 border-green-500/30 text-green-400'
        }`}>
          {pesquisaAtivada
            ? <><Globe size={14} /> Pesquisa Internet Ativa</>
            : <><Lock size={14} /> Modo Fechado — Dados Internos</>
          }
        </div>
      </div>

      {/* Banner de modo fechado */}
      {!pesquisaAtivada && (
        <div className="mb-5 p-4 bg-[#0f1f0f] border border-green-500/25 rounded-xl">
          <div className="flex items-start gap-3">
            <Lock size={16} className="text-green-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-green-400 mb-1">Modo Fechado Ativo</p>
              <p className="text-xs text-gray-400 leading-relaxed mb-3">
                A análise usa exclusivamente o conhecimento interno do sistema. Nenhuma consulta externa é realizada.
                Para incluir dados em tempo real da web, ative a pesquisa externa com o comando abaixo.
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={comandoInternet}
                  onChange={e => setComandoInternet(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleComandoInternet() }}
                  placeholder="ATIVAR PESQUISA NA INTERNET"
                  className="flex-1 bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-1.5 text-xs text-white placeholder:text-gray-600 font-mono focus:outline-none focus:border-green-500"
                />
                <button
                  onClick={handleComandoInternet}
                  className="px-3 py-1.5 bg-green-700/40 hover:bg-green-600/40 border border-green-500/30 text-green-400 text-xs font-medium rounded-lg transition-colors"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Banner de pesquisa ativa */}
      {pesquisaAtivada && (
        <div className="mb-5 p-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Globe size={16} className="text-orange-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-orange-400 mb-1">Pesquisa na Internet Ativada</p>
                <p className="text-xs text-gray-400">
                  O sistema consultará fontes externas via Tavily Search para enriquecer a análise com dados em tempo real.
                  Verifique sempre as fontes antes de usar como referência oficial.
                </p>
              </div>
            </div>
            <button
              onClick={() => setPesquisaAtivada(false)}
              className="shrink-0 text-xs text-gray-500 hover:text-white border border-white/10 hover:border-white/20 px-2 py-1 rounded-lg transition-colors"
            >
              Desativar
            </button>
          </div>
        </div>
      )}

      {!loading && !resultado && (
        <div className="space-y-4">
          <div className="bg-[#111f3a] border border-white/8 rounded-xl p-6 space-y-4">
            <Select
              label="Segmento de Mercado"
              id="segmento"
              options={SEGMENTOS}
              value={segmento}
              onChange={e => setSegmento(e.target.value)}
            />
            <Select
              label="Tipo de Análise"
              id="tipo"
              options={TIPOS_ANALISE}
              value={tipo}
              onChange={e => setTipo(e.target.value)}
            />
            <Textarea
              label="Contexto / Descrição"
              id="descricao"
              value={descricao}
              onChange={e => setDescricao(e.target.value)}
              placeholder={
                tipo === 'detector_lacunas'
                  ? 'Descreva seu portfólio atual de produtos...'
                  : tipo === 'analise_competicao'
                  ? 'Informe os concorrentes ou produtos que deseja analisar...'
                  : 'Descreva o contexto, foco específico ou perguntas de interesse...'
              }
              rows={4}
            />
          </div>

          {error && (
            <div className="p-4 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <Button variant="secondary" size="lg" onClick={analisar} className="w-full border-purple-500/40">
            <Search size={18} />
            Analisar Tendências {pesquisaAtivada ? '(+ Internet)' : '(Dados Internos)'}
          </Button>
        </div>
      )}

      {loading && <MoleculeLoader message="Analisando tendências de mercado..." />}

      {resultado && !loading && (
        <div className="animate-fade-in-up">
          <button
            onClick={() => { setResultado(null); setError(null) }}
            className="mb-6 text-sm text-gray-400 hover:text-white flex items-center gap-2 transition-colors"
          >
            ← Nova análise
          </button>

          {/* Indicador de modo usado */}
          {(() => {
            const modofechado = Boolean(resultado._modo_fechado)
            return (
              <div className={`mb-4 p-3 rounded-lg border flex items-center gap-2 ${
                modofechado ? 'bg-green-500/10 border-green-500/25' : 'bg-orange-500/10 border-orange-500/25'
              }`}>
                {modofechado
                  ? <><Lock size={13} className="text-green-400" /><p className="text-xs text-green-300">Análise baseada exclusivamente em dados internos do sistema.</p></>
                  : <><Globe size={13} className="text-orange-400" /><p className="text-xs text-orange-300">Análise enriquecida com pesquisa web em tempo real. Confirme fontes antes de usar como referência oficial.</p></>
                }
              </div>
            )
          })()}

          <div className="space-y-4">
            {/* Tendências globais */}
            {Array.isArray(resultado.tendencias_globais) && (
              <Card>
                <CardTitle className="mb-4 flex items-center gap-2">
                  <TrendingUp size={15} className="text-purple-400" />
                  Tendências Globais
                </CardTitle>
                <ul className="space-y-2">
                  {(resultado.tendencias_globais as string[]).map((t, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-purple-400 mt-0.5">→</span>{t}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Claims emergentes */}
            {Array.isArray(resultado.claims_emergentes) && resultado.claims_emergentes.length > 0 && (
              <Card>
                <CardTitle className="mb-3 flex items-center gap-2">
                  <Zap size={15} className="text-yellow-400" />
                  Claims Emergentes
                </CardTitle>
                <div className="flex flex-wrap gap-2">
                  {(resultado.claims_emergentes as string[]).map((c, i) => (
                    <Badge key={i} variant="gold">{c}</Badge>
                  ))}
                </div>
              </Card>
            )}

            {/* Oportunidades */}
            {Array.isArray(resultado.oportunidades) && resultado.oportunidades.length > 0 && (
              <Card>
                <CardTitle className="mb-4 flex items-center gap-2">
                  <Target size={15} className="text-green-400" />
                  Oportunidades Identificadas
                </CardTitle>
                <div className="space-y-3">
                  {(resultado.oportunidades as Array<Record<string, unknown>>).map((op, i) => (
                    <div key={i} className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="font-semibold text-white text-sm">{String(op.titulo)}</h3>
                        <Badge variant={String(op.potencial_mercado) === 'alto' ? 'green' : String(op.potencial_mercado) === 'medio' ? 'yellow' : 'gray'}>
                          Potencial: {String(op.potencial_mercado)}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-300 mb-2">{String(op.descricao)}</p>
                      {!!op.diferencial && (
                        <p className="text-xs text-green-400 mb-3"><strong>Diferencial:</strong> {String(op.diferencial)}</p>
                      )}
                      {Array.isArray(op.produtos_referencia) && op.produtos_referencia.length > 0 && (
                        <div className="mt-3 border-t border-green-500/20 pt-3">
                          <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Produtos de Referência</p>
                          <div className="space-y-2">
                            {(op.produtos_referencia as Array<Record<string, unknown>>).map((prod, j) => (
                              <div key={j} className="flex items-start justify-between gap-2 bg-[#0A1628]/60 rounded-lg px-3 py-2">
                                <div>
                                  <span className="text-sm font-medium text-white">{String(prod.nome)}</span>
                                  <span className="text-xs text-gray-400 ml-2">— {String(prod.empresa)}</span>
                                  {!!prod.observacao && <p className="text-xs text-gray-500 mt-0.5">{String(prod.observacao)}</p>}
                                </div>
                                {!!prod.site && String(prod.site) !== '...' && (
                                  <a href={`https://${String(prod.site).replace(/^https?:\/\//, '')}`} target="_blank" rel="noopener noreferrer"
                                    className="text-blue-400 hover:text-blue-300 shrink-0 flex items-center gap-1 text-xs">
                                    <ExternalLink size={11} /> {String(prod.site)}
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Lacunas */}
            {Array.isArray(resultado.lacunas_identificadas) && resultado.lacunas_identificadas.length > 0 && (
              <Card>
                <CardTitle className="mb-3 flex items-center gap-2">
                  <Search size={15} className="text-blue-400" />
                  Lacunas Identificadas
                </CardTitle>
                <ul className="space-y-2">
                  {(resultado.lacunas_identificadas as string[]).map((l, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-blue-400 mt-0.5">◆</span>{l}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {/* Resultados diretos da busca web — só aparecem se pesquisa estava ativa */}
            {Array.isArray(resultado._busca_resultados) && (resultado._busca_resultados as Array<Record<string, unknown>>).length > 0 && (
              <Card>
                <CardTitle className="mb-1 flex items-center gap-2">
                  <Globe size={15} className="text-orange-400" />
                  Resultados da Busca Web
                </CardTitle>
                <p className="text-xs text-gray-500 mb-4">
                  Fontes encontradas diretamente pelo motor de busca — sem intermediação da IA.
                </p>
                <div className="space-y-2">
                  {(resultado._busca_resultados as Array<Record<string, unknown>>).map((r, i) => (
                    <a key={i} href={String(r.url)} target="_blank" rel="noopener noreferrer"
                      className="block p-3 bg-blue-500/8 border border-blue-500/20 rounded-lg hover:border-blue-400/40 transition-colors group">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <span className="text-sm font-medium text-white leading-snug group-hover:text-blue-200 transition-colors">{String(r.titulo)}</span>
                        <ExternalLink size={11} className="text-blue-400 shrink-0 mt-0.5" />
                      </div>
                      <p className="text-xs text-blue-400 mb-1.5">{String(r.site)}</p>
                      {!!r.snippet && <p className="text-xs text-gray-400 leading-relaxed line-clamp-3">{String(r.snippet)}</p>}
                    </a>
                  ))}
                </div>
              </Card>
            )}

            {/* Insights */}
            {!!resultado.insights && (
              <Card>
                <CardTitle className="mb-3">Insights Estratégicos</CardTitle>
                <p className="text-sm text-gray-300 leading-relaxed">{String(resultado.insights)}</p>
              </Card>
            )}

            {/* Alerta de limitação quando em modo fechado */}
            {Boolean(resultado._modo_fechado) && (
              <div className="p-3 bg-[#111f3a] border border-white/8 rounded-lg flex items-start gap-2">
                <AlertCircle size={13} className="text-gray-500 mt-0.5 shrink-0" />
                <p className="text-xs text-gray-500">
                  Esta análise foi gerada em Modo Fechado, sem acesso à internet.
                  Para enriquecer com dados externos em tempo real, use o comando <span className="font-mono text-gray-400">ATIVAR PESQUISA NA INTERNET</span>.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
