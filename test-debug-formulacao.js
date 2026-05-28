/**
 * Debug detalhado do processo de match de fórmulas
 */
const { PrismaClient } = require('@prisma/client');

function removeAccents(s) {
  return s
    .replace(/[àáâãä]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/[ç]/g, 'c')
    .replace(/[ñ]/g, 'n');
}

async function debugarMatch() {
  const prisma = new PrismaClient();

  const descricao = 'Desincrustante Alcalino de Limpeza CIP para circulação para limpeza de circulação a quente';
  const segmento = 'Limpeza e desincrostação';

  console.log('='.repeat(80));
  console.log('DEBUG: Análise de Match de Fórmulas Proprietárias');
  console.log('='.repeat(80));
  console.log('');
  console.log('Solicitação:');
  console.log('  Segmento:', segmento);
  console.log('  Descrição:', descricao);
  console.log('');

  const norm = (s) => removeAccents(s.toLowerCase());

  // Stopwords comuns em português a descartar
  const stopwords = new Set(['para', 'circulacao', 'limpeza', 'quente', 'com', 'uma', 'dei', 'uso', 'aplicacao']);

  const palavrasChave = norm(descricao)
    .split(/\s+/)
    .filter(w => w.length > 2 && !stopwords.has(w));
  console.log('Palavras-chave extraídas (sem stopwords):', palavrasChave);
  console.log('');

  const formulas = await prisma.formulaProprietaria.findMany({
    where: { ativa: true },
  });

  console.log(`Total de fórmulas ativas: ${formulas.length}`);
  console.log('');

  const comScore = formulas.map(f => {
    let score = 0;
    const textoFormula = norm(`${f.segmento} ${f.aplicacao} ${f.nome_interno} ${f.tags || ''}`);

    // Match de segmento
    let matchSegmento = false;
    if (norm(f.segmento).includes(norm(segmento)) ||
        norm(segmento).includes(norm(f.segmento))) {
      score += 3;
      matchSegmento = true;
    }

    // Matches de palavras-chave
    const matchesKw = [];
    for (const kw of palavrasChave) {
      if (textoFormula.includes(kw)) {
        score += 2;
        matchesKw.push(kw);
      }
    }

    return { formula: f, score, matchSegmento, matchesKw, textoFormula };
  });

  comScore.sort((a, b) => b.score - a.score);

  console.log('Top 5 Matches (por score):');
  console.log('');
  for (let i = 0; i < Math.min(5, comScore.length); i++) {
    const item = comScore[i];
    console.log(`${i + 1}. SCORE: ${item.score} ⭐`);
    console.log(`   Nome: ${item.formula.nome_interno}`);
    console.log(`   Aplicação: ${item.formula.aplicacao}`);
    console.log(`   Segmento: ${item.formula.segmento}`);
    console.log(`   Match Segmento: ${item.matchSegmento ? 'SIM (+3)' : 'NÃO'}`);
    console.log(`   Matches Palavra-Chave: ${item.matchesKw.length > 0 ? item.matchesKw.join(', ') : 'NENHUM'}`);
    if (item.matchesKw.length > 0) {
      console.log(`                           (cada uma +2, total ${item.matchesKw.length * 2})`);
    }
    console.log('');
  }

  const threshold = 6;
  const melhor = comScore[0];
  const temMatchForte = melhor && melhor.score >= threshold;

  console.log('='.repeat(80));
  console.log(`Threshold: ${threshold}`);
  console.log(`Score do melhor match: ${melhor?.score || 0}`);
  console.log(`Tem match FORTE: ${temMatchForte ? 'SIM' : 'NÃO'}`);
  console.log('='.repeat(80));

  if (temMatchForte) {
    console.log('');
    console.log('⚠️ RESULTADO: Sistema vai injetar as MPs da fórmula como obrigatórias');
    console.log(`   Fórmula: ${melhor.formula.nome_interno}`);
  } else {
    console.log('');
    console.log('✅ RESULTADO: Sistema vai RECUSAR (sem fórmula de referência)');
  }

  await prisma.$disconnect();
}

debugarMatch().catch(console.error);
