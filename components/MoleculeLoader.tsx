'use client'

export function MoleculeLoader({ message = 'Processando formulação...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-6">
      {/* Molécula animada */}
      <div className="relative w-20 h-20">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 bg-[#D4A017] rounded-full animate-pulse-glow"></div>
        </div>
        <div className="absolute inset-0 animate-spin-molecule">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-blue-400 rounded-full opacity-80"></div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-4 bg-blue-400 rounded-full opacity-80"></div>
        </div>
        <div className="absolute inset-0 animate-spin-molecule" style={{ animationDuration: '3s', animationDirection: 'reverse' }}>
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-green-400 rounded-full opacity-70"></div>
          <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-green-400 rounded-full opacity-70"></div>
        </div>
      </div>

      <div className="text-center">
        <p className="text-white font-medium">{message}</p>
        <p className="text-gray-500 text-sm mt-1">Análise crítica em andamento...</p>
      </div>
    </div>
  )
}
