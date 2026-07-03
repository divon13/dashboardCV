/**
 * vagas.js
 * ─────────────────────────────────────────────────────────────
 * Módulo responsável por toda a lógica da página de Vagas (vagas.html).
 *
 * Funções exportadas (globais):
 *   - carregarVagas()            → Busca vagas no Supabase e renderiza os cards
 *   - configurarEventosVagas()   → Configura os botões de ação (editar, excluir, ver)
 *   - preencherModalDetalhes()   → Preenche o modal de detalhes com dados de uma vaga
 *   - carregarVagasAbertas()     → Conta vagas com status "aberta" para o dashboard
 *
 * Tabelas Supabase utilizadas:
 *   - Vagas      → Dados das vagas (Titulo, Descricao, Requisitos, status_vagas, etc.)
 *   - candidatos → Relacionamento para contar candidatos por vaga
 *
 * Também configura o handler do formulário de criação/edição de vagas (#vagaForm).
 * ─────────────────────────────────────────────────────────────
 */

/**
 * Verifica se existem vagas abertas que já passaram da data de encerramento
 * e atualiza o status delas para "encerrada" no Supabase.
 * Isso garante que vagas expiradas sejam tratadas corretamente na UI e métricas.
 */
async function verificarVagasExpiradas() {
    const hojeISO = getLocalIsoDate();

    try {
        // 1. Fecha as que expiraram (Aberta -> Encerrada)
        const { data: expiradas, error: err1 } = await supabaseClient
            .from('Vagas')
            .select('id')
            .eq('status_vagas', 'aberta')
            .lt('data_encerramento', hojeISO);

        if (err1) throw err1;

        if (expiradas && expiradas.length > 0) {
            await supabaseClient.from('Vagas').update({ status_vagas: 'encerrada' }).in('id', expiradas.map(v => v.id));
            console.log(`[Auto-Status] ${expiradas.length} vaga(s) expirada(s) encerradas.`);
        }

        // 2. Reabre as que foram estendidas (Encerrada -> Aberta)
        // Só fazemos isso para "encerrada", mantendo "cancelada" ou "arquivada" como estados manuais permanentes
        const { data: reabrir, error: err2 } = await supabaseClient
            .from('Vagas')
            .select('id')
            .eq('status_vagas', 'encerrada')
            .gte('data_encerramento', hojeISO);

        if (err2) throw err2;

        if (reabrir && reabrir.length > 0) {
            await supabaseClient.from('Vagas').update({ status_vagas: 'aberta' }).in('id', reabrir.map(v => v.id));
            console.log(`[Auto-Status] ${reabrir.length} vaga(s) reabertas (data estendida).`);
        }
    } catch (err) {
        console.error("Erro no processo de verificação de status das vagas:", err);
    }
}

/**
 * Indica se uma vaga deve ser tratada como encerrada/arquivada para estatísticas.
 */
function vagaEstaEncerradaOuArquivada(status) {
    const s = (status || '').toLowerCase();
    return s.includes('encerr') || s.includes('fechad') || s.includes('cancel') || s.includes('arquiv');
}

/**
 * Atualiza os mini-cards de estatísticas no topo da página de vagas.
 */
function atualizarEstatisticasVagas(data) {
    const elTotal = document.getElementById('statTotalVagas');
    const elAtivas = document.getElementById('statVagasAtivas');
    const elComCand = document.getElementById('statVagasComCandidatos');
    if (!elTotal && !elAtivas && !elComCand) return;

    const list = data || [];
    if (elTotal) elTotal.textContent = list.length;
    if (elAtivas) {
        elAtivas.textContent = list.filter(v => !vagaEstaEncerradaOuArquivada(v.status_vagas)).length;
    }
    if (elComCand) {
        elComCand.textContent = list.filter(v => v.candidatos && v.candidatos.length > 0).length;
    }
}

/**
 * Atualiza o badge "N vagas" conforme filtros visíveis.
 */
function atualizarContagemListaVagas() {
    const label = document.getElementById('vagasCountLabel');
    const container = document.getElementById('vagasContainer');
    if (!label || !container) return;

    const cards = container.querySelectorAll('.card-vaga');
    let visible = 0;
    cards.forEach(c => {
        if (c.style.display !== 'none') visible += 1;
    });
    label.textContent = visible === 1 ? '1 vaga' : `${visible} vagas`;
}

