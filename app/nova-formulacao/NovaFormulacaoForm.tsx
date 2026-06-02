'use client'
import { useState, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { MoleculeLoader } from '@/components/MoleculeLoader'
import { FormulacaoResult } from '@/components/FormulacaoResult'
import { FlaskConical, Plus, X } from 'lucide-react'

const SEGMENTOS = [
  { value: '', label: 'Selecione o segmento...' },
  { value: 'Limpeza e Manutenção Industrial', label: 'Limpeza e Manutenção Industrial' },
  { value: 'Automotivo', label: 'Automotivo' },
  { value: 'Saneantes e Domissanitários', label: 'Saneantes e Domissanitários' },
  { value: 'Tintas, Vernizes, Resinas e Polímeros', label: 'Tintas, Vernizes, Resinas e Polímeros' },
  { value: 'Biossolventes, Biopolímeros e Biolubrificantes', label: 'Biosolventes e Biolubrificantes' },
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

const STORAGE_KEY = 'clickchem_nova_formulacao'

// Lê localStorage de forma síncrona (só executa no client)
function lerStorage() {
  if (typeof window === 'undefined') return null
  try {
    const salvo = localStorage.getItem(STORAGE_KEY)
    if (salvo) return JSON.parse(salvo)
  } catch {}
  return null
}

// Salva no localStorage de forma síncrona
function salvarStorage(dados: {
  form?: typeof FORM_INICIAL
  materiasProibidas?: string[]
  materiasObrigatorias?: string[]
}) {
  try {
    const atual = lerStorage() || {}
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...atual, ...dados }))
  } catch {}
}

