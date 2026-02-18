/**
 * pipeline.js
 * ─────────────────────────────────────────────────────────────
 * Módulo responsável por toda a lógica do Pipeline de Recrutamento (Pipeline.html).
 *
 * O Pipeline é um quadro Kanban com 6 colunas que representam as etapas
 * do processo seletivo. Os candidatos são exibidos como cards e podem
 * ser movidos entre colunas por drag-and-drop.
 *
 * Colunas do Pipeline (em ordem):
 *   1. Aplicado          → Candidato acabou de se candidatar
 *   2. Triagem           → Em processo de triagem inicial
 *   3. Entrevista técnica→ Entrevista técnica agendada/realizada
 *   4. Adequação à cultura → Avaliação cultural
 *   5. Oferta enviada    → Proposta de emprego enviada
 *   6. Contratado        → Candidato contratado
 *
 * Funcionalidades principais:
 *   - Drag-and-drop entre colunas (atualiza o status no BD automaticamente)
 *   - Ao mover para "Entrevista técnica", abre o modal de agendamento
 *   - Menu kebab em cada card: Ver Perfil, Agendar Entrevista, Rejeitar
 *   - Filtro por vaga (select no cabeçalho)
 *   - Resumo no rodapé com contagem por etapa + rejeitados
 *
 * Funções principais:
 *   - carregarPipeline()          → Carrega candidatos e renderiza o quadro Kanban
 *   - criarCardPipeline()         → Cria o HTML de um card de candidato no pipeline
 *   - configurarDragAndDrop()     → Configura os eventos de drag-and-drop nas colunas
 *   - atualizarStatusCandidato()  → Atualiza o status do candidato no Supabase
 *   - recalcularContadores()      → Recalcula e atualiza as contagens das colunas
 *   - rejeitarCandidato()         → Muda o status para "Rejeitado" no Supabase
 *
 * Tabelas Supabase utilizadas:
 *   - candidatos → Dados dos candidatos (nome, status, nota, Capacidades, etc.)
 *   - Vagas      → Dados das vagas (id, Titulo, data_abertura)
 * ─────────────────────────────────────────────────────────────
 */

/**
 * Carrega todos os candidatos e vagas do Supabase e renderiza o quadro Kanban.
 *
 * Processo:
 *   1. Busca todos os candidatos da tabela "candidatos"
 *   2. Busca todas as vagas para criar mapas de lookup (por ID e por título)
 *   3. Popula o select de filtro por vaga (apenas na primeira carga)
 *   4. Limpa as colunas do pipeline
 *   5. Para cada candidato (não rejeitado e que passa o filtro de vaga),
 *      determina a coluna correta pelo seu status e cria o card
 *   6. Atualiza os contadores das colunas e do resumo no rodapé
 *   7. Configura o drag-and-drop
 *
 * O mapeamento de status para coluna é feito pelo objeto `mapStatusToColumn`.
 */