/**
 * Pesquisa local por título ou estado (uma vez ligada ao input).
 */
function configurarFiltroVagas() {
    const input = document.getElementById('filtroVagas');
    if (!input || input.dataset.bound === '1') return;
    input.dataset.bound = '1';

    input.addEventListener('input', () => {
        const q = input.value.trim().toLowerCase();
        const container = document.getElementById('vagasContainer');
        if (!container) return;

        container.querySelectorAll('.card-vaga').forEach(card => {
            const haystack = (card.dataset.search || card.textContent || '').toLowerCase();
            card.style.display = !q || haystack.includes(q) ? '' : 'none';
        });
        atualizarContagemListaVagas();
    });
}

/**
 * Carrega todas as vagas da base de dados e renderiza os seus cards
 * no container `#vagasContainer` (vagas.html).
 *
 * Cada card de vaga exibe:
 *   - Título e status da vaga (chip colorido)
 *   - Menu kebab (⋮) com opções: Ver Detalhes, Editar, Eliminar
 *   - Data de encerramento
 *   - Número de candidatos associados a essa vaga
 *
 * A query usa JOIN implícito do Supabase para contar candidatos:
 *   .select("*, candidatos(id)") → retorna a vaga com array de IDs de candidatos
 *
 * As vagas são ordenadas da mais recente para a mais antiga (id DESC).
 */
async function carregarVagas() {
    // Garante que vagas expiradas sejam atualizadas antes de listar
    await verificarVagasExpiradas();

    // Busca todas as vagas com os IDs dos candidatos associados (para contar)
    const { data, error } = await supabaseClient
        .from("Vagas")
        .select("*, candidatos(id)") // JOIN: inclui array de candidatos relacionados
        .order('id', { ascending: false }); // Mais recentes primeiro

    if (error) {
        console.error("Erro ao carregar vagas:", error);
        return;
    }

    // Verifica se o container existe na página atual
    const container = document.getElementById('vagasContainer');
    if (!container) {
        console.error('Container de vagas não encontrado: #vagasContainer');
        return;
    }

    // Limpa o conteúdo anterior antes de re-renderizar
    container.innerHTML = '';

    if (!data || data.length === 0) {
        container.innerHTML = `
      <div class="vagas-empty-state" role="status">
        <div class="vagas-empty-icon"><i class="fa-solid fa-briefcase"></i></div>
        <p class="vagas-empty-title">Ainda não há vagas</p>
        <p class="vagas-empty-text">Crie a primeira posição com o botão <strong>Nova vaga</strong> acima.</p>
      </div>`;
        atualizarEstatisticasVagas([]);
        configurarFiltroVagas();
        atualizarContagemListaVagas();
        return;
    }

    // Renderiza um card para cada vaga
    data.forEach(vaga => {
        const card = document.createElement('div');
        card.className = 'card-vaga';

        const candidatosCount = vaga.candidatos ? vaga.candidatos.length : 0;
        const dataEncerramento = vaga.data_encerramento ? formatarData(vaga.data_encerramento) : '—';

        card.innerHTML = `
      <div class="card-vaga-accent" aria-hidden="true"></div>
      <div class="card-vaga-inner">
      <div class="card-top">
        <div class="title-area">
          <div class="job-icon-wrap"><i class="fa-solid fa-briefcase"></i></div>
          <div class="job-meta">
            <div class="job-title">${escapeHtml(vaga.Titulo || '')}</div>
            <span class="chip-status chip-status-vaga status-${safeCssClass(vaga.status_vagas || 'aberta')}">${escapeHtml(vaga.status_vagas || 'aberta')}</span>
          </div>
        </div>
        <div class="card-actions">
           <div class="kebab-menu-container">
             <button class="kebab-btn" data-id="${vaga.id}"><i class="fa-solid fa-ellipsis"></i></button>
             <div id="menu-${vaga.id}" class="kebab-dropdown">
               <button class="dropdown-item view-btn" data-id="${vaga.id}"><i class="fa-regular fa-eye"></i> Ver Detalhes</button>
               <button class="dropdown-item edit-btn" data-id="${vaga.id}"><i class="fa-regular fa-pen-to-square"></i> Editar</button>
               <button class="dropdown-item delete-btn" data-id="${vaga.id}"><i class="fa-regular fa-trash-can"></i> Eliminar</button>
             </div>
           </div>
        </div>
      </div>
      <div class="card-bottom">
        <span class="card-vaga-meta"><i class="fa-solid fa-calendar-xmark"></i> Encerra ${escapeHtml(dataEncerramento)}</span>
        <span class="card-vaga-meta"><i class="fa-solid fa-users"></i> ${candidatosCount} candidato${candidatosCount === 1 ? '' : 's'}</span>
      </div>
      </div>
    `;
        card.dataset.search = `${vaga.Titulo || ''} ${vaga.status_vagas || ''}`.toLowerCase();
        container.appendChild(card);
    });

    atualizarEstatisticasVagas(data);
    configurarFiltroVagas();
    atualizarContagemListaVagas();

    configurarEventosVagas(container, data);
}

