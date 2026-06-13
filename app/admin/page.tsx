'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { Card, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import {
  Lock, Plus, Trash2, FlaskConical, Eye, EyeOff,
  ToggleLeft, ToggleRight, Upload, FileText, CheckCircle2,
  AlertCircle, ChevronDown, ChevronUp, Pencil, X,
} from 'lucide-react'

const SEGMENTOS = [
  'Limpeza e Manutenção Industrial',
  'Automotivo',
  'Saneantes e Domissanitários',
  'Tintas e Vernizes',
  'Resinas e Polímeros',
  'Biosolventes e Biolubrificantes',
  'Cosmético',
]
const SEG_OPTIONS = SEGMENTOS.map(s => ({ value: s, label: s }))

interface Componente { materia_prima: string; percentual: string; funcao: string }
interface FormulaPreview {
  nome_interno: string; segmento: string; aplicacao: string
  composicao: { materia_prima: string; percentual: number; funcao: string }[]
  ph_final?: string; viscosidade?: string; processo?: string
  performance_chave?: string; tags?: string
  _expandido?: boolean
}
interface FormulaDB extends FormulaPreview {
  id: string; ativa: boolean; createdAt: string
  composicao: { materia_prima: string; percentual: number; funcao: string }[]
}

type Aba = 'importar' | 'manual' | 'cadastradas' | 'documentos'

