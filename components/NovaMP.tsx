'use client'
import { useState, useRef, type ElementType } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import {
  X, Upload, FileText, Plus, CheckCircle2, AlertCircle,
  FlaskConical, ChevronRight,
} from 'lucide-react'

const CATEGORIAS = [
  'Solventes', 'Tensoativos Aniônicos', 'Tensoativos Não-iônicos',
  'Tensoativos Catiônicos', 'Tensoativos Anfóteros', 'Espessantes',
  'Sequestrantes', 'Neutralizantes', 'Conservantes', 'Inibidores de Corrosão',
  'Resinas', 'Biossolventes', 'Antiespumantes', 'Emulsificantes', 'Outros',
].map(c => ({ value: c, label: c }))

const TOXICIDADES = [
  { value: 'baixo', label: '🟢 Baixa' },
  { value: 'medio', label: '🟡 Média' },
  { value: 'alto', label: '🔴 Alta' },
]
const ORIGENS = [
  { value: 'petroleo', label: 'Petroquímica' },
  { value: 'vegetal', label: 'Vegetal / Bio' },
  { value: 'mineral', label: 'Mineral' },
  { value: 'bio-sintetico', label: 'Bio-sintético' },
]
const DISPONIBILIDADES = [
  { value: 'alta', label: 'Alta' },
  { value: 'media', label: 'Média' },
  { value: 'baixa', label: 'Baixa' },
]

type Aba = 'boletim' | 'manual'

interface MPForm {
  nome_comercial: string; nome_quimico: string; numero_cas: string
  categoria: string; subcategoria: string; funcao_principal: string
  faixa_uso_tipica: string; nivel_toxicidade: string; biodegradabilidade: string
  origem: string; aparencia: string; solubilidade_agua: string
  ph_estabilidade: string; custo_min: string; custo_max: string
  disponibilidade: string; sinergias: string; incompatibilidades: string
  aplicacoes_tipicas: string; restricoes_anvisa: string; restricoes_reach: string
  notas_tecnicas: string
}

const FORM_VAZIO: MPForm = {
  nome_comercial: '', nome_quimico: '', numero_cas: '', categoria: 'Outros',
  subcategoria: '', funcao_principal: '', faixa_uso_tipica: '', nivel_toxicidade: 'medio',
  biodegradabilidade: '', origem: 'petroleo', aparencia: '', solubilidade_agua: '',
  ph_estabilidade: '', custo_min: '', custo_max: '', disponibilidade: 'media',
  sinergias: '', incompatibilidades: '', aplicacoes_tipicas: '',
  restricoes_anvisa: '', restricoes_reach: '', notas_tecnicas: '',
}

function mpToForm(mp: Record<string, unknown>): MPForm {
  function str(v: unknown) { return v && v !== 'null' ? String(v) : '' }
  function arrStr(v: unknown) {
    if (Array.isArray(v)) return v.join(', ')
    if (typeof v === 'string' && v.startsWith('[')) {
      try { return JSON.parse(v).join(', ') } catch { return str(v) }
    }
    return str(v)
  }
  return {
    nome_comercial: str(mp.nome_comercial),
    nome_quimico: str(mp.nome_quimico),
    numero_cas: str(mp.numero_cas),
    categoria: str(mp.categoria) || 'Outros',
    subcategoria: str(mp.subcategoria),
    funcao_principal: str(mp.funcao_principal),
    faixa_uso_tipica: str(mp.faixa_uso_tipica),
    nivel_toxicidade: str(mp.nivel_toxicidade) || 'medio',
    biodegradabilidade: str(mp.biodegradabilidade),
    origem: str(mp.origem) || 'petroleo',
    aparencia: str(mp.aparencia),
    solubilidade_agua: str(mp.solubilidade_agua),
    ph_estabilidade: str(mp.ph_estabilidade),
    custo_min: mp.custo_min ? String(mp.custo_min) : '',
    custo_max: mp.custo_max ? String(mp.custo_max) : '',
    disponibilidade: str(mp.disponibilidade) || 'media',
    sinergias: arrStr(mp.sinergias),
    incompatibilidades: arrStr(mp.incompatibilidades),
    aplicacoes_tipicas: arrStr(mp.aplicacoes_tipicas),
    restricoes_anvisa: str(mp.restricoes_anvisa),
    restricoes_reach: str(mp.restricoes_reach),
    notas_tecnicas: str(mp.notas_tecnicas),
  }
}

