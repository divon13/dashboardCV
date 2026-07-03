/**

 * pipeline.js

 * ─────────────────────────────────────────────────────────────

 * Módulo responsável por toda a lógica do Pipeline de Recrutamento (Pipeline.html).

 *

 * O Pipeline é um quadro Kanban com 5 colunas que representam as etapas

 * do processo seletivo. Os candidatos são exibidos como cards e podem

 * ser movidos entre colunas por drag-and-drop.

 *

 * Colunas do Pipeline (em ordem):

 *   1. Aplicado           → Candidato acabou de se candidatar

 *   2. Entrevista técnica → Entrevista agendada (abre modal ao soltar)

 *   3. Entrevista feita   → Entrevista conduzida (via Conduzir → Guardar)

 *   4. Oferta enviada     → Proposta de emprego enviada

 *   5. Contratado         → Candidato contratado

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

    const mapStatusToColumn = {

        'Aplicado': 1,

        'Entrevista técnica': 2,

        'Entrevista feita': 3,

        'Oferta enviada': 4,

        'Contratado': 5

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



    const mapaVagasPorId = {};

    const filtroSelect = document.getElementById('filtroVaga');



    // Preserva a seleção atual do filtro antes de re-renderizar

    const filtroAtual = filtroSelect ? filtroSelect.value : 'todos';



    if (vagas) {

        vagas.forEach(v => {

            mapaVagas[v.id] = v.Titulo;

            mapaVagasPorTitulo[v.Titulo] = v;
            mapaVagasPorId[String(v.id)] = v;

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



    const buscaInput = document.getElementById('filtroPipelineBusca');

    const buscaAtual = buscaInput ? buscaInput.value.trim().toLowerCase() : '';

    configurarFiltroBuscaPipeline();



    // ── Limpa o conteúdo de todas as colunas ─────────────────────────────

    for (let i = 1; i <= 5; i++) {

        const colBody = document.querySelector(`.pipeline-column-${i} .pipeline-column-body`);

        if (colBody) colBody.innerHTML = '';

        const colCount = document.querySelector(`.pipeline-column-${i} .pipeline-column-count`);

        if (colCount) colCount.textContent = '0';

    }

    // Reseta também os contadores do resumo no rodapé

    document.querySelectorAll('.pipeline-summary-count').forEach(el => el.textContent = '0');



    // Contadores por coluna para atualizar os badges e o resumo

    const contadores = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    let countRejeitados = 0;



    // ── Processa cada candidato ───────────────────────────────────────────

    for (const candidato of candidatos) {

        // ── Filtro por vaga ───────────────────────────────────────────────

        // Se o filtro não for "todos", ignora candidatos de outras vagas

        const vagaDoCandidato = candidato.vaga_ID ? mapaVagasPorId[String(candidato.vaga_ID)] : null;
        const tituloVagaDoCandidato = vagaDoCandidato ? vagaDoCandidato.Titulo : (candidato.vaga_sugerida || candidato.vaga_sugerida_ia || 'Geral');

        if (filtroAtual !== 'todos' && String(tituloVagaDoCandidato) !== String(filtroAtual)) {

            continue;

        }



        // Candidatos rejeitados não aparecem nas colunas, apenas no contador de rejeitados

        if (candidato.status === 'Rejeitado') {

            countRejeitados++;

            continue;

        }



        // Mapeia o status para a coluna correta (comparação case-insensitive)

        let status = candidato.status ? candidato.status.trim() : 'Aplicado';

        const statusKey = Object.keys(mapStatusToColumn).find(

            k => k.toLowerCase() === status.toLowerCase()

        );

        const colIndex = statusKey ? mapStatusToColumn[statusKey] : mapStatusToColumn['Aplicado'];

        const colBody = document.querySelector(`.pipeline-column-${colIndex} .pipeline-column-body`);



        if (colBody) {

            // Busca os dados da vaga pelo título (campo vaga_sugerida do candidato)

            const vagaObj = vagaDoCandidato || (candidato.vaga_sugerida ? mapaVagasPorTitulo[candidato.vaga_sugerida] : null);

            const nomeVaga = vagaObj ? vagaObj.Titulo : tituloVagaDoCandidato;



            const searchText = [

                candidato.nome,

                candidato.email,

                candidato.telefone,

                candidato.status,

                candidato.vaga_sugerida,

                candidato.vaga_sugerida_ia,

                nomeVaga,

                candidato.nota,

                Array.isArray(candidato.Capacidades) ? candidato.Capacidades.join(' ') : candidato.Capacidades

            ].filter(Boolean).join(' ').toLowerCase();



            if (buscaAtual && !searchText.includes(buscaAtual)) {

                continue;

            }



            // Cria o card e adiciona à coluna correta

            const card = criarCardPipeline(candidato, nomeVaga, vagaObj);

            card.dataset.search = searchText;

            colBody.appendChild(card);

            contadores[colIndex]++;

        }

    }



    // ── Atualiza os contadores das colunas e do resumo ────────────────────

    for (let i = 1; i <= 5; i++) {

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

    setTimeout(carregarPipeline, 500); // Dá tempo para o Supabase processar a alteração

});



// Quando uma entrevista é concluída, atualiza o pipeline (ex: passa para Entrevista Feita ou é Reprovado)

window.addEventListener('interview-concluded', () => {

    setTimeout(carregarPipeline, 500); // Dá tempo para o Supabase processar a alteração

});



function configurarFiltroBuscaPipeline() {

    const input = document.getElementById('filtroPipelineBusca');

    if (!input || input.dataset.bound === '1') return;

    input.dataset.bound = '1';

    input.addEventListener('input', carregarPipeline);

}



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

    const topSkills = skills.slice(0, 3).map(s => `<span class="skill-tag">${escapeHtml(s)}</span>`).join('');



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

          <div class="pipeline-card-name">${escapeHtml(candidato.nome || 'Sem Nome')}</div>

      </div>

      <!-- Menu kebab com ações do candidato -->

      <div class="kebab-menu-container">

        <button type="button" class="kebab-btn" data-id="${candidato.id}"><i class="fa-solid fa-ellipsis"></i></button>

        <div id="pipeline-menu-${candidato.id}" class="kebab-dropdown">

            <button class="dropdown-item" data-id="${candidato.id}"><i class="fa-regular fa-eye"></i> Ver Perfil</button>

            <button class="dropdown-item" data-id="${candidato.id}"><i class="fa-regular fa-calendar-plus"></i> Agendar Entrevista</button>

            <button class="dropdown-item btn-ver-avaliacao" data-id="${candidato.id}" style="${!['aplicado', 'entrevista técnica'].includes((candidato.status || 'Aplicado').toLowerCase()) ? '' : 'display: none;'}"><i class="fa-solid fa-star-half-stroke"></i> Ver Avaliação</button>

            <button class="dropdown-item delete-btn" data-id="${candidato.id}"><i class="fa-regular fa-circle-xmark"></i> Rejeitar</button>

        </div>

      </div>

    </div>

    

    <!-- Barra de pontuação de compatibilidade com a vaga -->

    <div class="pipeline-match-score">

      <div class="match-score-label">

        <span>Pontuação de Compatibilidade</span>

        <span class="match-score-value">${Math.round(matchScore)}%</span>

      </div>

      <div class="progress-bar-container">

        <div class="progress-bar-fill" style="width: ${matchScore}%; background: ${corBarra};"></div>

      </div>

    </div>



    <div class="pipeline-applied-for">

      Candidatou-se a: <strong>${escapeHtml(nomeVaga)}</strong>

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
                        const agendamentoId = document.getElementById('agendamentoId');
                        if (agendamentoId) agendamentoId.value = '';

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

                        if (typeof preencherVagaDoCandidatoPorId === 'function') {
                            await preencherVagaDoCandidatoPorId(candidato.id);
                        }



                        // Pré-preenche o campo de vaga (se o candidato tiver vaga associada)

                        if (candidato.vaga_ID && vagaObj) {

                            const inputV = document.getElementById('searchVaga');

                            const hiddenV = document.getElementById('agVaga');

                            if (inputV && hiddenV) {

                                inputV.value = vagaObj.Titulo || '';

                                hiddenV.value = vagaObj.id || '';

                            }

                        }

                    }



                } else if (actionText.includes('Ver Avaliação')) {

                    // Busca a última avaliação deste candidato na base de dados

                    const { data: entrevistaData, error } = await supabaseClient

                        .from('Entrevistas')

                        .select('notas_entrevista, decisao_final, Data, Vagas(Titulo)')

                        .eq('Candidato_ID', candidato.id)

                        .not('notas_entrevista', 'is', null)

                        .order('created_at', { ascending: false })

                        .limit(1)

                        .single();

                        

                    if (error || !entrevistaData) {

                        alert('Ainda não existe nenhuma avaliação registada para este candidato.');

                    } else {

                        const n = entrevistaData.notas_entrevista || {};

                        const notasHTML = `

                            <div style="text-align: left; line-height: 1.6; font-size: 15px;">

                                <p><strong>Vaga:</strong> ${escapeHtml(entrevistaData.Vagas?.Titulo || 'N/A')}</p>

                                <p><strong>Conhecimento Técnico:</strong> ${escapeHtml(n.tecnica ? n.tecnica + ' / 5' : 'N/A')}</p>

                                <p><strong>Comunicação:</strong> ${escapeHtml(n.comunicacao ? n.comunicacao + ' / 5' : 'N/A')}</p>

                                <p><strong>Decisão Sugerida:</strong> ${escapeHtml(entrevistaData.decisao_final || 'N/A')}</p>

                                <p><strong>Notas Gerais:</strong><br/> ${escapeHtml(n.notas_gerais || 'Nenhuma nota registada.')}</p>

                            </div>

                        `;

                        // Reutiliza o modal de rejeição ou cria um simples alert para simplificar

                        const modalAval = document.createElement('div');

                        modalAval.className = 'modal modal-agendamento';

                        modalAval.style.display = 'flex';

                        modalAval.style.zIndex = '9999';

                        modalAval.innerHTML = `

                            <div class="modal-content-vaga modal-surface" style="max-width: 500px; padding: 25px;">

                                <div class="modal-header modal-header--surface" style="margin-bottom: 20px;">

                                    <h2>Avaliação da Entrevista</h2>

                                    <span class="close" style="cursor:pointer;" onclick="this.closest('.modal').remove()">&times;</span>

                                </div>

                                ${notasHTML}

                                <div class="form-actions" style="margin-top: 25px;">

                                    <button class="btn-submit" onclick="this.closest('.modal').remove()">Fechar</button>

                                </div>

                            </div>

                        `;

                        document.body.appendChild(modalAval);

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

                        }

                        if (typeof preencherVagaDoCandidatoPorId === 'function') {
                            await preencherVagaDoCandidatoPorId(cardId);
                        }



                        // ── Lógica de reversão ────────────────────────────

                        // Guarda o status anterior para poder reverter o card

                        // se o utilizador cancelar o agendamento

                        const oldStatus = card.dataset.status;

                        const mapStatusToColumn = {

                            'Aplicado': 1, 'Entrevista técnica': 2, 'Entrevista feita': 3,

                            'Oferta enviada': 4, 'Contratado': 5

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

                            const btnAvaliacao = card.querySelector('.btn-ver-avaliacao');

                            if (btnAvaliacao) btnAvaliacao.style.display = 'none';

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

                } else if (novoStatusTitulo === 'Entrevista feita') {

                    // ── Abre modal de conduzir entrevista ─────────────────

                    column.appendChild(card);

                    recalcularContadores();

                    const modalConcluir = document.getElementById('pipelineConcluirModal');

                    if (modalConcluir) {

                        // Buscar dados do candidato e entrevista
                        const candidateName = card.querySelector('.pipeline-card-name').textContent;
                        const candidateId = cardId;

                        // Preencher campos básicos
                        document.getElementById('pipelineConcluirCandidatoId').value = candidateId;
                        document.getElementById('pipelineConcluirSubtitulo').textContent = candidateName;

                        // Buscar entrevista agendada para este candidato
                        buscarEPreencherEntrevista(candidateId, candidateName);

                        modalConcluir.style.display = 'flex';

                        // ── Lógica de reversão ────────────────────────────
                        const oldStatus = card.dataset.status;
                        const mapRevertConcluir = {
                            'Aplicado': 1, 'Entrevista técnica': 2, 'Entrevista feita': 3,
                            'Oferta enviada': 4, 'Contratado': 5
                        };
                        const oldColIdx = mapRevertConcluir[oldStatus] || 1;
                        const revertTargetConcluir = document.querySelector(
                            `.pipeline-column-${oldColIdx} .pipeline-column-body`
                        );

                        // Se cancelar, reverte para coluna original
                        const cancelBtn = document.getElementById('cancelPipelineConcluir');
                        const closeBtn = document.getElementById('closePipelineConcluir');
                        
                        const revertir = () => {
                            if (revertTargetConcluir) revertTargetConcluir.appendChild(card);
                            recalcularContadores();
                            modalConcluir.style.display = 'none';
                        };

                        if (cancelBtn) {
                            cancelBtn.onclick = revertir;
                        }
                        if (closeBtn) {
                            closeBtn.onclick = revertir;
                        }
                        modalConcluir.onclick = (e) => {
                            if (e.target === modalConcluir) revertir();
                        };
                    }

                } else if (novoStatusTitulo === 'Contratado') {

                    // ── Caso especial: Contratado ─────────────────────────

                    // Ao mover para esta coluna, abre o modal de contratação

                    // para recolher data de início e horários antes de confirmar.

                    column.appendChild(card);

                    recalcularContadores();



                    const modalContratacao = document.getElementById('contratacaoModal');

                    if (modalContratacao) {

                        modalContratacao.style.display = 'flex';



                        // Preenche o nome do candidato no modal

                        const candidateName = card.querySelector('.pipeline-card-name').textContent;

                        const nomeEl = document.getElementById('contratacaoCandidatoNome');

                        const idEl = document.getElementById('contratacaoCandidatoId');

                        if (nomeEl) nomeEl.textContent = candidateName;

                        if (idEl) idEl.value = cardId;



                        // Reset do formulário

                        const form = document.getElementById('contratacaoForm');

                        if (form) {

                            document.getElementById('contratacaoDataInicio').value = '';

                            document.getElementById('contratacaoHoraEntrada').value = '09:00';

                            document.getElementById('contratacaoHoraSaida').value = '18:00';

                        }



                        // ── Lógica de reversão ────────────────────────────

                        const oldStatus = card.dataset.status;

                        const mapRevertContratacao = {

                            'Aplicado': 1, 'Entrevista técnica': 2, 'Entrevista feita': 3,

                            'Oferta enviada': 4, 'Contratado': 5

                        };

                        const oldColIdx = mapRevertContratacao[oldStatus] || 1;

                        const revertTargetContratacao = document.querySelector(

                            `.pipeline-column-${oldColIdx} .pipeline-column-body`

                        );



                        const cleanupContratacao = () => {

                            window.removeEventListener('contratacao-confirmed', onContratacaoSuccess);

                            if (btnCloseContratacao) btnCloseContratacao.removeEventListener('click', onContratacaoRevert);

                            if (btnCancelContratacao) btnCancelContratacao.removeEventListener('click', onContratacaoRevert);

                            window.removeEventListener('click', onContratacaoOutside);

                        };



                        const onContratacaoSuccess = () => {

                            card.dataset.status = 'Contratado';

                            const btnAvaliacao = card.querySelector('.btn-ver-avaliacao');

                            if (btnAvaliacao) btnAvaliacao.style.display = '';

                            cleanupContratacao();

                        };



                        const onContratacaoRevert = () => {

                            if (revertTargetContratacao) {

                                revertTargetContratacao.appendChild(card);

                                recalcularContadores();

                            }

                            modalContratacao.style.display = 'none';

                            cleanupContratacao();

                        };



                        const onContratacaoOutside = (ev) => {

                            if (ev.target === modalContratacao) onContratacaoRevert();

                        };



                        const btnCloseContratacao = document.getElementById('closeContratacaoModal');

                        const btnCancelContratacao = document.getElementById('cancelContratacao');



                        window.addEventListener('contratacao-confirmed', onContratacaoSuccess);

                        if (btnCloseContratacao) btnCloseContratacao.addEventListener('click', onContratacaoRevert);

                        if (btnCancelContratacao) btnCancelContratacao.addEventListener('click', onContratacaoRevert);

                        window.addEventListener('click', onContratacaoOutside);

                    }

                } else {

                    // ── Fluxo normal para todas as outras colunas ─────────

                    await atualizarStatusCandidato(cardId, novoStatusTitulo);

                    card.dataset.status = novoStatusTitulo;

                    const btnAvaliacao = card.querySelector('.btn-ver-avaliacao');

                    if (btnAvaliacao) {

                        btnAvaliacao.style.display = ['aplicado', 'entrevista técnica'].includes(novoStatusTitulo.toLowerCase()) ? 'none' : '';

                    }

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

    for (let i = 1; i <= 5; i++) {

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



// ── Setup do modal de contratação ─────────────────────────────────────────

// Configura o formulário de contratação (#contratacaoForm).

// Ao submeter, atualiza o status para "Contratado", guarda os dados de

// início no Supabase e envia o email de boas-vindas personalizado.

document.addEventListener('DOMContentLoaded', () => {

    const formContratacao = document.getElementById('contratacaoForm');

    if (!formContratacao) return;



    formContratacao.addEventListener('submit', async (e) => {

        e.preventDefault();



        const candidatoId = document.getElementById('contratacaoCandidatoId').value;

        const dataInicio = document.getElementById('contratacaoDataInicio').value;

        const horaEntrada = document.getElementById('contratacaoHoraEntrada').value;

        const horaSaida = document.getElementById('contratacaoHoraSaida').value;



        if (!candidatoId || !dataInicio || !horaEntrada || !horaSaida) {

            if (typeof showNotification === 'function') {

                showNotification('Preencha todos os campos obrigatórios.', 'error');

            } else {

                alert('Preencha todos os campos obrigatórios.');

            }

            return;

        }



        // Desabilita o botão de submit para evitar duplo clique

        const btnSubmit = formContratacao.querySelector('.btn-submit--success');

        if (btnSubmit) {

            btnSubmit.disabled = true;

            btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A processar...';

        }



        try {

            // 1. Atualiza o status do candidato para "Contratado" e guarda dados de contratação

            const { error: updateError } = await supabaseClient

                .from('candidatos')

                .update({

                    status: 'Contratado',

                    data_inicio: dataInicio,

                    hora_entrada: horaEntrada,

                    hora_saida: horaSaida

                })

                .eq('id', candidatoId);



            if (updateError) {

                console.error('Erro ao atualizar candidato:', updateError);

                // Se os campos extra não existirem, tenta só com o status

                const { error: fallbackError } = await supabaseClient

                    .from('candidatos')

                    .update({ status: 'Contratado' })

                    .eq('id', candidatoId);



                if (fallbackError) {

                    throw new Error('Erro ao atualizar status: ' + fallbackError.message);

                }

            }



            // 2. Busca dados do candidato para o email

            const { data: candidato } = await supabaseClient

                .from('candidatos')

                .select('nome, email')

                .eq('id', candidatoId)

                .single();



            // 3. Busca configurações da empresa para o email

            const { data: configs } = await supabaseClient

                .from('configuracoes')

                .select('chave, valor')

                .in('chave', ['empresa_nome', 'empresa_email']);



            const configMap = {};

            if (configs) configs.forEach(c => configMap[c.chave] = c.valor);



            // 4. Formata a data para exibição no email

            const dataFormatada = formatarDataInicioContratacao(dataInicio);



            // 5. Envia o email de contratação via Edge Function (se disponível)

            if (candidato && candidato.email) {

                await enviarEmailContratacao({

                    nome: candidato.nome,

                    email: candidato.email,

                    dataInicio: dataFormatada,

                    horaEntrada,

                    horaSaida,

                    empresaNome: configMap['empresa_nome'] || 'Empresa',

                    empresaEmail: configMap['empresa_email'] || ''

                });

            }



            // 6. Fecha o modal e notifica sucesso

            const modal = document.getElementById('contratacaoModal');

            if (modal) modal.style.display = 'none';



            window.dispatchEvent(new CustomEvent('contratacao-confirmed'));



            if (typeof showNotification === 'function') {

                showNotification('Candidato contratado com sucesso! Email enviado.', 'success');

            }



        } catch (err) {

            console.error('Erro na contratação:', err);

            if (typeof showNotification === 'function') {

                showNotification('Erro ao processar contratação: ' + err.message, 'error');

            } else {

                alert('Erro ao processar contratação: ' + err.message);

            }

        } finally {

            // Restaura o botão de submit

            if (btnSubmit) {

                btnSubmit.disabled = false;

                btnSubmit.innerHTML = '<i class="fa-solid fa-check-double"></i> Confirmar Contratação';

            }

        }

    });

});



/**

 * Formata a data de início para o formato legível (DD/MM/AAAA).

 * @param {string} dataISO - Data no formato YYYY-MM-DD

 * @returns {string} Data formatada como "DD/MM/AAAA"

 */

