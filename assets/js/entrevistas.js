/**
 * entrevistas.js
 * ─────────────────────────────────────────────────────────────
 * Módulo responsável por toda a lógica de entrevistas do projeto.
 *
 * Este ficheiro serve DUAS páginas distintas:
 *
 *   1. index.html (Dashboard Principal)
 *      → carregarEntrevistas(): carrega as próximas 7 entrevistas e
 *        renderiza cards simples na secção "Próximas Entrevistas"
 *
 *   2. Entrevistas.html (Página completa de Entrevistas)
 *      → initCalendarPage(): inicializa o calendário interativo,
 *        painel lateral, filtros, vista em lista e modal de agendamento
 *
 * Funções principais:
 *   - carregarEntrevistas()       → Cards simples para o dashboard (index.html)
 *   - criarCardEntrevista()       → Cria o HTML de um card simples de entrevista
 *   - initCalendarPage()          → Inicializa a página completa de entrevistas
 *   - setupAgendamentoModal()     → Configura o modal de agendar/editar entrevista
 *   - populateModalSelects()      → Preenche os dropdowns do modal com dados do BD
 *   - setupSearchableDropdown()   → Cria um dropdown com pesquisa em tempo real
 *   - handleAgendamentoSubmit()   → Processa o submit do formulário de agendamento
 *   - renderCalendar()            → Renderiza a grelha do calendário mensal
 *   - fetchMonthInterviews()      → Busca todas as entrevistas do BD e atualiza a cache
 *   - renderSidePanel()           → Renderiza as entrevistas do dia selecionado
 *   - renderListView()            → Renderiza todos os cards na vista em lista
 *   - updateCalendarDots()        → Adiciona pontos coloridos nos dias com entrevistas
 *   - updateStatsCounters()       → Atualiza os 4 contadores de estatísticas
 *   - animateValue()              → Anima numericamente um contador de 0 até o valor
 *   - editInterview()             → Abre o modal pré-preenchido para edição
 *   - deleteInterview()           → Elimina uma entrevista da base de dados
 *   - changeMonth()               → Navega para o mês anterior/seguinte no calendário
 *
 * Tabelas Supabase utilizadas:
 *   - Entrevistas   → Dados das entrevistas (Data, Status, Tipo, Observacoes, etc.)
 *   - candidatos    → JOIN para obter nome e nota do candidato
 *   - Vagas         → JOIN para obter o título da vaga
 *   - Entrevistador → JOIN para obter o nome do entrevistador
 * ─────────────────────────────────────────────────────────────
 */

/**
 * Carrega as próximas entrevistas agendadas e renderiza cards simples
 * no container `#entrevistasContainer` da página inicial (index.html).
 *
 * Filtros aplicados:
 *   - Data >= hoje (não mostra entrevistas passadas)
 *   - Ordenadas por data crescente (a mais próxima primeiro)
 *   - Limite de 7 entrevistas
 *
 * Também atualiza o contador "Entrevistas Hoje" (#entrevistas-hoje-val)
 * se o elemento existir na página.
 */
async function carregarEntrevistas() {
    // Define "hoje" como o início do dia atual (meia-noite) para filtrar corretamente
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeISO = getLocalIsoDate(hoje); // Formato "YYYY-MM-DD"

    // Busca entrevistas com JOIN nas tabelas relacionadas
    const { data, error } = await supabaseClient
        .from("Entrevistas")
        .select(`
      *,
      Vagas!inner(id, Titulo, status_vagas),
      candidatos(id, nome),
      Entrevistador(id, Nome)
    `)
        .eq('Vagas.status_vagas', 'aberta')
        .gte('Data', hojeISO)          // Apenas entrevistas de hoje em diante
        .order('Data', { ascending: true }) // Mais próximas primeiro
        .limit(7);                     // Máximo de 7 cards no dashboard

    if (error) {
        console.error("Erro ao carregar entrevistas:", error);
        const container = document.getElementById('entrevistasContainer');
        if (container) {
            container.innerHTML = '<div class="empty-state-dashboard empty-state-dashboard--error" role="alert">Erro ao carregar entrevistas.</div>';
        }
        return;
    }

    // ── Atualiza o contador "Entrevistas Hoje" no dashboard ───────────────
    // Filtra as entrevistas que têm data igual a hoje
    const countHojeEl = document.getElementById("entrevistas-hoje-val");
    if (countHojeEl) {
        const hojeISO = getLocalIsoDate();
        const numHoje = data ? data.filter(e => e.Data && e.Data.startsWith(hojeISO)).length : 0;
        countHojeEl.textContent = numHoje;
    }

    const container = document.getElementById('entrevistasContainer');
    if (!container) {
        return; // Sai silenciosamente se não estiver na página correta
    }

    container.innerHTML = '';

    if (!data || data.length === 0) {
        container.innerHTML = '<div class="empty-state-dashboard empty-state-dashboard--empty"><i class="fa-regular fa-calendar-xmark"></i><span>Nenhuma entrevista agendada nos próximos dias.</span></div>';
        return;
    }

    // Renderiza um card para cada entrevista
    data.forEach(entrevista => {
        const card = criarCardEntrevista(entrevista);
        container.appendChild(card);
    });
}

/**
 * Cria e retorna o elemento HTML de um card simples de entrevista.
 * Usado apenas na página inicial (index.html) na secção "Próximas Entrevistas".
 *
 * O card exibe: candidato, vaga, data/hora, entrevistador, status e observações.
 *
 * @param {Object} entrevista - Objeto da entrevista com JOINs do Supabase
 * @returns {HTMLElement} Elemento <div> com o card da entrevista
 */
function criarCardEntrevista(entrevista) {
    const card = document.createElement('div');
    card.className = 'card-entrevista';

    // Extrai os nomes dos relacionamentos (podem vir como array ou objeto)
    const nomeVaga = extrairNomeVaga(entrevista);
    const nomeCandidato = extrairNomeCandidato(entrevista);
    const dataFormatada = entrevista.Data ? formatarData(entrevista.Data) : 'Data não definida';
    const status = entrevista.Status || 'Agendada';
    const statusClass = status.toLowerCase().replace(/\s+/g, '-'); // Para classe CSS

    // Observações são opcionais — só renderiza o bloco se existirem
    const observacoes = entrevista.Observações || entrevista.Observacoes || '';
    const observacoesHTML = observacoes
        ? `<div class="entrevista-observacoes">${observacoes}</div>`
        : '';

    card.innerHTML = `
    <div class="card-top">
      <div class="title-area">
        <div class="entrevista-titulo">
          <div class="entrevista-candidato">${nomeCandidato}</div>
          <div class="entrevista-vaga">${nomeVaga}</div>
        </div>
      </div>
      <div class="chip-status chip-status-${statusClass}">${status}</div>
    </div>
    <div class="card-bottom">
      <span><i class="fa-solid fa-calendar-week"></i> ${dataFormatada}</span>
      <span><i class="fa-solid fa-user"></i> ${entrevista.Entrevistador ? entrevista.Entrevistador.Nome : 'Não definido'}</span>
    </div>
    ${observacoesHTML}
  `;

    return card;
}

/**
 * Extrai o nome da vaga de um objeto de entrevista retornado pelo Supabase.
 * O Supabase pode retornar o JOIN como objeto ou como array (dependendo da relação).
 *
 * @param {Object} entrevista - Objeto da entrevista com JOIN da tabela Vagas
 * @returns {string} Nome da vaga ou mensagem de fallback
 */
