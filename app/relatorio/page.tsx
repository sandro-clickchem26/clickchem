'use client'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { FileText, Download } from 'lucide-react'
import { gerarCodigoRelatorio } from '@/lib/utils'
import { gerarFormulacaoPDF } from '@/lib/pdf'

export default function Relatorio() {
  const [formulacoes, setFormulacoes] = useState<Array<Record<string, unknown>>>([])
  const [selecionada, setSelecionada] = useState<Record<string, unknown> | null>(null)
  const [responsavel, setResponsavel] = useState('')
  const [empresa, setEmpresa] = useState('')
  const [notas, setNotas] = useState('')
  const [loading, setLoading] = useState(false)
  const [codigoRelatorio] = useState(gerarCodigoRelatorio())

  useEffect(() => {
    fetch('/api/formulacao/listar')
      .then(r => r.json())
      .then(data => setFormulacoes(data.formulacoes || []))
      .catch(() => setFormulacoes([]))
  }, [])

  async function gerarPDF() {
    if (!selecionada) return
    setLoading(true)
    try {
      const composicaoData = selecionada.composicao as Record<string, unknown>
      // Mescla a fonte primária (composicao JSON) com as colunas separadas do BD como fallback
      const pdfData = {
        ...composicaoData,
        processo_fabricacao: composicaoData?.processo_fabricacao || selecionada._processo_fabricacao,
        controle_qualidade: composicaoData?.controle_qualidade || selecionada._controle_qualidade,
        riscos_tecnicos: composicaoData?.riscos_tecnicos || selecionada._riscos_tecnicos,
      }
      await gerarFormulacaoPDF({
        data: pdfData,
        nome: String(selecionada.nome || ''),
        segmento: String(selecionada.segmento || ''),
        responsavel,
        empresa,
        notas,
        codigoRelatorio,
        custoFallback: selecionada.custo_estimado ? Number(selecionada.custo_estimado) : null,
      })
    } catch (err) {
      console.error('Erro ao gerar PDF:', err)
      alert('Erro ao gerar PDF. Verifique o console.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <FileText className="text-[#D4A017]" size={24} />
          Relatório Técnico
        </h1>
        <p className="text-gray-400 mt-1 text-sm">
          Gere relatórios técnicos profissionais em PDF a partir das formulações salvas.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Seleção de formulação */}
        <div>
          <h2 className="text-base font-semibold text-white mb-3">Selecionar Formulação</h2>

          {formulacoes.length === 0 ? (
            <div className="p-6 bg-[#111f3a] border border-white/8 rounded-xl text-center">
              <FileText size={32} className="text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Nenhuma formulação salva ainda.</p>
              <p className="text-gray-600 text-xs mt-1">Gere uma formulação e salve-a para criar relatórios.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {formulacoes.map(form => (
                <div
                  key={String(form.id)}
                  onClick={() => setSelecionada(form)}
                  className={`p-4 bg-[#111f3a] border rounded-xl cursor-pointer transition-all ${
                    selecionada?.id === form.id
                      ? 'border-[#D4A017]/50 bg-yellow-700/10'
                      : 'border-white/8 hover:border-white/15'
                  }`}
                >
                  <p className="font-medium text-white text-sm">{String(form.nome)}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{String(form.segmento)}</p>
                  <p className="text-xs text-gray-600 mt-0.5">
                    {new Date(String(form.createdAt)).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Configurações do relatório */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-white mb-3">Configurações do Relatório</h2>

          <Card>
            <div className="space-y-3">
              <Input
                label="Responsável Técnico"
                value={responsavel}
                onChange={e => setResponsavel(e.target.value)}
                placeholder="Nome do responsável"
              />
              <Input
                label="Empresa / Cliente"
                value={empresa}
                onChange={e => setEmpresa(e.target.value)}
                placeholder="Nome da empresa"
              />
              <div>
                <label className="text-sm font-medium text-gray-300 block mb-1.5">
                  Notas Adicionais
                </label>
                <textarea
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  placeholder="Observações, ressalvas ou comentários técnicos..."
                  className="w-full bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 resize-y min-h-[80px] focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="p-3 bg-[#0A1628] rounded-lg">
                <p className="text-xs text-gray-500">Código do relatório:</p>
                <p className="text-sm font-mono text-[#D4A017] mt-0.5">{codigoRelatorio}</p>
              </div>
            </div>
          </Card>

          <Button
            variant="gold"
            size="lg"
            onClick={gerarPDF}
            loading={loading}
            disabled={!selecionada}
            className="w-full"
          >
            <Download size={18} />
            Gerar Relatório PDF
          </Button>

          {!selecionada && (
            <p className="text-xs text-gray-500 text-center">Selecione uma formulação para gerar o relatório</p>
          )}
        </div>
      </div>
    </div>
  )
}