function formatarDataInicioContratacao(dataISO) {

    if (!dataISO) return '';

    const [ano, mes, dia] = dataISO.split('-');

    return `${dia}/${mes}/${ano}`;

}



/**

 * Envia o email de contratação/boas-vindas para o candidato.

 *

 * O email inclui os dados personalizados do bloco "Próximos Passos":

 *   - Data de início

 *   - Horário de entrada e saída no escritório

 *

 * Tenta enviar via Supabase Edge Function. Se não estiver disponível,

 * faz log no console e exibe preview do email para copiar.

 *

 * @param {Object} dados - Dados para o email

 * @param {string} dados.nome - Nome do candidato

 * @param {string} dados.email - Email do candidato

 * @param {string} dados.dataInicio - Data de início formatada (DD/MM/AAAA)

 * @param {string} dados.horaEntrada - Horário de entrada (HH:MM)

 * @param {string} dados.horaSaida - Horário de saída (HH:MM)

 * @param {string} dados.empresaNome - Nome da empresa

 * @param {string} dados.empresaEmail - Email de contacto da empresa

 */

async function enviarEmailContratacao(dados) {

    const emailHtml = gerarEmailContratacaoHtml(dados);



    try {

        // Tenta enviar via Supabase Edge Function

        const { data, error } = await supabaseClient.functions.invoke('send-email', {

            body: {

                to: dados.email,

                subject: `Parabéns ${dados.nome}! Bem-vindo(a) à ${dados.empresaNome}`,

                html: emailHtml

            }

        });



        if (error) {

            console.warn('Edge Function de email não disponível:', error.message);

            console.log('Email HTML gerado (para envio manual):', emailHtml);

            // Não lança erro — a contratação foi feita com sucesso mesmo sem email

        } else {

            console.log('Email de contratação enviado com sucesso para:', dados.email);

        }

    } catch (err) {

        console.warn('Erro ao tentar enviar email (Edge Function possivelmente não configurada):', err);

        console.log('Email HTML gerado (para envio manual):', emailHtml);

    }

}