function extrairNomeVaga(entrevista) {
    if (!entrevista.Vagas) return 'Vaga não encontrada';

    // Supabase pode retornar como array (relação 1-para-muitos) ou objeto (1-para-1)
    if (Array.isArray(entrevista.Vagas) && entrevista.Vagas.length > 0) {
        return entrevista.Vagas[0].Titulo || 'Vaga não encontrada';
    } else if (entrevista.Vagas.Titulo) {
        return entrevista.Vagas.Titulo;
    }

    return 'Vaga não encontrada';
}

/**
 * Extrai o nome do candidato de um objeto de entrevista retornado pelo Supabase.
 * Mesma lógica de `extrairNomeVaga` — trata array ou objeto.
 *
 * @param {Object} entrevista - Objeto da entrevista com JOIN da tabela candidatos
 * @returns {string} Nome do candidato ou mensagem de fallback
 */
function extrairNomeCandidato(entrevista) {
    if (!entrevista.candidatos) return 'Candidato não encontrado';

    if (Array.isArray(entrevista.candidatos) && entrevista.candidatos.length > 0) {
        return entrevista.candidatos[0].nome || 'Candidato não encontrado';
    } else if (entrevista.candidatos.nome) {
        return entrevista.candidatos.nome;
    }

    return 'Candidato não encontrado';
}

// ============================================
// LÓGICA DA PÁGINA DE ENTREVISTAS (Entrevistas.html)
// ============================================

// ── Variáveis de estado do calendário ────────────────────────────────────────
// Estas variáveis mantêm o estado global do calendário entre chamadas de função.
let currentDate = new Date();    // Mês/ano atualmente visível no calendário
let selectedDate = new Date();   // Dia atualmente selecionado (painel lateral)
let interviewsCache = [];        // Cache local com todas as entrevistas carregadas do BD

/**
 * Inicializa a página completa de Entrevistas (Entrevistas.html).
 *
 * Responsável por:
 *   1. Renderizar o calendário do mês atual
 *   2. Inicializar os contadores de estatísticas
 *   3. Configurar todos os event listeners (navegação, filtros, vistas)
 *   4. Buscar as entrevistas do BD e popular o calendário
 *   5. Configurar o modal de agendamento
 *
 * É chamada automaticamente no DOMContentLoaded se a página tiver
 * a classe `.main-entrevistas` no elemento principal.
 */
async function initCalendarPage() {
    console.log('Iniciando página de entrevistas...');

    // Renderiza o calendário com o mês atual e inicializa os contadores a zero
    renderCalendar(currentDate);
    updateStatsCounters();

    // ── Navegação do calendário ───────────────────────────────────────────
    // Botões de seta para navegar entre meses
    const prevMonth = document.getElementById('prevMonth');
    if (prevMonth) prevMonth.addEventListener('click', () => changeMonth(-1)); // Mês anterior

    const nextMonth = document.getElementById('nextMonth');
    if (nextMonth) nextMonth.addEventListener('click', () => changeMonth(1));  // Próximo mês

    // Botão "Hoje" → volta para o mês e dia atual
    const goToday = document.getElementById('goToday');
    if (goToday) goToday.addEventListener('click', () => {
        currentDate = new Date();
        selectedDate = new Date();
        renderCalendar(currentDate);
        fetchMonthInterviews(currentDate); // Recarrega as entrevistas
    });

    // ── Filtros ───────────────────────────────────────────────────────────
    // Botão "Limpar" → reseta os selects de filtro e re-renderiza o painel lateral
    const btnClearFilters = document.getElementById('btnClearFilters');
    if (btnClearFilters) btnClearFilters.addEventListener('click', () => {
        document.getElementById('filterType').value = 'all';
        document.getElementById('filterStatus').value = 'all';
        renderSidePanel(selectedDate); // Re-renderiza com filtros limpos
    });

    // Filtro por tipo de entrevista → re-renderiza o painel ao mudar
    const filterType = document.getElementById('filterType');
    if (filterType) filterType.addEventListener('change', () => renderSidePanel(selectedDate));

    // Filtro por status → re-renderiza o painel ao mudar
    const filterStatus = document.getElementById('filterStatus');
    if (filterStatus) filterStatus.addEventListener('change', () => renderSidePanel(selectedDate));

    // ── Toggle de Vista (Calendário / Lista) ──────────────────────────────
    const viewCalendar = document.getElementById('viewCalendar');
    if (viewCalendar) viewCalendar.addEventListener('click', (e) => setActiveView(e.target, 'calendar'));

    const viewList = document.getElementById('viewList');
    if (viewList) viewList.addEventListener('click', (e) => setActiveView(e.target, 'list'));

    // ── Busca inicial das entrevistas ─────────────────────────────────────
    // Carrega todas as entrevistas do BD, popula a cache e atualiza o calendário
    await fetchMonthInterviews(currentDate);

    // Botão no painel lateral para mudar para a vista em lista
    const btnOpenListFromSide = document.getElementById('btnOpenListFromSide');
    if (btnOpenListFromSide) {
        btnOpenListFromSide.addEventListener('click', () => setActiveView(null, 'list'));
    }

    // Configura o modal de agendamento de entrevistas
    setupAgendamentoModal();
}

/**
 * Configura todos os event handlers do modal de agendamento de entrevistas
 * (#agendamentoModal). Este modal é partilhado entre Entrevistas.html e Pipeline.html.
 *
 * Comportamentos configurados:
 *   - Botão "Agendar Entrevista" → abre o modal e popula os dropdowns
 *   - Botão "X" e "Cancelar" → fecham o modal e limpam o formulário
 *   - Clique fora do modal → fecha o modal
 *   - Submit do formulário → chama handleAgendamentoSubmit()
 */
function setupAgendamentoModal() {
    const modal = document.getElementById('agendamentoModal');
    const btnOpen = document.getElementById('btnNovoAgendamento'); // Botão "Agendar Entrevista"
    const btnClose = document.getElementById('closeAgendamentoModal'); // Botão "X"
    const btnCancel = document.getElementById('cancelAgendamento');    // Botão "Cancelar"
    const form = document.getElementById('agendamentoForm');

    // Abre o modal e popula os dropdowns com dados do BD
    if (btnOpen) {
        btnOpen.addEventListener('click', async () => {
            if (form) form.reset(); // Limpa o formulário para nova entrevista
            document.getElementById('agendamentoId').value = ''; // Garante modo de criação
            modal.style.display = 'flex';
            await populateModalSelects(); // Carrega candidatos, vagas e entrevistadores
        });
    }

    // Função auxiliar para fechar e limpar o modal
    const closeModal = () => {
        if (modal) modal.style.display = 'none';
        if (form) form.reset();
    };

    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);

    // Fecha ao clicar no overlay (fora do conteúdo do modal)
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Processa o submit do formulário
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault(); // Impede reload da página
            const success = await handleAgendamentoSubmit(form);
            if (success) {
                closeModal();
                fetchMonthInterviews(currentDate); // Atualiza o calendário após agendar
            }
        };
    }
}

