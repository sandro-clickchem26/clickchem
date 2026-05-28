/**
 * Script de teste direto para verificar o novo fluxo de verificação de fórmulas
 */
const { gerarFormulacao } = require('./lib/ai');

async function testar() {
  console.log('='.repeat(80));
  console.log('TESTE 1: Formulação SEM referência no banco (CIP)');
  console.log('='.repeat(80));
  console.log('');

  const dados = {
    segmento: 'Limpeza e desincrostação',
    descricao: 'Desincrustante Alcalino de Limpeza CIP para circulação a quente',
    materias_obrigatorias: [],
  };

  try {
    const resultado = await gerarFormulacao(dados);

    console.log('RESULTADO:');
    console.log(JSON.stringify(resultado, null, 2));
    console.log('');

    // Verifica se a resposta é a esperada
    if (resultado.analise_critica?.viabilidade === 'verificacao_recusada') {
      console.log('✅ CORRETO: Sistema recusou por falta de referência de fórmula');
      console.log('   Motivo:', resultado.analise_critica.motivo_recusa);
    } else if (resultado.analise_critica?.viabilidade === 'recusado') {
      console.log('✅ RECUSADO (possível segurança):', resultado.analise_critica.motivo_recusa);
    } else {
      console.log('❌ ERRO: Sistema gerou fórmula mesmo sem referência:');
      console.log('   Viabilidade:', resultado.analise_critica?.viabilidade);
      if (resultado.formulacao?.nome_sugerido) {
        console.log('   Nome:', resultado.formulacao.nome_sugerido);
      }
    }
  } catch (err) {
    console.error('❌ Erro ao gerar:', err.message);
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('TESTE 2: Com autorização explícita (usuario_autoriza_composicao_sem_referencia)');
  console.log('='.repeat(80));
  console.log('');

  const dadosComAutor = {
    segmento: 'Limpeza e desincrostação',
    descricao: 'Desincrustante Alcalino de Limpeza CIP para circulação a quente',
    materias_obrigatorias: [],
    usuario_autoriza_composicao_sem_referencia: true,
  };

  try {
    const resultado = await gerarFormulacao(dadosComAutor);

    console.log('RESULTADO:');
    if (resultado.formulacao) {
      console.log('Nome sugerido:', resultado.formulacao.nome_sugerido);
      console.log('Viabilidade:', resultado.analise_critica?.viabilidade);
      console.log('Análise crítica:', resultado.analise_critica?.abordagem_quimica?.substring(0, 150) + '...');
    } else {
      console.log(JSON.stringify(resultado, null, 2));
    }

    if (resultado.formulacao?.nome_sugerido && resultado.analise_critica?.abordagem_quimica?.includes('sem referência')) {
      console.log('✅ CORRETO: Sistema gerou fórmula COM aviso de falta de referência');
    } else if (resultado.formulacao?.nome_sugerido) {
      console.log('⚠️ GERADO: Mas verificar se indica a falta de referência');
    } else {
      console.log('❌ ERRO: Não gerou fórmula mesmo com autorização');
    }
  } catch (err) {
    console.error('❌ Erro ao gerar:', err.message);
  }
}

testar().catch(console.error);