/**

 * Gera o HTML do email de contratação/boas-vindas.

 * Substitui o bloco genérico "Próximos Passos" pelos dados preenchidos

 * no formulário de contratação (data de início, horários do escritório).

 *

 * @param {Object} dados - Dados do candidato e da contratação

 * @returns {string} HTML completo do email

 */

function gerarEmailContratacaoHtml(dados) {

    return `

    <!DOCTYPE html>

    <html lang="pt">

    <head>

        <meta charset="UTF-8">

        <meta name="viewport" content="width=device-width, initial-scale=1.0">

    </head>

    <body style="margin:0; padding:0; background-color:#f0f2f5; font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">

        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f0f2f5; padding:40px 20px;">

            <tr>

                <td align="center">

                    <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.08);">

                        

                        <!-- Header com gradiente -->

                        <tr>

                            <td style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%); padding:40px 40px 30px; text-align:center;">

                                <div style="font-size:48px; margin-bottom:16px;">🚀</div>

                                <h1 style="margin:0 0 8px; font-size:26px; font-weight:800; color:#ffffff; letter-spacing:-0.5px;">

                                    É oficial, ${escapeHtml(dados.nome)}!

                                </h1>

                                <p style="margin:0; font-size:15px; color:rgba(255,255,255,0.7);">

                                    A jornada começa em breve.

                                </p>

                            </td>

                        </tr>

                        

                        <!-- Corpo do email -->

                        <tr>

                            <td style="padding:35px 40px;">

                                <p style="margin:0 0 25px; font-size:16px; line-height:1.7; color:#334155;">

                                    Estamos muito entusiasmados por anunciar que o seu processo de contratação foi <strong>concluído com sucesso!</strong>

                                </p>

                                

                                <!-- Bloco: Dados de Início (substitui Próximos Passos) -->

                                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f8fafc; border-radius:12px; border:1px solid #e2e8f0; margin-bottom:25px;">

                                    <tr>

                                        <td style="padding:24px;">

                                            <h3 style="margin:0 0 18px; font-size:16px; font-weight:700; color:#1e293b; text-align:center;">

                                                📋 Os seus dados de início

                                            </h3>

                                            

                                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">

                                                <tr>

                                                    <td style="padding:10px 0; border-bottom:1px solid #e2e8f0;">

                                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">

                                                            <tr>

                                                                <td width="30" style="vertical-align:middle;">

                                                                    <span style="font-size:18px;">📅</span>

                                                                </td>

                                                                <td style="vertical-align:middle; padding-left:12px;">

                                                                    <span style="font-size:13px; color:#64748b; font-weight:500;">Data de Início</span><br>

                                                                    <span style="font-size:16px; color:#1e293b; font-weight:700;">${escapeHtml(dados.dataInicio)}</span>

                                                                </td>

                                                            </tr>

                                                        </table>

                                                    </td>

                                                </tr>

                                                <tr>

                                                    <td style="padding:10px 0; border-bottom:1px solid #e2e8f0;">

                                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">

                                                            <tr>

                                                                <td width="30" style="vertical-align:middle;">

                                                                    <span style="font-size:18px;">🕐</span>

                                                                </td>

                                                                <td style="vertical-align:middle; padding-left:12px;">

                                                                    <span style="font-size:13px; color:#64748b; font-weight:500;">Horário de Entrada</span><br>

                                                                    <span style="font-size:16px; color:#1e293b; font-weight:700;">${escapeHtml(dados.horaEntrada)}</span>

                                                                </td>

                                                            </tr>

                                                        </table>

                                                    </td>

                                                </tr>

                                                <tr>

                                                    <td style="padding:10px 0;">

                                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">

                                                            <tr>

                                                                <td width="30" style="vertical-align:middle;">

                                                                    <span style="font-size:18px;">🕕</span>

                                                                </td>

                                                                <td style="vertical-align:middle; padding-left:12px;">

                                                                    <span style="font-size:13px; color:#64748b; font-weight:500;">Horário de Saída</span><br>

                                                                    <span style="font-size:16px; color:#1e293b; font-weight:700;">${escapeHtml(dados.horaSaida)}</span>

                                                                </td>

                                                            </tr>

                                                        </table>

                                                    </td>

                                                </tr>

                                            </table>

                                        </td>

                                    </tr>

                                </table>

                                

                                <p style="margin:0; font-size:18px; font-weight:700; color:#2563eb; text-align:center; letter-spacing:-0.3px;">

                                    Vemo-nos em breve!

                                </p>

                            </td>

                        </tr>

                        

                        <!-- Footer -->

                        <tr>

                            <td style="padding:20px 40px; text-align:center; border-top:1px solid #e2e8f0;">

                                <p style="margin:0; font-size:12px; color:#94a3b8;">

                                    © ${new Date().getFullYear()} Equipa de Recrutamento & Seleção — ${escapeHtml(dados.empresaNome)}

                                </p>

                            </td>

                        </tr>

                    </table>

                </td>

            </tr>

        </table>

    </body>

    </html>`;

}

