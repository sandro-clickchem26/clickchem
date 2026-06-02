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
  { value: 'Tintas e Vernizes', label: 'Tintas e Vernizes' },
  { value: 'Resinas e Polímeros', label: 'Resinas e Polímeros' },
  { value: 'Biosolventes e Biolubrificantes', label: 'Biosolventes e Biolubrificantes' },
  { value: 'Cosmético', label: 'Cosmético' },
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

// Escala Gardner de viscosidade — usada em Resinas e Polímeros
const VISCOSIDADES_GARDNER = [
  { value: '', label: 'Selecione (Escala Gardner)...' },
  { value: 'Gardner A — 50 cps / 0,5 Poise',    label: 'A  —  50 cps  /  0,5 Poise' },
  { value: 'Gardner Q — 435 cps / 4,35 Poise',   label: 'Q  —  435 cps  /  4,35 Poise' },
  { value: 'Gardner R — 470 cps / 4,70 Poise',   label: 'R  —  470 cps  /  4,70 Poise' },
  { value: 'Gardner S — 500 cps / 5,00 Poise',   label: 'S  —  500 cps  /  5,00 Poise' },
  { value: 'Gardner T — 550 cps / 5,50 Poise',   label: 'T  —  550 cps  /  5,50 Poise' },
  { value: 'Gardner U — 627 cps / 6,27 Poise',   label: 'U  —  627 cps  /  6,27 Poise' },
  { value: 'Gardner V — 884 cps / 8,84 Poise',   label: 'V  —  884 cps  /  8,84 Poise' },
  { value: 'Gardner W — 1070 cps / 10,70 Poise', label: 'W  —  1.070 cps  /  10,70 Poise' },
  { value: 'Gardner X — 1290 cps / 12,90 Poise', label: 'X  —  1.290 cps  /  12,90 Poise' },
  { value: 'Gardner Y — 1760 cps / 17,60 Poise', label: 'Y  —  1.760 cps  /  17,60 Poise' },
  { value: 'Gardner Z — 2270 cps / 22,70 Poise', label: 'Z  —  2.270 cps  /  22,70 Poise' },
  { value: 'Gardner Z1 — 2700 cps / 27,00 Poise', label: 'Z1  —  2.700 cps  /  27,00 Poise' },
  { value: 'Gardner Z2 — 3620 cps / 36,20 Poise', label: 'Z2  —  3.620 cps  /  36,20 Poise' },
  { value: 'Gardner Z3 — 4630 cps / 46,30 Poise', label: 'Z3  —  4.630 cps  /  46,30 Poise' },
  { value: 'Gardner Z4 — 6340 cps / 63,40 Poise', label: 'Z4  —  6.340 cps  /  63,40 Poise' },
  { value: 'Gardner Z5 — 9850 cps / 98,50 Poise', label: 'Z5  —  9.850 cps  /  98,50 Poise' },
  { value: 'Gardner Z6 — 14800 cps / 148,00 Poise', label: 'Z6  —  14.800 cps  /  148,00 Poise' },
  { value: 'Gardner Z7 — 388 Stokes',  label: 'Z7  —  388 Stokes' },
  { value: 'Gardner Z8 — 590 Stokes',  label: 'Z8  —  590 Stokes' },
  { value: 'Gardner Z9 — 855 Stokes',  label: 'Z9  —  855 Stokes' },
  { value: 'Gardner Z10 — 1066 Stokes', label: 'Z10  —  1.066 Stokes' },
]

const SEGMENTO_TINTAS = 'Tintas e Vernizes'
const SEGMENTO_COSMETICO = 'Cosmético'

const TIPOS_PRODUTO_COSMETICO = [
  { value: '', label: 'Selecione o tipo de produto...' },
  { value: 'Creme facial', label: 'Creme facial' },
  { value: 'Loção corporal', label: 'Loção corporal' },
  { value: 'Sérum', label: 'Sérum' },
  { value: 'Máscara facial', label: 'Máscara facial' },
  { value: 'Gel limpador', label: 'Gel limpador' },
  { value: 'Tônico', label: 'Tônico' },
  { value: 'Protetor solar', label: 'Protetor solar' },
  { value: 'Demaquilante', label: 'Demaquilante' },
  { value: 'Shampoo', label: 'Shampoo' },
  { value: 'Condicionador', label: 'Condicionador' },
  { value: 'Sabonete líquido', label: 'Sabonete líquido' },
  { value: 'Mousse / Espuma', label: 'Mousse / Espuma' },
  { value: 'Outro', label: 'Outro' },
]

