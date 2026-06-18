'use client'
import { useState, type ElementType } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import {
  X, CheckCircle2, AlertCircle, FlaskConical,
} from 'lucide-react'

const CATEGORIAS = [
  'Solventes', 'Tensoativos Aniônicos', 'Tensoativos Não-iônicos',
  'Tensoativos Catiônicos', 'Tensoativos Anfóteros', 'Espessantes',
  'Sequestrantes', 'Neutralizantes', 'Conservantes', 'Inibidores de Corrosão',
  'Resinas', 'Biossolventes', 'Antiespumantes', 'Emulsificantes', 'Dispersante', 'Umectante', 'Outros',
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
  sinergias: string[] | string
  incompatibilidades: string[] | string
  aplicacoes_tipicas: string[] | string
  ph_estabilidade?: string
  notas_tecnicas?: string
  restricoes_anvisa?: string
  restricoes_reach?: string
  aparencia?: string
  solubilidade_agua?: string
}

function mpToForm(mp: MP): MPForm {
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

export function EditarMP({ mp, onFechar }: { mp: MP; onFechar: () => void }) {
  const router = useRouter()
  const [form, setForm] = useState<MPForm>(() => {
    try {
      return mpToForm(mp)
    } catch (e) {
      console.error('Erro ao converter MP para form:', e)
      return {
        nome_comercial: mp.nome_comercial || '',
        nome_quimico: mp.nome_quimico || '',
        numero_cas: mp.numero_cas ? String(mp.numero_cas) : '',
        categoria: mp.categoria || 'Outros',
        subcategoria: mp.subcategoria || '',
        funcao_principal: mp.funcao_principal || '',
        faixa_uso_tipica: mp.faixa_uso_tipica ? String(mp.faixa_uso_tipica) : '',
        nivel_toxicidade: mp.nivel_toxicidade || 'medio',
        biodegradabilidade: mp.biodegradabilidade ? String(mp.biodegradabilidade) : '',
        origem: mp.origem || 'petroleo',
        aparencia: mp.aparencia ? String(mp.aparencia) : '',
        solubilidade_agua: mp.solubilidade_agua ? String(mp.solubilidade_agua) : '',
        ph_estabilidade: mp.ph_estabilidade ? String(mp.ph_estabilidade) : '',
        custo_min: mp.custo_min ? String(mp.custo_min) : '',
        custo_max: mp.custo_max ? String(mp.custo_max) : '',
        disponibilidade: mp.disponibilidade || 'media',
        sinergias: Array.isArray(mp.sinergias) ? mp.sinergias.join(', ') : String(mp.sinergias || ''),
        incompatibilidades: Array.isArray(mp.incompatibilidades) ? mp.incompatibilidades.join(', ') : String(mp.incompatibilidades || ''),
        aplicacoes_tipicas: Array.isArray(mp.aplicacoes_tipicas) ? mp.aplicacoes_tipicas.join(', ') : String(mp.aplicacoes_tipicas || ''),
        restricoes_anvisa: mp.restricoes_anvisa ? String(mp.restricoes_anvisa) : '',
        restricoes_reach: mp.restricoes_reach ? String(mp.restricoes_reach) : '',
        notas_tecnicas: mp.notas_tecnicas ? String(mp.notas_tecnicas) : '',
      }
    }
  })
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)

  function set(field: keyof MPForm, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function salvar() {
    if (!form.nome_comercial.trim()) {
      setErro('Nome comercial é obrigatório.')
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
      const res = await fetch(`/api/materias-primas/${mp.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setSucesso(true)
      setTimeout(() => {
        router.refresh()
        onFechar()
      }, 1500)
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
          <p className="text-white font-bold text-lg">{form.nome_comercial}</p>
          <p className="text-gray-400 text-sm mt-1">atualizada com sucesso!</p>
        </div>
        <p className="text-xs text-gray-500">As alterações foram salvas no banco técnico.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[#1B3A6B]/60 shrink-0">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FlaskConical size={18} className="text-blue-400" />
            Editar Matéria-Prima
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">{mp.nome_comercial}</p>
        </div>
        <button onClick={onFechar} className="text-gray-500 hover:text-white transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* Erro */}
      {erro && (
        <div className="mx-6 mt-3 p-3 bg-red-500/15 border border-red-500/30 rounded-xl flex gap-2 shrink-0">
          <AlertCircle size={14} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm font-medium">{erro}</p>
        </div>
      )}

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
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
              <Textarea label="Notas Técnicas" value={form.notas_tecnicas} onChange={e => set('notas_tecnicas', e.target.value)} placeholder="Informações adicionais relevantes..." rows={3} />
            </div>
          </div>
        </div>
      </div>

      {/* Footer fixo */}
      <div className="px-6 py-4 border-t border-[#1B3A6B]/60 shrink-0">
        <div className="flex gap-3">
          <Button variant="ghost" onClick={onFechar} className="flex-1">Cancelar</Button>
          <Button variant="gold" onClick={salvar} disabled={salvando} className="flex-1">
            {salvando ? 'Salvando...' : '✓ Salvar Alterações'}
          </Button>
        </div>
      </div>
    </div>
  )
}