async function carregarPipeline() {
    // Mapeamento: status do candidato → número da coluna (1-6)
    const mapStatusToColumn = {
        'Aplicado': 1,
        'Triagem': 2,
        'Entrevista técnica': 3,
        'Adequação à cultura': 4,
        'Oferta enviada': 5,
        'Contratado': 6
    };

    // Busca todos os candidatos sem filtro
    const { data: candidatos, error } = await supabaseClient
        .from("candidatos")
        .select("*");

    if (error) {
        console.error("Erro ao buscar candidatos:", error);
        return;
    }

    // Busca as vagas para criar os mapas de lookup
    const { data: vagas } = await supabaseClient
        .from("Vagas")
        .select("id, Titulo, data_abertura");

    // Mapas para acesso rápido às vagas:
    const mapaVagas = {};          // { id: Titulo }
    const mapaVagasPorTitulo = {}; // { Titulo: vagaObj } — usado para buscar por título

    const filtroSelect = document.getElementById('filtroVaga');

    // Preserva a seleção atual do filtro antes de re-renderizar
    const filtroAtual = filtroSelect ? filtroSelect.value : 'todos';

    if (vagas) {
        vagas.forEach(v => {
            mapaVagas[v.id] = v.Titulo;
            mapaVagasPorTitulo[v.Titulo] = v;
        });

        // Popula o select de filtro apenas se estiver vazio (evita duplicar opções)
        if (filtroSelect && filtroSelect.options.length <= 1) {
            vagas.forEach(v => {
                const option = document.createElement('option');
                option.value = v.Titulo; // Usa o título como valor (para comparar com vaga_sugerida)
                option.textContent = v.Titulo;
                filtroSelect.appendChild(option);
            });

            // Quando o filtro muda, recarrega o pipeline inteiro
            filtroSelect.onchange = carregarPipeline;
        }
    }

    // Restaura a seleção do filtro após re-popular o select
    if (filtroSelect) filtroSelect.value = filtroAtual;

    // ── Limpa o conteúdo de todas as colunas ─────────────────────────────
    for (let i = 1; i <= 6; i++) {
        const colBody = document.querySelector(`.pipeline-column-${i} .pipeline-column-body`);
        if (colBody) colBody.innerHTML = '';
        const colCount = document.querySelector(`.pipeline-column-${i} .pipeline-column-count`);
        if (colCount) colCount.textContent = '0';
    }
    // Reseta também os contadores do resumo no rodapé
    document.querySelectorAll('.pipeline-summary-count').forEach(el => el.textContent = '0');

    // Contadores por coluna para atualizar os badges e o resumo
    const contadores = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    let countRejeitados = 0;

    // ── Processa cada candidato ───────────────────────────────────────────
    for (const candidato of candidatos) {
        // ── Filtro por vaga ───────────────────────────────────────────────
        // Se o filtro não for "todos", ignora candidatos de outras vagas
        if (filtroAtual !== 'todos' && String(candidato.vaga_sugerida) !== String(filtroAtual)) {
            continue;
        }

        // Candidatos rejeitados não aparecem nas colunas, apenas no contador de rejeitados
        if (candidato.status === 'Rejeitado') {
            countRejeitados++;
            continue;
        }

        // Normaliza o status para encontrar a coluna correta
        // Se o status não existir no mapa, usa "Aplicado" como padrão
        let status = candidato.status ? candidato.status.toLowerCase().trim() : 'Aplicado';
        if (!mapStatusToColumn[status]) status = 'Aplicado';

        const colIndex = mapStatusToColumn[status];
        const colBody = document.querySelector(`.pipeline-column-${colIndex} .pipeline-column-body`);

        if (colBody) {
            // Busca os dados da vaga pelo título (campo vaga_sugerida do candidato)
            const vagaObj = candidato.vaga_sugerida ? mapaVagasPorTitulo[candidato.vaga_sugerida] : null;
            const nomeVaga = vagaObj ? vagaObj.Titulo : (candidato.vaga_sugerida || 'Geral');

            // Cria o card e adiciona à coluna correta
            const card = criarCardPipeline(candidato, nomeVaga, vagaObj);
            colBody.appendChild(card);
            contadores[colIndex]++;
        }
    }

    // ── Atualiza os contadores das colunas e do resumo ────────────────────
    for (let i = 1; i <= 6; i++) {
        // Badge de contagem no cabeçalho de cada coluna
        const colCount = document.querySelector(`.pipeline-column-${i} .pipeline-column-count`);
        if (colCount) colCount.textContent = contadores[i];

        // Cards de resumo no rodapé (mesma ordem das colunas)
        const summaryCounts = document.querySelectorAll('.pipeline-summary-count');
        if (summaryCounts[i - 1]) summaryCounts[i - 1].textContent = contadores[i];
    }

    // Atualiza o contador de rejeitados no rodapé (card especial em vermelho)
    const rejectedCountEl = document.getElementById('count-rejeitados');
    if (rejectedCountEl) rejectedCountEl.textContent = countRejeitados;

    // Configura o drag-and-drop após renderizar todos os cards
    configurarDragAndDrop();
}

// Quando uma entrevista é agendada com sucesso (evento emitido por entrevistas.js),
// recarrega o pipeline para refletir a mudança de status do candidato
window.addEventListener('interview-scheduled', () => {
    carregarPipeline();
});

/**
 * Cria e retorna o elemento HTML de um card de candidato para o pipeline.
 *
 * O card contém:
 *   - Ícone de drag (⠿) para indicar que é arrastável
 *   - Nome do candidato
 *   - Menu kebab (⋮) com: Ver Perfil, Agendar Entrevista, Rejeitar
 *   - Barra de progresso com a pontuação de compatibilidade (colorida)
 *   - Vaga a que se candidatou
 *   - Tags com as primeiras 3 capacidades
 *
 * O card é configurado como draggable=true para suportar drag-and-drop.
 * O dataset.id e dataset.status são usados pelo sistema de drag-and-drop.
 *
 * @param {Object} candidato - Objeto com os dados do candidato do Supabase
 * @param {string} nomeVaga - Nome da vaga a exibir no card
 * @param {Object|null} vagaObj - Objeto completo da vaga (para passar ao modal)
 * @returns {HTMLElement} Elemento <div> do card do pipeline
 */