const INDICACOES_COSMETICO = [
  'Hidratação profunda',
  'Anti-envelhecimento',
  'Ação clareadora',
  'Ação tonificante',
  'Proteção UV',
  'Limpeza profunda',
  'Controle de oleosidade',
  'Sensibilidade/Calmante',
  'Antioxidante',
  'Firmeza/Elasticidade',
]

const TIPOS_PELE = [
  { value: '', label: 'Selecione o tipo de pele...' },
  { value: 'Seca', label: 'Seca' },
  { value: 'Oleosa', label: 'Oleosa' },
  { value: 'Mista', label: 'Mista' },
  { value: 'Sensível', label: 'Sensível' },
  { value: 'Normal', label: 'Normal' },
  { value: 'Todos os tipos', label: 'Todos os tipos' },
]

const TIPOS_SISTEMA_RESINA = [
  { value: '', label: 'Selecione o sistema/resina...' },
  { value: 'Poliéster saturado', label: 'Poliéster saturado' },
  { value: 'Poliéster hidroxilado', label: 'Poliéster hidroxilado' },
  { value: 'Acrílico carboxilado', label: 'Acrílico carboxilado' },
  { value: 'Acrílico hidroxilado', label: 'Acrílico hidroxilado' },
  { value: 'Acrílico termoplástico', label: 'Acrílico termoplástico' },
  { value: 'Acrílico 2K PU', label: 'Acrílico 2K PU' },
  { value: 'Alquídica curta', label: 'Alquídica curta' },
  { value: 'Alquídica média', label: 'Alquídica média' },
  { value: 'Alquídica longa', label: 'Alquídica longa' },
  { value: 'Alquídica fenolada', label: 'Alquídica fenolada' },
  { value: 'Alquídica acrilada', label: 'Alquídica acrilada' },
  { value: 'Alquídica melamina', label: 'Alquídica melamina' },
  { value: 'Éster epóxi', label: 'Éster epóxi' },
  { value: 'Epóxi-amina', label: 'Epóxi-amina' },
  { value: 'Epóxi-poliamida', label: 'Epóxi-poliamida' },
  { value: 'Epóxi-fenólico', label: 'Epóxi-fenólico' },
  { value: 'Poliéster-melamina', label: 'Poliéster-melamina' },
  { value: 'Acrílico-melamina', label: 'Acrílico-melamina' },
  { value: 'Fenólica', label: 'Fenólica' },
  { value: 'Nitrocelulose', label: 'Nitrocelulose' },
  { value: 'Poliuretano 2K', label: 'Poliuretano 2K' },
  { value: 'Poliuretano monocomponente', label: 'Poliuretano monocomponente' },
  { value: 'Resinas Amínicas', label: 'Resinas Amínicas' },
  { value: 'Outro sistema', label: 'Outro sistema' },
]

const TIPOS_PRODUTO_TINTA = [
  { value: '', label: 'Selecione o tipo de produto...' },
  { value: 'Tinta', label: 'Tinta' },
  { value: 'Verniz', label: 'Verniz' },
  { value: 'Primer', label: 'Primer' },
  { value: 'Esmalte', label: 'Esmalte' },
  { value: 'Fundo', label: 'Fundo' },
  { value: 'Selador', label: 'Selador' },
  { value: 'Revestimento anticorrosivo', label: 'Revestimento anticorrosivo' },
  { value: 'Verniz de impregnação', label: 'Verniz de impregnação' },
  { value: 'Tinta de acabamento', label: 'Tinta de acabamento' },
  { value: 'Outro', label: 'Outro' },
]

const BASES_SISTEMA = [
  { value: '', label: 'Selecione a base...' },
  { value: 'Base solvente', label: 'Base solvente' },
  { value: 'Base água', label: 'Base água' },
  { value: 'Alto sólidos', label: 'Alto sólidos' },
  { value: '100% sólidos', label: '100% sólidos' },
  { value: 'UV/EB', label: 'UV/EB' },
  { value: 'Pó', label: 'Pó' },
]