/**
 * Preenche os dropdowns do modal de agendamento com dados do Supabase.
 *
 * Dropdowns preenchidos:
 *   - Candidato: dropdown pesquisável (#searchCandidato / #agCandidato)
 *   - Vaga: dropdown pesquisável (#searchVaga / #agVaga)
 *   - Entrevistador: select padrão (#agEntrevistador)
 *
 * Os dropdowns de candidato e vaga são "searchable" (com pesquisa em tempo real),
 * enquanto o de entrevistador é um <select> HTML padrão.
 */
async function populateModalSelects() {
    // ── Candidatos (dropdown pesquisável) ─────────────────────────────────
    const { data: candidates } = await supabaseClient.from('candidatos').select('id, nome');
    if (candidates) {
        setupSearchableDropdown(
            'searchCandidato',   // ID do input de pesquisa
            'optionsCandidato',  // ID do container de opções
            'agCandidato',       // ID do input hidden (guarda o ID selecionado)
            candidates.map(c => ({ id: c.id, label: c.nome })), // Transforma em {id, label}
            true // keepExisting: mantém o valor atual se já estiver preenchido (modo edição)
        );
    }

    // ── Vagas (dropdown pesquisável - apenas vagas abertas) ───────────────
    const { data: vagas } = await supabaseClient.from('Vagas').select('id, Titulo').eq('status_vagas', 'aberta');
    if (vagas) {
        setupSearchableDropdown(
            'searchVaga',
            'optionsVaga',
            'agVaga',
            vagas.map(v => ({ id: v.id, label: v.Titulo })),
            true
        );
    }

    // ── Entrevistadores (select padrão) ───────────────────────────────────
    const entrevistadorSelect = document.getElementById('agEntrevistador');
    const { data: entrevistadores } = await supabaseClient.from('Entrevistador').select('id, Nome');
    if (entrevistadores && entrevistadorSelect) {
        entrevistadorSelect.innerHTML = '<option value="">Selecione um entrevistador...</option>';
        entrevistadores.forEach(e => {
            const opt = document.createElement('option');
            opt.value = e.id;
            opt.textContent = e.Nome;
            entrevistadorSelect.appendChild(opt);
        });
    }
}

/**
 * Configura um dropdown com pesquisa em tempo real (searchable dropdown).
 *
 * Funcionamento:
 *   - O utilizador escreve no input de texto (#searchXxx)
 *   - As opções são filtradas em tempo real pelo texto digitado
 *   - Ao selecionar uma opção, o input mostra o label e o input hidden guarda o ID
 *   - O dropdown fecha ao clicar fora dele
 *
 * Este padrão é necessário porque o <select> HTML padrão não suporta pesquisa.
 *
 * @param {string} inputId - ID do input de texto visível (pesquisa)
 * @param {string} containerId - ID do div que contém as opções
 * @param {string} hiddenId - ID do input hidden que guarda o ID selecionado
 * @param {Array} items - Array de objetos {id, label} com as opções disponíveis
 * @param {boolean} keepExisting - Se true, não limpa o valor hidden ao inicializar
 */
function setupSearchableDropdown(inputId, containerId, hiddenId, items, keepExisting = false) {
    const input = document.getElementById(inputId);
    const container = document.getElementById(containerId);
    const hidden = document.getElementById(hiddenId);

    if (!input || !container || !hidden) return;

    // Só limpa o valor selecionado se não estivermos em modo de edição
    if (!keepExisting) hidden.value = '';

    // Função auxiliar que renderiza as opções filtradas pelo texto
    const renderOptions = (filterText = '') => {
        container.innerHTML = '';
        // Filtra os itens pelo texto digitado (case-insensitive)
        const filtered = items.filter(i => i.label.toLowerCase().includes(filterText.toLowerCase()));

        if (filtered.length === 0) {
            // Mostra mensagem quando não há resultados
            const div = document.createElement('div');
            div.className = 'dropdown-option';
            div.textContent = 'Nenhum resultado encontrado';
            div.style.color = 'var(--text-muted)';
            div.style.fontStyle = 'italic';
            div.style.cursor = 'default';
            container.appendChild(div);
            return;
        }

        // Cria um elemento clicável para cada opção filtrada
        filtered.forEach(item => {
            const div = document.createElement('div');
            div.className = 'dropdown-option';
            div.textContent = item.label;
            div.onclick = (e) => {
                e.stopPropagation(); // Impede que o clique feche o dropdown prematuramente
                input.value = item.label; // Mostra o nome no input visível
                hidden.value = item.id;   // Guarda o ID no input hidden
                container.classList.remove('active'); // Fecha o dropdown
            };
            container.appendChild(div);
        });
    };

    // Renderiza todas as opções inicialmente (sem filtro)
    renderOptions();

    // Abre o dropdown e filtra ao focar no input
    input.onfocus = () => {
        renderOptions(input.value);
        container.classList.add('active'); // Mostra o dropdown
    };

    // Filtra as opções em tempo real conforme o utilizador digita
    input.oninput = (e) => {
        renderOptions(e.target.value);
        container.classList.add('active');
    };

    // Fecha o dropdown ao clicar fora do input ou do container de opções
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !container.contains(e.target)) {
            container.classList.remove('active');
        }
    });
}

/**
 * Processa o submit do formulário de agendamento de entrevista.
 *
 * Valida os campos obrigatórios (candidato e vaga devem ser selecionados
 * da lista, não apenas digitados), e depois:
 *   - Se #agendamentoId tiver valor → atualiza a entrevista existente (UPDATE)
 *   - Se #agendamentoId estiver vazio → cria nova entrevista (INSERT)
 *
 * Após criar uma nova entrevista, atualiza automaticamente o status do
 * candidato para "Entrevista técnica" na tabela candidatos.
 *
 * Emite o evento customizado 'interview-scheduled' para notificar
 * outros módulos (ex: pipeline.js) de que uma entrevista foi agendada.
 *
 * @param {HTMLFormElement} form - O elemento do formulário
 * @returns {boolean} true se guardou com sucesso, false se houve erro
 */