function criarCardPipeline(candidato, nomeVaga, vagaObj) {
    const card = document.createElement('div');
    card.className = 'pipeline-card';
    card.draggable = true;          // Habilita o drag-and-drop HTML5
    card.dataset.id = candidato.id; // ID usado pelo drag-and-drop para identificar o candidato
    card.dataset.status = candidato.status || 'Aplicado'; // Status atual (para reverter se necessário)

    // ── Processamento das Capacidades ────────────────────────────────────
    let skills = [];
    try {
        if (Array.isArray(candidato.Capacidades)) skills = candidato.Capacidades;
        else if (candidato.Capacidades) skills = JSON.parse(candidato.Capacidades);
    } catch (e) { skills = []; }

    // Mostra apenas as 3 primeiras capacidades como tags
    const topSkills = skills.slice(0, 3).map(s => `<span class="skill-tag">${s}</span>`).join('');

    // ── Cálculo da barra de pontuação ────────────────────────────────────
    const nota = parseFloat(candidato.nota) || 0;
    const matchScore = nota > 100 ? 100 : (nota < 0 ? 0 : nota); // Limita entre 0 e 100
    const corBarra = getCorPorPontuacao(matchScore); // Verde/Amarelo/Vermelho

    // ── HTML do card ──────────────────────────────────────────────────────
    card.innerHTML = `
    <div class="pipeline-card-header" style="justify-content: space-between;">
      <div style="display:flex; align-items:center;">
          <!-- Ícone de drag (cursor grab) para indicar que o card é arrastável -->
          <div class="pipeline-card-menu" style="cursor: grab; margin-right:8px;"><i class="fa-solid fa-grip-vertical"></i></div>
          <div class="pipeline-card-name">${candidato.nome || 'Sem Nome'}</div>
      </div>
      <!-- Menu kebab com ações do candidato -->
      <div class="kebab-menu-container">
        <button type="button" class="kebab-btn" data-id="${candidato.id}"><i class="fa-solid fa-ellipsis"></i></button>
        <div id="pipeline-menu-${candidato.id}" class="kebab-dropdown">
            <button class="dropdown-item" data-id="${candidato.id}"><i class="fa-regular fa-eye"></i> Ver Perfil</button>
            <button class="dropdown-item" data-id="${candidato.id}"><i class="fa-regular fa-calendar-plus"></i> Agendar Entrevista</button>
            <button class="dropdown-item delete-btn" data-id="${candidato.id}"><i class="fa-regular fa-circle-xmark"></i> Rejeitar</button>
        </div>
      </div>
    </div>
    
    <!-- Barra de pontuação de compatibilidade com a vaga -->
    <div class="pipeline-match-score">
      <div class="match-score-label">
        <span>Pontuação de Compatibilidade</span>
        <span class="match-score-value" style="color: ${corBarra};">${Math.round(matchScore)}%</span>
      </div>
      <div class="progress-bar-container">
        <div class="progress-bar-fill" style="width: ${matchScore}%; background: ${corBarra};"></div>
      </div>
    </div>

    <div class="pipeline-applied-for">
      Candidatou-se a: <strong>${nomeVaga}</strong>
    </div>

    <div class="pipeline-card-skills">
      ${topSkills}
    </div>
  `;

    // ── Configura o menu kebab do card ────────────────────────────────────
    const kebabBtn = card.querySelector('.kebab-btn');
    const dropdown = card.querySelector('.kebab-dropdown');

    if (kebabBtn && dropdown) {
        kebabBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Impede que o clique inicie o drag
            e.preventDefault();

            // Fecha todos os outros menus kebab abertos no pipeline
            document.querySelectorAll('.kebab-dropdown.show').forEach(m => {
                if (m !== dropdown) {
                    m.classList.remove('show');
                    // Remove o estilo de card ativo do card pai
                    const parentCard = m.closest('.pipeline-card');
                    if (parentCard) parentCard.classList.remove('active-card');
                }
            });
            document.querySelectorAll('.kebab-btn.active').forEach(b => {
                if (b !== kebabBtn) b.classList.remove('active');
            });

            // Alterna o estado do menu deste card
            dropdown.classList.toggle('show');
            kebabBtn.classList.toggle('active');

            // Eleva o z-index do card para o dropdown não ficar por baixo de outros cards
            card.classList.toggle('active-card');
        });
    }

    // ── Configura os botões dentro do dropdown ────────────────────────────
    // Impede que cliques no dropdown iniciem o drag do card
    if (dropdown) {
        dropdown.addEventListener('mousedown', (e) => e.stopPropagation());

        dropdown.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();

                // Fecha o menu após clicar numa opção
                dropdown.classList.remove('show');
                kebabBtn.classList.remove('active');
                card.classList.remove('active-card');

                const actionText = btn.textContent.trim();

                if (actionText.includes('Ver Perfil')) {
                    // Abre o modal de detalhes do candidato (definido em candidatos.js)
                    if (typeof abrirModalDetalhes === 'function') {
                        abrirModalDetalhes(candidato, vagaObj);
                    }

                } else if (actionText.includes('Agendar Entrevista')) {
                    // Abre o modal de agendamento pré-preenchido com o candidato e vaga
                    const modal = document.getElementById('agendamentoModal');
                    if (modal) {
                        modal.style.display = 'flex';
                        if (typeof populateModalSelects === 'function') {
                            await populateModalSelects(); // Carrega os dropdowns
                        }

                        // Pré-preenche o campo de candidato
                        const input = document.getElementById('searchCandidato');
                        const hidden = document.getElementById('agCandidato');
                        if (input && hidden) {
                            input.value = candidato.nome || '';
                            hidden.value = candidato.id;
                        }

                        // Pré-preenche o campo de vaga (se o candidato tiver vaga associada)
                        if (vagaObj) {
                            const inputV = document.getElementById('searchVaga');
                            const hiddenV = document.getElementById('agVaga');
                            if (inputV && hiddenV) {
                                inputV.value = vagaObj.Titulo || '';
                                hiddenV.value = vagaObj.id || '';
                            }
                        }
                    }

                } else if (actionText.includes('Rejeitar')) {
                    // Abre o modal de confirmação de rejeição
                    // O ID do candidato é guardado num input hidden para ser usado na confirmação
                    const modal = document.getElementById('confirmRejeicaoModal');
                    const inputId = document.getElementById('idCandidatoRejeicao');
                    if (modal && inputId) {
                        inputId.value = candidato.id;
                        modal.style.display = 'flex';
                    }
                }
            });
        });
    }

    // ── Eventos de Drag-and-Drop ──────────────────────────────────────────

    // Quando o drag começa: guarda o ID do candidato e esconde o card original
    card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', candidato.id); // Passa o ID para o drop handler
        e.dataTransfer.effectAllowed = 'move';
        card.classList.add('dragging');
        // Esconde o card após um pequeno delay (para o browser capturar a imagem de drag)
        setTimeout(() => { card.style.display = 'none'; }, 0);
    });

    // Quando o drag termina (com ou sem drop): restaura a visibilidade do card
    card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        card.style.display = 'block';
        // Remove o estilo de "drag-over" de todas as colunas
        document.querySelectorAll('.pipeline-column-body').forEach(c => c.classList.remove('drag-over'));
    });

    return card;
}

