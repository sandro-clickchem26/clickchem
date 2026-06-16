'use client'

import { SOLVENTS_KB_REFERENCE, type SolventKBData } from '@/lib/solvents-kb-reference'
import { useMemo } from 'react'

interface SuggestionWithKB {
  materia_prima: string
  funcao: string
  beneficio: string
  compatibilidade: string
  percentual_sugerido: string
  kb?: number | null
  categoria?: string
  notas?: string
}

interface SolventKBWidgetProps {
  sugestao: SuggestionWithKB
  solventesPrincipais?: Array<{ nome: string; percentual: number }>
}

export function SolventKBWidget({ sugestao, solventesPrincipais }: SolventKBWidgetProps) {
  const solventData = useMemo(() => {
    // Procura o solvente na base de dados
    const key = Object.keys(SOLVENTS_KB_REFERENCE).find(
      k => SOLVENTS_KB_REFERENCE[k].name.toLowerCase() === sugestao.materia_prima.toLowerCase() ||
           SOLVENTS_KB_REFERENCE[k].commonNames?.some(cn => cn.toLowerCase() === sugestao.materia_prima.toLowerCase())
    )
    return key ? SOLVENTS_KB_REFERENCE[key] : null
  }, [sugestao.materia_prima])

  const mainSolvent = useMemo(() => {
    if (!solventesPrincipais?.length) return null
    const main = solventesPrincipais[0]
    const key = Object.keys(SOLVENTS_KB_REFERENCE).find(
      k => SOLVENTS_KB_REFERENCE[k].name.toLowerCase() === main.nome.toLowerCase() ||
           SOLVENTS_KB_REFERENCE[k].commonNames?.some(cn => cn.toLowerCase() === main.nome.toLowerCase())
    )
    return key ? SOLVENTS_KB_REFERENCE[key] : null
  }, [solventesPrincipais])

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'muito-forte': 'from-red-500 to-red-600',
      'forte': 'from-orange-500 to-orange-600',
      'moderado': 'from-yellow-500 to-yellow-600',
      'fraco': 'from-blue-500 to-blue-600',
      'muito-fraco': 'from-gray-500 to-gray-600',
    }
    return colors[category] || 'from-gray-500 to-gray-600'
  }

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      'muito-forte': '🔴 MUITO FORTE',
      'forte': '🟠 FORTE',
      'moderado': '🟡 MODERADO',
      'fraco': '🔵 FRACO',
      'muito-fraco': '⚪ MUITO FRACO',
    }
    return labels[category] || 'DESCONHECIDO'
  }

  const getKBBarWidth = (kb: number | null | undefined) => {
    if (!kb) return 0
    return Math.min((kb / 600) * 100, 100)
  }

  // Se não é solvente, retorna componente simples
  // Se não encontrou na base de dados OU não tem KB → renderiza versão simples (aditivos químicos)
  if (!solventData || solventData.kb === null) {
    return (
      <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 mb-3">
        <div className="text-green-400 font-semibold">{sugestao.materia_prima}</div>
        <div className="text-slate-400 text-sm mt-1">Função: {sugestao.funcao}</div>
        <div className="text-slate-400 text-sm mt-1">{sugestao.beneficio}</div>
        <div className="text-slate-400 text-sm mt-1">Compatibilidade: <span className={`font-semibold ${sugestao.compatibilidade === 'alta' ? 'text-green-400' : sugestao.compatibilidade === 'media' ? 'text-yellow-400' : 'text-red-400'}`}>{sugestao.compatibilidade}</span></div>
      </div>
    )
  }

  // Validação: Se é solvente fraco e há solvente principal forte, mostrar aviso
  const isWeakComplementingStrong =
    mainSolvent &&
    mainSolvent.kb !== null &&
    mainSolvent.kb > 100 &&
    solventData.kb !== null &&
    solventData.kb < 50

  return (
    <div className={`border-2 rounded-lg p-4 mb-3 transition-all ${
      isWeakComplementingStrong
        ? 'border-red-500 bg-red-950 shadow-lg shadow-red-500/20'
        : 'border-slate-700 bg-slate-800'
    }`}>
      {/* Cabeçalho */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-green-400 font-semibold text-base">{sugestao.materia_prima}</div>
          <div className="text-slate-400 text-xs mt-0.5">{sugestao.funcao}</div>
        </div>
        {solventData.kb !== null && (
          <div className="text-right">
            <div className="text-lg font-bold text-blue-300">KB {solventData.kb}</div>
            <div className={`text-xs font-semibold ${
              solventData.category === 'muito-forte' ? 'text-red-400' :
              solventData.category === 'forte' ? 'text-orange-400' :
              solventData.category === 'moderado' ? 'text-yellow-400' :
              solventData.category === 'fraco' ? 'text-blue-400' :
              'text-gray-400'
            }`}>
              {getCategoryLabel(solventData.category)}
            </div>
          </div>
        )}
      </div>

      {/* Barra de força */}
      <div className="mb-3">
        <div className="text-slate-400 text-xs mb-1">Força de Dissolução:</div>
        <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-700">
          <div
            className={`h-full bg-gradient-to-r ${getCategoryColor(solventData.category)} transition-all`}
            style={{ width: `${getKBBarWidth(solventData.kb)}%` }}
          />
        </div>
        <div className="text-slate-500 text-xs mt-1">
          Escala: Muito Fraco (KB 0) ← → Muito Forte (KB 600)
        </div>
      </div>

      {/* Compatibilidade */}
      <div className="mb-3 flex items-center gap-2">
        <span className="text-slate-400 text-sm">Compatibilidade:</span>
        <span className={`px-3 py-1 rounded text-sm font-semibold ${
          sugestao.compatibilidade === 'alta'
            ? 'bg-green-900 text-green-300'
            : sugestao.compatibilidade === 'media'
            ? 'bg-yellow-900 text-yellow-300'
            : 'bg-red-900 text-red-300'
        }`}>
          {sugestao.compatibilidade.toUpperCase()}
        </span>
        <span className="text-slate-400 text-sm ml-auto">Sugestão: {sugestao.percentual_sugerido}</span>
      </div>

      {/* Benefício */}
      <div className="mb-3">
        <div className="text-slate-300 text-sm">{sugestao.beneficio}</div>
      </div>

      {/* Análise de KB */}
      {solventData.kb !== null && mainSolvent && mainSolvent.kb !== null && (
        <div className={`border-l-4 pl-3 py-2 rounded text-sm ${
          isWeakComplementingStrong
            ? 'border-red-500 bg-red-900/30'
            : 'border-blue-500 bg-blue-900/20'
        }`}>
          <div className="font-semibold mb-1">
            {isWeakComplementingStrong ? '⚠️ ANÁLISE DE KB:' : '✅ ANÁLISE DE KB:'}
          </div>
          <div className="text-slate-300 text-xs space-y-1">
            <div>• Solvente principal: <span className="font-semibold">{mainSolvent.name} (KB {mainSolvent.kb})</span></div>
            <div>• Sugestão: <span className="font-semibold">{sugestao.materia_prima} (KB {solventData.kb})</span></div>
            {isWeakComplementingStrong && (
              <div className="text-red-300 font-semibold mt-2">
                ❌ PROBLEMA: Solvente fraco (KB {solventData.kb}) não complementa solvente forte (KB {mainSolvent.kb})
              </div>
            )}
            {!isWeakComplementingStrong && mainSolvent.kb > 100 && solventData.kb > 100 && (
              <div className="text-green-300 font-semibold mt-2">
                ✅ CORRETO: Ambos são solventes fortes - sinergismo esperado
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