async function handleAgendamentoSubmit(form) {
    // Recolhe os valores dos campos do formulário
    const candidatoId = document.getElementById('agCandidato').value;   // ID do candidato (hidden)
    const vagaId = document.getElementById('agVaga').value;             // ID da vaga (hidden)
    const tipo = document.getElementById('agTipo').value;               // Tipo de entrevista
    const dataHora = document.getElementById('agDataHora').value;       // Data e hora
    const formDataEntrevistador = document.getElementById('agEntrevistador').value;
    const entrevistadorId = formDataEntrevistador ? parseInt(formDataEntrevistador) : null;
    const obs = document.getElementById('agObs').value;                 // Observações

    // ── Validação: candidato e vaga devem ser selecionados da lista ───────
    // Os inputs hidden ficam vazios se o utilizador apenas digitou sem selecionar
    if (!candidatoId) {
        showNotification('Por favor, selecione um candidato da lista.', 'error');
        return;
    }
    if (!vagaId) {
        showNotification('Por favor, selecione uma vaga da lista.', 'error');
        return;
    }

    const interviewId = document.getElementById('agendamentoId').value; // Vazio se nova entrevista

    // Objeto com os dados a guardar na tabela Entrevistas
    const dataToSave = {
        "Candidato_ID": candidatoId ? parseInt(candidatoId) : null,
        "Vagas_ID": vagaId ? parseInt(vagaId) : null,
        "Data": dataHora,
        "Entrevistador": formDataEntrevistador ? parseInt(formDataEntrevistador) : null,
        "Observacoes": obs,
        "status": 'Agendada',
        "Tipo de entrevista": tipo
    };

    // Validação adicional: garante que os IDs são números válidos
    if (!dataToSave.Candidato_ID || isNaN(dataToSave.Candidato_ID)) {
        showNotification('Erro: Por favor, selecione um candidato válido da lista.', 'error');
        return false;
    }
    if (!dataToSave.Vagas_ID || isNaN(dataToSave.Vagas_ID)) {
        showNotification('Erro: Por favor, selecione uma vaga válida da lista.', 'error');
        return false;
    }

    let result;
    if (interviewId) {
        // ── Modo Edição: atualiza a entrevista existente ──────────────────
        result = await supabaseClient.from('Entrevistas').update(dataToSave).eq('id', interviewId);
    } else {
        // ── Modo Criação: insere nova entrevista ──────────────────────────
        result = await supabaseClient.from('Entrevistas').insert([dataToSave]);
    }

    if (result.error) {
        console.error('Error saving interview:', result.error);
        showNotification('Erro ao salvar entrevista: ' + result.error.message, 'error');
        return false;
    } else {
        // ── Atualiza o status do candidato (apenas em novas entrevistas) ──
        // Quando uma entrevista é agendada pela primeira vez, o candidato
        // avança automaticamente para a etapa "Entrevista técnica" no pipeline.
        if (!interviewId) {
            const { error: updateError } = await supabaseClient
                .from('candidatos')
                .update({ status: 'Entrevista técnica' })
                .eq('id', candidatoId);

            if (updateError) {
                console.error('Erro ao atualizar status do candidato:', updateError);
            }
        }

        showNotification(interviewId ? 'Entrevista atualizada com sucesso!' : 'Entrevista agendada com sucesso!', 'success');

        // Emite evento customizado para notificar outros módulos (ex: pipeline.js recarrega)
        window.dispatchEvent(new CustomEvent('interview-scheduled', { detail: { candidatoId } }));
        return true;
    }
}

/**
 * Alterna entre a vista de Calendário e a vista em Lista.
 *
 * Vista Calendário: mostra a grelha do calendário + painel lateral
 * Vista Lista: mostra todos os cards de entrevistas numa grelha
 *
 * @param {HTMLElement|null} btn - O botão clicado (para adicionar classe 'active')
 * @param {string} view - "calendar" ou "list"
 */
function setActiveView(btn, view) {
    const calendarView = document.getElementById('calendarViewContainer');
    const listView = document.getElementById('listViewContainer');
    const calendarToggle = document.getElementById('viewCalendar');
    const listToggle = document.getElementById('viewList');

    if (!calendarView || !listView || !calendarToggle || !listToggle) return;

    // Remove a classe 'active' de todos os botões de toggle
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));

    if (view === 'calendar') {
        calendarToggle.classList.add('active');
        calendarView.style.display = 'grid'; // Mostra o calendário
        listView.style.display = 'none';
        renderCalendar(currentDate); // Atualiza o calendário
    } else {
        listToggle.classList.add('active');
        calendarView.style.display = 'none';
        listView.style.display = 'grid'; // Mostra a lista
        renderListView(); // Renderiza os cards da lista
    }
}

/**
 * Renderiza todos os cards de entrevistas na vista em lista (#listViewContainer).
 * Usa os dados da cache `interviewsCache` (já carregados do BD).
 *
 * Cada card é criado pela função `createInterviewListCard()`.
 */
async function renderListView() {
    const listContainer = document.getElementById('listViewContainer');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const hojeISO = getLocalIsoDate(hoje);

    // Filtra para exibir apenas entrevistas de hoje em diante na vista de lista
    const upcomingInterviews = interviewsCache.filter(i => {
        if (!i.Data) return false;
        const dateStr = i.Data.substring(0, 10); // Extrai apenas "YYYY-MM-DD" da string do Supabase
        return dateStr >= hojeISO;
    });

    if (upcomingInterviews.length === 0) {
        listContainer.innerHTML = '<div class="empty-state">Nenhuma entrevista futura encontrada</div>';
        return;
    }

    // Cria um card para cada entrevista futura
    upcomingInterviews.forEach(interview => {
        const card = createInterviewListCard(interview);
        listContainer.appendChild(card);
    });
}

/**
 * Cria e retorna o elemento HTML de um card de entrevista para a vista em lista.
 *
 * Este card é mais completo que o card simples do dashboard, incluindo:
 *   - Ícone do tipo de entrevista (presencial/vídeo/telefone)
 *   - Status e tipo
 *   - Nome do candidato, vaga e pontuação (%)
 *   - Data, hora e entrevistador
 *   - Observações
 *   - Menu kebab com ações: Conduzir, Editar, Eliminar
 *
 * @param {Object} i - Objeto da entrevista com JOINs do Supabase
 * @returns {HTMLElement} Elemento <div> com o card completo
 */
function createInterviewListCard(i) {
    const card = document.createElement('div');
    card.className = 'interview-list-card';

    // ── Extração de dados dos JOINs ───────────────────────────────────────
    // O Supabase pode retornar os relacionamentos como array ou objeto
    const candidateObj = Array.isArray(i.candidatos) ? i.candidatos[0] : i.candidatos;
    const candName = candidateObj ? candidateObj.nome : 'Candidato Desconhecido';
    const score = candidateObj && candidateObj.nota != null ? Math.round(candidateObj.nota) : '--';

    const vagaObj = Array.isArray(i.Vagas) ? i.Vagas[0] : i.Vagas;
    const vagaName = vagaObj ? vagaObj.Titulo : 'Vaga não informada';

    const interviewerObj = Array.isArray(i.Entrevistador) ? i.Entrevistador[0] : i.Entrevistador;
    const interviewerName = interviewerObj ? interviewerObj.Nome : 'Não definido';

    // ── Ícone do tipo de entrevista ───────────────────────────────────────
    const type = i["Tipo de entrevista"] || 'Presencial';
    let typeIcon = 'fa-building'; // Presencial (padrão)
    if (type.toLowerCase().includes('video') || type.toLowerCase().includes('online')) typeIcon = 'fa-video';
    if (type.toLowerCase().includes('telefone')) typeIcon = 'fa-phone';

    const status = i.status || 'Agendada';
    const statusClass = status.toLowerCase().replace(/\s+/g, '-');
    const dateStr = i.Data ? formatarData(i.Data) : 'Sem data';
    const timeStr = i.Data ? i.Data.split('T')[1].substring(0, 5) : '--:--'; // Extrai HH:MM

    card.innerHTML = `
        <div class="ilc-header">
            <div class="ilc-status-icon ${statusClass}">
                <i class="fa-solid ${typeIcon}"></i>
            </div>
            <div class="ilc-status-text">
                <span class="ilc-status">${status}</span>
                <span class="ilc-type">${type}</span>
            </div>
            <!-- Menu kebab com ações -->
            <div class="kebab-menu-container">
                <button class="kebab-btn"><i class="fa-solid fa-ellipsis-vertical"></i></button>
                <div class="kebab-dropdown">

                    <button class="dropdown-item btn-conduzir"><i class="fa-solid fa-clipboard-question"></i> Conduzir</button>
                    <button class="dropdown-item btn-editar"><i class="fa-solid fa-pen"></i> Editar</button>
                    <button class="dropdown-item delete-btn btn-eliminar"><i class="fa-solid fa-trash-can"></i> Eliminar</button>
                </div>
            </div>
        </div>
        
        <div class="ilc-candidate">
            <div class="ilc-cand-info">
                <h4>${candName}</h4>
                <span>${vagaName}</span>
            </div>
            <div class="ilc-score">${score}%</div>
        </div>

        <div class="ilc-details">
            <div class="ilc-detail-item">
                <i class="fa-regular fa-calendar"></i>
                <span>${dateStr}</span>
                <i class="fa-regular fa-clock" style="margin-left:8px;"></i>
                <span>${timeStr}</span>
            </div>
            <div class="ilc-detail-item">
                <i class="fa-solid fa-user-group"></i>
                <span>${interviewerName}</span>
            </div>
        </div>

        <div class="ilc-observations">
            ${i.Observações || i.Observacoes || 'Sem observações adicionais'}
        </div>
    `;

    // ── Menu kebab do card ────────────────────────────────────────────────
    const kebab = card.querySelector('.kebab-btn');
    const dropdown = card.querySelector('.kebab-dropdown');
    if (kebab && dropdown) {
        kebab.onclick = (e) => {
            e.stopPropagation();
            // Fecha todos os outros dropdowns abertos
            document.querySelectorAll('.kebab-dropdown.show').forEach(d => {
                if (d !== dropdown) d.classList.remove('show');
            });
            dropdown.classList.toggle('show');
            kebab.classList.toggle('active');
        };
    }

    // ── Botões de ação do card ────────────────────────────────────────────
    const btnConduzir = card.querySelector('.btn-conduzir');
    const btnEditar = card.querySelector('.btn-editar');
    const btnEliminar = card.querySelector('.btn-eliminar');

    // Conduzir: abre o modal para avaliar o candidato
    if (btnConduzir) btnConduzir.onclick = () => openConduzirModal(i);
    // Editar: abre o modal pré-preenchido com os dados desta entrevista
    if (btnEditar) btnEditar.onclick = () => editInterview(i);
    // Eliminar: pede confirmação e elimina a entrevista
    if (btnEliminar) btnEliminar.onclick = () => deleteInterview(i.id);

    return card;
}

