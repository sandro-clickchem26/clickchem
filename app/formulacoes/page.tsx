'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Archive, FlaskConical } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { FormulacaoResult } from '@/components/FormulacaoResult'
import { gerarCodigoRelatorio } from '@/lib/utils'
import { gerarFormulacaoPDF } from '@/lib/pdf'

const SEG_CORES: Record<string, string> = {
  'Limpeza e Manutenção Industrial': 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  'Automotivo': 'text-orange-400 bg-orange-500/10 border-orange-500/30',
  'Saneantes e Domissanitários': 'text-green-400 bg-green-500/10 border-green-500/30',
  'Tintas, Vernizes, Resinas e Polímeros': 'text-purple-400 bg-purple-500/10 border-purple-500/30',
  'Biossolventes e Biolubrificantes': 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
}

const SEG_EMOJI: Record<string, string> = {
  'Limpeza e Manutenção Industrial': '🧪',
  'Automotivo': '🚗',
  'Saneantes e Domissanitários': '🧴',
  'Tintas, Vernizes, Resinas e Polímeros': '🎨',
  'Biossolventes e Biolubrificantes': '🌿',
}

interface FormulaSalva {
  id: string
  nome: string
  segmento: string
  status: string
  custo_estimado: number | null
  score_sustentab: number | null
  createdAt: string
  composicao: Record<string, unknown>
  _processo_fabricacao?: Record<string, unknown> | null
  _controle_qualidade?: Record<string, unknown> | null
  _riscos_tecnicos?: Array<Record<string, unknown>> | null
}