// ── Funções para Modal de Conclusão de Entrevista no Pipeline ─────────────

async function buscarEPreencherEntrevista(candidatoId, candidatoNome) {
    try {
        console.log('Buscando entrevista para candidato:', candidatoId);
        
        // Buscar entrevista agendada para este candidato
        const { data: entrevistas, error } = await supabaseClient
            .from('Entrevistas')
            .select('*, candidatos(*), Vagas(*)')
            .eq('candidato_ID', candidatoId)
            .eq('status', 'Agendada')
            .single();

        console.log('Resultado da busca de entrevista:', entrevistas, error);

        if (error) {
            console.error('Erro ao buscar entrevista:', error);
            // Continua mesmo sem entrevista - pode ser conduzida sem agendamento prévio
        }

        // Buscar dados completos do candidato
        const { data: candidato, error: candError } = await supabaseClient
            .from('candidatos')
            .select('*')
            .eq('id', candidatoId)
            .single();

        console.log('Dados do candidato:', candidato, candError);

        if (candError) {
            console.error('Erro ao buscar candidato:', candError);
            return;
        }

        // Preencher campos do modal
        document.getElementById('pipelineConcluirEntrevistaId').value = entrevistas?.id || '';
        
        const vagaNome = entrevistas?.Vagas?.Titulo || candidato?.vaga_Titulo || 'Vaga';
        document.getElementById('pipelineConcluirSubtitulo').textContent = `${candidatoNome} - ${vagaNome}`;

        // Preencher notas existentes (se houver)
        let notas = entrevistas?.notas_entrevista || {};
        if (typeof notas === 'string') {
            try { notas = JSON.parse(notas); } catch { notas = { notas_gerais: notas }; }
        }

        document.getElementById('pipelineNotaTecnica').value = notas.tecnica || '';
        document.getElementById('pipelineNotaComunicacao').value = notas.comunicacao || '';
        document.getElementById('pipelineNotasEntrevistador').value = notas.notas_gerais || notas.observacoes || '';
        document.getElementById('pipelineDecisaoFinal').value = entrevistas?.decisao_final || '';

        // Renderizar perguntas sugeridas
        console.log('Renderizando perguntas sugeridas para candidato:', candidato?.perguntas_sugeridas);
        renderPipelinePerguntasSugeridas(candidato);

        // Preencher currículo
        const iframe = document.getElementById('pipelineIframeCurriculo');
        const noCvMsg = document.getElementById('pipelineNoCurriculoMsg');
        const openCv = document.getElementById('pipelineOpenCurriculo');
        const cvUrl = candidato?.url_curriculo || '';
        console.log('URL do currículo:', cvUrl);
        console.log('Elementos do currículo:', { iframe: !!iframe, noCvMsg: !!noCvMsg, openCv: !!openCv });
        if (iframe && noCvMsg && openCv) {
            applySafeCvToElements(cvUrl, { iframe, openLink: openCv, noCvMsg });
        }

    } catch (err) {
        console.error('Erro ao buscar entrevista:', err);
    }
}