/**
 * Extrai o caminho do ficheiro no bucket curriculos a partir da URL pública.
 * @param {string} url - URL do currículo no Supabase Storage
 * @returns {string|null} Caminho relativo no bucket ou null
 */
function extrairCaminhoCurriculo(url) {
    if (!url || typeof url !== 'string') return null;
    const match = url.match(/\/curriculos\/(.+?)(?:\?|$)/);
    return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Remove o ficheiro do currículo no Storage e apaga o candidato e as suas entrevistas.
 * @param {number|string} candidatoId - ID do candidato
 * @param {string|null} urlCurriculo - URL pública do currículo (opcional)
 * @returns {Promise<boolean>} true se eliminou com sucesso
 */
async function eliminarCandidatoComCurriculo(candidatoId, urlCurriculo) {
    const caminho = extrairCaminhoCurriculo(urlCurriculo);
    if (caminho) {
        const { error: errStorage } = await supabaseClient.storage.from('curriculos').remove([caminho]);
        if (errStorage) console.error('Erro ao remover currículo:', errStorage);
    }

    const { error: errEntrevistas } = await supabaseClient
        .from('Entrevistas')
        .delete()
        .eq('Candidato_ID', candidatoId);

    if (errEntrevistas) {
        console.error('Erro ao eliminar entrevistas do candidato:', errEntrevistas);
        showNotification('Erro ao eliminar entrevistas associadas.', 'error');
        return false;
    }

    const { error: errDelCand } = await supabaseClient
        .from('candidatos')
        .delete()
        .eq('id', candidatoId);

    if (errDelCand) {
        console.error('Erro ao eliminar candidato:', errDelCand);
        showNotification('Erro ao eliminar candidato da base de dados.', 'error');
        return false;
    }

    return true;
}

/**
 * Abre o modal de agendamento pré-preenchido com os dados de uma entrevista
 * existente, para permitir a sua edição.
 *
 * Processo:
 *   1. Abre o modal e define o ID da entrevista no campo hidden
 *   2. Popula os dropdowns com os dados do BD
 *   3. Preenche cada campo com os valores atuais da entrevista
 *
 * @param {Object} i - Objeto da entrevista com JOINs do Supabase
 */
async function editInterview(i) {
    const modal = document.getElementById('agendamentoModal');
    if (!modal) return;

    modal.style.display = 'flex';
    document.getElementById('agendamentoId').value = i.id; // Indica modo de edição

    // Popula os dropdowns antes de preencher os valores
    await populateModalSelects();

    // Extrai os objetos dos JOINs (podem ser array ou objeto)
    const candidateObj = Array.isArray(i.candidatos) ? i.candidatos[0] : i.candidatos;
    const vagaObj = Array.isArray(i.Vagas) ? i.Vagas[0] : i.Vagas;

    // Preenche o dropdown de candidato
    if (candidateObj) {
        document.getElementById('searchCandidato').value = candidateObj.nome;
        document.getElementById('agCandidato').value = candidateObj.id;
    }
    // Preenche o dropdown de vaga
    if (vagaObj) {
        document.getElementById('searchVaga').value = vagaObj.Titulo;
        document.getElementById('agVaga').value = vagaObj.id;
    }

    document.getElementById('agTipo').value = i["Tipo de entrevista"] || 'Presencial';

    // Converte a data ISO para o formato "YYYY-MM-DDTHH:MM" aceite pelo input datetime-local
    if (i.Data) {
        const date = new Date(i.Data);
        const iso = date.toLocaleString('sv-SE', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit'
        }).replace(' ', 'T').substring(0, 16);
        document.getElementById('agDataHora').value = iso;
    }

    // Determina o ID do entrevistador (pode estar em campos diferentes)
    let interviewerId = '';
    if (i.Entrevistador_ID) {
        interviewerId = i.Entrevistador_ID;
    } else if (i.Entrevistador) {
        // Se veio como objeto do JOIN, usa o ID do objeto
        interviewerId = i.Entrevistador.id || i.Entrevistador;
    }

    document.getElementById('agEntrevistador').value = interviewerId;
    document.getElementById('agObs').value = i.Observação || i.Observacoes || '';
}

/**
 * Abre o modal de confirmação para eliminar uma entrevista da base de dados.
 *
 * @param {number} id - ID da entrevista a eliminar
 */
function deleteInterview(id) {
    const modal = document.getElementById('confirmDeleteInterviewModal');
    if (!modal) return;
    
    document.getElementById('idEntrevistaDelete').value = id;
    modal.style.display = 'flex';
}

/**
 * Navega para o mês anterior ou seguinte no calendário.
 * Atualiza a variável `currentDate` e recarrega o calendário e as entrevistas.
 *
 * @param {number} delta - -1 para mês anterior, +1 para próximo mês
 */
function changeMonth(delta) {
    currentDate.setMonth(currentDate.getMonth() + delta);
    renderCalendar(currentDate);
    fetchMonthInterviews(currentDate); // Recarrega as entrevistas para o novo mês
}

