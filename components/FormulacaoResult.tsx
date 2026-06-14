'use client'
import { useState } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { viabilidadeBadge, toxicidadeBadge, formatCurrency } from '@/lib/utils'
import {
  ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Info,
  FlaskConical, Beaker, Shield, Leaf, ClipboardList, FileText
} from 'lucide-react'

interface FormulacaoResultProps {
  data: Record<string, unknown>
  onSalvar?: () => void
  onRelatorio?: () => void
  onRefinar?: (instrucoes: string) => void
}

function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Card className="mb-4">
      <button
        className="w-full flex items-center justify-between text-left"
        onClick={() => setOpen(!open)}
      >
        <CardTitle className="flex items-center gap-2">
          <Icon size={16} className="text-blue-400" />
          {title}
        </CardTitle>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>
      {open && <div className="mt-4">{children}</div>}
    </Card>
  )
}

export function FormulacaoResult({ data, onSalvar, onRelatorio, onRefinar }: FormulacaoResultProps) {
  const [refinarInstrucoes, setRefinarInstrucoes] = useState('')
  const [showRefinar, setShowRefinar] = useState(false)
  // Custos reais por índice de MP (sobrescreve estimativa da IA)
  const [custosReais, setCustosReais] = useState<Record<number, string>>({})
  // Percentuais ajustados pelo usuário (sobrescreve sugestão da IA)
  const [percReais, setPercReais] = useState<Record<number, string>>({})

  const analise = data.analise_critica as Record<string, unknown> | undefined
  const formulacao = data.formulacao as Record<string, unknown> | undefined
  const fonte = String(data.fonte || '')
  const formulaReferencia = String(data.formula_referencia || '')
  const processo = data.processo_fabricacao as Record<string, unknown> | undefined
  const cq = data.controle_qualidade as Record<string, unknown> | undefined
  const riscos = data.riscos_tecnicos as Array<Record<string, unknown>> | undefined
  const sustentabilidade = data.sustentabilidade as Record<string, unknown> | undefined

  const viabilidade = viabilidadeBadge(String(analise?.viabilidade || 'media'))
  const composicao = (formulacao?.composicao as Array<Record<string, unknown>>) || []

  // Percentual efetivo: usa valor do usuário se houver, senão o da IA
  function effectivePerc(i: number): number {
    const v = percReais[i]
    if (v !== undefined && v !== '' && !isNaN(Number(v))) return Number(v)
    return Number(composicao[i]?.percentual_recomendado) || 0
  }

  // Total dinâmico (reage a edições do usuário)
  const totalPerc = composicao.reduce((acc, _, i) => acc + effectivePerc(i), 0)
  const totalColor = Math.abs(totalPerc - 100) < 0.5 ? 'text-green-400'
    : totalPerc > 100 ? 'text-red-400' : 'text-yellow-400'

  // Custo real por kg: usa custo digitado pelo usuário ou estimativa da IA como fallback
  const custoRealKg = composicao.reduce((acc, comp, i) => {
    const perc = effectivePerc(i)
    const custoStr = custosReais[i]
    const custo = custoStr !== undefined && custoStr !== '' && !isNaN(Number(custoStr))
      ? Number(custoStr)
      : (Number(comp.custo_estimado_kg) || 0)
    return acc + (perc / 100) * custo
  }, 0)
  const temCustoReal = Object.values(custosReais).some(v => v !== '' && !isNaN(Number(v)))

  return (
    <div className="animate-fade-in-up">
      {/* Cabeçalho do resultado */}
      <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">{String(formulacao?.nome_sugerido || 'Formulação Gerada')}</h2>
          <p className="text-gray-400 mt-1 text-sm">{String(formulacao?.descricao_tecnica || '')}</p>
          {fonte && (
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                fonte.includes('P&D Proprietário')
                  ? 'bg-blue-500/15 border-blue-500/40 text-blue-300'
                  : fonte.includes('Busca Externa')
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-gray-500/15 border-gray-500/40 text-gray-400'
              }`}>
                {fonte.includes('P&D Proprietário') ? '🏭' : fonte.includes('Busca Externa') ? '🌐' : '📋'}
                {' '}{fonte}
              </span>
              {formulaReferencia && formulaReferencia !== 'null' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-white/5 border border-white/10 text-gray-400">
                  Ref: {formulaReferencia}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          {onRefinar && (
            <Button variant="secondary" size="sm" onClick={() => setShowRefinar(!showRefinar)}>
              <FlaskConical size={14} /> Refinar
            </Button>
          )}
          {onSalvar && (
            <Button variant="secondary" size="sm" onClick={onSalvar}>
              Salvar
            </Button>
          )}
          {onRelatorio && (
            <Button variant="gold" size="sm" onClick={onRelatorio}>
              <FileText size={14} /> Relatório PDF
            </Button>
          )}
        </div>
      </div>

      {/* Refinar */}
      {showRefinar && (
        <Card className="mb-4 border-blue-500/30">
          <p className="text-sm text-gray-300 mb-2">Instruções para refinamento:</p>
          <textarea
            value={refinarInstrucoes}
            onChange={e => setRefinarInstrucoes(e.target.value)}
            placeholder="Ex: Aumentar pH para 10, substituir EDTA por GLDA, reduzir custo abaixo de R$8/kg..."
            className="w-full bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 resize-y min-h-[80px] focus:outline-none focus:border-blue-500"
          />
          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowRefinar(false)}>Cancelar</Button>
            <Button variant="primary" size="sm" onClick={() => { onRefinar?.(refinarInstrucoes); setShowRefinar(false) }}>
              Aplicar Refinamento
            </Button>
          </div>
        </Card>
      )}

      {/* Análise Crítica */}
      <Section title="Análise Crítica" icon={AlertTriangle}>
        <div className="mb-3">
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold ${viabilidade.color}`}>
            {viabilidade.label}
          </span>
        </div>

        {!!analise?.abordagem_quimica && (
          <div className="mb-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-sm text-blue-300"><strong>Abordagem:</strong> {String(analise.abordagem_quimica)}</p>
          </div>
        )}

        {Array.isArray(analise?.pontos_de_atencao) && analise.pontos_de_atencao.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium text-red-400 uppercase tracking-wide mb-2">Pontos de Atenção</p>
            <ul className="space-y-1.5">
              {(analise.pontos_de_atencao as string[]).map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <AlertTriangle size={13} className="text-red-400 mt-0.5 shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}

        {Array.isArray(analise?.hipoteses_a_validar) && analise.hipoteses_a_validar.length > 0 && (
          <div className="mb-3">
            <p className="text-xs font-medium text-yellow-400 uppercase tracking-wide mb-2">Hipóteses a Validar</p>
            <ul className="space-y-1.5">
              {(analise.hipoteses_a_validar as string[]).map((h, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                  <Info size={13} className="text-yellow-400 mt-0.5 shrink-0" />
                  {h}
                </li>
              ))}
            </ul>
          </div>
        )}

        {Array.isArray(analise?.informacoes_faltantes) && analise.informacoes_faltantes.length > 0 && (
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-2">Informações Faltantes</p>
            <ul className="space-y-1.5">
              {(analise.informacoes_faltantes as string[]).map((inf, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                  <Info size={13} className="text-gray-500 mt-0.5 shrink-0" />
                  {inf}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Section>

      {/* Composição */}
      <Section title="Composição da Fórmula" icon={Beaker}>
        {/* Cards de métricas rápidas */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-[#0A1628] rounded-lg p-3 text-center">
            <div className="text-lg font-bold text-[#D4A017]">{composicao.length}</div>
            <div className="text-xs text-gray-500">Componentes</div>
          </div>
          <div className="bg-[#0A1628] rounded-lg p-3 text-center">
            <div className={`text-lg font-bold ${totalColor}`}>{totalPerc.toFixed(1)}%</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div className="bg-[#0A1628] rounded-lg p-3 text-center">
            <div className={`text-lg font-bold ${temCustoReal ? 'text-[#D4A017]' : 'text-green-400'}`}>
              {custoRealKg > 0 ? formatCurrency(custoRealKg) : (formulacao?.custo_estimado_total ? formatCurrency(Number(formulacao.custo_estimado_total)) : 'N/A')}
            </div>
            <div className="text-xs text-gray-500">{temCustoReal ? 'Custo Real/kg ✓' : 'Custo IA/kg'}</div>
          </div>
        </div>

        {/* Propriedades esperadas */}
        {!!(formulacao?.ph_final_esperado || formulacao?.viscosidade_estimada) && (
          <div className="flex flex-wrap gap-2 mb-4">
            {!!formulacao.ph_final_esperado && (
              <Badge variant="blue">pH: {String(formulacao.ph_final_esperado)}</Badge>
            )}
            {!!formulacao.viscosidade_estimada && (
              <Badge variant="gray">Viscosidade: {String(formulacao.viscosidade_estimada)}</Badge>
            )}
            {!!formulacao.cor_esperada && (
              <Badge variant="gray">Cor: {String(formulacao.cor_esperada)}</Badge>
            )}
          </div>
        )}

        {/* Tabela de composição */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#1B3A6B]/60">
                <th className="text-left text-xs text-gray-500 pb-2 font-medium">Matéria-Prima</th>
                <th className="text-left text-xs text-gray-500 pb-2 font-medium">Função</th>
                <th className="text-center text-xs text-gray-500 pb-2 font-medium">%</th>
                <th className="text-center text-xs text-gray-500 pb-2 font-medium">Toxicidade</th>
                <th className="text-right text-xs text-gray-500 pb-2 font-medium">R$/kg <span className="text-blue-400 font-normal">(seu custo)</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1B3A6B]/30">
              {composicao.map((comp, i) => {
                const tox = toxicidadeBadge(String(comp.nivel_toxicidade || 'medio'))
                const perc = Number(comp.percentual_recomendado) || 0
                const range = comp.percentual_minimo !== comp.percentual_maximo
                  ? `${comp.percentual_minimo}–${comp.percentual_maximo}%`
                  : null

                return (
                  <tr key={i} className="group">
                    <td className="py-2.5 pr-3">
                      <div className="font-medium text-white text-sm">{String(comp.materia_prima)}</div>
                      {!!comp.numero_cas && String(comp.numero_cas) !== 'N/A' && (
                        <div className="text-xs text-gray-400 mt-0.5">CAS {String(comp.numero_cas)}</div>
                      )}
                      {!!comp.justificativa && (
                        <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{String(comp.justificativa)}</div>
                      )}
                      {Array.isArray(comp.alternativas) && comp.alternativas.length > 0 && (
                        <div className="text-xs text-blue-400 mt-0.5">
                          Alt: {(comp.alternativas as string[]).join(', ')}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-gray-400 text-xs">{String(comp.funcao_tecnica)}</td>
                    <td className="py-2.5 pr-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={percReais[i] !== undefined ? percReais[i] : String(perc)}
                          onChange={e => setPercReais(prev => ({ ...prev, [i]: e.target.value }))}
                          className="w-14 text-center bg-[#0A1628] border border-[#1B3A6B] rounded px-1 py-1 text-sm font-semibold text-white focus:outline-none focus:border-blue-500"
                        />
                        <span className="text-xs text-gray-400">%</span>
                        {percReais[i] !== undefined && (
                          <button
                            onClick={() => setPercReais(prev => { const n = { ...prev }; delete n[i]; return n })}
                            className="text-gray-600 hover:text-gray-300 text-sm leading-none"
                            title="Restaurar original"
                          >↺</button>
                        )}
                      </div>
                      {range && <div className="text-xs text-gray-500 mt-0.5">{range}</div>}
                      <div className="mt-1 w-full bg-[#0A1628] rounded-full h-1">
                        <div
                          className="bg-blue-500 h-1 rounded-full transition-all"
                          style={{ width: `${Math.min((effectivePerc(i) / (totalPerc || 100)) * 100, 100)}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-2.5 pr-3 text-center">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${tox.color}`}>
                        {tox.label}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="text-xs text-gray-600">R$</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={custosReais[i] ?? ''}
                          onChange={e => setCustosReais(prev => ({ ...prev, [i]: e.target.value }))}
                          placeholder={comp.custo_estimado_kg ? Number(comp.custo_estimado_kg).toFixed(3) : '0.000'}
                          className="w-20 text-right bg-[#0A1628] border border-[#1B3A6B] rounded px-2 py-1 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Processo de Fabricação */}
      {processo && (
        <Section title="Processo de Fabricação" icon={ClipboardList} defaultOpen={false}>
          {/* Etapas */}
          {Array.isArray(processo.ordem_adicao) && (
            <div className="space-y-3 mb-4">
              {(processo.ordem_adicao as Array<Record<string, unknown>>).map((etapa, i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-[#2563EB]/20 border border-blue-500/30 flex items-center justify-center shrink-0 text-blue-400 text-xs font-bold">
                    {Number(etapa.etapa)}
                  </div>
                  <div>
                    <p className="text-sm text-white">{String(etapa.acao)}</p>
                    {!!etapa.observacao && (
                      <p className="text-xs text-gray-500 mt-0.5">{String(etapa.observacao)}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-4">
            {!!processo.temperatura_processo && (
              <div className="bg-[#0A1628] rounded-lg p-3">
                <div className="text-xs text-gray-500">Temperatura</div>
                <div className="text-sm text-white mt-1">{String(processo.temperatura_processo)}</div>
              </div>
            )}
            {!!processo.tempo_mistura && (
              <div className="bg-[#0A1628] rounded-lg p-3">
                <div className="text-xs text-gray-500">Tempo de Mistura</div>
                <div className="text-sm text-white mt-1">{String(processo.tempo_mistura)}</div>
              </div>
            )}
          </div>

          {Array.isArray(processo.precaucoes_seguranca) && processo.precaucoes_seguranca.length > 0 && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-2">
                <Shield size={12} className="inline mr-1" />
                Precauções de Segurança
              </p>
              <ul className="space-y-1">
                {(processo.precaucoes_seguranca as string[]).map((p, i) => (
                  <li key={i} className="text-xs text-red-300">{p}</li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {/* Controle de Qualidade */}
      {cq && (
        <Section title="Controle de Qualidade" icon={CheckCircle2} defaultOpen={false}>
          {Array.isArray(cq.parametros) && (
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#1B3A6B]/60">
                    <th className="text-left text-xs text-gray-500 pb-2">Parâmetro</th>
                    <th className="text-left text-xs text-gray-500 pb-2">Método</th>
                    <th className="text-left text-xs text-gray-500 pb-2">Especificação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1B3A6B]/30">
                  {(cq.parametros as Array<Record<string, unknown>>).map((param, i) => (
                    <tr key={i}>
                      <td className="py-2 pr-3 font-medium text-white">{String(param.parametro)}</td>
                      <td className="py-2 pr-3 text-gray-400 text-xs">{String(param.metodo)}</td>
                      <td className="py-2 text-gray-300 text-xs">{String(param.especificacao)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {Array.isArray(cq.testes_estabilidade) && cq.testes_estabilidade.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Testes de Estabilidade</p>
              <div className="flex flex-wrap gap-2">
                {(cq.testes_estabilidade as string[]).map((t, i) => (
                  <Badge key={i} variant="blue">{t}</Badge>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(cq.testes_desempenho) && cq.testes_desempenho.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Testes de Desempenho</p>
              <div className="flex flex-wrap gap-2">
                {(cq.testes_desempenho as string[]).map((t, i) => (
                  <Badge key={i} variant="gray">{t}</Badge>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* Riscos Técnicos */}
      {riscos && riscos.length > 0 && (
        <Section title="Riscos Técnicos" icon={AlertTriangle} defaultOpen={false}>
          <div className="space-y-3">
            {riscos.map((risco, i) => {
              const probColor = {
                alta: 'border-red-500/40 bg-red-500/10',
                media: 'border-yellow-500/40 bg-yellow-500/10',
                baixa: 'border-green-500/40 bg-green-500/10',
              }[String(risco.probabilidade)] || 'border-gray-500/40 bg-gray-500/10'

              return (
                <div key={i} className={`p-3 rounded-lg border ${probColor}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm text-white font-medium">{String(risco.risco)}</p>
                    <Badge variant={
                      String(risco.probabilidade) === 'alta' ? 'red' :
                      String(risco.probabilidade) === 'media' ? 'yellow' : 'green'
                    }>
                      {String(risco.probabilidade)}
                    </Badge>
                  </div>
                  {!!risco.mitigacao && (
                    <p className="text-xs text-gray-400 mt-1.5">
                      <strong className="text-gray-300">Mitigação:</strong> {String(risco.mitigacao)}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* Sustentabilidade */}
      {sustentabilidade && (
        <Section title="Sustentabilidade" icon={Leaf} defaultOpen={false}>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-gray-400">Score de Sustentabilidade</span>
              <span className="text-sm font-bold text-white">{Number(sustentabilidade.pontuacao)}/10</span>
            </div>
            <div className="w-full bg-[#0A1628] rounded-full h-3">
              <div
                className="h-3 rounded-full transition-all"
                style={{
                  width: `${Math.min(Number(sustentabilidade.pontuacao) * 10, 100)}%`,
                  background: Number(sustentabilidade.pontuacao) >= 7 ? '#10B981' :
                    Number(sustentabilidade.pontuacao) >= 4 ? '#F59E0B' : '#EF4444'
                }}
              />
            </div>
          </div>

          {!!sustentabilidade.biodegradabilidade_estimada && (
            <p className="text-sm text-gray-300 mb-3">
              <strong className="text-gray-400">Biodegradabilidade:</strong> {String(sustentabilidade.biodegradabilidade_estimada)}
            </p>
          )}

          {Array.isArray(sustentabilidade.alternativas_sustentaveis) && sustentabilidade.alternativas_sustentaveis.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Alternativas Mais Verdes</p>
              <ul className="space-y-1.5">
                {(sustentabilidade.alternativas_sustentaveis as string[]).map((alt, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                    <Leaf size={12} className="text-green-400 mt-0.5 shrink-0" />
                    {alt}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Section>
      )}

      {/* Próximos Passos */}
      {Array.isArray(data.proximos_passos) && (data.proximos_passos as string[]).length > 0 && (
        <Card className="mb-4">
          <CardTitle className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={16} className="text-green-400" />
            Próximos Passos
          </CardTitle>
          <ol className="space-y-2">
            {(data.proximos_passos as string[]).map((passo, i) => (
              <li key={i} className="flex items-start gap-3 text-sm text-gray-300">
                <span className="w-5 h-5 bg-[#2563EB]/20 rounded-full flex items-center justify-center text-blue-400 text-xs shrink-0 mt-0.5">
                  {i + 1}
                </span>
                {passo}
              </li>
            ))}
          </ol>
          {!!data.classificacao_regulatoria && (
            <div className="mt-3 pt-3 border-t border-[#1B3A6B]/40">
              <span className="text-xs text-gray-500">Classificação Regulatória: </span>
              <span className="text-xs text-white">{String(data.classificacao_regulatoria)}</span>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}