export default function NovaFormulacaoForm() {
  // ---- inicialização síncrona a partir do localStorage ----
  const saved = lerStorage()

  const [form, setForm] = useState<typeof FORM_INICIAL>(saved?.form ?? FORM_INICIAL)
  const [materiasProibidas, setMateriasProibidas] = useState<string[]>(saved?.materiasProibidas ?? [])
  const [materiasObrigatorias, setMateriasObrigatorias] = useState<string[]>(saved?.materiasObrigatorias ?? [])

  // Ref para manter o valor mais recente do form em closures
  const formRef = useRef(form)

  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<Record<string, unknown> | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [novaMP, setNovaMP] = useState('')
  const [novaMPObrig, setNovaMPObrig] = useState('')

  // Atualiza um campo do form e salva imediatamente no localStorage
  function handleChange(field: string, value: string) {
    const novoForm = { ...formRef.current, [field]: value } as typeof FORM_INICIAL
    formRef.current = novoForm
    setForm(novoForm)
    salvarStorage({ form: novoForm })
  }

  function toggleCheckbox(field: 'regulatorios' | 'certificacoes', value: string) {
    const novoForm = {
      ...formRef.current,
      [field]: formRef.current[field].includes(value)
        ? formRef.current[field].filter((v: string) => v !== value)
        : [...formRef.current[field], value],
    } as typeof FORM_INICIAL
    formRef.current = novoForm
    setForm(novoForm)
    salvarStorage({ form: novoForm })
  }

  function adicionarMPProibida() {
    const v = novaMP.trim()
    if (!v || materiasProibidas.includes(v)) return
    const novas = [...materiasProibidas, v]
    setMateriasProibidas(novas)
    setNovaMP('')
    salvarStorage({ materiasProibidas: novas })
  }

  function adicionarMPObrigatoria() {
    const v = novaMPObrig.trim()
    if (!v) return
    // Aceita múltiplas MPs separadas por vírgula
    const itens = v.split(',').map(s => s.trim()).filter(Boolean)
    const novas = [...materiasObrigatorias]
    for (const mp of itens) { if (!novas.includes(mp)) novas.push(mp) }
    setMateriasObrigatorias(novas)
    setNovaMPObrig('')
    salvarStorage({ materiasObrigatorias: novas })
  }

  function removerMPProibida(i: number) {
    const novas = materiasProibidas.filter((_, j) => j !== i)
    setMateriasProibidas(novas)
    salvarStorage({ materiasProibidas: novas })
  }

  function removerMPObrigatoria(i: number) {
    const novas = materiasObrigatorias.filter((_, j) => j !== i)
    setMateriasObrigatorias(novas)
    salvarStorage({ materiasObrigatorias: novas })
  }

  async function gerarFormulacao() {
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
        body: JSON.stringify({
          ...form,
          materias_proibidas: materiasProibidas,
          materias_obrigatorias: materiasObrigatorias,
        }),
      })
      const raw = await res.text()
      if (!res.ok) {
        let mensagem = 'Erro ao gerar formulação. Tente novamente.'
        try {
          const parsed = JSON.parse(raw)
          if (parsed?.error) mensagem = String(parsed.error)
        } catch {
          if (res.status === 504 || res.status === 502)
            mensagem = 'A geração demorou demais. Tente novamente em instantes.'
          else if (res.status >= 500)
            mensagem = 'Erro temporário no servidor. Tente novamente.'
        }
        throw new Error(mensagem)
      }
      let data: Record<string, unknown>
      try { data = JSON.parse(raw) } catch { throw new Error('Resposta incompleta do servidor. Tente novamente.') }
      setResultado(data)
      try { localStorage.removeItem(STORAGE_KEY) } catch {}
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  async function handleSalvar() {
    if (!resultado) return
    try {
      await fetch('/api/formulacao/salvar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formulacao: resultado, segmento: form.segmento }),
      })
      alert('Formulação salva com sucesso!')
    } catch {
      alert('Erro ao salvar formulação.')
    }
  }

  async function handleRefinar(instrucoes: string) {
    setLoading(true)
    try {
      const res = await fetch('/api/formulacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          materias_proibidas: materiasProibidas,
          materias_obrigatorias: materiasObrigatorias,
          refinamento: instrucoes,
          formulacao_anterior: resultado,
        }),
      })
      const data = await res.json()
      setResultado(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao refinar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <FlaskConical className="text-blue-400" size={24} />
          Nova Formulação
        </h1>
        <p className="text-gray-400 mt-1 text-sm">
          Descreva a necessidade industrial e o sistema gerará uma formulação com análise crítica completa.
        </p>
      </div>

      {!resultado && (
        <form
          onSubmit={e => e.preventDefault()}
          className={`space-y-6 ${loading ? 'pointer-events-none opacity-50' : ''}`}
        >
          {/* SOBRE O PRODUTO */}
          <div className="bg-[#111f3a] border border-white/8 rounded-xl p-6">
            <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">
              Sobre o Produto
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Select
                  label="Segmento de Aplicação *"
                  id="segmento"
                  options={SEGMENTOS}
                  value={form.segmento}
                  onChange={e => handleChange('segmento', e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <Textarea
                  label="Descrição do Produto Desejado *"
                  id="descricao"
                  value={form.descricao}
                  onChange={e => handleChange('descricao', e.target.value)}
                  placeholder="Ex: Desengraxante alcalino para peças metálicas com alta aderência de graxa mineral..."
                  rows={3}
                />
              </div>
              <Input
                label="Substrato / Superfície de Aplicação"
                id="substrato"
                value={form.substrato}
                onChange={e => handleChange('substrato', e.target.value)}
                placeholder="Ex: Aço inox, Alumínio, Plástico ABS"
              />
              <Input
                label="Tipo de Sujeira / Resíduo / Contaminante"
                id="sujeira"
                value={form.sujeira}
                onChange={e => handleChange('sujeira', e.target.value)}
                placeholder="Ex: Óleo mineral de corte, Graxa sintética"
              />
            </div>
          </div>

          {/* PARÂMETROS TÉCNICOS */}
          <div className="bg-[#111f3a] border border-white/8 rounded-xl p-6">
            <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">
              Parâmetros Técnicos
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex gap-3 items-end">
                <Input
                  label="pH mínimo"
                  id="ph_min"
                  type="number"
                  min="1"
                  max="14"
                  step="0.5"
                  value={form.ph_min}
                  onChange={e => handleChange('ph_min', e.target.value)}
                  placeholder="1"
                  className="w-full"
                />
                <Input
                  label="pH máximo"
                  id="ph_max"
                  type="number"
                  min="1"
                  max="14"
                  step="0.5"
                  value={form.ph_max}
                  onChange={e => handleChange('ph_max', e.target.value)}
                  placeholder="14"
                  className="w-full"
                />
              </div>
              <Select
                label="Viscosidade Esperada"
                id="viscosidade"
                options={VISCOSIDADES}
                value={form.viscosidade}
                onChange={e => handleChange('viscosidade', e.target.value)}
              />
              <Select
                label="Forma Física do Produto"
                id="forma_fisica"
                options={FORMAS_FISICAS}
                value={form.forma_fisica}
                onChange={e => handleChange('forma_fisica', e.target.value)}
              />
              <Input
                label="Temperatura de Aplicação (°C)"
                id="temperatura"
                type="text"
                value={form.temperatura}
                onChange={e => handleChange('temperatura', e.target.value)}
                placeholder="Ex: 50°C ou 20–60°C"
              />
              <div className="md:col-span-2">
                <Select
                  label="Método de Aplicação"
                  id="metodo_aplicacao"
                  options={METODOS_APLICACAO}
                  value={form.metodo_aplicacao}
                  onChange={e => handleChange('metodo_aplicacao', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* RESTRIÇÕES */}
          <div className="bg-[#111f3a] border border-white/8 rounded-xl p-6">
            <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">
              Restrições e Requisitos
            </h2>

            {/* MPs obrigatórias */}
            <div className="mb-6">
              <label className="text-sm font-medium text-gray-300 block mb-1.5">
                Matérias-primas Obrigatórias / Desejadas
              </label>
              <p className="text-xs text-gray-500 mb-2">
                A IA irá incluir estas MPs na formulação, ajustando percentuais conforme a técnica.
              </p>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={novaMPObrig}
                  onChange={e => setNovaMPObrig(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarMPObrigatoria() } }}
                  placeholder="Ex: NPE, Butilglicol, d-Limoneno..."
                  className="flex-1 bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={adicionarMPObrigatoria}
                  className="w-9 h-9 bg-green-700/60 hover:bg-green-600 rounded-lg flex items-center justify-center transition-colors"
                >
                  <Plus size={14} className="text-white" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {materiasObrigatorias.map((mp, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 bg-green-500/15 text-green-400 border border-green-500/25 rounded-full px-3 py-0.5 text-xs"
                  >
                    {mp}
                    <button type="button" onClick={() => removerMPObrigatoria(i)}>
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* MPs proibidas */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-300 block mb-1.5">
                Matérias-primas Proibidas / Indesejadas
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={novaMP}
                  onChange={e => setNovaMP(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); adicionarMPProibida() } }}
                  placeholder="Ex: NPE, solventes clorados, fosfatos..."
                  className="flex-1 bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={adicionarMPProibida}
                  className="w-9 h-9 bg-[#1B3A6B] hover:bg-[#2563EB] rounded-lg flex items-center justify-center transition-colors"
                >
                  <Plus size={14} className="text-white" />
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {materiasProibidas.map((mp, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1.5 bg-red-500/15 text-red-400 border border-red-500/25 rounded-full px-3 py-0.5 text-xs"
                  >
                    {mp}
                    <button type="button" onClick={() => removerMPProibida(i)}>
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Toxicidade */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-300 block mb-2">
                Nível de Toxicidade Aceitável
              </label>
              <div className="space-y-2">
                {TOXICIDADES.map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="toxicidade"
                      value={value}
                      checked={form.toxicidade === value}
                      onChange={() => handleChange('toxicidade', value)}
                      className="accent-blue-500"
                    />
                    <span className="text-sm text-gray-300">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Regulatórios */}
            <div className="mb-4">
              <label className="text-sm font-medium text-gray-300 block mb-2">Requisitos Regulatórios</label>
              <div className="flex flex-wrap gap-3">
                {['ANVISA', 'REACH', 'EPA', 'Não aplicável'].map(req => (
                  <label key={req} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.regulatorios.includes(req)}
                      onChange={() => toggleCheckbox('regulatorios', req)}
                      className="accent-blue-500 w-4 h-4"
                    />
                    <span className="text-sm text-gray-300">{req}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Certificações */}
            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Certificações Desejadas</label>
              <div className="flex flex-wrap gap-3">
                {['Biodegradável', 'Livre de VOCs', 'Cruelty-free', 'Ecocert / COSMOS'].map(cert => (
                  <label key={cert} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.certificacoes.includes(cert)}
                      onChange={() => toggleCheckbox('certificacoes', cert)}
                      className="accent-blue-500 w-4 h-4"
                    />
                    <span className="text-sm text-gray-300">{cert}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* DESEMPENHO E CUSTO */}
          <div className="bg-[#111f3a] border border-white/8 rounded-xl p-6">
            <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">
              Desempenho e Custo
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Textarea
                  label="Performance Mínima Esperada"
                  id="performance"
                  value={form.performance}
                  onChange={e => handleChange('performance', e.target.value)}
                  placeholder="Ex: Remoção ≥ 95% de óleo mineral em 5 minutos de imersão a 50°C..."
                  rows={2}
                />
              </div>
              <Input
                label="Custo Alvo por kg do Produto Final (R$)"
                id="custo_alvo"
                type="number"
                value={form.custo_alvo}
                onChange={e => handleChange('custo_alvo', e.target.value)}
                placeholder="Ex: 12.00"
              />
              <Select
                label="Volume de Produção Esperado"
                id="volume"
                options={VOLUMES}
                value={form.volume}
                onChange={e => handleChange('volume', e.target.value)}
              />
              <Select
                label="Odor Desejado"
                id="odor"
                options={ODORES}
                value={form.odor}
                onChange={e => handleChange('odor', e.target.value)}
              />
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-500/15 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <Button
            type="button"
            variant="gold"
            size="lg"
            onClick={gerarFormulacao}
            className="w-full"
          >
            <FlaskConical size={18} />
            Gerar Formulação com Análise Crítica
          </Button>
        </form>
      )}

      {loading && <MoleculeLoader message="Gerando formulação com análise crítica..." />}

      {resultado && !loading && (
        <div>
          <button
            type="button"
            onClick={() => { setResultado(null); setError(null) }}
            className="mb-6 text-sm text-gray-400 hover:text-white flex items-center gap-2 transition-colors"
          >
            ← Nova formulação
          </button>
          <FormulacaoResult
            data={resultado}
            onSalvar={handleSalvar}
            onRefinar={handleRefinar}
          />
        </div>
      )}
    </div>
  )
}
