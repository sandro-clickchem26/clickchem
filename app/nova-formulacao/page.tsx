'use client'
import { useState, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { MoleculeLoader } from '@/components/MoleculeLoader'
import { FormulacaoResult } from '@/components/FormulacaoResult'
import { FlaskConical, Plus, X } from 'lucide-react'
import { gerarCodigoRelatorio } from '@/lib/utils'
import { gerarFormulacaoPDF } from '@/lib/pdf'

const SEGMENTOS = [
  { value: '', label: 'Selecione o segmento...' },
  { value: 'Limpeza e Manutenção Industrial', label: 'Limpeza e Manutenção Industrial' },
  { value: 'Automotivo', label: 'Automotivo' },
  { value: 'Saneantes e Domissanitários', label: 'Saneantes e Domissanitários' },
  { value: 'Tintas, Vernizes, Resinas e Polímeros', label: 'Tintas, Vernizes, Resinas e Polímeros' },
  { value: 'Biossolventes, Biopolímeros e Biolubrificantes', label: 'Biossolventes e Biolubrificantes' },
]
const VISCOSIDADES = [
  { value: '', label: 'Selecione...' },
  { value: 'Líquido fluido (< 100 cP)', label: 'Líquido fluido (< 100 cP)' },
  { value: 'Líquido viscoso (100–1000 cP)', label: 'Líquido viscoso (100–1000 cP)' },
  { value: 'Gel (1000–10000 cP)', label: 'Gel (1000–10000 cP)' },
  { value: 'Pasta / sólido', label: 'Pasta / sólido' },
]
const FORMAS_FISICAS = [
  { value: '', label: 'Selecione...' },
  { value: 'Concentrado (diluir em uso)', label: 'Concentrado (diluir em uso)' },
  { value: 'Pronto para uso (RTU)', label: 'Pronto para uso (RTU)' },
  { value: 'Sólido / pó / pastilha', label: 'Sólido / pó / pastilha' },
]
const METODOS_APLICACAO = [
  { value: '', label: 'Selecione...' },
  { value: 'Imersão / tanque', label: 'Imersão / tanque' },
  { value: 'Spray / aspersão', label: 'Spray / aspersão' },
  { value: 'Pano / esfregão manual', label: 'Pano / esfregão manual' },
  { value: 'Circulação em sistema fechado', label: 'Circulação em sistema fechado' },
]
const TOXICIDADES = [
  { value: 'baixo', label: '🟢 Baixa toxicidade (prioritário)' },
  { value: 'medio', label: '🟡 Toxicidade moderada (aceitável com controles)' },
  { value: 'alto', label: '🔴 Sem restrição (eficiência é prioridade)' },
]
const VOLUMES = [
  { value: '', label: 'Selecione...' },
  { value: 'Bancada / laboratório (< 50L)', label: 'Bancada / laboratório (< 50L)' },
  { value: 'Piloto (50–500L)', label: 'Piloto (50–500L)' },
  { value: 'Industrial (> 500L)', label: 'Industrial (> 500L)' },
]
const ODORES = [
  { value: '', label: 'Selecione...' },
  { value: 'Inodoro', label: 'Inodoro' },
  { value: 'Perfumado suave', label: 'Perfumado suave' },
  { value: 'Neutro / técnico', label: 'Neutro / técnico' },
  { value: 'Sem preferência', label: 'Sem preferência' },
]

const FORM_INICIAL = {
  segmento: '',
  descricao: '',
  substrato: '',
  sujeira: '',
  ph_min: '',
  ph_max: '',
  viscosidade: '',
  forma_fisica: '',
  temperatura: '',
  metodo_aplicacao: '',
  toxicidade: 'baixo',
  regulatorios: [] as string[],
  certificacoes: [] as string[],
  performance: '',
  custo_alvo: '',
  volume: '',
  odor: '',
}

export default function NovaFormulacao() {
  const [form, setForm] = useState<typeof FORM_INICIAL>(FORM_INICIAL)
  const [mpProib, setMpProib] = useState<string[]>([])
  const [mpObrig, setMpObrig] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [novaMP, setNovaMP] = useState('')
  const [novaMPObrig, setNovaMPObrig] = useState('')

  // ref espelha o estado atual para closures síncronas
  const r = useRef({ form: FORM_INICIAL, mpProib: [] as string[], mpObrig: [] as string[] })

  function campo(field: string, value: string) {
    const f = { ...r.current.form, [field]: value } as typeof FORM_INICIAL
    r.current.form = f
    setForm(f)
  }

  function check(field: 'regulatorios' | 'certificacoes', value: string) {
    const lista = r.current.form[field]
    const nova = lista.includes(value) ? lista.filter(v => v !== value) : [...lista, value]
    const f = { ...r.current.form, [field]: nova } as typeof FORM_INICIAL
    r.current.form = f
    setForm(f)
  }

  function addProib() {
    const v = novaMP.trim()
    if (!v || r.current.mpProib.includes(v)) return
    const n = [...r.current.mpProib, v]
    r.current.mpProib = n
    setMpProib(n)
    setNovaMP('')
  }

  function addObrig() {
    const v = novaMPObrig.trim()
    if (!v || r.current.mpObrig.includes(v)) return
    const n = [...r.current.mpObrig, v]
    r.current.mpObrig = n
    setMpObrig(n)
    setNovaMPObrig('')
  }

  function remProib(i: number) {
    const n = r.current.mpProib.filter((_, j) => j !== i)
    r.current.mpProib = n
    setMpProib(n)
  }

  function remObrig(i: number) {
    const n = r.current.mpObrig.filter((_, j) => j !== i)
    r.current.mpObrig = n
    setMpObrig(n)
  }

  async function gerar() {
    if (!form.segmento || !form.descricao) {
      setError('Preencha o segmento e a descrição do produto.')
      return
    }
    setError(null)
    setLoading(true)
    setResultado(null)
    try {
      const res = await fetch('/api/formulacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, materias_proibidas: mpProib, materias_obrigatorias: mpObrig }),
      })
      if (!res.ok) throw new Error((await res.json()).error || 'Erro ao gerar formulação')
      const data = await res.json()
      setResultado(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  async function salvar() {
    if (!resultado) return
    try {
      await fetch('/api/formulacao/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formulacao: resultado, segmento: form.segmento }),
      })
      alert('Formulação salva com sucesso!')
    } catch { alert('Erro ao salvar formulação.') }
  }

  async function gerarPDF() {
    if (!resultado) return
    try {
      await gerarFormulacaoPDF({
        data: resultado,
        nome: String((resultado?.formulacao as Record<string, unknown>)?.nome_sugerido || 'Formulação'),
        segmento: form.segmento,
        codigoRelatorio: gerarCodigoRelatorio(),
      })
    } catch (err) {
      console.error('Erro ao gerar PDF:', err)
      alert('Erro ao gerar PDF. Verifique o console.')
    }
  }

  async function refinar(instrucoes: string) {
    setLoading(true)
    try {
      // Detecta se a chamada veio do botão "Prosseguir sem Referência"
      const isAutorizacao = instrucoes === 'usuario_autoriza_composicao_sem_referencia'
      const payload: Record<string, unknown> = {
        ...form,
        materias_proibidas: mpProib,
        materias_obrigatorias: mpObrig,
        formulacao_anterior: resultado,
      }
      if (isAutorizacao) {
        // Autorização: envia o flag boolean (não como instrução de refinamento)
        payload.usuario_autoriza_composicao_sem_referencia = true
      } else {
        // Refinamento normal
        payload.refinamento = instrucoes
      }
      const res = await fetch('/api/formulacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      setResultado(await res.json())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao refinar')
    } finally {
      setLoading(false)
    }
  }

  const titulo = (
    <div className="mb-8">
      <h1 className="text-2xl font-bold text-white flex items-center gap-3">
        <FlaskConical className="text-blue-400" size={24} />
        Nova Formulação
      </h1>
      <p className="text-gray-400 mt-1 text-sm">
        Descreva a necessidade industrial e o sistema gerará uma formulação com análise crítica completa.
      </p>
    </div>
  )

  if (resultado) return (
    <div>
      {titulo}
      <button type="button" onClick={() => {
        setResultado(null)
        setError(null)
      }}
        className="mb-6 text-sm text-gray-400 hover:text-white flex items-center gap-2 transition-colors">
        ← Nova formulação
      </button>
      <FormulacaoResult data={resultado} onSalvar={salvar} onRelatorio={gerarPDF} onRefinar={refinar} />
    </div>
  )

  if (loading) return (
    <div>
      {titulo}
      <MoleculeLoader message="Gerando formulação com análise crítica..." />
    </div>
  )

  return (
    <div>
      {titulo}
      <form onSubmit={e => e.preventDefault()} className="space-y-6">

        {/* SOBRE O PRODUTO */}
        <div className="bg-[#111f3a] border border-white/8 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">Sobre o Produto</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Select label="Segmento de Aplicação *" id="segmento" options={SEGMENTOS} value={form.segmento} onChange={e => campo('segmento', e.target.value)} />
            </div>
            <div className="md:col-span-2">
              <Textarea label="Descrição do Produto Desejado *" id="descricao" value={form.descricao} onChange={e => campo('descricao', e.target.value)} placeholder="Ex: Desengraxante alcalino para peças metálicas com alta aderência de graxa mineral..." rows={3} />
            </div>
            <Input label="Substrato / Superfície de Aplicação" id="substrato" value={form.substrato} onChange={e => campo('substrato', e.target.value)} placeholder="Ex: Aço inox, Alumínio, Plástico ABS" />
            <Input label="Tipo de Sujeira / Resíduo / Contaminante" id="sujeira" value={form.sujeira} onChange={e => campo('sujeira', e.target.value)} placeholder="Ex: Óleo mineral de corte, Graxa sintética" />
          </div>
        </div>

        {/* PARÂMETROS TÉCNICOS */}
        <div className="bg-[#111f3a] border border-white/8 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">Parâmetros Técnicos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex gap-3 items-end">
              <Input label="pH mínimo" id="ph_min" type="number" min="1" max="14" step="0.5" value={form.ph_min} onChange={e => campo('ph_min', e.target.value)} placeholder="1" className="w-full" />
              <Input label="pH máximo" id="ph_max" type="number" min="1" max="14" step="0.5" value={form.ph_max} onChange={e => campo('ph_max', e.target.value)} placeholder="14" className="w-full" />
            </div>
            <Select label="Viscosidade Esperada" id="viscosidade" options={VISCOSIDADES} value={form.viscosidade} onChange={e => campo('viscosidade', e.target.value)} />
            <Select label="Forma Física do Produto" id="forma_fisica" options={FORMAS_FISICAS} value={form.forma_fisica} onChange={e => campo('forma_fisica', e.target.value)} />
            <Input label="Temperatura de Aplicação (°C)" id="temperatura" type="text" value={form.temperatura} onChange={e => campo('temperatura', e.target.value)} placeholder="Ex: 50°C ou 20–60°C" />
            <div className="md:col-span-2">
              <Select label="Método de Aplicação" id="metodo_aplicacao" options={METODOS_APLICACAO} value={form.metodo_aplicacao} onChange={e => campo('metodo_aplicacao', e.target.value)} />
            </div>
          </div>
        </div>

        {/* RESTRIÇÕES */}
        <div className="bg-[#111f3a] border border-white/8 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">Restrições e Requisitos</h2>

          <div className="mb-6">
            <label className="text-sm font-medium text-gray-300 block mb-1.5">Matérias-primas Obrigatórias / Desejadas</label>
            <p className="text-xs text-gray-500 mb-2">A IA irá incluir estas MPs na formulação, ajustando percentuais conforme a técnica.</p>
            <div className="flex gap-2 mb-2">
              <input type="text" value={novaMPObrig} onChange={e => setNovaMPObrig(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addObrig() } }}
                placeholder="Ex: NPE, Butilglicol, d-Limoneno..."
                className="flex-1 bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500" />
              <button type="button" onClick={addObrig} className="w-9 h-9 bg-green-700/60 hover:bg-green-600 rounded-lg flex items-center justify-center transition-colors">
                <Plus size={14} className="text-white" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {mpObrig.map((mp, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 bg-green-500/15 text-green-400 border border-green-500/25 rounded-full px-3 py-0.5 text-xs">
                  {mp}<button type="button" onClick={() => remObrig(i)}><X size={11} /></button>
                </span>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="text-sm font-medium text-gray-300 block mb-1.5">Matérias-primas Proibidas / Indesejadas</label>
            <div className="flex gap-2 mb-2">
              <input type="text" value={novaMP} onChange={e => setNovaMP(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addProib() } }}
                placeholder="Ex: NPE, solventes clorados, fosfatos..."
                className="flex-1 bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500" />
              <button type="button" onClick={addProib} className="w-9 h-9 bg-[#1B3A6B] hover:bg-[#2563EB] rounded-lg flex items-center justify-center transition-colors">
                <Plus size={14} className="text-white" />
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {mpProib.map((mp, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 bg-red-500/15 text-red-400 border border-red-500/25 rounded-full px-3 py-0.5 text-xs">
                  {mp}<button type="button" onClick={() => remProib(i)}><X size={11} /></button>
                </span>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="text-sm font-medium text-gray-300 block mb-2">Nível de Toxicidade Aceitável</label>
            <div className="space-y-2">
              {TOXICIDADES.map(({ value, label }) => (
                <label key={value} className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="toxicidade" value={value} checked={form.toxicidade === value} onChange={() => campo('toxicidade', value)} className="accent-blue-500" />
                  <span className="text-sm text-gray-300">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <label className="text-sm font-medium text-gray-300 block mb-2">Requisitos Regulatórios</label>
            <div className="flex flex-wrap gap-3">
              {['ANVISA', 'REACH', 'EPA', 'Não aplicável'].map(req => (
                <label key={req} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.regulatorios.includes(req)} onChange={() => check('regulatorios', req)} className="accent-blue-500 w-4 h-4" />
                  <span className="text-sm text-gray-300">{req}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-300 block mb-2">Certificações Desejadas</label>
            <div className="flex flex-wrap gap-3">
              {['Biodegradável', 'Livre de VOCs', 'Cruelty-free', 'Ecocert / COSMOS'].map(cert => (
                <label key={cert} className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.certificacoes.includes(cert)} onChange={() => check('certificacoes', cert)} className="accent-blue-500 w-4 h-4" />
                  <span className="text-sm text-gray-300">{cert}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* DESEMPENHO E CUSTO */}
        <div className="bg-[#111f3a] border border-white/8 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">Desempenho e Custo</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Textarea label="Performance Mínima Esperada" id="performance" value={form.performance} onChange={e => campo('performance', e.target.value)} placeholder="Ex: Remoção ≥ 95% de óleo mineral em 5 minutos de imersão a 50°C..." rows={2} />
            </div>
            <Input label="Custo Alvo por kg do Produto Final (R$)" id="custo_alvo" type="number" value={form.custo_alvo} onChange={e => campo('custo_alvo', e.target.value)} placeholder="Ex: 12.00" />
            <Select label="Volume de Produção Esperado" id="volume" options={VOLUMES} value={form.volume} onChange={e => campo('volume', e.target.value)} />
            <Select label="Odor Desejado" id="odor" options={ODORES} value={form.odor} onChange={e => campo('odor', e.target.value)} />
          </div>
        </div>

        {error && <div className="p-4 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 text-sm">{error}</div>}

        <Button type="button" variant="gold" size="lg" onClick={gerar} className="w-full">
          <FlaskConical size={18} />
          Gerar Formulação com Análise Crítica
        </Button>

      </form>
    </div>
  )
}