export default function MinhasFormulacoes() {
  const [formulas, setFormulas] = useState<FormulaSalva[]>([])
  const [loading, setLoading] = useState(true)
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')
  const [pdfLoading, setPdfLoading] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/formulacao/listar')
      .then(r => r.json())
      .then(d => setFormulas(d.formulacoes || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  function toggleExpand(id: string) {
    setExpandidos(prev => {
      const s = new Set(prev)
      s.has(id) ? s.delete(id) : s.add(id)
      return s
    })
  }

  async function handleGerarPDF(f: FormulaSalva) {
    setPdfLoading(f.id)
    try {
      const pdfData = {
        ...f.composicao,
        processo_fabricacao: (f.composicao as Record<string, unknown>)?.processo_fabricacao || f._processo_fabricacao,
        controle_qualidade: (f.composicao as Record<string, unknown>)?.controle_qualidade || f._controle_qualidade,
        riscos_tecnicos: (f.composicao as Record<string, unknown>)?.riscos_tecnicos || f._riscos_tecnicos,
      }
      await gerarFormulacaoPDF({
        data: pdfData,
        nome: f.nome,
        segmento: f.segmento,
        codigoRelatorio: gerarCodigoRelatorio(),
        custoFallback: f.custo_estimado,
      })
    } catch (err) {
      console.error('Erro ao gerar PDF:', err)
      alert('Erro ao gerar PDF.')
    } finally {
      setPdfLoading(null)
    }
  }

  const formulasFiltradas = formulas.filter(f =>
    f.nome.toLowerCase().includes(busca.toLowerCase()) ||
    f.segmento.toLowerCase().includes(busca.toLowerCase())
  )

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Archive className="text-blue-400" size={24} />
          Minhas Fórmulas
        </h1>
        <p className="text-gray-400 mt-1 text-sm">
          Histórico de todas as formulações geradas e salvas pela IA.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-gray-400">
          <div className="w-6 h-6 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
          Carregando fórmulas...
        </div>
      ) : formulas.length === 0 ? (
        <div className="text-center py-20">
          <FlaskConical size={48} className="mx-auto mb-4 text-gray-700" />
          <p className="text-gray-400 font-medium">Nenhuma fórmula salva ainda.</p>
          <p className="text-gray-600 text-sm mt-1 mb-6">Gere sua primeira formulação e salve para aparecer aqui.</p>
          <Link
            href="/nova-formulacao"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#2563EB] hover:bg-[#1d4ed8] text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <FlaskConical size={16} /> Nova Formulação
          </Link>
        </div>
      ) : (
        <>
          {/* Resumo */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-[#111f3a] border border-white/8 rounded-xl p-4">
              <div className="text-2xl font-bold text-blue-400">{formulas.length}</div>
              <div className="text-xs text-gray-500 mt-1">Fórmulas salvas</div>
            </div>
            <div className="bg-[#111f3a] border border-white/8 rounded-xl p-4">
              <div className="text-2xl font-bold text-[#D4A017]">
                {new Set(formulas.map(f => f.segmento)).size}
              </div>
              <div className="text-xs text-gray-500 mt-1">Segmentos</div>
            </div>
            <div className="bg-[#111f3a] border border-white/8 rounded-xl p-4">
              <div className="text-2xl font-bold text-green-400">
                {formulas.filter(f => f.score_sustentab && f.score_sustentab >= 7).length}
              </div>
              <div className="text-xs text-gray-500 mt-1">Alta sustent.</div>
            </div>
          </div>

          {/* Busca */}
          {formulas.length > 4 && (
            <div className="mb-4">
              <input
                type="text"
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar por nome ou segmento..."
                className="w-full bg-[#111f3a] border border-[#1B3A6B] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* Lista */}
          <div className="space-y-3">
            {formulasFiltradas.map(f => {
              const composicaoTyped = f.composicao as {
                formulacao?: { composicao?: unknown[] }
                sustentabilidade?: { pontuacao?: number }
              }
              const numMPs = composicaoTyped?.formulacao?.composicao?.length ?? 0
              const expandido = expandidos.has(f.id)
              const corSeg = SEG_CORES[f.segmento] || 'text-gray-400 bg-white/5 border-white/10'
              const data = new Date(f.createdAt).toLocaleDateString('pt-BR')

              // Monta o objeto de data para o FormulacaoResult com fallbacks
              const formulaData = {
                ...f.composicao,
                processo_fabricacao: (f.composicao as Record<string, unknown>)?.processo_fabricacao || f._processo_fabricacao,
                controle_qualidade: (f.composicao as Record<string, unknown>)?.controle_qualidade || f._controle_qualidade,
                riscos_tecnicos: (f.composicao as Record<string, unknown>)?.riscos_tecnicos || f._riscos_tecnicos,
              }

              return (
                <div key={f.id} className="bg-[#111f3a] border border-white/8 rounded-xl overflow-hidden">
                  {/* Cabeçalho — clica para expandir */}
                  <div
                    className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-white/3 transition-colors"
                    onClick={() => toggleExpand(f.id)}
                  >
                    <span className={`text-xs px-2 py-0.5 rounded-full border shrink-0 ${corSeg}`}>
                      {SEG_EMOJI[f.segmento] || '🧬'} {f.segmento.split(' e ')[0].split(',')[0]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-white text-sm truncate">{f.nome}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{data} · {numMPs} MPs</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {f.custo_estimado && (
                        <span className="text-xs text-gray-500 hidden sm:block">
                          R$ {f.custo_estimado.toFixed(2)}/kg
                        </span>
                      )}
                      {f.score_sustentab != null && (
                        <Badge variant={f.score_sustentab >= 7 ? 'green' : f.score_sustentab >= 4 ? 'yellow' : 'red'}>
                          {f.score_sustentab}/10
                        </Badge>
                      )}
                      <span className="text-gray-500 text-xs">{expandido ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {/* Detalhe expandido — usa FormulacaoResult completo */}
                  {expandido && (
                    <div className="border-t border-white/8 px-4 py-4 bg-[#0A1628]/40">
                      <FormulacaoResult
                        data={formulaData}
                        onRelatorio={() => handleGerarPDF(f)}
                      />
                      {pdfLoading === f.id && (
                        <p className="text-xs text-gray-500 text-center mt-2">Gerando PDF...</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {formulasFiltradas.length === 0 && busca && (
              <p className="text-center text-gray-600 text-sm py-10">
                Nenhuma fórmula encontrada para &quot;{busca}&quot;
              </p>
            )}
          </div>
        </>
      )}
    </div>
  )
}
