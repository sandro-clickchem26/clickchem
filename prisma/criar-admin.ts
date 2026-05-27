/**
 * Cria o usuário administrador inicial.
 * Uso: npx tsx prisma/criar-admin.ts
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = 'admin@astanaquimica.com.br'
  const senha = 'AstanaClick2026!'
  const nome = 'Administrador'

  const hash = await bcrypt.hash(senha, 12)

  const user = await prisma.usuario.upsert({
    where: { email },
    update: { senha: hash, ativo: true },
    create: { email, senha: hash, nome, role: 'admin', ativo: true },
  })

  console.log('✅ Usuário admin criado/atualizado:')
  console.log('   Email:', user.email)
  console.log('   Senha:', senha)
  console.log('   Role: ', user.role)
  console.log('')
  console.log('⚠️  Altere a senha após o primeiro acesso!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