/**
 * Configura os event handlers para todos os botões de ação dos cards de vagas.
 *
 * Botões configurados:
 *   - .kebab-btn   → Abre/fecha o menu dropdown (⋮)
 *   - .edit-btn    → Preenche o formulário e abre o modal de edição
 *   - .delete-btn  → Abre o modal de confirmação de exclusão
 *   - .view-btn    → Preenche e abre o modal de detalhes
 *
 * O menu kebab tem lógica de "fechar outros menus" para garantir que
 * apenas um menu esteja aberto de cada vez.
 *
 * @param {HTMLElement} container - O elemento #vagasContainer com os cards renderizados
 * @param {Array} data - Array com os objetos de vaga do Supabase
 */
function configurarEventosVagas(container, data) {

    // ── Menu Kebab (⋮) ────────────────────────────────────────────────────
    // Ao clicar no botão ⋮ de uma vaga, fecha todos os outros menus abertos
    // e faz toggle (abre/fecha) do menu desta vaga.
    container.querySelectorAll('.kebab-btn').forEach(btn => {
        btn.onclick = function (e) {
            e.stopPropagation(); // Impede que o clique feche o menu imediatamente
            const id = this.getAttribute('data-id');
            const menu = document.getElementById(`menu-${id}`);

            // Fecha todos os outros menus abertos
            document.querySelectorAll('.kebab-dropdown').forEach(m => {
                if (m.id !== `menu-${id}`) m.classList.remove('show');
            });
            document.querySelectorAll('.kebab-btn').forEach(b => {
                if (b !== this) b.classList.remove('active');
            });

            // Alterna o estado do menu atual (abre se fechado, fecha se aberto)
            if (menu) menu.classList.toggle('show');
            this.classList.toggle('active');
        };
    });

    // Fecha o menu dropdown ao clicar em qualquer opção dentro dele
    container.querySelectorAll('.dropdown-item').forEach(item => {
        item.addEventListener('click', () => {
            document.querySelectorAll('.kebab-dropdown').forEach(m => {
                m.classList.remove('show');
            });
            document.querySelectorAll('.kebab-btn').forEach(b => {
                b.classList.remove('active');
            });
        });
    });

    // ── Botão "Editar" ────────────────────────────────────────────────────
    // Encontra a vaga pelo ID, preenche o formulário com os dados atuais
    // e abre o modal de criação/edição em modo de edição.
    // O campo oculto `#vagaId` indica ao formulário que é uma atualização (não criação).
    container.querySelectorAll('.edit-btn').forEach(btn => {
        btn.onclick = function () {
            const id = this.getAttribute('data-id');
            const vaga = data.find(v => v.id == id); // Encontra a vaga no array local
            if (!vaga) return;

            // Preenche o formulário com os dados da vaga a editar
            document.getElementById('vagaId').value = vaga.id;           // ID para o update
            document.getElementById('titulo').value = vaga.Titulo || '';
            document.getElementById('descricao').value = vaga.Descricao || '';
            document.getElementById('requisitos').value = vaga.Requisitos || '';
            // A data de encerramento vem como "YYYY-MM-DD HH:MM:SS", precisamos só "YYYY-MM-DD"
            document.getElementById('dataEncerramento').value = vaga.data_encerramento
                ? vaga.data_encerramento.substring(0, 10)
                : '';

            // ── Proposta: mostra ficheiro existente ou limpa ────────────
            const propostaFile = document.getElementById('propostaFile');
            const propostaPlaceholder = document.getElementById('propostaPlaceholder');
            const propostaPreview = document.getElementById('propostaPreview');
            const propostaFileName = document.getElementById('propostaFileName');
            if (propostaFile) propostaFile.value = '';

            if (vaga.url_proposta) {
                // Extrai o nome do ficheiro da URL
                const nomeArquivo = decodeURIComponent(vaga.url_proposta.split('/').pop());
                propostaFileName.textContent = nomeArquivo;
                propostaPlaceholder.style.display = 'none';
                propostaPreview.style.display = 'flex';
            } else {
                propostaPlaceholder.style.display = 'flex';
                propostaPreview.style.display = 'none';
            }

            document.getElementById('vagaModal').style.display = 'flex';
        };
    });

    // ── Botão "Eliminar" ──────────────────────────────────────────────────
    // Abre o modal de confirmação de exclusão e guarda o ID da vaga
    // no atributo `data-id` do botão de confirmação (para ser usado no utils.js).
    container.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = function () {
            const id = this.getAttribute('data-id');
            const vaga = data.find(v => v.id == id);
            if (!vaga) return;

            const confirmModal = document.getElementById('confirmDeleteModal');
            const deleteTitulo = document.getElementById('deleteVagaTitulo');
            const confirmarBtn = document.getElementById('confirmarDeleteBtn');

            // Mostra o título da vaga no modal de confirmação
            if (deleteTitulo) {
                deleteTitulo.textContent = vaga.Titulo ? `Vaga: ${vaga.Titulo}` : '';
            }
            // Guarda o ID no botão de confirmação para ser usado pelo handler em utils.js
            if (confirmarBtn) {
                confirmarBtn.setAttribute('data-id', id);
            }
            if (confirmModal) {
                confirmModal.style.display = 'flex';
            }
        };
    });

    // ── Botão "Ver Detalhes" ──────────────────────────────────────────────
    // Preenche o modal de detalhes com os dados da vaga e abre-o.
    container.querySelectorAll('.view-btn').forEach(btn => {
        btn.onclick = function () {
            const id = this.getAttribute('data-id');
            const vaga = data.find(v => v.id == id);
            if (!vaga) return;

            preencherModalDetalhes(vaga); // Preenche os campos do modal
            const detalhesModal = document.getElementById('vagaDetalhesModal');
            if (detalhesModal) {
                detalhesModal.style.display = 'flex';
            }
        };
    });
}