/**
 * Renderiza a grelha do calendário para um determinado mês.
 *
 * Estrutura do calendário:
 *   - Cabeçalho: "Janeiro 2025" com botões de navegação
 *   - Grelha: 7 colunas (Dom-Sáb) com os dias do mês
 *   - Dias do mês anterior/seguinte são mostrados com opacidade reduzida
 *   - O dia atual é marcado com a classe 'today'
 *   - O dia selecionado é marcado com a classe 'selected'
 *
 * @param {Date} date - Objeto Date representando o mês a renderizar
 */
function renderCalendar(date) {
    const year = date.getFullYear();
    const month = date.getMonth(); // 0-11

    // Atualiza o cabeçalho com o nome do mês e o ano
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const display = document.getElementById('currentMonthDisplay');
    if (display) display.textContent = `${monthNames[month]} ${year}`;

    const daysGrid = document.getElementById('calendarDaysGrid');
    if (!daysGrid) return;

    daysGrid.innerHTML = ''; // Limpa a grelha anterior

    // Calcula os limites do mês
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // Dia da semana do 1º dia (0=Dom)
    const daysInMonth = new Date(year, month + 1, 0).getDate(); // Número de dias no mês
    const daysInPrevMonth = new Date(year, month, 0).getDate(); // Dias no mês anterior

    // ── Dias do mês anterior (para preencher a primeira linha) ────────────
    // Começa do último dia do mês anterior e vai para trás
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        const dayCell = createDayCell(day, true, false); // isOtherMonth=true
        daysGrid.appendChild(dayCell);
    }

    // ── Dias do mês atual ─────────────────────────────────────────────────
    for (let i = 1; i <= daysInMonth; i++) {
        const isToday = i === new Date().getDate()
            && month === new Date().getMonth()
            && year === new Date().getFullYear();
        const isSelected = i === selectedDate.getDate()
            && month === selectedDate.getMonth()
            && year === selectedDate.getFullYear();
        const dayCell = createDayCell(i, false, isToday, isSelected, new Date(year, month, i));
        daysGrid.appendChild(dayCell);
    }

    // ── Dias do próximo mês (para completar a última linha) ───────────────
    const totalCells = daysGrid.children.length;
    const rowsNeeded = Math.ceil((daysInMonth + firstDayOfMonth) / 7); // Número de linhas necessárias
    const totalSlots = rowsNeeded * 7;
    const remainingParams = totalSlots - totalCells;

    for (let i = 1; i <= remainingParams; i++) {
        const dayCell = createDayCell(i, true, false); // isOtherMonth=true
        daysGrid.appendChild(dayCell);
    }

    // Adiciona os pontos coloridos nos dias que têm entrevistas
    updateCalendarDots();
}

/**
 * Cria e retorna o elemento HTML de uma célula de dia no calendário.
 *
 * Cada célula contém:
 *   - O número do dia
 *   - Um container para os pontos de eventos (preenchido por updateCalendarDots)
 *
 * Ao clicar num dia do mês atual, atualiza o painel lateral com as entrevistas desse dia.
 *
 * @param {number} day - Número do dia
 * @param {boolean} isOtherMonth - Se true, é um dia do mês anterior/seguinte (opacidade reduzida)
 * @param {boolean} isToday - Se true, aplica o estilo de "hoje"
 * @param {boolean} isSelected - Se true, aplica o estilo de "selecionado"
 * @param {Date|null} dateObj - Objeto Date do dia (null para dias de outros meses)
 * @returns {HTMLElement} Elemento <div> da célula do dia
 */
function createDayCell(day, isOtherMonth, isToday, isSelected = false, dateObj = null) {
    const el = document.createElement('div');
    el.className = `day-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`;

    // Apenas dias do mês atual são clicáveis
    if (!isOtherMonth && dateObj) {
        el.onclick = () => {
            selectedDate = dateObj; // Atualiza o dia selecionado
            // Remove a seleção de todos os dias e aplica ao clicado
            document.querySelectorAll('.day-cell').forEach(c => c.classList.remove('selected'));
            el.classList.add('selected');
            renderSidePanel(selectedDate); // Atualiza o painel lateral
        };
        // Guarda a data no atributo data-date para ser usado por updateCalendarDots
        el.setAttribute('data-date', getLocalIsoDate(dateObj)); // "YYYY-MM-DD"
    }

    el.innerHTML = `
    <div class="day-number">${day}</div>
    <div class="day-events-dots"></div>
  `;
    return el;
}

/**
 * Busca as entrevistas futuras do Supabase, atualiza a cache local
 * e re-renderiza o calendário, o painel lateral e os contadores.
 *
 * Esta função é chamada:
 *   - Na inicialização da página
 *   - Após agendar, editar ou eliminar uma entrevista
 *   - Ao navegar entre meses
 *
 * @param {Date} date - Mês de referência (usado para contexto)
 */
async function fetchMonthInterviews(date) {
    // Busca todas as entrevistas para permitir visualizar o histórico no calendário e painel lateral
    const { data, error } = await supabaseClient
        .from("Entrevistas")
        .select(`
      *,
      Vagas!inner(id, Titulo, status_vagas),
      candidatos(id, nome, nota, url_curriculo, perguntas_sugeridas),
      Entrevistador(id, Nome)
    `)
        .eq('Vagas.status_vagas', 'aberta')
        .order('Data', { ascending: true }); // Ordena por data crescente

    if (error) {
        console.error('Error fetching interviews', error);
        return;
    }

    // Atualiza a cache local com os dados mais recentes
    interviewsCache = data || [];

    // Atualiza todos os elementos visuais que dependem da cache
    updateCalendarDots();      // Pontos coloridos no calendário
    renderSidePanel(selectedDate); // Painel lateral do dia selecionado
    updateStatsCounters();     // Contadores de estatísticas (Hoje, Semana, etc.)

    // Se a vista em lista estiver ativa, atualiza-a também
    const listToggle = document.getElementById('viewList');
    if (listToggle && listToggle.classList.contains('active')) {
        renderListView();
    }
}

/**
 * Adiciona pontos coloridos nas células do calendário que têm entrevistas.
 *
 * Cada ponto representa uma entrevista nesse dia:
 *   - Ponto verde: entrevista presencial
 *   - Ponto azul: entrevista online/vídeo
 *
 * Máximo de 3 pontos por dia (para não sobrecarregar visualmente).
 * Usa os dados da cache `interviewsCache`.
 */
function updateCalendarDots() {
    // Limpa todos os pontos existentes antes de re-renderizar
    document.querySelectorAll('.day-events-dots').forEach(d => d.innerHTML = '');

    interviewsCache.forEach(interview => {
        if (!interview.Data) return;

        // Extrai apenas a parte da data "YYYY-MM-DD" para encontrar a célula correta
        const dateKey = interview.Data.split('T')[0];
        const cell = document.querySelector(`.day-cell[data-date="${dateKey}"]`);

        if (cell) {
            const dotsContainer = cell.querySelector('.day-events-dots');
            // Limita a 3 pontos por dia para não sobrecarregar visualmente
            if (dotsContainer.children.length < 3) {
                const dot = document.createElement('div');
                // Cor diferente para entrevistas online vs presenciais
                dot.className = `event-dot ${interview["Tipo de entrevista"] === 'Online' ? 'online' : 'presencial'}`;
                dotsContainer.appendChild(dot);
            }
        }
    });
}

