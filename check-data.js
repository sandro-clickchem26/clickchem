const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const usuarios = await prisma.usuario.findMany();
  console.log('=== USUÁRIOS ===');
  usuarios.forEach(u => console.log(`${u.email} (${u.id}) - role: ${u.role}`));

  const formulasSemUserId = await prisma.formulacao.findMany({
    where: { userId: null }
  });
  console.log(`\n=== FÓRMULAS COM userId=null: ${formulasSemUserId.length} ===`);
  formulasSemUserId.slice(0, 5).forEach(f => console.log(`${f.id}: ${f.nome}`));

  await prisma.$disconnect();
}

check().catch(console.error);