/**
 * Preenche o modal de detalhes (#vagaDetalhesModal) com os dados de uma vaga.
 *
 * Campos preenchidos:
 *   - #det-titulo       → Título da vaga
 *   - #det-descricao    → Descrição completa
 *   - #det-requisitos   → Requisitos da vaga
 *   - #det-status       → Status atual (ex: "aberta", "fechada")
 *   - #det-abertura     → Data de abertura formatada
 *   - #det-encerramento → Data de encerramento formatada
 *
 * @param {Object} vaga - Objeto com os dados da vaga do Supabase
 */
function preencherModalDetalhes(vaga) {
    // Recolhe referências a todos os elementos do modal de uma vez
    const elementos = {
        titulo: document.getElementById('det-titulo'),
        descricao: document.getElementById('det-descricao'),
        requisitos: document.getElementById('det-requisitos'),
        status: document.getElementById('det-status'),
        abertura: document.getElementById('det-abertura'),
        encerramento: document.getElementById('det-encerramento')
    };

    // Preenche cada campo, verificando se o elemento existe antes de atribuir
    if (elementos.titulo) elementos.titulo.textContent = vaga.Titulo || '';
    if (elementos.descricao) elementos.descricao.textContent = vaga.Descricao || '';
    if (elementos.requisitos) elementos.requisitos.textContent = vaga.Requisitos || '';
    if (elementos.status) elementos.status.textContent = vaga.status_vagas || '';

    // As datas são formatadas para o padrão angolano (DD/MM/AAAA HH:MM)
    if (elementos.abertura) {
        elementos.abertura.textContent = vaga.data_abertura
            ? formatarData(vaga.data_abertura)
            : '';
    }
    if (elementos.encerramento) {
        elementos.encerramento.textContent = vaga.data_encerramento
            ? formatarData(vaga.data_encerramento)
            : '';
    }
}

