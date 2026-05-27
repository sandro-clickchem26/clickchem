'use client'
import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { MessageCircle, X, Send, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatAssistenteProps {
  contexto?: string
}

export function ChatAssistente({ contexto = '' }: ChatAssistenteProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Olá! Sou o assistente técnico do Click Chem. Posso ajudar com dúvidas de formulação, compatibilidades, regulação ANVISA/REACH, custos e muito mais. Como posso ajudar?' }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Esconde na nova-formulacao — todos os hooks já foram chamados acima
  if (pathname === '/nova-formulacao') return null

  async function sendMessage() {
    if (!input.trim() || loading) return

    const userMsg: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensagens: [...messages, userMsg], contexto }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.resposta }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro ao conectar com o assistente. Verifique a chave de API nas configurações.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Botão flutuante */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#2563EB] hover:bg-[#1d4ed8] rounded-full shadow-xl flex items-center justify-center transition-all duration-200 hover:scale-105"
          title="Assistente Técnico"
        >
          <MessageCircle size={22} className="text-white" />
        </button>
      )}

      {/* Painel do chat */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[520px] bg-[#0d1f3c] border border-[#1B3A6B] rounded-2xl shadow-2xl flex flex-col animate-fade-in-up">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#1B3A6B]/60">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-[#2563EB]/20 rounded-full flex items-center justify-center">
                <Bot size={14} className="text-blue-400" />
              </div>
              <div>
                <div className="text-sm font-medium text-white">Assistente Técnico</div>
                <div className="text-xs text-green-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block"></span>
                  Online
                </div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Mensagens */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div
                  className={cn(
                    'max-w-[80%] rounded-xl px-3 py-2 text-sm',
                    msg.role === 'user'
                      ? 'bg-[#2563EB] text-white'
                      : 'bg-[#1B3A6B]/60 text-gray-200'
                  )}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[#1B3A6B]/60 rounded-xl px-3 py-2">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-[#1B3A6B]/60 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Faça uma pergunta técnica..."
              className="flex-1 bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-600 focus:outline-none focus:border-blue-500"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="w-9 h-9 bg-[#2563EB] hover:bg-[#1d4ed8] rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"
            >
              <Send size={14} className="text-white" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
