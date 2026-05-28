/**
 * Test script to verify the authorization button flow end-to-end
 */
const payload = {
  segmento: 'Limpeza e desincrostação',
  descricao: 'Desincrustante Alcalino de Limpeza CIP para circulação a quente',
  substrato: 'Aço inoxidável',
  performance: 'Remoção de incrustações minerais',
  custo_alvo: 15,
  volume: 'Médio (1000-5000 L/mês)',
  toxicidade: 'baixa',
  regulatorios: ['REACH'],
  // First call WITHOUT authorization - should recuse
  usuario_autoriza_composicao_sem_referencia: false,
  // Later: set to true and test again
};

console.log('='.repeat(80));
console.log('TEST: Authorization Button Flow');
console.log('='.repeat(80));
console.log('');
console.log('Payload sent to API:');
console.log(JSON.stringify(payload, null, 2));
console.log('');
console.log('Expected behavior:');
console.log('1. Without authorization flag: System should return verificacao_recusada');
console.log('2. With authorization flag set to true: System should generate formula');
console.log('');
console.log('Use curl to test:');
console.log('');
console.log('curl -X POST http://localhost:3000/api/formulacao \\');
console.log('  -H "Content-Type: application/json" \\');
console.log('  -d \'{"segmento":"Limpeza e desincrostação","descricao":"Desincrustante Alcalino de Limpeza CIP para circulação a quente","usuario_autoriza_composicao_sem_referencia":false}\'');
console.log('');
console.log('Then test with usuario_autoriza_composicao_sem_referencia: true');
console.log('');
