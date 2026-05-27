import { formatCurrency } from './utils'

export interface GerarPDFParams {
  data: Record<string, unknown>
  nome: string
  segmento: string
  responsavel?: string
  empresa?: string
  notas?: string
  codigoRelatorio: string
  custoFallback?: number | null
}

export async function gerarFormulacaoPDF(params: GerarPDFParams): Promise<void> {
  const {
    data,
    nome,
    segmento,
    responsavel = '',
    empresa = '',
    notas = '',
    codigoRelatorio,
    custoFallback = null,
  } = params

  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = 210
  const margin = 15
  let y = margin

  function sanitizePDF(text: string): string {
    return String(text)
      .replace(/•/g, '-')
      .replace(/²/g, '2').replace(/³/g, '3').replace(/¹/g, '1')
      .replace(/⁺/g, '+').replace(/⁻/g, '-').replace(/°/g, 'o')
      .replace(/[^\x00-\xFF]/g, '')
  }

  function addText(text: string, fontSize: number, bold = false, color: [number, number, number] = [0, 0, 0]) {
    doc.setFontSize(fontSize)
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setTextColor(...color)
    const safeText = sanitizePDF(text)
    const lines = doc.splitTextToSize(safeText, 175)
    const lineH = fontSize * 0.42
    for (const line of lines as string[]) {
      if (y > 268) { doc.addPage(); y = margin }
      doc.text(String(line || ''), margin, y)
      y += lineH
    }
    y += 1.5
  }

  function addLine() {
    if (y > 268) { doc.addPage(); y = margin }
    doc.setDrawColor(30, 58, 107)
    doc.line(margin, y, pageW - margin, y)
    y += 4
  }

  // CABEÇALHO
  doc.setFillColor(10, 22, 40)
  doc.rect(0, 0, pageW, 35, 'F')
  doc.setTextColor(212, 160, 23)
  doc.setFontSize(20)
  doc.setFont('helvetica', 'bold')
  doc.text('CLICK CHEM', margin, 15)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(148, 163, 184)
  doc.text('Astana Química | Relatório Técnico Confidencial', margin, 22)
  doc.setTextColor(255, 255, 255)
  doc.text(`Código: ${codigoRelatorio}`, margin, 29)
  doc.text(`Data: ${new Date().toLocaleDateString('pt-BR')}`, pageW - margin - 35, 29)

  y = 45

  const formulacao = data?.formulacao as Record<string, unknown> | undefined
  const analise = data?.analise_critica as Record<string, unknown> | undefined
  const processo = data?.processo_fabricacao as Record<string, unknown> | undefined
  const cq = data?.controle_qualidade as Record<string, unknown> | undefined
  const riscos = data?.riscos_tecnicos as Array<Record<string, unknown>> | undefined
  const sustentabilidade = data?.sustentabilidade as Record<string, unknown> | undefined
  const componentes = (formulacao?.composicao as Array<Record<string, unknown>>) || []

  // 1. IDENTIFICAÇÃO
  addText('1. IDENTIFICAÇÃO DO PRODUTO', 13, true, [37, 99, 235])
  addLine()
  addText(`Nome: ${String(formulacao?.nome_sugerido || nome || 'N/A')}`, 10, true)
  addText(`Segmento: ${String(segmento || '')}`, 10)
  addText(`Responsável Técnico: ${responsavel || '____________________'}`, 10)
  addText(`Empresa / Cliente: ${empresa || '____________________'}`, 10)
  addText(`Descrição: ${String(formulacao?.descricao_tecnica || '')}`, 10)
  y += 4

  // 2. ANÁLISE CRÍTICA
  if (analise) {
    addText('2. ANÁLISE CRÍTICA DA FORMULAÇÃO', 13, true, [37, 99, 235])
    addLine()
    addText(`Viabilidade Técnica: ${String(analise.viabilidade || '').toUpperCase()}`, 10, true)
    if (Array.isArray(analise.pontos_de_atencao)) {
      addText('Pontos de Atenção:', 10, true)
      ;(analise.pontos_de_atencao as string[]).forEach(p => addText(`• ${p}`, 9))
    }
    y += 4
  }

  // 3. COMPOSIÇÃO PERCENTUAL
  addText('3. COMPOSIÇÃO PERCENTUAL', 13, true, [37, 99, 235])
  addLine()
  if (componentes.length > 0) {
    doc.setFillColor(27, 58, 107)
    doc.rect(margin, y, pageW - margin * 2, 7, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text('Matéria-Prima', margin + 2, y + 5)
    doc.text('%', 130, y + 5)
    doc.text('Função', 140, y + 5)
    doc.text('R$/kg', 185, y + 5)
    y += 8

    componentes.forEach((comp, i) => {
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      const nomeMp = doc.splitTextToSize(sanitizePDF(String(comp.materia_prima || '')), 52)
      const funcao = doc.splitTextToSize(sanitizePDF(String(comp.funcao_tecnica || '')), 42)
      const lineH = 3.8
      const pad = 2.5
      const rowH = Math.max(nomeMp.length, funcao.length) * lineH + pad * 2

      if (y + rowH > 275) { doc.addPage(); y = margin }

      if (i % 2 === 1) {
        doc.setFillColor(240, 244, 255)
        doc.rect(margin, y, pageW - margin * 2, rowH, 'F')
      }

      doc.setTextColor(0, 0, 0)
      doc.text(nomeMp, margin + 2, y + pad + 2)
      doc.text(String(comp.percentual_recomendado ?? '') + '%', 130, y + pad + 2)
      doc.text(funcao, 140, y + pad + 2)
      doc.text(comp.custo_estimado_kg ? `R$${Number(comp.custo_estimado_kg).toFixed(2)}` : '—', 185, y + pad + 2)

      doc.setDrawColor(220, 228, 245)
      doc.line(margin, y + rowH, pageW - margin, y + rowH)
      y += rowH
    })
    y += 4
  } else {
    addText('Composição detalhada não disponível para esta formulação.', 9)
  }

  // Custo — sempre exibido, com fallback para coluna dedicada no BD
  const custoValor = formulacao?.custo_estimado_total
    ? Number(formulacao.custo_estimado_total)
    : custoFallback
  addText(`Custo Estimado Total: ${custoValor ? formatCurrency(custoValor) + '/kg' : 'N/A'}`, 10, true)
  y += 4

  // 4. PROCESSO DE FABRICAÇÃO
  addText('4. PROCESSO DE FABRICAÇÃO', 13, true, [37, 99, 235])
  addLine()
  if (processo && (Array.isArray(processo.ordem_adicao) || processo.temperatura_processo || processo.tempo_mistura)) {
    if (Array.isArray(processo.ordem_adicao)) {
      ;(processo.ordem_adicao as Array<Record<string, unknown>>).forEach(etapa => {
        addText(`Etapa ${etapa.etapa}: ${String(etapa.acao)}`, 9, true)
        if (etapa.observacao) addText(`   ${String(etapa.observacao)}`, 8)
      })
    }
    if (processo.temperatura_processo) addText(`Temperatura: ${String(processo.temperatura_processo)}`, 9)
    if (processo.tempo_mistura) addText(`Tempo de mistura: ${String(processo.tempo_mistura)}`, 9)
    if (Array.isArray(processo.precaucoes_seguranca)) {
      addText('Precauções de Segurança:', 9, true)
      ;(processo.precaucoes_seguranca as string[]).forEach(p => addText(`• ${p}`, 8))
    }
  } else {
    addText('Processo de fabricação não disponível para esta formulação.', 9)
    addText('Gere uma nova formulação para obter o processo completo.', 8)
  }
  y += 4

  // 5. CONTROLE DE QUALIDADE
  addText('5. PARÂMETROS DE CONTROLE DE QUALIDADE', 13, true, [37, 99, 235])
  addLine()
  if (cq && Array.isArray(cq.parametros) && cq.parametros.length > 0) {
    ;(cq.parametros as Array<Record<string, unknown>>).forEach(param => {
      addText(`${String(param.parametro)}: ${String(param.especificacao)} — ${String(param.metodo)}`, 9)
    })
  } else {
    addText('Parâmetros de controle de qualidade não disponíveis.', 9)
  }
  y += 4

  // 6. RISCOS TÉCNICOS
  addText('6. RISCOS TÉCNICOS', 13, true, [37, 99, 235])
  addLine()
  if (riscos && riscos.length > 0) {
    riscos.forEach(r => {
      addText(`• ${String(r.risco)} [${String(r.probabilidade)}]`, 9, true)
      if (r.mitigacao) addText(`  Mitigação: ${String(r.mitigacao)}`, 8)
    })
  } else {
    addText('Análise de riscos técnicos não disponível.', 9)
  }
  y += 4

  // 7. SUSTENTABILIDADE
  addText('7. SUSTENTABILIDADE', 13, true, [37, 99, 235])
  addLine()
  if (sustentabilidade && sustentabilidade.pontuacao != null) {
    addText(`Score: ${Number(sustentabilidade.pontuacao)}/10`, 10, true)
    if (sustentabilidade.biodegradabilidade_estimada) {
      addText(`Biodegradabilidade: ${String(sustentabilidade.biodegradabilidade_estimada)}`, 9)
    }
  } else {
    addText('Dados de sustentabilidade não disponíveis.', 9)
  }
  y += 4

  // 8. NOTAS ADICIONAIS
  if (notas) {
    addText('8. NOTAS ADICIONAIS', 13, true, [37, 99, 235])
    addLine()
    addText(notas, 9)
    y += 4
  }

  // RODAPÉ em todas as páginas
  const totalPages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFillColor(10, 22, 40)
    doc.rect(0, 287, pageW, 10, 'F')
    doc.setFontSize(7)
    doc.setTextColor(148, 163, 184)
    doc.text('Click Chem — Astana Química | Documento técnico confidencial', margin, 293)
    doc.text(`Pág. ${p}/${totalPages}`, pageW - margin - 15, 293)
  }

  doc.save(`clickchem-relatorio-${codigoRelatorio}.pdf`)
}