/**
 * Renderiza as entrevistas do dia selecionado no painel lateral do calendário.
 *
 * Aplica os filtros ativos (tipo e status) antes de renderizar.
 * Se não houver entrevistas para o dia (após filtros), mostra mensagem vazia.
 *
 * @param {Date} date - O dia selecionado no calendário
 */
function renderSidePanel(date) {
    const dateKey = getLocalIsoDate(date); // "YYYY-MM-DD"
    const displayDate = date.toLocaleDateString('pt-AO', { day: 'numeric', month: 'long' });

    // Atualiza o título do painel lateral com a data selecionada
    const selectedDateDisplay = document.getElementById('selectedDateDisplay');
    if (selectedDateDisplay) selectedDateDisplay.textContent = displayDate;

    const listContainer = document.getElementById('dayEventsList');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    // Filtra as entrevistas da cache para o dia selecionado
    const dayInterviews = interviewsCache.filter(i => i.Data && i.Data.startsWith(dateKey));

    // ── Aplica os filtros ativos ───────────────────────────────────────────
    const filterType = document.getElementById('filterType');
    const filterStatus = document.getElementById('filterStatus');
    const typeFilterValue = filterType ? filterType.value : 'all';
    const statusFilterValue = filterStatus ? filterStatus.value : 'all';

    const filtered = dayInterviews.filter(i => {
        // Filtra por tipo (presencial, video, telefone)
        if (typeFilterValue !== 'all' && i["Tipo de entrevista"] &&
            i["Tipo de entrevista"].toLowerCase() !== typeFilterValue) return false;
        // Filtra por status (agendada, concluida)
        if (statusFilterValue !== 'all' && i.status &&
            i.status.toLowerCase() !== statusFilterValue) return false;
        return true;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = `<div class="empty-state-small">Nenhuma entrevista encontrada</div>`;
        return;
    }

    // Renderiza um mini-card para cada entrevista do dia no painel lateral
    filtered.forEach(i => {
        const time = i.Data.split('T')[1].substring(0, 5); // Extrai "HH:MM"
        const nomeCandidato = i.candidatos ? i.candidatos.nome : 'Candidato desconhecido';
        const nomeVaga = i.Vagas ? i.Vagas.Titulo : 'Vaga não informada';

        const card = document.createElement('div');
        card.className = 'side-event-card';
        card.innerHTML = `
           <div class="event-icon-box">
             <!-- Ícone diferente para online vs presencial -->
             <i class="fa-solid ${i["Tipo de entrevista"] === 'Online' ? 'fa-video' : 'fa-building'}"></i>
           </div>
           <div class="event-info">
             <div class="event-title">${nomeCandidato}</div>
             <div class="event-time">${time} - ${nomeVaga}</div>
             <div class="event-status-badge">${i.status}</div>
           </div>
           <button class="btn-icon-only btn-conduzir" style="margin-left: auto; cursor: pointer; color: var(--primary-color);" title="Conduzir Entrevista">
             <i class="fa-solid fa-clipboard-question"></i>
           </button>
        `;
        
        const btnConduzir = card.querySelector('.btn-conduzir');
        if (btnConduzir) {
            btnConduzir.onclick = (e) => {
                e.stopPropagation();
                openConduzirModal(i);
            };
        }
        
        listContainer.appendChild(card);
    });
}

/**
 * Calcula e atualiza os 4 contadores de estatísticas na página de Entrevistas.
 *
 * Contadores:
 *   - Hoje (#statHoje): entrevistas com data igual a hoje
 *   - Esta Semana (#statSemana): entrevistas entre segunda e domingo desta semana
 *   - Presenciais (#statPresenciais): entrevistas com tipo "Presencial"
 *   - Agendadas (#statPendentes): entrevistas com status "Agendada"
 *
 * Os valores são animados numericamente (de 0 até o valor final) pela função animateValue().
 * Usa os dados da cache `interviewsCache`.
 */
function updateStatsCounters() {
    const today = new Date();
    const todayStr = getLocalIsoDate(today); // "YYYY-MM-DD"

    // Calcula o início da semana (segunda-feira)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Dia da semana: 0=Dom, 1=Seg...
    const startOfWeekStr = getLocalIsoDate(startOfWeek);

    // Calcula o fim da semana (domingo)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const endOfWeekStr = getLocalIsoDate(endOfWeek);

    // Calcula cada contador a partir da cache
    const countToday = interviewsCache.filter(i => i.Data && i.Data.startsWith(todayStr)).length;
    
    const countWeek = interviewsCache.filter(i => {
        if (!i.Data) return false;
        const dateStr = i.Data.substring(0, 10); // "YYYY-MM-DD"
        return dateStr >= startOfWeekStr && dateStr <= endOfWeekStr;
    }).length;

    // Extrai apenas as entrevistas futuras para calcular os outros cards
    const upcomingInterviews = interviewsCache.filter(i => {
        if (!i.Data) return false;
        const dateStr = i.Data.substring(0, 10);
        return dateStr >= todayStr;
    });

    const countPending = upcomingInterviews.filter(i => i.status === 'Agendada').length;
    const countPresencial = upcomingInterviews.filter(i => i["Tipo de entrevista"] === 'Presencial').length;

    // Anima cada contador de 0 até o valor calculado (duração: 1 segundo)
    animateValue("statHoje", 0, countToday, 1000);
    animateValue("statSemana", 0, countWeek, 1000);
    animateValue("statPresenciais", 0, countPresencial, 1000);
    animateValue("statPendentes", 0, countPending, 1000);
}

/**
 * Anima numericamente o conteúdo de um elemento HTML de um valor inicial até um valor final.
 * Cria um efeito de "contador a subir" muito comum em dashboards.
 *
 * Exemplo: animateValue("statHoje", 0, 5, 1000)
 *   → O elemento #statHoje vai de 0 para 5 em 1 segundo
 *
 * @param {string} id - ID do elemento HTML a animar
 * @param {number} start - Valor inicial (normalmente 0)
 * @param {number} end - Valor final (o número real)
 * @param {number} duration - Duração total da animação em milissegundos
 */
function animateValue(id, start, end, duration) {
    if (start === end) return; // Sem animação se os valores forem iguais

    const range = end - start;
    let current = start;
    const increment = end > start ? 1 : -1; // Sobe ou desce
    const stepTime = Math.abs(Math.floor(duration / range)); // Tempo entre cada incremento

    const obj = document.getElementById(id);
    if (!obj) return;

    // Usa setInterval para incrementar o valor a cada `stepTime` milissegundos
    const timer = setInterval(function () {
        current += increment;
        obj.innerHTML = current;
        if (current == end) {
            clearInterval(timer); // Para a animação quando chega ao valor final
        }
    }, stepTime);
}

// ── Auto-inicialização ────────────────────────────────────────────────────────
// Quando o DOM estiver pronto, verifica em que página estamos e inicializa
// os componentes apropriados.
document.addEventListener('DOMContentLoaded', () => {
    // Se estivermos na página de Entrevistas (tem a classe .main-entrevistas),
    // inicializa o calendário completo
    if (document.querySelector('.main-entrevistas')) {
        initCalendarPage();
    }

    // O modal de agendamento também existe no Pipeline.html, por isso é sempre
    // configurado (setupAgendamentoModal verifica internamente se os elementos existem)
    setupAgendamentoModal();
    
    // Configura os modais de confirmação
    setupConfirmModals();
});

/**
 * Configura os event listeners para os modais de confirmação de status e exclusão.
 */
function setupConfirmModals() {
    // --- Modal Exclusão ---
    const deleteModal = document.getElementById('confirmDeleteInterviewModal');
    if (deleteModal) {
        document.getElementById('cancelarDeleteInterview').addEventListener('click', () => {
            deleteModal.style.display = 'none';
        });
        document.getElementById('confirmarDeleteInterview').addEventListener('click', async () => {
            const id = document.getElementById('idEntrevistaDelete').value;
            
            if (id) {
                const { error } = await supabaseClient
                    .from('Entrevistas')
                    .delete()
                    .eq('id', id);

                if (error) {
                    showNotification('Erro ao eliminar entrevista: ' + error.message, 'error');
                } else {
                    showNotification('Entrevista eliminada com sucesso.', 'success');
                    fetchMonthInterviews(currentDate);
                }
                deleteModal.style.display = 'none';
            }
        });
        window.addEventListener('click', (e) => {
            if (e.target === deleteModal) deleteModal.style.display = 'none';
        });
    }
}

// ============================================
// LÓGICA DO MODAL CONDUZIR ENTREVISTA
// ============================================

/**
 * Abre o modal de condução de entrevista, carregando o PDF do candidato
 * e as perguntas sugeridas pela IA.
 */
function openConduzirModal(interview) {
    const modal = document.getElementById('conduzirEntrevistaModal');
    if (!modal) return;

    // Extrai dados do candidato e da vaga
    const candidateObj = Array.isArray(interview.candidatos) ? interview.candidatos[0] : interview.candidatos;
    const candName = candidateObj ? candidateObj.nome : 'Candidato Desconhecido';
    const candId = candidateObj ? candidateObj.id : null;
    
    const vagaObj = Array.isArray(interview.Vagas) ? interview.Vagas[0] : interview.Vagas;
    const vagaName = vagaObj ? vagaObj.Titulo : 'Vaga não informada';

    // Preenche cabeçalho
    document.getElementById('conduzirNomeCandidato').textContent = candName;
    document.getElementById('conduzirNomeVaga').textContent = vagaName;
    
    // IDs ocultos
    document.getElementById('conduzirEntrevistaId').value = interview.id;
    document.getElementById('conduzirCandidatoId').value = candId;
    document.getElementById('conduzirUrlCurriculo').value =
        (candidateObj && candidateObj.url_curriculo) ? candidateObj.url_curriculo : '';

    // Carrega currículo no iframe
    const iframe = document.getElementById('iframeCurriculo');
    const noCurriculoMsg = document.getElementById('noCurriculoMsg');
    if (candidateObj && candidateObj.url_curriculo) {
        iframe.src = candidateObj.url_curriculo;
        iframe.style.display = 'block';
        noCurriculoMsg.style.display = 'none';
    } else {
        iframe.src = '';
        iframe.style.display = 'none';
        noCurriculoMsg.style.display = 'flex';
    }

    // Carrega perguntas sugeridas
    const listaPerguntas = document.getElementById('listaPerguntasSugeridas');
    listaPerguntas.innerHTML = '';
    
    if (candidateObj && candidateObj.perguntas_sugeridas && Array.isArray(candidateObj.perguntas_sugeridas) && candidateObj.perguntas_sugeridas.length > 0) {
        candidateObj.perguntas_sugeridas.forEach(pergunta => {
            const li = document.createElement('li');
            li.textContent = pergunta;
            listaPerguntas.appendChild(li);
        });
    } else {
        const li = document.createElement('li');
        li.textContent = 'Nenhuma pergunta sugerida pela IA encontrada para este candidato.';
        li.style.color = 'var(--text-muted)';
        listaPerguntas.appendChild(li);
    }

    // Limpa formulário de avaliação
    document.getElementById('formAvaliacaoEntrevista').reset();

    // Eventos de fechar
    const closeBtn = document.getElementById('fecharConduzirModal');
    const cancelBtn = document.getElementById('cancelarConduzir');
    
    const closeModal = () => modal.style.display = 'none';
    if (closeBtn) closeBtn.onclick = closeModal;
    if (cancelBtn) cancelBtn.onclick = closeModal;

    modal.style.display = 'flex';
}

// Configura o submit do formulário de avaliação
document.addEventListener('DOMContentLoaded', () => {
    const formAvaliacao = document.getElementById('formAvaliacaoEntrevista');
    if (formAvaliacao) {
        formAvaliacao.onsubmit = async (e) => {
            e.preventDefault();
            
            const entrevistaId = document.getElementById('conduzirEntrevistaId').value;
            const candidatoId = document.getElementById('conduzirCandidatoId').value;
            
            const notaTecnica = document.getElementById('notaTecnica').value;
            const notaComunicacao = document.getElementById('notaComunicacao').value;
            const notas = document.getElementById('notasEntrevistador').value;
            const decisao = document.getElementById('decisaoFinal').value;
            
            if (!decisao) {
                showNotification('Por favor, selecione uma decisão final.', 'error');
                return;
            }

            const notasEntrevistaObj = {
                tecnica: parseInt(notaTecnica),
                comunicacao: parseInt(notaComunicacao),
                notas_gerais: notas
            };

            // Atualiza Entrevista
            const { error: errorEntrevista } = await supabaseClient
                .from('Entrevistas')
                .update({ 
                    notas_entrevista: notasEntrevistaObj,
                    decisao_final: decisao,
                    status: 'Concluída' // Marca como concluída
                })
                .eq('id', entrevistaId);

            if (errorEntrevista) {
                console.error('Erro ao salvar avaliação:', errorEntrevista);
                showNotification('Erro ao salvar avaliação.', 'error');
                return;
            }

            // Atualiza Candidato baseado na decisão
            let novoStatusCandidato = null;
            if (decisao === 'Passar') novoStatusCandidato = 'Oferta enviada';
            else if (decisao === 'Guardar') novoStatusCandidato = 'Entrevista feita';
            
            if (decisao === 'Reprovar') {
                const urlCurriculo = document.getElementById('conduzirUrlCurriculo').value || '';
                const ok = await eliminarCandidatoComCurriculo(candidatoId, urlCurriculo);
                if (!ok) return;
            } else if (novoStatusCandidato) {
                const { error: errorCand } = await supabaseClient
                    .from('candidatos')
                    .update({ status: novoStatusCandidato })
                    .eq('id', candidatoId);
                    
                if (errorCand) {
                    console.error('Erro ao atualizar status do candidato:', errorCand);
                }
            }

            const msgSucesso = decisao === 'Reprovar'
                ? 'Candidato e currículo eliminados com sucesso.'
                : decisao === 'Guardar'
                    ? 'Avaliação guardada. Candidato movido para Entrevista feita.'
                    : 'Avaliação guardada. Candidato avançou no pipeline.';
            showNotification(msgSucesso, 'success');
            document.getElementById('conduzirEntrevistaModal').style.display = 'none';
            
            // Recarrega os dados locais
            fetchMonthInterviews(currentDate);
            
            // Dispara evento para o pipeline atualizar
            window.dispatchEvent(new CustomEvent('interview-concluded', { detail: { candidatoId } }));
        };
    }
});