/**
 * Conta as vagas com status "aberta" e atualiza o card de métricas.
 *
 * Utilizado em:
 *   - index.html: atualiza o card "Vagas Abertas" (#vagas-abertas-val)
 *   - vagas.html: também pode atualizar se o elemento existir
 *
 * Usa a opção `count: "exact"` do Supabase para obter apenas a contagem
 * sem transferir os dados completos (mais eficiente).
 */
async function carregarVagasAbertas() {
    // Garante que vagas expiradas sejam atualizadas antes de contar para o dashboard
    await verificarVagasExpiradas();

    // Conta apenas as vagas com status "aberta" (sem trazer os dados completos)
    const { count, error } = await supabaseClient
        .from("Vagas")
        .select("*", { count: "exact" }) // Retorna apenas a contagem
        .eq('status_vagas', 'aberta');   // Filtra por status

    if (error) {
        console.error("Erro ao carregar contagem de vagas abertas:", error);
        return;
    }

    const totalVagasAbertas = count || 0;

    // Tenta encontrar o elemento pelo ID específico (index.html) ou pelo seletor genérico
    const vagasAbertasCountElement = document.getElementById("vagas-abertas-val")
        || document.querySelector(".card:nth-child(2) p");

    if (vagasAbertasCountElement) {
        vagasAbertasCountElement.textContent = totalVagasAbertas;
    }
}

