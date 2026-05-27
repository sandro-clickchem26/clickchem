'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardTitle } from '@/components/ui/Card'
import { Settings, Key, Database, Info } from 'lucide-react'

export default function Configuracoes() {
  const [apiKey, setApiKey] = useState('')
  const [modelo, setModelo] = useState('claude-sonnet-4-6')
  const [saved, setSaved] = useState(false)

  function salvar() {
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Settings className="text-gray-400" size={24} />
          Configurações
        </h1>
        <p className="text-gray-400 mt-1 text-sm">
          Configure a API do Claude e outras opções do sistema.
        </p>
      </div>

      <div className="space-y-6 max-w-xl">
        {/* API Key */}
        <Card>
          <CardTitle className="flex items-center gap-2 mb-4">
            <Key size={16} className="text-[#D4A017]" />
            API da Anthropic (Claude)
          </CardTitle>
          <div className="space-y-4">
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-xs text-blue-300">
                <strong>Como configurar:</strong> Abra o arquivo <code className="bg-black/30 px-1 rounded">.env</code> na raiz do projeto e preencha:
              </p>
              <pre className="mt-2 text-xs text-green-400 bg-black/30 p-2 rounded">
{`ANTHROPIC_API_KEY="sua-chave-aqui"
CLAUDE_MODEL="claude-sonnet-4-6"`}
              </pre>
              <p className="text-xs text-blue-300 mt-2">
                Obtenha sua chave em{' '}
                <span className="text-blue-400 underline">console.anthropic.com</span>
              </p>
            </div>

            <Input
              label="Chave da API (apenas exibição — configure no .env)"
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="sk-ant-..."
            />

            <div>
              <label className="text-sm font-medium text-gray-300 block mb-1.5">Modelo Claude</label>
              <select
                value={modelo}
                onChange={e => setModelo(e.target.value)}
                className="w-full bg-[#0A1628] border border-[#1B3A6B] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              >
                <option value="claude-sonnet-4-6">claude-sonnet-4-6 (Recomendado)</option>
                <option value="claude-opus-4-7">claude-opus-4-7 (Mais poderoso)</option>
                <option value="claude-haiku-4-5-20251001">claude-haiku-4-5 (Mais rápido)</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Banco de dados */}
        <Card>
          <CardTitle className="flex items-center gap-2 mb-4">
            <Database size={16} className="text-green-400" />
            Banco de Dados
          </CardTitle>
          <div className="space-y-3">
            <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-xs text-green-300 mb-2">
                <strong>Inicializar banco de dados:</strong> Execute os comandos abaixo no terminal.
              </p>
              <pre className="text-xs text-green-400 bg-black/30 p-2 rounded space-y-1">
                <div>npm run db:push</div>
                <div>npm run db:seed</div>
              </pre>
              <p className="text-xs text-green-300 mt-2">
                Isso cria o banco SQLite e popula com 45+ matérias-primas.
              </p>
            </div>
          </div>
        </Card>

        {/* Sobre */}
        <Card>
          <CardTitle className="flex items-center gap-2 mb-4">
            <Info size={16} className="text-blue-400" />
            Sobre o Click Chem
          </CardTitle>
          <div className="space-y-2 text-sm text-gray-400">
            <p><strong className="text-white">Versão:</strong> 1.0 MVP</p>
            <p><strong className="text-white">Desenvolvido por:</strong> Astana Química</p>
            <p><strong className="text-white">Stack:</strong> Next.js 16 · Prisma · Claude API</p>
            <p><strong className="text-white">Modelo IA:</strong> {modelo}</p>
            <p className="text-xs text-gray-600 pt-2 border-t border-white/8">
              A química que conecta inovação e eficiência
            </p>
          </div>
        </Card>

        {saved && (
          <div className="p-3 bg-green-500/15 border border-green-500/30 rounded-lg text-green-400 text-sm text-center">
            Configurações salvas! Lembre-se de atualizar o arquivo .env.
          </div>
        )}

        <Button variant="gold" onClick={salvar} className="w-full">
          Salvar Configurações
        </Button>
      </div>
    </div>
  )
}