const TIPOS_CURA = [
  { value: '', label: 'Selecione o tipo de cura...' },
  { value: 'Secagem ao ar', label: 'Secagem ao ar' },
  { value: 'Cura em estufa', label: 'Cura em estufa' },
  { value: 'Cura oxidativa', label: 'Cura oxidativa' },
  { value: 'Cura 2K', label: 'Cura 2K' },
  { value: 'Cura UV', label: 'Cura UV' },
  { value: 'Cura por evaporação de solvente', label: 'Cura por evaporação de solvente' },
  { value: 'Cura por reação química', label: 'Cura por reação química' },
]

const SUBSTRATOS_TINTA = [
  { value: '', label: 'Selecione o substrato...' },
  { value: 'Aço carbono', label: 'Aço carbono' },
  { value: 'Alumínio', label: 'Alumínio' },
  { value: 'Galvanizado', label: 'Galvanizado' },
  { value: 'Madeira', label: 'Madeira' },
  { value: 'Plástico', label: 'Plástico' },
  { value: 'Concreto', label: 'Concreto' },
  { value: 'Cobre', label: 'Cobre' },
  { value: 'Motor elétrico', label: 'Motor elétrico' },
  { value: 'Embalagem metálica', label: 'Embalagem metálica' },
  { value: 'Outro', label: 'Outro' },
]

const METODOS_APLICACAO_TINTA = [
  { value: '', label: 'Selecione o método...' },
  { value: 'Pistola convencional', label: 'Pistola convencional' },
  { value: 'Airless', label: 'Airless' },
  { value: 'Eletrostática', label: 'Eletrostática' },
  { value: 'Rolo', label: 'Rolo' },
  { value: 'Pincel', label: 'Pincel' },
  { value: 'Imersão', label: 'Imersão' },
  { value: 'Flow coat', label: 'Flow coat' },
  { value: 'Coil coating', label: 'Coil coating' },
  { value: 'Spray automático', label: 'Spray automático' },
  { value: 'Outro', label: 'Outro' },
]

const TEMPERATURAS_CURA = [
  { value: '', label: 'Selecione a temperatura...' },
  { value: 'Ambiente', label: 'Ambiente' },
  { value: '60–80 °C', label: '60–80 °C' },
  { value: '100–120 °C', label: '100–120 °C' },
  { value: '130–160 °C', label: '130–160 °C' },
  { value: '180–220 °C', label: '180–220 °C' },
  { value: 'Outro valor', label: 'Outro valor' },
]

