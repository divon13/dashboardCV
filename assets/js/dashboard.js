// ============================================
// dashboard.js
// ─────────────────────────────────────────────────────────────
// Ponto de entrada principal da aplicação.
// Responsável por orquestrar a inicialização de todos os módulos
// consoante a página que está a ser visualizada.
//
// Estratégia de deteção de página:
//   Em vez de usar rotas ou um router, este ficheiro verifica a
//   existência de elementos HTML específicos de cada página para
//   decidir quais funções chamar. Isto permite que todos os scripts
//   sejam carregados em todas as páginas sem conflitos.
//
// Ordem de carregamento dos scripts (definida nos ficheiros HTML):
//   1. supabaseClient.js  → Inicializa a ligação ao Supabase
//   2. utils.js           → Funções utilitárias (formatarData, etc.)
//   3. candidatos.js      → Lógica de candidatos
//   4. vagas.js           → Lógica de vagas
//   5. entrevistas.js     → Lógica de entrevistas e calendário
//   6. pipeline.js        → Lógica do pipeline Kanban
//   7. dashboard.js       → Este ficheiro (inicialização final)
// ─────────────────────────────────────────────────────────────

/**
 * Saudação dinâmica e data na página inicial (index.html).
 */
function initDashboardHome() {
  const greetingEl = document.getElementById('dashboardGreeting');
  const dateEl = document.getElementById('dashboardDate');
  if (!greetingEl && !dateEl) return;

  const hour = new Date().getHours();
  let greeting = 'Boa noite';
  if (hour < 12) greeting = 'Bom dia';
  else if (hour < 18) greeting = 'Boa tarde';

  if (greetingEl) greetingEl.textContent = greeting;
  if (dateEl) {
    try {
      dateEl.textContent = new Intl.DateTimeFormat('pt-PT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      }).format(new Date());
    } catch (e) {
      dateEl.textContent = new Date().toLocaleDateString('pt-PT');
    }
  }
}

document.addEventListener('DOMContentLoaded', function () {

  initDashboardHome();

  // ── Configuração global de Modais ────────────────────────────────────
  // Configura os modais de Vagas (criar, editar, excluir, ver detalhes).
  // A função está definida em utils.js e é segura para chamar em qualquer
  // página, pois verifica internamente se os elementos existem.
  if (typeof configurarModais === 'function') {
    configurarModais();
  }

  // ── Configuração do Modal de Candidato ───────────────────────────────
  // Configura o modal de detalhes do candidato e o modal de rejeição.
  // Definido em candidatos.js. Necessário nas páginas Candidatos e Pipeline.
  if (typeof configurarModalCandidato === 'function') {
    configurarModalCandidato();
  }

  // ── Inicialização do Pipeline (Pipeline.html) ────────────────────────
  // Verifica se estamos na página do Pipeline pela presença da classe
  // `.pipeline-main` no elemento principal. Se sim, carrega os candidatos
  // e organiza-os nas colunas do quadro Kanban.
  if (document.querySelector('.pipeline-main') && typeof carregarPipeline === 'function') {
    carregarPipeline();
  }

  // ── Inicialização da página de Candidatos (Candidatos.html) ──────────
  // O elemento `#candidatesCardsContainer` só existe em Candidatos.html.
  // Carrega:
  //   - carregarUsuarios(): renderiza os cards de candidatos
  //   - carregarCandidatos(): atualiza os contadores (total, qualificados, aguardando)
  if (document.getElementById('candidatesCardsContainer')) {
    if (typeof carregarUsuarios === 'function') carregarUsuarios();   // Renderiza os cards
    if (typeof carregarCandidatos === 'function') carregarCandidatos(); // Atualiza métricas
  }

  // ── Inicialização da página de Vagas (vagas.html) ────────────────────
  // O elemento `#vagasContainer` só existe em vagas.html.
  // Carrega:
  //   - carregarVagas(): renderiza os cards de vagas com opções de editar/excluir
  //   - carregarVagasAbertas(): atualiza o contador de vagas abertas
  if (document.getElementById('vagasContainer')) {
    if (typeof carregarVagas === 'function') carregarVagas();
    if (typeof carregarVagasAbertas === 'function') carregarVagasAbertas();
  }

  // ── Inicialização da Dashboard Principal (index.html) ────────────────
  // A página inicial tem `.cards` mas NÃO tem `#candidatesCardsContainer`
  // nem `#vagasContainer`. Esta condição garante que os contadores gerais
  // (total de candidatos e vagas abertas) só são carregados na Home.
  if (document.querySelector('.cards') &&
    !document.getElementById('candidatesCardsContainer') &&
    !document.getElementById('vagasContainer')) {
    if (typeof carregarCandidatos === 'function') carregarCandidatos();   // Contagem total de candidatos
    if (typeof carregarVagasAbertas === 'function') carregarVagasAbertas(); // Contagem de vagas abertas
  }

  // ── Inicialização das Próximas Entrevistas (index.html) ──────────────
  // O elemento `#entrevistasContainer` existe apenas em index.html.
  // Carrega as próximas entrevistas agendadas (a partir de hoje, máx. 7).
  // Nota: A página Entrevistas.html usa `initCalendarPage()` (em entrevistas.js),
  // que é inicializada automaticamente por esse mesmo ficheiro.
  if (document.getElementById('entrevistasContainer')) {
    if (typeof carregarEntrevistas === 'function') carregarEntrevistas();
  }
});
