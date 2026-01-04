// ============================================
// DASHBOARD - INICIALIZAÇÃO E ORQUESTRAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', function () {
  // Configuração global de Modais
  if (typeof configurarModais === 'function') {
    configurarModais();
  }

  // Configuração específica de Modal de Candidato
  if (typeof configurarModalCandidato === 'function') {
    configurarModalCandidato();
  }

  // Inicialização do Pipeline
  if (document.querySelector('.pipeline-main') && typeof carregarPipeline === 'function') {
    carregarPipeline();
  }

  // Inicialização de Candidatos
  if (document.getElementById('candidatesCardsContainer')) {
    if (typeof carregarUsuarios === 'function') carregarUsuarios(); // Lista de cards
    if (typeof carregarCandidatos === 'function') carregarCandidatos(); // Métricas
  }

  // Inicialização de Vagas
  if (document.getElementById('vagasContainer')) {
    if (typeof carregarVagas === 'function') carregarVagas();
    if (typeof carregarVagasAbertas === 'function') carregarVagasAbertas();
  }

  // Inicialização da Dashboard (Home)
  // Carrega métricas se houver cards e não estivermos nas páginas específicas
  if (document.querySelector('.cards') &&
    !document.getElementById('candidatesCardsContainer') &&
    !document.getElementById('vagasContainer')) {
    if (typeof carregarCandidatos === 'function') carregarCandidatos(); // Contagem total
    if (typeof carregarVagasAbertas === 'function') carregarVagasAbertas(); // Vagas abertas
  }

  // Inicialização de Entrevistas
  if (document.getElementById('entrevistasContainer')) {
    if (typeof carregarEntrevistas === 'function') carregarEntrevistas();
  }
});