// ─── LOGIN ──────────────────────────────────────────────────────────────────
function Login({ onLogin }: { onLogin: (pin: string) => void }) {
  const [pin, setPin] = useState('')
  const [erro, setErro] = useState(false)
  const [show, setShow] = useState(false)

  function tentar() {
    if (!pin.trim()) return
    fetch('/api/admin/formulas', { headers: { 'x-admin-pin': pin } })
      .then(r => { if (r.ok) { onLogin(pin); setErro(false) } else setErro(true) })
      .catch(() => setErro(true))
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-[#D4A017]/15 border border-[#D4A017]/40 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Lock size={28} className="text-[#D4A017]" />
          </div>
          <h1 className="text-xl font-bold text-white">P&D Proprietário</h1>
          <p className="text-gray-500 text-sm mt-1">Banco de Fórmulas Confidenciais</p>
        </div>
        <Card>
          <div className="space-y-4">
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                value={pin}
                onChange={e => { setPin(e.target.value); setErro(false) }}
                onKeyDown={e => e.key === 'Enter' && tentar()}
                placeholder="PIN de acesso..."
                className={`w-full bg-[#0A1628] border rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none pr-10 ${erro ? 'border-red-500' : 'border-[#1B3A6B] focus:border-blue-500'}`}
              />
              <button onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                {show ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {erro && <p className="text-red-400 text-xs">PIN incorreto.</p>}
            <Button variant="gold" onClick={tentar} className="w-full">
              <Lock size={14} /> Entrar
            </Button>
          </div>
        </Card>
        <p className="text-center text-xs text-gray-600 mt-4">Configure o PIN no arquivo .env → ADMIN_PIN</p>
      </div>
    </div>
  )
}

// ─── IMPORTAR ARQUIVO ────────────────────────────────────────────────────────
function ImportarArquivo({ pin, onImportou }: { pin: string; onImportou: () => void }) {
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [preview, setPreview] = useState<FormulaPreview[] | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [arquivo, setArquivo] = useState<string>('')
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function processarArquivo(file: File): Promise<{ formulas: FormulaPreview[]; arquivo: string; aviso?: string }> {
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'docx', 'doc', 'xlsx', 'xls', 'md'].includes(ext || '')) {
      throw new Error(`${file.name}: Formato não suportado. Use PDF, Word (.docx), Excel (.xlsx) ou Markdown (.md).`)
    }
    if (file.size > 4 * 1024 * 1024) {
      throw new Error(`${file.name}: Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Limite: 4 MB.`)
    }

    const fd = new FormData()
    fd.append('file', file)

    const res = await fetch('/api/admin/import', {
      method: 'POST',
      headers: { 'x-admin-pin': pin },
      body: fd,
    })
    const raw = await res.text()
    let data: Record<string, unknown> = {}
    try { data = JSON.parse(raw) } catch { throw new Error(`Erro no servidor: ${raw.slice(0, 120)}`) }
    if (!res.ok) throw new Error(String(data.error || 'Erro ao processar arquivo'))

    const formulas: FormulaPreview[] = ((data.formulas as Record<string, unknown>[]) || []).map((f) => ({
      ...(f as Omit<FormulaPreview, 'segmento'>),
      segmento: String(f.segmento || SEGMENTOS[0]),
      _expandido: false,
    }))

    return {
      formulas,
      arquivo: String(data.arquivo || file.name),
      aviso: data.aviso ? String(data.aviso) : undefined,
    }
  }

  async function processar(files: FileList | File[]) {
    if (files.length === 0) return
    setLoading(true)
    setErro(null)
    setPreview(null)
    setAviso(null)

    try {
      // Processa todos os arquivos em paralelo
      const resultados = await Promise.allSettled(
        Array.from(files).map(f => processarArquivo(f))
      )

      // Coleta fórmulas e erros
      const todasFormulas: FormulaPreview[] = []
      const erros: string[] = []
      const avisos: string[] = []
      const arquivos: string[] = []

      for (const resultado of resultados) {
        if (resultado.status === 'fulfilled') {
          todasFormulas.push(...resultado.value.formulas)
          arquivos.push(resultado.value.arquivo)
          if (resultado.value.aviso) avisos.push(resultado.value.aviso)
        } else {
          erros.push(resultado.reason instanceof Error ? resultado.reason.message : String(resultado.reason))
        }
      }

      if (erros.length > 0 && todasFormulas.length === 0) {
        setErro(erros.join('\n'))
        return
      }

      if (erros.length > 0) {
        setAviso(`⚠️ Alguns arquivos tiveram erros:\n${erros.join('\n')}`)
      }

      if (avisos.length > 0) {
        setAviso((prev) => (prev ? prev + '\n\n' : '') + avisos.join('\n'))
      }

      // Verifica se o arquivo já foi anexado antes
      const nomeArquivo = arquivos.join(', ')
      try {
        const res = await fetch('/api/admin/check-arquivo', {
          method: 'POST',
          headers: { 'x-admin-pin': pin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ arquivo_nome: nomeArquivo })
        })
        const data = await res.json() as { count: number; data?: { createdAt: string } }
        if (res.ok && data.count > 0) {
          const dataFormatada = data.data?.createdAt ? new Date(data.data.createdAt).toLocaleDateString('pt-BR') : 'desconhecida'
          setAviso((prev) => (prev ? prev + '\n\n' : '') + `⚠️ Este arquivo já foi processado em ${dataFormatada} com ${data.count} fórmula(s). Será atualizado.`)
        }
      } catch { /* ignora */ }

      setPreview(todasFormulas)
      setArquivo(nomeArquivo)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao processar arquivos.')
    } finally {
      setLoading(false)
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length > 0) processar(e.dataTransfer.files)
  }

  function onInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) processar(e.target.files)
  }

  function updatePreview(i: number, field: keyof FormulaPreview, value: unknown) {
    setPreview(prev => prev?.map((f, j) => j === i ? { ...f, [field]: value } : f) ?? null)
  }

  async function salvarTodos() {
    if (!preview || preview.length === 0) return
    setSalvando(true)
    setErro(null)
    let salvos = 0
    for (const f of preview) {
      try {
        await fetch('/api/admin/formulas', {
          method: 'POST',
          headers: { 'x-admin-pin': pin, 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...f, arquivo_origem: arquivo }),
        })
        salvos++
      } catch { /* continua */ }
    }
    setSalvando(false)
    setSucesso(`${salvos} fórmula(s) importada(s) com sucesso!`)
    setPreview(null)
    onImportou()
    setTimeout(() => setSucesso(null), 5000)
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 border-2 border-[#D4A017]/30 border-t-[#D4A017] rounded-full animate-spin" />
        <p className="text-gray-400 text-sm">Claude está lendo o documento e extraindo as fórmulas...</p>
      </div>
    )
  }

  if (preview) {
    return (
      <div>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-white font-semibold">{preview.length} fórmula(s) encontrada(s)</h3>
            <p className="text-gray-500 text-xs mt-0.5">Arquivo: {arquivo} · Revise os dados e selecione a categoria antes de salvar</p>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => { setPreview(null); setArquivo('') }}>
              Cancelar
            </Button>
            <Button variant="gold" size="sm" onClick={salvarTodos} disabled={salvando}>
              {salvando ? 'Salvando...' : <><CheckCircle2 size={14} /> Salvar todas no banco</>}
            </Button>
          </div>
        </div>

        {aviso && (
          <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex gap-2">
            <AlertCircle size={14} className="text-yellow-400 shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-300">{aviso}</p>
          </div>
        )}

        {sucesso && (
          <div className="mb-4 p-3 bg-green-500/15 border border-green-500/30 rounded-lg text-green-400 text-sm">{sucesso}</div>
        )}

        <div className="space-y-3">
          {preview.map((f, i) => (
            <div key={i} className="bg-[#111f3a] border border-white/8 rounded-xl overflow-hidden">
              {/* Cabeçalho da fórmula — categoria sempre visível */}
              <div className="px-5 pt-4 pb-3">
                <div className="flex items-start gap-3">
                  <span className="text-xs bg-[#D4A017]/20 text-[#D4A017] border border-[#D4A017]/30 rounded-full w-6 h-6 flex items-center justify-center font-bold shrink-0 mt-0.5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white text-sm truncate mb-0.5">{f.nome_interno || 'Sem nome'}</p>
                    <p className="text-xs text-gray-400 truncate mb-3">{f.aplicacao}</p>
                    {/* Seletor de categoria sempre visível */}
                    <div>
                      <label className="text-xs font-medium text-[#D4A017] block mb-1">Categoria / Segmento</label>
                      <select
                        value={f.segmento}
                        onChange={e => updatePreview(i, 'segmento', e.target.value)}
                        onClick={e => e.stopPropagation()}
                        className="w-full bg-[#0A1628] border border-[#D4A017]/40 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"
                      >
                        {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="gray">{f.composicao.length} MPs</Badge>
                    <button onClick={() => updatePreview(i, '_expandido', !f._expandido)} className="text-gray-500 hover:text-gray-300 transition-colors">
                      {f._expandido ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>
              </div>

              {f._expandido && (
                <div className="px-5 pb-5 border-t border-white/8 pt-4 space-y-3">
                  {/* Nome e pH */}

                  {/* Nome e Aplicação */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Nome interno</label>
                      <input value={f.nome_interno} onChange={e => updatePreview(i, 'nome_interno', e.target.value)}
                        className="w-full bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">pH final</label>
                      <input value={f.ph_final || ''} onChange={e => updatePreview(i, 'ph_final', e.target.value)}
                        className="w-full bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500" />
                    </div>
                  </div>

                  {/* Composição */}
                  <div>
                    <label className="text-xs font-medium text-gray-400 block mb-2">Composição extraída</label>
                    <div className="space-y-1">
                      {f.composicao.map((c, ci) => (
                        <div key={ci} className="flex items-center gap-2 text-xs bg-[#0A1628] rounded-lg px-3 py-2">
                          <span className="text-white flex-1">{c.materia_prima}</span>
                          <span className="text-[#D4A017] font-mono w-12 text-right">{c.percentual}%</span>
                          <span className="text-gray-500 flex-1 text-right">{c.funcao}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Performance */}
                  {f.performance_chave && (
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Performance</label>
                      <p className="text-xs text-green-400/80 bg-green-500/10 rounded-lg px-3 py-2">{f.performance_chave}</p>
                    </div>
                  )}

                  {/* Tags */}
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">Tags</label>
                    <input value={f.tags || ''} onChange={e => updatePreview(i, 'tags', e.target.value)}
                      placeholder="Ex: alcalino, industrial, metais..."
                      className="w-full bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500" />
                  </div>

                  <button onClick={() => setPreview(p => p?.filter((_, j) => j !== i) ?? null)}
                    className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors">
                    <Trash2 size={12} /> Remover esta fórmula
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <Button variant="gold" onClick={salvarTodos} disabled={salvando}>
            {salvando ? 'Salvando...' : <><CheckCircle2 size={15} /> Salvar {preview.length} fórmula(s) no banco</>}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {sucesso && <div className="mb-4 p-3 bg-green-500/15 border border-green-500/30 rounded-lg text-green-400 text-sm">{sucesso}</div>}

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${dragging ? 'border-[#D4A017] bg-[#D4A017]/10' : 'border-[#1B3A6B] hover:border-[#D4A017]/50 hover:bg-white/3'}`}
      >
        <input ref={inputRef} type="file" accept=".pdf,.docx,.doc,.xlsx,.xls,.md" multiple className="hidden" onChange={onInput} />
        <Upload size={40} className={`mx-auto mb-4 ${dragging ? 'text-[#D4A017]' : 'text-gray-600'}`} />
        <p className="text-white font-medium mb-1">Arraste o arquivo aqui ou clique para selecionar</p>
        <p className="text-gray-500 text-sm">Suporta PDF, Word (.docx), Excel (.xlsx) e Markdown (.md)</p>
        <p className="text-gray-600 text-xs mt-3">O Claude vai ler o documento e extrair as fórmulas automaticamente</p>
      </div>

      {erro && (
        <div className="mt-4 p-4 bg-red-500/15 border border-red-500/30 rounded-xl flex gap-3">
          <AlertCircle size={16} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm">{erro}</p>
        </div>
      )}

      {/* Dicas */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-3">
        {[
          { icon: '📄', tipo: 'PDF', desc: 'Laudos, relatórios, fichas técnicas — o Claude extrai os dados automaticamente.' },
          { icon: '📝', tipo: 'Word (.docx)', desc: 'Documentos com tabelas de composição, procedimentos e especificações.' },
          { icon: '📊', tipo: 'Excel (.xlsx)', desc: 'Planilhas com listas de ingredientes, percentuais e parâmetros.' },
          { icon: '📋', tipo: 'Markdown (.md)', desc: 'Artigos científicos estruturados com seções, resultados e referências.' },
        ].map(({ icon, tipo, desc }) => (
          <div key={tipo} className="bg-[#111f3a] border border-white/8 rounded-xl p-4">
            <div className="text-2xl mb-2">{icon}</div>
            <p className="text-sm font-medium text-white mb-1">{tipo}</p>
            <p className="text-xs text-gray-500">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── CADASTRO MANUAL ─────────────────────────────────────────────────────────
function CadastroManual({ pin, onSalvou }: { pin: string; onSalvou: () => void }) {
  const [form, setForm] = useState({
    nome_interno: '', segmento: SEGMENTOS[0], aplicacao: '',
    ph_final: '', viscosidade: '', processo: '', performance_chave: '', tags: '',
  })
  const [componentes, setComponentes] = useState<Componente[]>([
    { materia_prima: '', percentual: '', funcao: '' },
    { materia_prima: '', percentual: '', funcao: '' },
  ])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  const totalPerc = componentes.reduce((s, c) => s + (parseFloat(c.percentual) || 0), 0)

  function updateComp(i: number, field: keyof Componente, val: string) {
    setComponentes(prev => prev.map((c, j) => j === i ? { ...c, [field]: val } : c))
  }

  async function salvar() {
    const comps = componentes.filter(c => c.materia_prima.trim() && c.percentual && c.funcao.trim())
    if (!form.nome_interno || !form.aplicacao || comps.length < 1) {
      setErro('Preencha nome interno, aplicação e pelo menos 1 componente.')
      return
    }
    setSalvando(true); setErro(null)
    try {
      const res = await fetch('/api/admin/formulas', {
        method: 'POST',
        headers: { 'x-admin-pin': pin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, composicao: comps.map(c => ({ ...c, percentual: parseFloat(c.percentual) })) }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      setSucesso('Fórmula salva!')
      setTimeout(() => setSucesso(null), 3000)
      setForm({ nome_interno: '', segmento: SEGMENTOS[0], aplicacao: '', ph_final: '', viscosidade: '', processo: '', performance_chave: '', tags: '' })
      setComponentes([{ materia_prima: '', percentual: '', funcao: '' }, { materia_prima: '', percentual: '', funcao: '' }])
      onSalvou()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="Nome / Código Interno *" value={form.nome_interno} onChange={e => setForm(p => ({ ...p, nome_interno: e.target.value }))} placeholder="Ex: FP-001, Desengraxante Alcalino v3" />
        <Select label="Segmento *" options={SEG_OPTIONS} value={form.segmento} onChange={e => setForm(p => ({ ...p, segmento: e.target.value }))} />
        <div className="md:col-span-2">
          <Textarea label="Aplicação / Descrição *" value={form.aplicacao} onChange={e => setForm(p => ({ ...p, aplicacao: e.target.value }))} placeholder="Descreva o produto, substrato, sujeira alvo..." rows={2} />
        </div>
      </div>

      {/* Composição */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-300">Composição *</label>
          <span className={`text-xs font-mono ${Math.abs(totalPerc - 100) < 0.5 ? 'text-green-400' : totalPerc > 100 ? 'text-red-400' : 'text-yellow-400'}`}>Total: {totalPerc.toFixed(1)}%</span>
        </div>
        <div className="space-y-2 mb-2">
          <div className="grid grid-cols-12 gap-2 text-xs text-gray-500 px-1">
            <div className="col-span-4">Matéria-prima</div>
            <div className="col-span-2">% p/p</div>
            <div className="col-span-5">Função técnica</div>
          </div>
          {componentes.map((c, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <input type="text" value={c.materia_prima} onChange={e => updateComp(i, 'materia_prima', e.target.value)} placeholder="Nome da MP..." className="col-span-4 bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-500" />
              <input type="number" value={c.percentual} onChange={e => updateComp(i, 'percentual', e.target.value)} placeholder="0.0" step="0.1" min="0" max="100" className="col-span-2 bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-500" />
              <input type="text" value={c.funcao} onChange={e => updateComp(i, 'funcao', e.target.value)} placeholder="Ex: tensoativo aniônico" className="col-span-5 bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-yellow-500" />
              <button onClick={() => setComponentes(p => p.filter((_, j) => j !== i))} className="col-span-1 flex justify-center text-gray-600 hover:text-red-400 transition-colors">
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setComponentes(p => [...p, { materia_prima: '', percentual: '', funcao: '' }])}>
          <Plus size={13} /> Adicionar componente
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input label="pH Final" value={form.ph_final} onChange={e => setForm(p => ({ ...p, ph_final: e.target.value }))} placeholder="Ex: 9.5–10.5" />
        <Input label="Viscosidade" value={form.viscosidade} onChange={e => setForm(p => ({ ...p, viscosidade: e.target.value }))} placeholder="Ex: fluido, 500 cP" />
        <div className="md:col-span-2">
          <Textarea label="Performance Comprovada" value={form.performance_chave} onChange={e => setForm(p => ({ ...p, performance_chave: e.target.value }))} placeholder="Ex: Remoção ≥ 98% de óleo mineral em 3 min a 50°C." rows={2} />
        </div>
        <div className="md:col-span-2">
          <Textarea label="Observações de Processo" value={form.processo} onChange={e => setForm(p => ({ ...p, processo: e.target.value }))} placeholder="Ordem de adição, temperatura, cuidados..." rows={2} />
        </div>
        <div className="md:col-span-2">
          <Input label="Tags (separadas por vírgula)" value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))} placeholder="Ex: alcalino, industrial, metais, concentrado" />
        </div>
      </div>

      {erro && <div className="p-3 bg-red-500/15 border border-red-500/30 rounded-lg text-red-400 text-sm">{erro}</div>}
      {sucesso && <div className="p-3 bg-green-500/15 border border-green-500/30 rounded-lg text-green-400 text-sm">{sucesso}</div>}

      <Button variant="gold" onClick={salvar} disabled={salvando} className="w-full">
        {salvando ? 'Salvando...' : <><FlaskConical size={15} /> Salvar Fórmula Proprietária</>}
      </Button>
    </div>
  )
}

// ─── LISTA DE CADASTRADAS ────────────────────────────────────────────────────
const SEG_CORES: Record<string, string> = {
  'Limpeza e Manutenção Industrial': 'border-blue-500/40 text-blue-400 bg-blue-500/10',
  'Automotivo': 'border-orange-500/40 text-orange-400 bg-orange-500/10',
  'Saneantes e Domissanitários': 'border-green-500/40 text-green-400 bg-green-500/10',
  'Tintas e Vernizes': 'border-purple-500/40 text-purple-400 bg-purple-500/10',
  'Resinas e Polímeros': 'border-violet-500/40 text-violet-400 bg-violet-500/10',
  'Biosolventes e Biolubrificantes': 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
  'Cosmético': 'border-pink-500/40 text-pink-400 bg-pink-500/10',
}
const SEG_EMOJI: Record<string, string> = {
  'Limpeza e Manutenção Industrial': '🧪',
  'Automotivo': '🚗',
  'Saneantes e Domissanitários': '🧴',
  'Tintas e Vernizes': '🎨',
  'Resinas e Polímeros': '🧪',
  'Biosolventes e Biolubrificantes': '🌿',
  'Cosmético': '💄',
}

function ListaCadastradas({ pin, formulas, onAtualizar }: { pin: string; formulas: FormulaDB[]; onAtualizar: () => void }) {
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [segFiltro, setSegFiltro] = useState<string>('todos')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [editComps, setEditComps] = useState<Componente[]>([])
  const [salvandoEdit, setSalvandoEdit] = useState(false)
  const adminH = { 'x-admin-pin': pin, 'Content-Type': 'application/json' }

  function iniciarEdicao(f: FormulaDB) {
    const comps: { materia_prima: string; percentual: number; funcao: string }[] =
      Array.isArray(f.composicao) ? f.composicao : JSON.parse(f.composicao as unknown as string)
    setEditandoId(f.id)
    setEditForm({
      nome_interno: f.nome_interno,
      segmento: f.segmento,
      aplicacao: f.aplicacao,
      ph_final: f.ph_final || '',
      viscosidade: f.viscosidade || '',
      processo: f.processo || '',
      performance_chave: f.performance_chave || '',
      tags: f.tags || '',
    })
    setEditComps(comps.map(c => ({ materia_prima: c.materia_prima, percentual: String(c.percentual), funcao: c.funcao })))
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setEditForm({})
    setEditComps([])
  }

  async function salvarEdicao(id: string) {
    setSalvandoEdit(true)
    try {
      const compsLimpas = editComps.filter(c => c.materia_prima.trim()).map(c => ({
        materia_prima: c.materia_prima,
        percentual: parseFloat(c.percentual) || 0,
        funcao: c.funcao,
      }))
      await fetch(`/api/admin/formulas/${id}`, {
        method: 'PUT',
        headers: adminH,
        body: JSON.stringify({ ...editForm, composicao: compsLimpas }),
      })
      setEditandoId(null)
      onAtualizar()
    } catch { /* continua */ } finally {
      setSalvandoEdit(false)
    }
  }

  function updateEditComp(i: number, field: keyof Componente, val: string) {
    setEditComps(prev => prev.map((c, j) => j === i ? { ...c, [field]: val } : c))
  }

  async function excluir(id: string) {
    if (!confirm('Excluir esta fórmula permanentemente?')) return
    await fetch(`/api/admin/formulas/${id}`, { method: 'DELETE', headers: adminH })
    onAtualizar()
  }

  async function toggleAtiva(id: string, ativa: boolean) {
    await fetch('/api/admin/formulas', {
      method: 'PATCH', headers: adminH,
      body: JSON.stringify({ id, ativa: !ativa }),
    })
    onAtualizar()
  }

  function toggleExpand(id: string) {
    setExpandidos(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  if (formulas.length === 0) {
    return (
      <div className="text-center py-16 text-gray-600">
        <FlaskConical size={40} className="mx-auto mb-3 opacity-30" />
        <p>Nenhuma fórmula cadastrada ainda.</p>
        <p className="text-xs mt-1">Use a aba &quot;Importar Arquivo&quot; para começar.</p>
      </div>
    )
  }

  // Agrupa por segmento
  const porSegmento: Record<string, FormulaDB[]> = {}
  for (const f of formulas) {
    if (!porSegmento[f.segmento]) porSegmento[f.segmento] = []
    porSegmento[f.segmento].push(f)
  }

  const formulasFiltradas = segFiltro === 'todos' ? formulas : (porSegmento[segFiltro] || [])

  return (
    <div>
      {/* Resumo por categoria */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-6">
        <button
          onClick={() => setSegFiltro('todos')}
          className={`p-3 rounded-xl border text-left transition-all ${segFiltro === 'todos' ? 'border-[#D4A017]/60 bg-[#D4A017]/10' : 'border-white/8 bg-[#0A1628] hover:border-white/20'}`}
        >
          <div className="text-xl font-bold text-white">{formulas.length}</div>
          <div className="text-xs text-gray-400 mt-0.5">Todas as categorias</div>
          <div className="text-xs text-gray-600">{formulas.filter(f => f.ativa).length} ativas</div>
        </button>
        {SEGMENTOS.filter(s => porSegmento[s]?.length > 0).map(seg => (
          <button
            key={seg}
            onClick={() => setSegFiltro(segFiltro === seg ? 'todos' : seg)}
            className={`p-3 rounded-xl border text-left transition-all ${segFiltro === seg ? `${SEG_CORES[seg]} border-opacity-60` : 'border-white/8 bg-[#0A1628] hover:border-white/20'}`}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-base">{SEG_EMOJI[seg] || '🧬'}</span>
              <span className="text-xl font-bold text-white">{porSegmento[seg].length}</span>
            </div>
            <div className="text-xs text-gray-300 leading-tight">{seg.split(' e ')[0].split(',')[0]}</div>
            <div className="text-xs text-gray-600">{porSegmento[seg].filter(f => f.ativa).length} ativas</div>
          </button>
        ))}
      </div>

      {segFiltro !== 'todos' && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-gray-400">Filtrando:</span>
          <span className={`text-xs px-3 py-1 rounded-full border ${SEG_CORES[segFiltro] || 'border-white/20 text-gray-400'}`}>{SEG_EMOJI[segFiltro]} {segFiltro}</span>
          <button onClick={() => setSegFiltro('todos')} className="text-xs text-gray-600 hover:text-gray-300 underline">ver todas</button>
        </div>
      )}

      {/* Lista de fórmulas */}
      <div className="space-y-2">
        {formulasFiltradas.map(f => {
          const comps: { materia_prima: string; percentual: number; funcao: string }[] =
            Array.isArray(f.composicao) ? f.composicao : JSON.parse(f.composicao as unknown as string)
          const expandido = expandidos.has(f.id)
          const corSeg = SEG_CORES[f.segmento] || 'border-white/20 text-gray-400'

          return (
            <div key={f.id} className={`border rounded-xl overflow-hidden transition-all ${f.ativa ? 'border-white/8' : 'border-white/4 opacity-55'}`}>
              {/* Cabeçalho sempre visível */}
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/3 transition-colors"
                onClick={() => toggleExpand(f.id)}
              >
                <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${corSeg}`}>
                  {SEG_EMOJI[f.segmento]} {f.segmento.split(' e ')[0].split(',')[0]}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-white text-sm">{f.nome_interno}</span>
                  <span className="text-gray-500 text-xs ml-2 truncate hidden sm:inline">{f.aplicacao}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-gray-600">{comps.length} MPs</span>
                  {f.ph_final && <span className="text-xs text-gray-600">pH {f.ph_final}</span>}
                  <Badge variant={f.ativa ? 'green' : 'gray'} className="hidden sm:inline-flex">
                    {f.ativa ? 'Ativa' : 'Inativa'}
                  </Badge>
                  {expandido ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
                </div>
              </div>

              {/* Detalhe expandido */}
              {expandido && (
                <div className="border-t border-white/8 px-4 py-4 bg-[#0A1628]/40">
                  {editandoId === f.id ? (
                    /* ── MODO EDIÇÃO ── */
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Nome interno</label>
                          <input value={editForm.nome_interno || ''} onChange={e => setEditForm(p => ({ ...p, nome_interno: e.target.value }))}
                            className="w-full bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500" />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-[#D4A017] block mb-1">Categoria / Segmento</label>
                          <select value={editForm.segmento || ''} onChange={e => setEditForm(p => ({ ...p, segmento: e.target.value }))}
                            className="w-full bg-[#0A1628] border border-[#D4A017]/40 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500">
                            {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-xs text-gray-400 block mb-1">Aplicação</label>
                          <textarea value={editForm.aplicacao || ''} onChange={e => setEditForm(p => ({ ...p, aplicacao: e.target.value }))} rows={2}
                            className="w-full bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500 resize-none" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">pH Final</label>
                          <input value={editForm.ph_final || ''} onChange={e => setEditForm(p => ({ ...p, ph_final: e.target.value }))}
                            className="w-full bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500" />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Viscosidade</label>
                          <input value={editForm.viscosidade || ''} onChange={e => setEditForm(p => ({ ...p, viscosidade: e.target.value }))}
                            className="w-full bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500" />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-xs text-gray-400 block mb-1">Performance comprovada</label>
                          <textarea value={editForm.performance_chave || ''} onChange={e => setEditForm(p => ({ ...p, performance_chave: e.target.value }))} rows={2}
                            className="w-full bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500 resize-none" />
                        </div>
                        <div className="md:col-span-2">
                          <label className="text-xs text-gray-400 block mb-1">Tags (separadas por vírgula)</label>
                          <input value={editForm.tags || ''} onChange={e => setEditForm(p => ({ ...p, tags: e.target.value }))}
                            className="w-full bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500" />
                        </div>
                      </div>

                      {/* Composição editável */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-medium text-gray-400">Composição</label>
                          <span className={`text-xs font-mono ${Math.abs(editComps.reduce((s, c) => s + (parseFloat(c.percentual) || 0), 0) - 100) < 0.5 ? 'text-green-400' : 'text-yellow-400'}`}>
                            Total: {editComps.reduce((s, c) => s + (parseFloat(c.percentual) || 0), 0).toFixed(1)}%
                          </span>
                        </div>
                        <div className="space-y-1.5 mb-2">
                          <div className="grid grid-cols-12 gap-1.5 text-xs text-gray-500 px-1">
                            <div className="col-span-4">Matéria-prima</div>
                            <div className="col-span-2">%</div>
                            <div className="col-span-5">Função</div>
                          </div>
                          {editComps.map((c, i) => (
                            <div key={i} className="grid grid-cols-12 gap-1.5 items-center">
                              <input value={c.materia_prima} onChange={e => updateEditComp(i, 'materia_prima', e.target.value)}
                                className="col-span-4 bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-500" />
                              <input type="number" value={c.percentual} onChange={e => updateEditComp(i, 'percentual', e.target.value)} step="0.1" min="0" max="100"
                                className="col-span-2 bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-500" />
                              <input value={c.funcao} onChange={e => updateEditComp(i, 'funcao', e.target.value)}
                                className="col-span-5 bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-yellow-500" />
                              <button onClick={() => setEditComps(p => p.filter((_, j) => j !== i))} className="col-span-1 flex justify-center text-gray-600 hover:text-red-400">
                                <X size={12} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <button onClick={() => setEditComps(p => [...p, { materia_prima: '', percentual: '', funcao: '' }])}
                          className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 transition-colors">
                          <Plus size={12} /> Adicionar componente
                        </button>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/8">
                        <button onClick={cancelarEdicao} className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors">
                          <X size={13} /> Cancelar
                        </button>
                        <button onClick={() => salvarEdicao(f.id)} disabled={salvandoEdit}
                          className="text-xs text-white bg-[#D4A017]/80 hover:bg-[#D4A017] disabled:opacity-50 flex items-center gap-1.5 px-4 py-1.5 rounded-lg transition-colors font-medium">
                          {salvandoEdit ? 'Salvando...' : <><CheckCircle2 size={13} /> Salvar alterações</>}
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* ── MODO VISUALIZAÇÃO ── */
                    <>
                      <p className="text-xs text-gray-400 mb-3">{f.aplicacao}</p>

                      {/* Composição completa */}
                      <div className="mb-3">
                        <p className="text-xs font-medium text-gray-500 mb-2">COMPOSIÇÃO</p>
                        <div className="space-y-1">
                          {comps.map((c, ci) => (
                            <div key={ci} className="flex items-center gap-3 text-xs">
                              <div className="w-24 shrink-0">
                                <div className="bg-[#1B3A6B] rounded-full h-1.5">
                                  <div className="h-1.5 rounded-full bg-[#D4A017]" style={{ width: `${Math.min(c.percentual, 100)}%` }} />
                                </div>
                              </div>
                              <span className="text-[#D4A017] font-mono w-10 shrink-0">{c.percentual}%</span>
                              <span className="text-white flex-1">{c.materia_prima}</span>
                              <span className="text-gray-500 hidden sm:block">{c.funcao}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 mb-3">
                        {f.ph_final && (
                          <div><p className="text-xs text-gray-500 mb-0.5">pH</p><p className="text-sm text-white">{f.ph_final}</p></div>
                        )}
                        {f.viscosidade && (
                          <div><p className="text-xs text-gray-500 mb-0.5">Viscosidade</p><p className="text-sm text-white">{f.viscosidade}</p></div>
                        )}
                      </div>

                      {f.performance_chave && (
                        <div className="mb-3 p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
                          <p className="text-xs text-gray-500 mb-0.5">Performance comprovada</p>
                          <p className="text-xs text-green-300">{f.performance_chave}</p>
                        </div>
                      )}
                      {f.processo && (
                        <div className="mb-3">
                          <p className="text-xs text-gray-500 mb-0.5">Processo</p>
                          <p className="text-xs text-gray-300">{f.processo}</p>
                        </div>
                      )}
                      {f.tags && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {f.tags.split(',').map((t, ti) => (
                            <span key={ti} className="text-xs bg-white/5 text-gray-400 border border-white/10 rounded-full px-2 py-0.5">{t.trim()}</span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-white/8">
                        <button
                          onClick={() => toggleAtiva(f.id, f.ativa)}
                          className={`flex items-center gap-1.5 text-xs transition-colors ${f.ativa ? 'text-green-400 hover:text-yellow-400' : 'text-gray-500 hover:text-green-400'}`}
                        >
                          {f.ativa ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          {f.ativa ? 'Ativa — IA usa como referência' : 'Inativa — IA ignora'}
                        </button>
                        <div className="flex items-center gap-3">
                          <button onClick={() => iniciarEdicao(f)} className="text-xs text-gray-500 hover:text-blue-400 flex items-center gap-1 transition-colors">
                            <Pencil size={12} /> Editar
                          </button>
                          <button onClick={() => excluir(f.id)} className="text-xs text-gray-600 hover:text-red-400 flex items-center gap-1 transition-colors">
                            <Trash2 size={12} /> Excluir
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── DOCS CIENTÍFICOS ────────────────────────────────────────────────────────
interface DocCientifico {
  id: string; titulo: string; autores?: string; ano?: number; fonte?: string
  segmento: string; tags: string; resumo?: string; arquivo_nome?: string
  ativo: boolean; createdAt: string
}

function DocsCientificos({ pin }: { pin: string }) {
  const [docs, setDocs] = useState<DocCientifico[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [extraindo, setExtraindo] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [salvandoEdit, setSalvandoEdit] = useState(false)
  const [form, setForm] = useState({
    titulo: '', autores: '', ano: '', fonte: '', segmento: SEGMENTOS[0], tags: '', resumo: '',
  })

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/documentos', { headers: { 'x-admin-pin': pin } })
      const data = await res.json()
      setDocs(data.documentos || [])
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [pin])

  useEffect(() => { carregar() }, [carregar])

  async function aplicarArquivo(f: File) {
    setArquivo(f)
    // Preenche título imediatamente com nome do arquivo como fallback
    const nomeBase = f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
    setForm(p => ({ ...p, titulo: p.titulo.trim() ? p.titulo : nomeBase }))

    // Extrai metadados via IA em paralelo (apenas se tamanho ok)
    if (f.size <= 4 * 1024 * 1024) {
      setExtraindo(true)
      try {
        const fd = new FormData()
        fd.append('file', f)
        const res = await fetch('/api/admin/documentos/extrair-metadados', {
          method: 'POST',
          headers: { 'x-admin-pin': pin },
          body: fd,
        })
        if (res.ok) {
          const meta = await res.json() as Record<string, unknown>
          setForm(p => ({
            titulo: (meta.titulo as string) || p.titulo,
            autores: (meta.autores as string) || p.autores,
            ano: meta.ano ? String(meta.ano) : p.ano,
            fonte: (meta.fonte as string) || p.fonte,
            segmento: p.segmento,
            tags: Array.isArray(meta.tags) ? (meta.tags as string[]).join(', ') : p.tags,
            resumo: (meta.resumo as string) || p.resumo,
          }))
        }
      } catch { /* ignora — campos ficam com valores do usuário */ }
      finally { setExtraindo(false) }
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) aplicarArquivo(f)
  }

  async function enviar() {
    if (!arquivo) { setErro('Selecione um arquivo'); return }
    if (!form.titulo.trim()) { setErro('Título é obrigatório'); return }
    if (arquivo.size > 4 * 1024 * 1024) {
      setErro(`Arquivo muito grande (${(arquivo.size / 1024 / 1024).toFixed(1)} MB). Limite: 4 MB. Comprima o PDF ou divida o documento.`)
      return
    }
    setUploading(true); setErro(null); setSucesso(null)
    try {
      const fd = new FormData()
      fd.append('file', arquivo)
      Object.entries(form).forEach(([k, v]) => fd.append(k, v))
      const res = await fetch('/api/admin/documentos/upload', {
        method: 'POST', headers: { 'x-admin-pin': pin }, body: fd,
      })
      const raw = await res.text()
      let data: Record<string, unknown> = {}
      try { data = JSON.parse(raw) } catch { throw new Error(`Erro no servidor: ${raw.slice(0, 120)}`) }
      if (!res.ok) throw new Error(String(data.error || 'Erro ao enviar'))
      setSucesso(`"${form.titulo}" importado com sucesso!`)
      setArquivo(null)
      setForm({ titulo: '', autores: '', ano: '', fonte: '', segmento: SEGMENTOS[0], tags: '', resumo: '' })
      carregar()
    } catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao enviar') }
    finally { setUploading(false) }
  }

  async function toggleAtivo(id: string, ativo: boolean) {
    await fetch('/api/admin/documentos', {
      method: 'PATCH', headers: { 'x-admin-pin': pin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ativo: !ativo }),
    })
    carregar()
  }

  async function excluir(id: string) {
    if (!confirm('Excluir este documento?')) return
    await fetch('/api/admin/documentos', {
      method: 'DELETE', headers: { 'x-admin-pin': pin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    carregar()
  }

  function iniciarEdicao(doc: DocCientifico) {
    setEditandoId(doc.id)
    setEditForm({
      titulo: doc.titulo || '',
      autores: doc.autores || '',
      ano: doc.ano ? String(doc.ano) : '',
      fonte: doc.fonte || '',
      segmento: doc.segmento || '',
      tags: doc.tags || '',
      resumo: doc.resumo || '',
    })
  }

  async function salvarEdicao() {
    if (!editandoId) return
    setSalvandoEdit(true)
    try {
      const res = await fetch('/api/admin/documentos', {
        method: 'PATCH',
        headers: { 'x-admin-pin': pin, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editandoId, ...editForm }),
      })
      if (res.ok) {
        setSucesso('Documento atualizado com sucesso!')
        setEditandoId(null)
        carregar()
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSalvandoEdit(false)
    }
  }

  function cancelarEdicao() {
    setEditandoId(null)
    setEditForm({})
  }

  return (
    <div className="space-y-6">
      {/* Upload */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Upload size={14} className="text-blue-400" /> Adicionar Documento
        </h3>

        {/* Drop zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all mb-4 ${dragging ? 'border-blue-400 bg-blue-500/10' : arquivo ? 'border-green-500/50 bg-green-500/5' : 'border-white/15 hover:border-white/30'}`}
        >
          <input ref={inputRef} type="file" accept=".pdf,.docx,.doc" className="hidden"
            onChange={e => { if (e.target.files?.[0]) aplicarArquivo(e.target.files[0]); e.target.value = '' }} />
          {arquivo ? (
            <div className="flex items-center justify-center gap-2">
              <CheckCircle2 size={16} className="text-green-400" />
              <span className="text-sm text-green-300">{arquivo.name}</span>
              <button onClick={e => { e.stopPropagation(); setArquivo(null) }} className="text-gray-500 hover:text-red-400">
                <X size={14} />
              </button>
            </div>
          ) : (
            <>
              <FileText size={24} className="mx-auto mb-2 text-gray-600" />
              <p className="text-sm text-gray-400">Arraste ou clique para selecionar</p>
              <p className="text-xs text-gray-600 mt-1">PDF ou Word (.docx) — máx. 10MB</p>
            </>
          )}
        </div>

        {/* Indicador extração */}
        {extraindo && (
          <div className="flex items-center gap-2 text-xs text-blue-400 mb-3 px-1">
            <div className="w-3 h-3 border border-blue-400/40 border-t-blue-400 rounded-full animate-spin shrink-0" />
            Extraindo metadados do documento com IA...
          </div>
        )}

        {/* Metadados */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-xs text-gray-400 block mb-1">Título <span className="text-red-400">*</span></label>
            <input value={form.titulo} onChange={e => setForm(p => ({ ...p, titulo: e.target.value }))}
              placeholder="Ex: Biosolventes Terpênicos em Limpeza Industrial"
              className="w-full bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Segmento <span className="text-red-400">*</span></label>
            <select value={form.segmento} onChange={e => setForm(p => ({ ...p, segmento: e.target.value }))}
              className="w-full bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
              {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 block mb-1">Autores</label>
            <input value={form.autores} onChange={e => setForm(p => ({ ...p, autores: e.target.value }))}
              placeholder="Ex: Silva, J. A.; Costa, M. B."
              className="w-full bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Ano</label>
              <input type="number" value={form.ano} onChange={e => setForm(p => ({ ...p, ano: e.target.value }))}
                placeholder="2024"
                className="w-full bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Fonte</label>
              <input value={form.fonte} onChange={e => setForm(p => ({ ...p, fonte: e.target.value }))}
                placeholder="Journal / ABNT..."
                className="w-full bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500" />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-gray-400 block mb-1">Tags (separadas por vírgula)</label>
            <input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
              placeholder="d-limoneno, biossolvente, terpeno, biodegradável"
              className="w-full bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500" />
          </div>
          <div className="md:col-span-2">
            <label className="text-xs text-gray-400 block mb-1">Resumo / Principais achados</label>
            <textarea value={form.resumo} onChange={e => setForm(p => ({ ...p, resumo: e.target.value }))}
              rows={3} placeholder="Descreva os principais achados e relevância para formulação..."
              className="w-full bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500 resize-none" />
          </div>
        </div>

        {erro && <p className="text-red-400 text-xs mb-3 flex items-center gap-1"><AlertCircle size={12} />{erro}</p>}
        {sucesso && <p className="text-green-400 text-xs mb-3 flex items-center gap-1"><CheckCircle2 size={12} />{sucesso}</p>}

        <button onClick={enviar} disabled={uploading || !arquivo}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors flex items-center justify-center gap-2">
          {uploading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processando...</> : <><Upload size={14} /> Importar Documento</>}
        </button>
      </div>

      {/* Lista */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">
          Documentos Cadastrados ({docs.filter(d => d.ativo).length} ativos)
        </h3>
        {loading ? (
          <div className="text-center py-8 text-gray-500 text-sm">Carregando...</div>
        ) : docs.length === 0 ? (
          <div className="text-center py-8 text-gray-600 text-sm">Nenhum documento cadastrado ainda.</div>
        ) : (
          <div className="space-y-2">
            {docs.map(doc => {
              const tags = (() => { try { return JSON.parse(doc.tags) as string[] } catch { return [] } })()
              return (
                <div key={doc.id} className={`border rounded-xl px-4 py-3 transition-all ${doc.ativo ? 'border-blue-500/20 bg-blue-500/5' : 'border-white/5 opacity-50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white truncate">{doc.titulo}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {[doc.autores, doc.ano, doc.fonte].filter(Boolean).join(' · ')}
                        {doc.arquivo_nome && <span className="ml-2 text-gray-600">📎 {doc.arquivo_nome}</span>}
                      </p>
                      <p className="text-xs text-blue-400/70 mt-0.5">{doc.segmento}</p>
                      {tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {tags.map((t, i) => <span key={i} className="text-xs px-1.5 py-0.5 bg-white/5 rounded text-gray-400">{t}</span>)}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button onClick={() => iniciarEdicao(doc)}
                        className="text-gray-600 hover:text-blue-400 transition-colors">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => toggleAtivo(doc.id, doc.ativo)}
                        className={`text-xs flex items-center gap-1 transition-colors ${doc.ativo ? 'text-green-400 hover:text-yellow-400' : 'text-gray-500 hover:text-green-400'}`}>
                        {doc.ativo ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                      </button>
                      <button onClick={() => excluir(doc.id)} className="text-gray-600 hover:text-red-400 transition-colors">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de Edição */}
      {editandoId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#0A1628] border border-blue-500/30 rounded-xl p-6 max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-white mb-4">Editar Documento</h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Título</label>
                <input value={editForm.titulo || ''} onChange={e => setEditForm(p => ({ ...p, titulo: e.target.value }))}
                  className="w-full bg-[#111f3a] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Segmento</label>
                <select value={editForm.segmento || ''} onChange={e => setEditForm(p => ({ ...p, segmento: e.target.value }))}
                  className="w-full bg-[#111f3a] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500">
                  {SEGMENTOS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Autores</label>
                <input value={editForm.autores || ''} onChange={e => setEditForm(p => ({ ...p, autores: e.target.value }))}
                  className="w-full bg-[#111f3a] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Ano</label>
                  <input type="number" value={editForm.ano || ''} onChange={e => setEditForm(p => ({ ...p, ano: e.target.value }))}
                    className="w-full bg-[#111f3a] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Fonte</label>
                  <input value={editForm.fonte || ''} onChange={e => setEditForm(p => ({ ...p, fonte: e.target.value }))}
                    className="w-full bg-[#111f3a] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Tags</label>
                <input value={editForm.tags || ''} onChange={e => setEditForm(p => ({ ...p, tags: e.target.value }))}
                  className="w-full bg-[#111f3a] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Resumo</label>
                <textarea value={editForm.resumo || ''} onChange={e => setEditForm(p => ({ ...p, resumo: e.target.value }))}
                  rows={3} className="w-full bg-[#111f3a] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 resize-none" />
              </div>
            </div>

            <div className="flex gap-2 mt-6">
              <button onClick={cancelarEdicao}
                className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white text-sm font-semibold rounded-lg transition-colors">
                Cancelar
              </button>
              <button onClick={salvarEdicao} disabled={salvandoEdit}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors">
                {salvandoEdit ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── PÁGINA PRINCIPAL ────────────────────────────────────────────────────────
export default function AdminPage() {
  const [pin, setPin] = useState('')
  const [autenticado, setAutenticado] = useState(false)
  const [aba, setAba] = useState<Aba>('importar')
  const [formulas, setFormulas] = useState<FormulaDB[]>([])
  const [migrando, setMigrando] = useState(false)
  const [msgMigracao, setMsgMigracao] = useState<string | null>(null)

  async function migrarFormulas() {
    setMigrando(true)
    setMsgMigracao(null)
    try {
      const res = await fetch('/api/admin/migrar-formulas', { method: 'POST' })
      const data = await res.json()
      setMsgMigracao(data.mensagem || data.error || 'Concluído.')
    } catch {
      setMsgMigracao('Erro ao migrar.')
    } finally {
      setMigrando(false)
    }
  }

  const carregar = useCallback(async (p: string) => {
    const res = await fetch('/api/admin/formulas', { headers: { 'x-admin-pin': p } })
    if (res.ok) setFormulas(await res.json())
  }, [])

  useEffect(() => {
    if (autenticado) carregar(pin)
  }, [autenticado, pin, carregar])

  if (!autenticado) {
    return <Login onLogin={p => { setPin(p); setAutenticado(true) }} />
  }

  const ativas = formulas.filter(f => f.ativa).length

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Lock className="text-[#D4A017]" size={22} />
          P&D Proprietário — Banco de Fórmulas
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Área confidencial · A IA usa estas fórmulas como referência interna · Nunca serão reveladas aos usuários
        </p>
      </div>

      {/* Abas */}
      <div className="flex gap-1 mb-6 bg-[#0d1f3c] border border-[#1B3A6B]/60 rounded-xl p-1">
        {([
          { id: 'importar', label: 'Importar Arquivo', icon: Upload },
          { id: 'manual', label: 'Cadastrar Manual', icon: Plus },
          { id: 'cadastradas', label: `Formulações (${formulas.length})`, icon: FileText },
          { id: 'documentos', label: 'Artigos Científicos', icon: FlaskConical },
        ] as { id: Aba; label: string; icon: React.ElementType }[]).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setAba(id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${aba === id ? 'bg-[#D4A017]/15 text-[#D4A017] border border-[#D4A017]/30' : 'text-gray-500 hover:text-gray-300'}`}
          >
            <Icon size={14} />{label}
          </button>
        ))}
      </div>

      {/* Migração de fórmulas sem usuário */}
      <div className="mb-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg flex items-center justify-between gap-3">
        <div>
          <p className="text-xs text-yellow-300 font-medium">Recuperar fórmulas antigas</p>
          <p className="text-xs text-gray-500 mt-0.5">Atribui ao seu usuário todas as fórmulas salvas antes da separação por conta.</p>
          {msgMigracao && <p className="text-xs text-green-400 mt-1">{msgMigracao}</p>}
        </div>
        <button
          onClick={migrarFormulas}
          disabled={migrando}
          className="shrink-0 text-xs px-3 py-1.5 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 text-yellow-300 rounded-lg transition-colors disabled:opacity-50"
        >
          {migrando ? 'Migrando...' : 'Executar'}
        </button>
      </div>

      {ativas > 0 && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2">
          <CheckCircle2 size={14} className="text-green-400" />
          <p className="text-xs text-green-300">{ativas} fórmula(s) ativa(s) — sendo usadas como referência pela IA nas novas formulações.</p>
        </div>
      )}

      <div className="bg-[#111f3a] border border-white/8 rounded-xl p-6">
        {aba === 'importar' && <ImportarArquivo pin={pin} onImportou={() => { carregar(pin); setAba('cadastradas') }} />}
        {aba === 'manual' && <CadastroManual pin={pin} onSalvou={() => { carregar(pin); setAba('cadastradas') }} />}
        {aba === 'cadastradas' && <ListaCadastradas pin={pin} formulas={formulas} onAtualizar={() => carregar(pin)} />}
        {aba === 'documentos' && <DocsCientificos pin={pin} />}
      </div>
    </div>
  )
}