export function NovaMP({ onFechar }: { onFechar: () => void }) {
  const router = useRouter()
  const [aba, setAba] = useState<Aba>('boletim')
  const [form, setForm] = useState<MPForm>(FORM_VAZIO)
  const [loadingUpload, setLoadingUpload] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)
  const [nomeSalvo, setNomeSalvo] = useState('')
  const [categoriaSalva, setCategoriaSalva] = useState('')
  const [arquivoNome, setArquivoNome] = useState('')
  const [extraido, setExtraido] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [jaDuplicada, setJaDuplicada] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function set(field: keyof MPForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
    if (field === 'nome_comercial') {
      verificarDuplicidade(value)
    }
  }

  async function verificarDuplicidade(nome: string) {
    if (!nome.trim()) {
      setJaDuplicada(false)
      return
    }
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)

      const res = await fetch(`/api/materias-primas?nome=${encodeURIComponent(nome)}`, {
        method: 'GET',
        signal: controller.signal
      })
      clearTimeout(timeoutId)

      if (!res.ok) {
        console.warn('Erro na verificação de duplicidade:', res.status)
        setJaDuplicada(false)
        return
      }

      const data = await res.json()
      console.log('Duplicidade check:', { nome, exists: data.exists })
      setJaDuplicada(!!data.exists)
    } catch (err) {
      console.warn('Erro ao verificar duplicidade:', err)
      setJaDuplicada(false)
    }
  }

  async function processarBoletim(file: File) {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'docx', 'doc', 'xlsx', 'xls'].includes(ext || '')) {
      setErro('Use PDF, Word (.docx) ou Excel (.xlsx).')
      return
    }
    setLoadingUpload(true)
    setErro(null)
    setExtraido(false)

    const fd = new FormData()
    fd.append('file', file)

    try {
      const res = await fetch('/api/materias-primas/import', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setForm(mpToForm(data.mp))
      setArquivoNome(file.name)
      setExtraido(true)
      setAba('manual') // mostra o formulário preenchido para revisão
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao processar boletim.')
    } finally {
      setLoadingUpload(false)
    }
  }

  async function salvar() {
    if (!form.nome_comercial.trim()) {
      setErro('Nome comercial é obrigatório.')
      return
    }

    // Verificar duplicidade antes de salvar
    if (jaDuplicada) {
      setErro('Esta matéria-prima já existe no banco. Não é possível adicionar duplicatas.')
      return
    }

    setSalvando(true)
    setErro(null)

    const payload = {
      ...form,
      funcao_principal: form.funcao_principal.trim() || form.categoria,
      custo_min: form.custo_min ? parseFloat(form.custo_min) : null,
      custo_max: form.custo_max ? parseFloat(form.custo_max) : null,
      sinergias: form.sinergias ? form.sinergias.split(',').map(s => s.trim()).filter(Boolean) : [],
      incompatibilidades: form.incompatibilidades ? form.incompatibilidades.split(',').map(s => s.trim()).filter(Boolean) : [],
      aplicacoes_tipicas: form.aplicacoes_tipicas ? form.aplicacoes_tipicas.split(',').map(s => s.trim()).filter(Boolean) : [],
    }

    try {
      const res = await fetch('/api/materias-primas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setNomeSalvo(form.nome_comercial)
      setCategoriaSalva(form.categoria)
      setSucesso(true)
      setTimeout(() => {
        router.refresh()
        onFechar()
      }, 2500)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  if (sucesso) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 px-6 text-center">
        <CheckCircle2 size={48} className="text-green-400" />
        <div>
          <p className="text-white font-bold text-lg">{nomeSalvo}</p>
          <p className="text-gray-400 text-sm mt-1">adicionada com sucesso!</p>
        </div>
        <div className="p-3 bg-green-500/15 border border-green-500/30 rounded-xl w-full">
          <p className="text-xs text-gray-400 mb-0.5">Categoria</p>
          <p className="text-green-300 font-medium">{categoriaSalva}</p>
        </div>
        <p className="text-xs text-gray-500">Já disponível no Banco Técnico e para a IA usar nas formulações.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1B3A6B]/60 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FlaskConical size={18} className="text-green-400" />
            Nova Matéria-Prima
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">A MP será adicionada ao banco e ficará disponível para a IA</p>
        </div>
        <button onClick={onFechar} className="text-gray-500 hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Abas */}
      {!extraido && (
        <div className="flex gap-1 px-6 pt-4 shrink-0">
          {([
            { id: 'boletim', label: 'Upload Boletim Técnico', icon: Upload },
            { id: 'manual', label: 'Formulário Manual', icon: Plus },
          ] as { id: Aba; label: string; icon: ElementType }[]).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${aba === id ? 'bg-green-500/15 text-green-400 border border-green-500/30' : 'text-gray-500 hover:text-gray-300 border border-transparent'}`}
            >
              <Icon size={14} />{label}
            </button>
          ))}
        </div>
      )}

      {extraido && (
        <div className="mx-6 mt-4 shrink-0 space-y-2">
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2">
            <CheckCircle2 size={14} className="text-green-400 shrink-0" />
            <p className="text-xs text-green-300">
              Dados extraídos de <strong>{arquivoNome}</strong> — revise a categoria e clique em salvar.
            </p>
          </div>
          <button
            onClick={salvar}
            disabled={salvando || jaDuplicada}
            className="w-full py-2.5 rounded-xl bg-[#D4A017] hover:bg-[#b88a14] disabled:opacity-50 text-[#0A1628] font-bold text-sm flex items-center justify-center gap-2 transition-colors"
          >
            {salvando ? 'Salvando...' : jaDuplicada ? '⚠️ Duplicada — não é possível salvar' : '✓ Confirmar e Adicionar ao Banco Técnico'}
          </button>
        </div>
      )}

      {/* Alerta de duplicidade */}
      {jaDuplicada && (
        <div className="mx-6 mt-3 p-3 bg-yellow-500/15 border border-yellow-500/30 rounded-xl flex gap-2 shrink-0">
          <AlertCircle size={14} className="text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-yellow-400 text-sm font-medium">⚠️ Esta matéria-prima já existe no banco. Verifique antes de salvar.</p>
        </div>
      )}

      {/* Erro — sempre visível */}
      {erro && (
        <div className="mx-6 mt-3 p-3 bg-red-500/15 border border-red-500/30 rounded-xl flex gap-2 shrink-0">
          <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm font-medium">{erro}</p>
        </div>
      )}

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Upload de boletim */}
        {aba === 'boletim' && !extraido && (
          <div>
            {loadingUpload ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4">
                <div className="w-10 h-10 border-2 border-green-500/30 border-t-green-400 rounded-full animate-spin" />
                <p className="text-gray-400 text-sm">Claude está lendo o boletim e extraindo dados técnicos...</p>
              </div>
            ) : (
              <div>
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processarBoletim(f) }}
                  onClick={() => inputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${dragging ? 'border-green-400 bg-green-500/10' : 'border-[#1B3A6B] hover:border-green-500/50 hover:bg-white/3'}`}
                >
                  <input ref={inputRef} type="file" accept=".pdf,.docx,.doc,.xlsx,.xls" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) processarBoletim(f) }} />
                  <Upload size={36} className={`mx-auto mb-3 ${dragging ? 'text-green-400' : 'text-gray-600'}`} />
                  <p className="text-white font-medium mb-1">Arraste o boletim técnico aqui</p>
                  <p className="text-gray-500 text-sm">PDF, Word (.docx) ou Excel (.xlsx)</p>
                  <p className="text-gray-600 text-xs mt-2">O Claude extrai automaticamente todos os dados técnicos</p>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  {[
                    { icon: '📄', label: 'PDF', desc: 'Ficha técnica, SDS, boletim' },
                    { icon: '📝', label: 'Word', desc: 'Documentos técnicos .docx' },
                    { icon: '📊', label: 'Excel', desc: 'Planilhas de especificação' },
                  ].map(({ icon, label, desc }) => (
                    <div key={label} className="bg-[#111f3a] border border-white/8 rounded-xl p-3">
                      <div className="text-xl mb-1">{icon}</div>
                      <p className="text-xs font-medium text-white">{label}</p>
                      <p className="text-xs text-gray-600 mt-0.5">{desc}</p>
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => { setErro(null); setAba('manual') }}
                  className="mt-4 text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors"
                >
                  Prefiro preencher manualmente <ChevronRight size={12} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Formulário */}
        {(aba === 'manual' || extraido) && (
          <div className="space-y-5">
            {/* CATEGORIA — sempre primeiro e em destaque */}
            <div className="p-4 bg-[#D4A017]/10 border border-[#D4A017]/30 rounded-xl">
              <p className="text-xs font-bold text-[#D4A017] uppercase tracking-wide mb-2">Categoria no Banco Técnico *</p>
              <select
                value={form.categoria}
                onChange={e => set('categoria', e.target.value)}
                className="w-full bg-[#0A1628] border-2 border-[#D4A017]/50 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#D4A017]"
              >
                {CATEGORIAS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <p className="text-xs text-gray-500 mt-1.5">A MP aparecerá nesta categoria no Banco Técnico.</p>
            </div>

            {/* Identificação */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Identificação</p>
              <div className="grid grid-cols-1 gap-3">
                <Input label="Nome Comercial *" value={form.nome_comercial} onChange={e => set('nome_comercial', e.target.value)} placeholder="Ex: LABSA, Texapón N70, Dowanol PnB" />
                <Input label="Nome Químico / IUPAC" value={form.nome_quimico} onChange={e => set('nome_quimico', e.target.value)} placeholder="Ex: Ácido Linear Alquilbenzeno Sulfônico" />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Nº CAS" value={form.numero_cas} onChange={e => set('numero_cas', e.target.value)} placeholder="Ex: 85536-14-7" />
                  <Input label="Aparência" value={form.aparencia} onChange={e => set('aparencia', e.target.value)} placeholder="Ex: líquido amarelado" />
                </div>
              </div>
            </div>

            {/* Classificação */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Classificação</p>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Subcategoria" value={form.subcategoria} onChange={e => set('subcategoria', e.target.value)} placeholder="Ex: Aniônico, Éster, etc." />
                <Select label="Origem" options={ORIGENS} value={form.origem} onChange={e => set('origem', e.target.value)} />
                <Select label="Toxicidade" options={TOXICIDADES} value={form.nivel_toxicidade} onChange={e => set('nivel_toxicidade', e.target.value)} />
              </div>
            </div>

            {/* Técnico */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Dados Técnicos</p>
              <div className="space-y-3">
                <Input label="Função Principal *" value={form.funcao_principal} onChange={e => set('funcao_principal', e.target.value)} placeholder="Ex: Tensoativo aniônico para limpeza industrial" />
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Faixa de Uso Típica (%)" value={form.faixa_uso_tipica} onChange={e => set('faixa_uso_tipica', e.target.value)} placeholder="Ex: 5–15%" />
                  <Input label="Estabilidade de pH" value={form.ph_estabilidade} onChange={e => set('ph_estabilidade', e.target.value)} placeholder="Ex: 3–11" />
                  <Input label="Solubilidade em Água" value={form.solubilidade_agua} onChange={e => set('solubilidade_agua', e.target.value)} placeholder="Ex: Miscível, Parcial" />
                  <Input label="Biodegradabilidade" value={form.biodegradabilidade} onChange={e => set('biodegradabilidade', e.target.value)} placeholder="Ex: Facilmente biodegradável" />
                </div>
              </div>
            </div>

            {/* Compatibilidades */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Compatibilidades (separar por vírgula)</p>
              <div className="space-y-3">
                <Textarea label="Sinergias / Compatível com" value={form.sinergias} onChange={e => set('sinergias', e.target.value)} placeholder="Ex: LABSA, NaOH, EDTA..." rows={2} />
                <Textarea label="Incompatibilidades" value={form.incompatibilidades} onChange={e => set('incompatibilidades', e.target.value)} placeholder="Ex: oxidantes fortes, ácidos concentrados..." rows={2} />
                <Textarea label="Aplicações Típicas" value={form.aplicacoes_tipicas} onChange={e => set('aplicacoes_tipicas', e.target.value)} placeholder="Ex: Detergentes, Desengraxantes, Limpadores..." rows={2} />
              </div>
            </div>

            {/* Custo e disponibilidade */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Custo e Disponibilidade</p>
              <div className="grid grid-cols-3 gap-3">
                <Input label="Custo mín. (R$/kg)" type="number" value={form.custo_min} onChange={e => set('custo_min', e.target.value)} placeholder="0.00" />
                <Input label="Custo máx. (R$/kg)" type="number" value={form.custo_max} onChange={e => set('custo_max', e.target.value)} placeholder="0.00" />
                <Select label="Disponibilidade" options={DISPONIBILIDADES} value={form.disponibilidade} onChange={e => set('disponibilidade', e.target.value)} />
              </div>
            </div>

            {/* Regulatório */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Regulatório e Notas</p>
              <div className="space-y-3">
                <Textarea label="Restrições ANVISA" value={form.restricoes_anvisa} onChange={e => set('restricoes_anvisa', e.target.value)} placeholder="Ex: Concentração máxima 0,5% em cosméticos..." rows={2} />
                <Textarea label="Restrições REACH" value={form.restricoes_reach} onChange={e => set('restricoes_reach', e.target.value)} placeholder="Ex: SVHC, requer autorização acima de 0,1%..." rows={2} />
                <Textarea label="Notas Técnicas" value={form.notas_tecnicas} onChange={e => set('notas_tecnicas', e.target.value)} placeholder="Informações adicionais relevantes do boletim..." rows={3} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer fixo */}
      {(aba === 'manual' || extraido) && (
        <div className="px-6 py-4 border-t border-[#1B3A6B]/60 shrink-0">
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onFechar} className="flex-1">Cancelar</Button>
            <Button variant="gold" onClick={salvar} disabled={salvando} className="flex-1">
              {salvando ? 'Salvando...' : <><FileText size={14} /> Adicionar ao Banco Técnico</>}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