/**
 * Configura os eventos de drag-and-drop em todas as colunas do pipeline.
 *
 * Eventos configurados em cada coluna:
 *   - dragover: permite o drop e adiciona estilo visual de "zona de drop"
 *   - dragleave: remove o estilo visual quando o card sai da coluna
 *   - drop: processa o drop do card
 *
 * Lógica especial para a coluna "Entrevista técnica":
 *   Ao soltar um card nesta coluna, em vez de atualizar o status diretamente,
 *   abre o modal de agendamento de entrevista. Se o utilizador cancelar,
 *   o card é revertido para a coluna original. Se confirmar, o status é
 *   atualizado automaticamente pelo handleAgendamentoSubmit() em entrevistas.js.
 */
function configurarDragAndDrop() {
    const columns = document.querySelectorAll('.pipeline-column-body');

    columns.forEach(column => {
        // Permite que a coluna receba drops e adiciona estilo visual
        column.addEventListener('dragover', (e) => {
            e.preventDefault(); // Necessário para permitir o drop
            e.dataTransfer.dropEffect = 'move';
            column.classList.add('drag-over'); // Estilo visual de "zona ativa"
        });

        // Remove o estilo quando o card sai da coluna sem fazer drop
        column.addEventListener('dragleave', () => {
            column.classList.remove('drag-over');
        });

        // Processa o drop do card na coluna
        column.addEventListener('drop', async (e) => {
            e.preventDefault();
            column.classList.remove('drag-over');

            // Obtém o ID do candidato que foi arrastado
            const cardId = e.dataTransfer.getData('text/plain');
            const card = document.querySelector(`.pipeline-card[data-id="${cardId}"]`);

            if (card) {
                // Obtém o título da coluna de destino (para determinar o novo status)
                const parentColumn = column.parentElement;
                const novoStatusTitulo = parentColumn.querySelector('h3').textContent.trim();

                card.style.display = 'block'; // Torna o card visível novamente
                column.appendChild(card);     // Move o card para a nova coluna visualmente

                // ── Caso especial: Entrevista técnica ─────────────────────
                // Ao mover para esta coluna, abre o modal de agendamento.
                // Se o utilizador cancelar, o card volta para a coluna original.
                if (novoStatusTitulo === 'Entrevista técnica') {
                    column.appendChild(card);
                    recalcularContadores(); // Atualiza contadores visualmente

                    const modal = document.getElementById('agendamentoModal');
                    if (modal) {
                        modal.style.display = 'flex';

                        // Popula os dropdowns do modal
                        if (typeof populateModalSelects === 'function') {
                            await populateModalSelects();
                        }

                        // Pré-preenche o candidato no modal
                        const candidateName = card.querySelector('.pipeline-card-name').textContent;
                        const input = document.getElementById('searchCandidato');
                        const hidden = document.getElementById('agCandidato');

                        if (input && hidden) {
                            input.value = candidateName;
                            hidden.value = cardId;
                            input.dispatchEvent(new Event('input')); // Atualiza o dropdown de pesquisa
                        }

                        // ── Lógica de reversão ────────────────────────────
                        // Guarda o status anterior para poder reverter o card
                        // se o utilizador cancelar o agendamento
                        const oldStatus = card.dataset.status;
                        const mapStatusToColumn = {
                            'Aplicado': 1, 'Triagem': 2, 'Entrevista técnica': 3,
                            'Adequação à cultura': 4, 'Oferta enviada': 5, 'Contratado': 6
                        };
                        const oldColIndex = mapStatusToColumn[oldStatus] || 1;
                        const revertTarget = document.querySelector(`.pipeline-column-${oldColIndex} .pipeline-column-body`);

                        // Função de limpeza: remove todos os listeners temporários
                        const cleanup = () => {
                            window.removeEventListener('interview-scheduled', onSuccess);
                            if (btnClose) btnClose.removeEventListener('click', onRevert);
                            if (btnCancel) btnCancel.removeEventListener('click', onRevert);
                            window.removeEventListener('click', onOutside);
                        };

                        // Se a entrevista foi agendada com sucesso: atualiza o dataset do card
                        const onSuccess = () => {
                            card.dataset.status = 'Entrevista técnica';
                            cleanup();
                        };

                        // Se o utilizador cancelou: reverte o card para a coluna original
                        const onRevert = () => {
                            if (revertTarget) {
                                revertTarget.appendChild(card); // Move de volta
                                recalcularContadores();
                            }
                            cleanup();
                        };

                        // Fecha ao clicar fora do modal → reverte
                        const onOutside = (e) => {
                            if (e.target === modal) onRevert();
                        };

                        // Adiciona listeners temporários para os botões de fechar/cancelar
                        const btnClose = document.getElementById('closeAgendamentoModal');
                        const btnCancel = document.getElementById('cancelAgendamento');

                        window.addEventListener('interview-scheduled', onSuccess);
                        if (btnClose) btnClose.addEventListener('click', onRevert);
                        if (btnCancel) btnCancel.addEventListener('click', onRevert);
                        window.addEventListener('click', onOutside);
                    }
                } else {
                    // ── Fluxo normal para todas as outras colunas ─────────
                    // Atualiza o status no Supabase e recalcula os contadores
                    await atualizarStatusCandidato(cardId, novoStatusTitulo);
                    recalcularContadores();
                }
            }
        });
    });
}