function renderPipelinePerguntasSugeridas(candidato) {
    const list = document.getElementById('pipelinePerguntasSugeridas');
    if (!list) return;

    list.innerHTML = '';
    let perguntasRaw = candidato?.perguntas_sugeridas;
    if (typeof perguntasRaw === 'string') {
        try { perguntasRaw = JSON.parse(perguntasRaw); } catch { perguntasRaw = [perguntasRaw]; }
    }
    const perguntas = Array.isArray(perguntasRaw) ? perguntasRaw.filter(Boolean) : [];

    if (perguntas.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'Nenhuma pergunta sugerida pela IA encontrada para este candidato.';
        li.className = 'ma-pergunta-empty';
        list.appendChild(li);
        return;
    }

    perguntas.forEach((pergunta) => {
        const li = document.createElement('li');
        li.textContent = pergunta;
        list.appendChild(li);
    });
}

async function handlePipelineConclusao(e) {
    e.preventDefault();
    const entrevistaId = document.getElementById('pipelineConcluirEntrevistaId').value;
    const candidatoId = document.getElementById('pipelineConcluirCandidatoId').value;
    const tecnica = document.getElementById('pipelineNotaTecnica').value;
    const comunicacao = document.getElementById('pipelineNotaComunicacao').value;
    const notasGerais = document.getElementById('pipelineNotasEntrevistador').value.trim();
    const decisao = document.getElementById('pipelineDecisaoFinal').value;

    if (!decisao) {
        if (typeof showNotification === 'function') showNotification('Selecione uma decisão final.', 'error');
        return;
    }

    const notasEntrevistaObj = {
        tecnica: parseInt(tecnica, 10) || 0,
        comunicacao: parseInt(comunicacao, 10) || 0,
        notas_gerais: notasGerais
    };

    // Atualizar entrevista
    if (entrevistaId) {
        const { error: errorEntrevista } = await supabaseClient
            .from('Entrevistas')
            .update({
                notas_entrevista: notasEntrevistaObj,
                decisao_final: decisao,
                status: 'Concluída'
            })
            .eq('id', entrevistaId);

        if (errorEntrevista) {
            console.error('Erro ao salvar avaliação:', errorEntrevista);
            if (typeof showNotification === 'function') showNotification('Erro ao salvar a conclusão.', 'error');
            return;
        }
    }

    // Atualizar status do candidato
    if (candidatoId) {
        const novoStatusCandidato = {
            'Passar': 'Entrevista feita',
            'Guardar': 'Entrevista feita',
            'Reprovar': 'Rejeitado'
        }[decisao];

        if (novoStatusCandidato) {
            const { error: errorCand } = await supabaseClient
                .from('candidatos')
                .update({ status: novoStatusCandidato })
                .eq('id', candidatoId);
            if (errorCand) console.error('Erro ao atualizar status do candidato:', errorCand);
        }
    }

    if (typeof showNotification === 'function') showNotification('Entrevista concluída com sucesso.', 'success');
    document.getElementById('pipelineConcluirModal').style.display = 'none';
    
    // Recarregar pipeline
    await carregarPipeline();
    
    // Dispatch evento para atualizar outras partes da aplicação
    window.dispatchEvent(new CustomEvent('interview-concluded', { detail: { candidatoId } }));
}

// Configurar handler do form de conclusão
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('pipelineConcluirForm');
    if (form) {
        form.addEventListener('submit', handlePipelineConclusao);
    }
});