// ── Handler do Formulário de Criação/Edição de Vagas ─────────────────────────
// Este listener é registado quando o DOM está pronto.
// Trata tanto da criação de novas vagas como da edição de vagas existentes.
// A distinção é feita pelo campo oculto #vagaId:
//   - Se #vagaId tiver valor → é uma edição (UPDATE)
//   - Se #vagaId estiver vazio → é uma criação (INSERT)
document.addEventListener('DOMContentLoaded', () => {

    // ── Interação do campo de upload de proposta ──────────────────────────
    const propostaDropArea  = document.getElementById('propostaDropArea');
    const propostaFileInput = document.getElementById('propostaFile');
    const propostaPlaceholder = document.getElementById('propostaPlaceholder');
    const propostaPreview   = document.getElementById('propostaPreview');
    const propostaFileName  = document.getElementById('propostaFileName');
    const propostaRemoveBtn = document.getElementById('propostaRemoveBtn');

    if (propostaDropArea && propostaFileInput) {
        // Clique na área abre o seletor de ficheiros
        propostaDropArea.addEventListener('click', (e) => {
            if (e.target.closest('.upload-remove-btn')) return; // Não abrir se clicou em remover
            propostaFileInput.click();
        });

        // Quando o utilizador seleciona um ficheiro
        propostaFileInput.addEventListener('change', () => {
            const file = propostaFileInput.files[0];
            if (file) {
                _mostrarFicheiroProposta(file.name);
            }
        });

        // Drag & Drop
        ['dragenter', 'dragover'].forEach(evt => {
            propostaDropArea.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                propostaDropArea.classList.add('dragover');
            });
        });

        ['dragleave', 'drop'].forEach(evt => {
            propostaDropArea.addEventListener(evt, (e) => {
                e.preventDefault();
                e.stopPropagation();
                propostaDropArea.classList.remove('dragover');
            });
        });

        propostaDropArea.addEventListener('drop', (e) => {
            const file = e.dataTransfer.files[0];
            if (!file) return;

            // Valida extensão
            const ext = file.name.split('.').pop().toLowerCase();
            if (!['doc', 'docx'].includes(ext)) {
                alert('Apenas ficheiros .doc ou .docx são permitidos.');
                return;
            }
            // Valida tamanho (10 MB)
            if (file.size > 10 * 1024 * 1024) {
                alert('O ficheiro excede o limite de 10 MB.');
                return;
            }

            // Transfere para o input file via DataTransfer
            const dt = new DataTransfer();
            dt.items.add(file);
            propostaFileInput.files = dt.files;
            _mostrarFicheiroProposta(file.name);
        });

        // Botão remover
        if (propostaRemoveBtn) {
            propostaRemoveBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                propostaFileInput.value = '';
                propostaPlaceholder.style.display = 'flex';
                propostaPreview.style.display = 'none';
            });
        }
    }

    /** Mostra o preview com o nome do ficheiro */
    function _mostrarFicheiroProposta(nome) {
        if (propostaFileName) propostaFileName.textContent = nome;
        if (propostaPlaceholder) propostaPlaceholder.style.display = 'none';
        if (propostaPreview) propostaPreview.style.display = 'flex';
    }

    // ── Handler do formulário de vagas ─────────────────────────────────────
    const vagaForm = document.getElementById('vagaForm');
    if (vagaForm) {
        vagaForm.addEventListener('submit', async (event) => {
            event.preventDefault(); // Impede o reload da página

            const { data: userData } = await supabaseClient.auth.getUser();
            const userId = userData?.user?.id || null;

            // Recolhe os dados do formulário
            const dadosVaga = {
                Titulo: document.getElementById('titulo').value,
                Descricao: document.getElementById('descricao').value,
                Requisitos: document.getElementById('requisitos').value,
                data_encerramento: document.getElementById('dataEncerramento').value,
                admin_id: userId
            };

            // ── Upload da proposta (se houver ficheiro selecionado) ────────
            const propostaInput = document.getElementById('propostaFile');
            const ficheiroProposta = propostaInput?.files[0] || null;

            const id = document.getElementById('vagaId').value; // Vazio se for nova vaga

            try {
                // Se há ficheiro novo, faz o upload para o Supabase Storage
                if (ficheiroProposta) {
                    console.log('Iniciando upload da proposta:', ficheiroProposta.name, ficheiroProposta.size, 'bytes');
                    
                    const ext = ficheiroProposta.name.split('.').pop().toLowerCase();
                    const timestamp = Date.now();
                    const caminhoStorage = `proposta/${timestamp}_${ficheiroProposta.name}`;

                    console.log('Caminho no Storage:', caminhoStorage);

                    const { data: uploadData, error: uploadError } = await supabaseClient
                        .storage
                        .from('proposta')
                        .upload(caminhoStorage, ficheiroProposta, {
                            cacheControl: '3600',
                            upsert: false
                        });

                    if (uploadError) {
                        console.error('Erro no upload para Storage:', uploadError);
                        throw new Error('Erro ao enviar proposta: ' + uploadError.message);
                    }

                    console.log('Upload concluído com sucesso:', uploadData);

                    // Obtém a URL pública do ficheiro carregado
                    const { data: urlData } = supabaseClient
                        .storage
                        .from('proposta')
                        .getPublicUrl(caminhoStorage);

                    console.log('URL pública gerada:', urlData.publicUrl);
                    dadosVaga.url_proposta = urlData.publicUrl;
                } else {
                    console.log('Nenhum ficheiro de proposta selecionado');
                }

                if (id) {
                    // ── Modo Edição: atualiza a vaga existente ────────────────
                    const { data, error } = await supabaseClient
                        .from('Vagas')
                        .update(dadosVaga)
                        .eq('id', id)
                        .select(); // Retorna os dados atualizados para confirmação

                    if (error) throw error;
                    console.log('Vaga atualizada:', data[0]);
                } else {
                    // ── Modo Criação: insere uma nova vaga ────────────────────
                    const { data, error } = await supabaseClient
                        .from('Vagas')
                        .insert([dadosVaga])
                        .select(); // Retorna os dados inseridos para confirmação

                    if (error) throw error;
                    console.log('Vaga criada:', data[0]);
                }

                // Sucesso: recarrega a lista de vagas, fecha o modal e limpa o formulário
                if (typeof carregarVagas === 'function') carregarVagas();

                const modal = document.getElementById('vagaModal');
                if (modal) modal.style.display = 'none';

                vagaForm.reset();
                document.getElementById('vagaId').value = ''; // Limpa o ID para o próximo uso

                // Limpa o preview da proposta
                if (propostaPlaceholder) propostaPlaceholder.style.display = 'flex';
                if (propostaPreview) propostaPreview.style.display = 'none';

            } catch (err) {
                console.error('Erro ao salvar vaga:', err.message || err);
                alert('Erro ao salvar vaga: ' + (err.message || err));
            }
        });
    }

    // ── Fecha menus kebab ao clicar fora deles ────────────────────────────
    // Listener global que fecha qualquer menu dropdown aberto quando o
    // utilizador clica em qualquer área fora de um `.kebab-menu-container`
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.kebab-menu-container')) {
            document.querySelectorAll('.kebab-dropdown').forEach(m => {
                m.classList.remove('show');
            });
            document.querySelectorAll('.kebab-btn').forEach(b => {
                b.classList.remove('active');
            });
        }
    });
});