/**
 * Atualiza o campo `status` de um candidato na tabela "candidatos" do Supabase.
 * Chamada quando um card é solto numa nova coluna do pipeline.
 *
 * Se houver erro, recarrega o pipeline inteiro para garantir consistência visual.
 *
 * @param {string|number} id - ID do candidato a atualizar
 * @param {string} novoStatus - Novo status (ex: "Triagem", "Contratado")
 */
async function atualizarStatusCandidato(id, novoStatus) {
    const { error } = await supabaseClient
        .from('candidatos')
        .update({ status: novoStatus })
        .eq('id', id);

    if (error) {
        console.error('Erro ao atualizar status:', error);
        alert('Erro ao mover candidato.');
        carregarPipeline(); // Recarrega para reverter a mudança visual em caso de erro
    }
}

/**
 * Recalcula e atualiza os contadores de candidatos em cada coluna do pipeline.
 *
 * Conta os filhos diretos de cada `.pipeline-column-body` para obter
 * o número atual de cards em cada coluna. Atualiza tanto os badges
 * das colunas como os cards de resumo no rodapé.
 *
 * Chamada após operações de drag-and-drop para manter os contadores sincronizados
 * sem precisar de recarregar dados do BD.
 */
function recalcularContadores() {
    for (let i = 1; i <= 6; i++) {
        const colBody = document.querySelector(`.pipeline-column-${i} .pipeline-column-body`);
        const count = colBody ? colBody.children.length : 0; // Conta os cards na coluna

        // Atualiza o badge de contagem no cabeçalho da coluna
        const colCount = document.querySelector(`.pipeline-column-${i} .pipeline-column-count`);
        if (colCount) colCount.textContent = count;

        // Atualiza o card de resumo correspondente no rodapé
        const summaryCounts = document.querySelectorAll('.pipeline-summary-count');
        if (summaryCounts[i - 1]) summaryCounts[i - 1].textContent = count;
    }
}