const PROPRIEDADES_TINTA = [
  'Brilho alto', 'Fosco', 'Alta dureza', 'Flexibilidade', 'Aderência',
  'Resistência química', 'Resistência à corrosão', 'Resistência térmica',
  'Resistência UV', 'Secagem rápida', 'Baixo VOC', 'Menor toxicidade',
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
  // Campos específicos Tintas e Vernizes
  tipo_sistema_resina: '',
  tipo_produto_tinta: '',
  base_sistema: '',
  tipo_cura: '',
  substrato_tinta: '',
  metodo_aplicacao_tinta: '',
  temperatura_cura: '',
  propriedades_desejadas: [] as string[],
  // Campos específicos Cosmético
  tipo_produto_cosmetico: '',
  tipo_pele: '',
  indicacoes_cosmetico: [] as string[],
  ph_alvo: '',
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

  function checkProp(value: string) {
    const lista = r.current.form.propriedades_desejadas
    const nova = lista.includes(value) ? lista.filter(v => v !== value) : [...lista, value]
    const f = { ...r.current.form, propriedades_desejadas: nova } as typeof FORM_INICIAL
    r.current.form = f
    setForm(f)
  }

  function checkIndicacaoCosmetico(value: string) {
    const lista = r.current.form.indicacoes_cosmetico
    const nova = lista.includes(value) ? lista.filter(v => v !== value) : [...lista, value]
    const f = { ...r.current.form, indicacoes_cosmetico: nova } as typeof FORM_INICIAL
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
    if (!v) return
    // Aceita múltiplas MPs separadas por vírgula
    const novas = v.split(',').map(s => s.trim()).filter(Boolean)
    const n = [...r.current.mpObrig]
    for (const mp of novas) { if (!n.includes(mp)) n.push(mp) }
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

  const isTintas = form.segmento === SEGMENTO_TINTAS
  const isCosmetico = form.segmento === SEGMENTO_COSMETICO

  async function gerar() {
    if (!form.segmento || !form.descricao) {
      setError('Preencha o segmento e a descrição do produto.')
      return
    }
    if (isTintas) {
      if (!form.tipo_sistema_resina || !form.tipo_produto_tinta || !form.base_sistema || !form.tipo_cura) {
        setError('Para Tintas e Vernizes, preencha obrigatoriamente: Tipo de Sistema/Resina, Tipo de Produto, Base do Sistema e Tipo de Cura.')
        return
      }
    }
    if (isCosmetico) {
      if (!form.tipo_produto_cosmetico || !form.tipo_pele) {
        setError('Para Cosmético, preencha obrigatoriamente: Tipo de Produto e Tipo de Pele.')
        return
      }
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
      const raw = await res.text()
      if (!res.ok) {
        let mensagem = 'Erro ao gerar formulação. Tente novamente.'
        try {
          const parsed = JSON.parse(raw)
          const e = parsed?.error
          if (e) {
            if (typeof e === 'string') mensagem = e
            else if (typeof e?.message === 'string') mensagem = e.message
            else mensagem = JSON.stringify(e)
          }
        } catch {
          if (res.status === 504 || res.status === 502) {
            mensagem = 'A geração demorou demais e o servidor encerrou a conexão. Tente novamente em alguns instantes.'
          } else if (res.status >= 500) {
            mensagem = 'Erro temporário no servidor. Tente novamente em alguns instantes.'
          }
        }
        throw new Error(mensagem)
      }
      try {
        setResultado(JSON.parse(raw))
      } catch {
        throw new Error('A resposta do servidor está incompleta. Tente gerar novamente.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
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
      const res = await fetch('/api/formulacao', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, materias_proibidas: mpProib, materias_obrigatorias: mpObrig, refinamento: instrucoes, formulacao_anterior: resultado }),
      })
      const raw = await res.text()
      if (!res.ok) {
        let mensagem = 'Erro ao refinar formulação. Tente novamente.'
        try {
          const parsed = JSON.parse(raw)
          const e = parsed?.error
          if (e) {
            if (typeof e === 'string') mensagem = e
            else if (typeof e?.message === 'string') mensagem = e.message
            else mensagem = JSON.stringify(e)
          }
        } catch { /* ignora — usa mensagem padrão */ }
        throw new Error(mensagem)
      }
      try {
        setResultado(JSON.parse(raw))
      } catch {
        throw new Error('A resposta do servidor está incompleta. Tente novamente.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
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

        {/* ESPECIFICAÇÕES TINTAS E VERNIZES */}
        {isTintas && (
          <div className="bg-[#0f1f3a] border border-blue-500/30 rounded-xl p-6">
            <h2 className="text-base font-semibold text-white mb-1 pb-2 border-b border-blue-500/20">
              Especificações Técnicas — Tintas e Vernizes
            </h2>
            <p className="text-xs text-blue-400/70 mb-4">Campos obrigatórios para este segmento</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div className="md:col-span-2">
                <Select label="Tipo de Sistema / Resina *" id="tipo_sistema_resina" options={TIPOS_SISTEMA_RESINA} value={form.tipo_sistema_resina} onChange={e => campo('tipo_sistema_resina', e.target.value)} />
              </div>
              <Select label="Tipo de Produto *" id="tipo_produto_tinta" options={TIPOS_PRODUTO_TINTA} value={form.tipo_produto_tinta} onChange={e => campo('tipo_produto_tinta', e.target.value)} />
              <Select label="Base do Sistema *" id="base_sistema" options={BASES_SISTEMA} value={form.base_sistema} onChange={e => campo('base_sistema', e.target.value)} />
              <div className="md:col-span-2">
                <Select label="Tipo de Cura / Secagem *" id="tipo_cura" options={TIPOS_CURA} value={form.tipo_cura} onChange={e => campo('tipo_cura', e.target.value)} />
              </div>
            </div>

            <p className="text-xs text-gray-500 mb-3">Campos opcionais (melhoram a precisão técnica)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Select label="Substrato de Aplicação" id="substrato_tinta" options={SUBSTRATOS_TINTA} value={form.substrato_tinta} onChange={e => campo('substrato_tinta', e.target.value)} />
              <Select label="Método de Aplicação" id="metodo_aplicacao_tinta" options={METODOS_APLICACAO_TINTA} value={form.metodo_aplicacao_tinta} onChange={e => campo('metodo_aplicacao_tinta', e.target.value)} />
              <div className="md:col-span-2">
                <Select label="Temperatura de Cura" id="temperatura_cura" options={TEMPERATURAS_CURA} value={form.temperatura_cura} onChange={e => campo('temperatura_cura', e.target.value)} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Propriedades Desejadas</label>
              <div className="flex flex-wrap gap-2">
                {PROPRIEDADES_TINTA.map(prop => (
                  <label key={prop} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs cursor-pointer border transition-colors ${form.propriedades_desejadas.includes(prop) ? 'bg-blue-500/20 border-blue-500/50 text-blue-300' : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'}`}>
                    <input type="checkbox" className="sr-only" checked={form.propriedades_desejadas.includes(prop)} onChange={() => checkProp(prop)} />
                    {prop}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ESPECIFICAÇÕES COSMÉTICO */}
        {isCosmetico && (
          <div className="bg-[#0f1f3a] border border-pink-500/30 rounded-xl p-6">
            <h2 className="text-base font-semibold text-white mb-1 pb-2 border-b border-pink-500/20">
              Especificações Técnicas — Cosmético
            </h2>
            <p className="text-xs text-pink-400/70 mb-4">Campos obrigatórios para este segmento</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Select label="Tipo de Produto *" id="tipo_produto_cosmetico" options={TIPOS_PRODUTO_COSMETICO} value={form.tipo_produto_cosmetico} onChange={e => campo('tipo_produto_cosmetico', e.target.value)} />
              <Select label="Tipo de Pele *" id="tipo_pele" options={TIPOS_PELE} value={form.tipo_pele} onChange={e => campo('tipo_pele', e.target.value)} />
            </div>

            <p className="text-xs text-gray-500 mb-3">Campos opcionais (melhoram a precisão técnica)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <Input label="pH Alvo (range)" id="ph_alvo" type="text" value={form.ph_alvo} onChange={e => campo('ph_alvo', e.target.value)} placeholder="Ex: 5.5–6.5" />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-300 block mb-2">Indicações / Benefícios Desejados</label>
              <div className="flex flex-wrap gap-2">
                {INDICACOES_COSMETICO.map(ind => (
                  <label key={ind} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs cursor-pointer border transition-colors ${form.indicacoes_cosmetico.includes(ind) ? 'bg-pink-500/20 border-pink-500/50 text-pink-300' : 'bg-white/5 border-white/10 text-gray-400 hover:border-white/20'}`}>
                    <input type="checkbox" className="sr-only" checked={form.indicacoes_cosmetico.includes(ind)} onChange={() => checkIndicacaoCosmetico(ind)} />
                    {ind}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* PARÂMETROS TÉCNICOS */}
        <div className="bg-[#111f3a] border border-white/8 rounded-xl p-6">
          <h2 className="text-base font-semibold text-white mb-4 pb-2 border-b border-white/8">Parâmetros Técnicos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex gap-3 items-end">
              <Input label="pH mínimo" id="ph_min" type="number" min="1" max="14" step="0.5" value={form.ph_min} onChange={e => campo('ph_min', e.target.value)} placeholder="1" className="w-full" />
              <Input label="pH máximo" id="ph_max" type="number" min="1" max="14" step="0.5" value={form.ph_max} onChange={e => campo('ph_max', e.target.value)} placeholder="14" className="w-full" />
            </div>
            {form.segmento === 'Resinas e Polímeros'
              ? <Select label="Viscosidade Gardner" id="viscosidade" options={VISCOSIDADES_GARDNER} value={form.viscosidade} onChange={e => campo('viscosidade', e.target.value)} />
              : <Select label="Viscosidade Esperada" id="viscosidade" options={VISCOSIDADES} value={form.viscosidade} onChange={e => campo('viscosidade', e.target.value)} />
            }
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