// ── Fecha menus kebab ao clicar fora deles ────────────────────────────────────
// Listener global que fecha qualquer menu dropdown aberto quando o utilizador
// clica em qualquer área fora de um `.kebab-menu-container`
document.addEventListener('click', (e) => {
    if (!e.target.closest('.kebab-menu-container')) {
        document.querySelectorAll('.kebab-dropdown.show').forEach(m => {
            m.classList.remove('show');
            // Remove também o estilo de card ativo
            const parentCard = m.closest('.pipeline-card');
            if (parentCard) parentCard.classList.remove('active-card');
        });
        document.querySelectorAll('.kebab-btn.active').forEach(b => b.classList.remove('active'));
    }
});

// ── Setup do modal de confirmação de rejeição ─────────────────────────────────
// Configura os botões "Cancelar" e "Confirmar" do modal de rejeição (#confirmRejeicaoModal).
// Este modal é partilhado entre Pipeline.html e Candidatos.html.
document.addEventListener('DOMContentLoaded', () => {
    const modalRejeicao = document.getElementById('confirmRejeicaoModal');
    const btnCancel = document.getElementById('cancelarRejeicao');
    const btnConfirm = document.getElementById('confirmarRejeicao');

    // Botão "Cancelar" → fecha o modal sem fazer nada
    if (btnCancel && modalRejeicao) {
        btnCancel.addEventListener('click', () => {
            modalRejeicao.style.display = 'none';
        });
    }

    // Botão "Confirmar" → executa a rejeição do candidato
    if (btnConfirm && modalRejeicao) {
        btnConfirm.addEventListener('click', async () => {
            const idCandidato = document.getElementById('idCandidatoRejeicao').value;
            if (idCandidato) {
                await rejeitarCandidato(idCandidato); // Atualiza no BD
                modalRejeicao.style.display = 'none';
            }
        });
    }

    // Fecha ao clicar no overlay (fora do conteúdo do modal)
    window.addEventListener('click', (e) => {
        if (e.target === modalRejeicao) {
            modalRejeicao.style.display = 'none';
        }
    });
});

/**
 * Atualiza o status de um candidato para "Rejeitado" no Supabase
 * e recarrega o pipeline para remover o card da visualização.
 *
 * Nota: A rejeição NÃO elimina o registo do candidato da base de dados.
 * O candidato fica com status "Rejeitado" e é contabilizado no
 * contador de rejeitados no rodapé do pipeline.
 *
 * @param {string|number} id - ID do candidato a rejeitar
 */
async function rejeitarCandidato(id) {
    const { error } = await supabaseClient
        .from('candidatos')
        .update({ status: 'Rejeitado' }) // Apenas muda o campo status
        .eq('id', id);

    if (error) {
        console.error('Erro ao rejeitar candidato:', error);
        alert('Erro ao rejeitar candidato.');
    } else {
        // Recarrega o pipeline completo para refletir a mudança
        // (o candidato rejeitado desaparece das colunas e aparece no contador)
        carregarPipeline();
    }
}
