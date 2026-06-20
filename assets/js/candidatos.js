/**
 * candidatos.js
 * ─────────────────────────────────────────────────────────────
 * Módulo responsável por toda a lógica da página de Candidatos.
 *
 * Funções exportadas (globais):
 *   - carregarUsuarios()        → Busca candidatos no Supabase e renderiza os cards
 *   - criarCardCandidato()      → Cria o elemento HTML de um card de candidato
 *   - abrirModalDetalhes()      → Abre o modal com os detalhes completos do candidato
 *   - configurarModalCandidato()→ Configura os event handlers do modal de candidato
 *   - rejeitarCandidatoLista()  → Atualiza o status do candidato para "Rejeitado" no BD
 *   - carregarCandidatos()      → Busca métricas (total, qualificados, aguardando)
 *
 * Tabelas Supabase utilizadas:
 *   - candidatos  → Dados dos candidatos (nome, email, nota, status, etc.)
 *   - Vagas       → Dados das vagas (Titulo, data_abertura)
 * ─────────────────────────────────────────────────────────────
 */

/**
 * Carrega todos os candidatos da base de dados e renderiza os seus cards
 * no container `#candidatesCardsContainer` (Candidatos.html).
 *
 * Fluxo:
 *   1. Busca todos os candidatos na tabela "candidatos"
 *   2. Para cada candidato (que não seja Rejeitado), tenta buscar
 *      os dados da vaga associada pelo campo `vaga_sugerida`
 *   3. Cria e insere o card HTML no container
 *
 * Candidatos com status "Rejeitado" são ignorados e não aparecem na lista.
 */
async function carregarUsuarios() {
    // Busca todos os candidatos sem filtro
    const { data, error } = await supabaseClient
        .from("candidatos")
        .select("*");

    if (error) {
        console.error("Erro ao carregar candidatos:", error);
        return;
    }

    // Verifica se o container existe na página atual
    const container = document.getElementById("candidatesCardsContainer");
    if (!container) {
        console.error("Container de cards não encontrado: #candidatesCardsContainer");
        return;
    }

    // Limpa o conteúdo anterior antes de re-renderizar
    container.innerHTML = "";

    // Caso não haja candidatos na base de dados
    if (!data || data.length === 0) {
        container.innerHTML = `
      <div class="candidatos-empty-state" role="status">
        <div class="candidatos-empty-icon"><i class="fa-solid fa-user-group"></i></div>
        <p class="candidatos-empty-title">Nenhum candidato encontrado</p>
        <p class="candidatos-empty-text">Os perfis vão aparecer aqui assim que forem inseridos na base de dados.</p>
      </div>`;
        atualizarContagemCandidatosVisiveis();
        return;
    }

    // Itera sobre cada candidato para criar o seu card
    for (const candidato of data) {
        // Ignora candidatos rejeitados — eles não aparecem na lista
        if (candidato.status === 'Rejeitado') continue;

        let vagaData = null;

        // Se o candidato tem uma vaga associada (pelo ID),
        // busca os dados completos dessa vaga para exibir no card
        if (candidato.vaga_ID) {
            const { data: vaga, error: vagaError } = await supabaseClient
                .from("Vagas")
                .select("Titulo, data_abertura")
                .eq("id", candidato.vaga_ID) // Busca pelo ID da vaga
                .single(); // Espera apenas um resultado

            if (!vagaError && vaga) {
                vagaData = vaga; // Guarda os dados da vaga para passar ao card
            }
        }

        // Cria o elemento HTML do card e adiciona ao container
        const card = criarCardCandidato(candidato, vagaData);
        container.appendChild(card);
    }

    if (!container.querySelector('.card-candidato')) {
        container.innerHTML = `
      <div class="candidatos-empty-state" role="status">
        <div class="candidatos-empty-icon"><i class="fa-solid fa-user-check"></i></div>
        <p class="candidatos-empty-title">Sem perfis ativos</p>
        <p class="candidatos-empty-text">Todos os candidatos atuais estão marcados como rejeitados.</p>
      </div>`;
    }
    atualizarContagemCandidatosVisiveis();
}

/**
 * Cria e retorna o elemento HTML de um card de candidato.
 *
 * O card contém:
 *   - Nome e vaga a que se candidatou
 *   - Círculo SVG animado com a pontuação da IA (0-100%)
 *   - Informações de contacto (endereço, email, telefone)
 *   - Experiência e formação académica
 *   - Pills com as primeiras 3 capacidades (+ contador do restante)
 *   - Botão "Ver Perfil" → abre o modal de detalhes
 *   - Botão "Rejeitar"   → abre o modal de confirmação de rejeição
 *
 * @param {Object} candidato - Objeto com os dados do candidato vindos do Supabase
 * @param {Object|null} vagaData - Dados da vaga relacionada (Titulo, data_abertura), ou null
 * @returns {HTMLElement} Elemento <div> com o card completo do candidato
 */
function criarCardCandidato(candidato, vagaData) {
    const card = document.createElement('div');
    card.className = 'card-candidato';

    // ── Processamento das Capacidades ────────────────────────────────────
    // As capacidades podem vir como string JSON ou como array do Supabase.
    // Tentamos fazer parse se for string; se falhar, usamos array vazio.
    let capacidades = [];
    if (candidato.Capacidades) {
        if (typeof candidato.Capacidades === 'string') {
            try {
                capacidades = JSON.parse(candidato.Capacidades);
            } catch (e) {
                capacidades = []; // Se o JSON for inválido, ignora
            }
        } else if (Array.isArray(candidato.Capacidades)) {
            capacidades = candidato.Capacidades;
        }
    }

    // Mostra apenas as primeiras 3 capacidades como "pills" (etiquetas)
    const capacidadesPills = capacidades.slice(0, 3).map(cap =>
        `<span class="capacidade-pill">${escapeHtml(cap)}</span>`
    ).join('');

    // Se houver mais de 3 capacidades, mostra um pill extra com o número restante
    const capacidadesRestantes = capacidades.length > 3 ? capacidades.length - 3 : 0;
    const maisCapacidades = capacidadesRestantes > 0
        ? `<span class="capacidade-pill capacidade-pill-more">+${capacidadesRestantes} mais</span>`
        : '';

    // ── Nome da Vaga ──────────────────────────────────────────────────────
    // Usa o título da vaga buscada no BD; se não encontrou, usa o campo
    // vaga_sugerida_ia do candidato; se não tiver, mostra "Não especificada"
    const nomeVaga = escapeHtml(vagaData ? vagaData.Titulo : (candidato.vaga_sugerida_ia || 'Não especificada'));

    // ── Cálculo do Círculo de Pontuação (SVG) ────────────────────────────
    // O círculo é desenhado com stroke-dasharray e stroke-dashoffset para
    // criar o efeito de progresso circular. A fórmula é:
    //   circunferência = 2 * π * raio
    //   offset = circunferência - (percentagem / 100) * circunferência
    // Um offset de 0 = círculo completo; offset = circunferência = círculo vazio
    const nota = parseFloat(candidato.nota) || 0;
    const porcentagemNota = nota > 100 ? 100 : (nota < 0 ? 0 : nota); // Limita entre 0 e 100
    const circunferencia = 2 * Math.PI * 40; // Raio do círculo = 40 unidades SVG
    const offset = circunferencia - (porcentagemNota / 100) * circunferencia;
    const corCirculo = getCorPorPontuacao(porcentagemNota); // Verde/Amarelo/Vermelho

    // ── Processamento de Experiência e Formação ──────────────────────────
    // O campo Experiencias pode ser um número (anos) ou uma string descritiva
    let experienciaTexto = '';
    if (candidato.Experiencias) {
        if (isNaN(candidato.Experiencias)) {
            // É uma string descritiva (ex: "5 anos em gestão de projetos")
            experienciaTexto = candidato.Experiencias;
        } else {
            // É um número → formata como "X anos de experiência"
            experienciaTexto = candidato.Experiencias + ' anos de experiência';
        }
    }
    const formacaoTexto = candidato.formacao_academica || '';

    // Combina experiência e formação com separador "•", ou mostra "Não informado"
    const experienciaFormacao = escapeHtml(
        experienciaTexto && formacaoTexto
            ? `${experienciaTexto} • ${formacaoTexto}`
            : (experienciaTexto || formacaoTexto || 'Não informado')
    );

    // ── HTML do Círculo de Pontuação ──────────────────────────────────────
    // Dois círculos SVG sobrepostos: o de fundo (cinza) e o de progresso (colorido)
    const scoreCircle = `
    <div class="candidato-score-wrapper">
      <svg class="candidato-score-circle" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" class="score-circle-bg"></circle>
        <circle cx="50" cy="50" r="40" class="score-circle-progress" 
                stroke-dasharray="${circunferencia}" 
                stroke-dashoffset="${offset}"
                style="stroke: ${corCirculo};"></circle>
      </svg>
      <div class="score-text">${nota.toFixed(0)}%</div>
    </div>
  `;

    // ── HTML completo do card ─────────────────────────────────────────────
    card.innerHTML = `
    <div class="candidato-header">
      <div class="candidato-header-left">
        <div class="candidato-nome">${escapeHtml(candidato.nome || 'Nome não informado')}</div>
        <div class="candidato-vaga">${nomeVaga}</div>
      </div>
      <div class="candidato-header-right">
        ${scoreCircle}
      </div>
    </div>
    <div class="candidato-contato">
      <div class="candidato-contato-item">
        <i class="fa-solid fa-location-dot"></i>
        <span>${escapeHtml(candidato.Endereco || 'Não informado')}</span>
      </div>
      <div class="candidato-contato-item">
        <i class="fa-solid fa-envelope"></i>
        <span>${escapeHtml(candidato.email || 'Não informado')}</span>
      </div>
      <div class="candidato-contato-item">
        <i class="fa-solid fa-phone"></i>
        <span>${escapeHtml(candidato.telefone || 'Não informado')}</span>
      </div>
    </div>
    <div class="candidato-experiencia-formacao">
      ${experienciaFormacao}
    </div>
    <div class="candidato-capacidades">
      ${capacidadesPills}
      ${maisCapacidades}
    </div>
    <div class="candidato-actions candidato-actions-row">
      <button class="btn-ver-perfil" data-id="${candidato.id}">
        <i class="fa-solid fa-external-link"></i>
        Ver Perfil
      </button>
      <button class="btn-rejeitar-candidato" data-id="${candidato.id}">
        <i class="fa-solid fa-xmark"></i>
        Rejeitar
      </button>
    </div>
  `;

    // ── Event Listeners dos botões do card ───────────────────────────────

    // Botão "Ver Perfil" → abre o modal com todos os detalhes do candidato
    const btnVerPerfil = card.querySelector('.btn-ver-perfil');
    if (btnVerPerfil) {
        btnVerPerfil.onclick = function () {
            abrirModalDetalhes(candidato, vagaData);
        };
    }

    // Botão "Rejeitar" → abre o modal de confirmação de rejeição
    // Guarda o ID do candidato num input hidden para ser usado na confirmação
    const btnRejeitar = card.querySelector('.btn-rejeitar-candidato');
    if (btnRejeitar) {
        btnRejeitar.onclick = function () {
            const modal = document.getElementById('confirmRejeicaoModal');
            const inputId = document.getElementById('idCandidatoRejeicao');
            if (modal && inputId) {
                inputId.value = candidato.id; // Guarda o ID para a confirmação
                modal.style.display = 'flex';
            }
        };
    }

    return card;
}

function atualizarContagemCandidatosVisiveis() {
    const container = document.getElementById('candidatesCardsContainer');
    const label = document.getElementById('candidatosCountLabel');
    if (!container || !label) return;
    const total = container.querySelectorAll('.card-candidato').length;
    label.textContent = total === 1 ? '1 candidato' : `${total} candidatos`;
}

/**
 * Preenche e abre o modal de detalhes completos de um candidato.
 *
 * O modal (#candidatoDetalhesModal) contém:
 *   - Painel expansível com a descrição gerada pela IA
 *   - Grid com informações pessoais (nome, email, telefone, endereço, etc.)
 *   - Lista completa de capacidades (todas, não apenas as 3 primeiras)
 *   - Informações da vaga associada
 *   - Botão para visualizar/descarregar o currículo (se disponível)
 *
 * @param {Object} candidato - Objeto com os dados completos do candidato
 * @param {Object|null} vagaData - Dados da vaga relacionada, ou null
 */
function abrirModalDetalhes(candidato, vagaData) {
    const modal = document.getElementById('candidatoDetalhesModal');
    if (!modal) return; // Sai se o modal não existir na página atual

    // ── Preenche as informações principais ───────────────────────────────
    document.getElementById('modal-descricao-IA').textContent = candidato.descricao_IA || 'Não disponível';
    document.getElementById('modal-registro').textContent = candidato.registro ? formatarData(candidato.registro) : 'Não informado';
    document.getElementById('modal-nome').textContent = candidato.nome || 'Não informado';
    document.getElementById('modal-email').textContent = candidato.email || 'Não informado';
    document.getElementById('modal-telefone').textContent = candidato.telefone || 'Não informado';

    // Formata o campo de experiências (número ou texto)
    const experiencias = candidato.Experiencias;
    const experienciasText = experiencias
        ? (isNaN(experiencias) ? experiencias : `${experiencias} anos`)
        : 'Não informado';
    document.getElementById('modal-experiencias').textContent = experienciasText;

    document.getElementById('modal-formacao').textContent = candidato.formacao_academica || 'Não informado';

    // Formata a nota com 1 casa decimal, ou "N/A" se não for um número válido
    const notaModal = parseFloat(candidato.nota);
    document.getElementById('modal-nota').textContent = !isNaN(notaModal) ? notaModal.toFixed(1) : 'N/A';
    document.getElementById('modal-endereco').textContent = candidato.Endereco || 'Não informado';

    // ── Preenche a lista completa de capacidades ─────────────────────────
    // No modal mostramos TODAS as capacidades (não apenas as 3 primeiras do card)
    const capacidadesContainer = document.getElementById('modal-capacidades-todas');
    if (capacidadesContainer) {
        let capacidades = [];
        if (candidato.Capacidades) {
            if (typeof candidato.Capacidades === 'string') {
                try {
                    capacidades = JSON.parse(candidato.Capacidades);
                } catch (e) {
                    capacidades = [];
                }
            } else if (Array.isArray(candidato.Capacidades)) {
                capacidades = candidato.Capacidades;
            }
        }

        if (capacidades.length > 0) {
            // Renderiza cada capacidade como um pill com classe diferente (tamanho maior)
            capacidadesContainer.innerHTML = capacidades.map(cap =>
                `<span class="capacidade-pill capacidade-pill-full">${escapeHtml(cap)}</span>`
            ).join('');
        } else {
            capacidadesContainer.innerHTML = '<span style="color: var(--secondary-color);">Nenhuma capacidade informada</span>';
        }
    }

    // ── Preenche as informações da vaga ──────────────────────────────────
    const nomeVaga = vagaData ? vagaData.Titulo : (candidato.vaga_sugerida || 'Não especificada');
    const dataAbertura = vagaData && vagaData.data_abertura ? formatarData(vagaData.data_abertura) : 'Não disponível';
    document.getElementById('modal-vaga-nome').textContent = nomeVaga;
    document.getElementById('modal-vaga-data-abertura').textContent = dataAbertura;

    // ── Configura o botão de visualização do currículo ───────────────────
    // Se o candidato tem URL de currículo, o botão abre numa nova aba.
    // Se não tem, o botão fica desativado (opacidade reduzida).
    const btnDownload = document.getElementById('btnDownloadCurriculo');
    if (btnDownload) {
        if (candidato.url_curriculo && isSafeCvUrl(candidato.url_curriculo)) {
            btnDownload.onclick = function () {
                openSafeCvUrl(candidato.url_curriculo);
            };
            btnDownload.disabled = false;
            btnDownload.style.opacity = '1';
        } else {
            btnDownload.disabled = true;
            btnDownload.style.opacity = '0.5'; // Visual de desativado
            btnDownload.onclick = null;
        }
    }

    // ── Reseta o painel expansível da descrição IA ───────────────────────
    // Garante que o painel começa sempre fechado ao abrir o modal
    const descricaoContent = document.getElementById('descricaoIAContent');
    const descricaoChevron = document.getElementById('descricaoIAChevron');
    if (descricaoContent) {
        descricaoContent.style.display = 'none'; // Fecha o painel
    }
    if (descricaoChevron) {
        descricaoChevron.style.transform = 'rotate(0deg)'; // Seta apontando para baixo
    }

    // Exibe o modal
    modal.style.display = 'flex';
}

/**
 * Configura todos os event handlers do modal de detalhes do candidato
 * e do modal de confirmação de rejeição.
 *
 * Deve ser chamada uma vez após o DOM estar carregado (via dashboard.js).
 * Trata de:
 *   - Fechar o modal ao clicar no "X"
 *   - Toggle do painel expansível da descrição IA (com animação da seta)
 *   - Fechar ao clicar fora do modal (no overlay)
 *   - Fechar com a tecla ESC
 *   - Cancelar e confirmar a rejeição de um candidato
 */
function configurarModalCandidato() {
    const modal = document.getElementById('candidatoDetalhesModal');
    const btnFechar = document.getElementById('fecharModalCandidato');
    const descricaoHeader = document.getElementById('descricaoIAHeader'); // Cabeçalho clicável do painel
    const descricaoContent = document.getElementById('descricaoIAContent'); // Conteúdo expansível
    const descricaoChevron = document.getElementById('descricaoIAChevron'); // Ícone de seta

    // ── Fechar modal pelo botão "X" ───────────────────────────────────────
    if (btnFechar) {
        btnFechar.onclick = function () {
            if (modal) modal.style.display = 'none';
        };
    }

    // ── Painel expansível da descrição gerada pela IA ────────────────────
    // Ao clicar no cabeçalho, alterna entre mostrar e esconder o conteúdo.
    // A seta (chevron) roda 180° quando o painel está aberto.
    if (descricaoHeader && descricaoContent && descricaoChevron) {
        descricaoHeader.onclick = function () {
            const isHidden = descricaoContent.style.display === 'none' || !descricaoContent.style.display;
            descricaoContent.style.display = isHidden ? 'block' : 'none';
            descricaoChevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
        };
    }

    // ── Fechar modal ao clicar no overlay (fora do conteúdo) ─────────────
    if (modal) {
        window.addEventListener('click', function (event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    // ── Fechar modal com a tecla ESC ──────────────────────────────────────
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal && modal.style.display === 'flex') {
            modal.style.display = 'none';
        }
    });

    // ── Setup do modal de confirmação de rejeição ─────────────────────────
    // Este modal aparece quando o utilizador clica em "Rejeitar" num card.
    // O ID do candidato a rejeitar é guardado num input hidden (#idCandidatoRejeicao).
    const modalRejeicao = document.getElementById('confirmRejeicaoModal');
    const btnCancel = document.getElementById('cancelarRejeicao');
    const btnConfirm = document.getElementById('confirmarRejeicao');

    // Botão "Cancelar" → fecha o modal sem fazer nada
    if (btnCancel && modalRejeicao) {
        btnCancel.addEventListener('click', () => {
            modalRejeicao.style.display = 'none';
        });
    }

    // Botão "Confirmar" → executa a rejeição
    // Usa cloneNode para remover listeners antigos e evitar chamadas duplicadas
    // (importante porque esta função pode ser chamada em múltiplas páginas)
    if (btnConfirm && modalRejeicao) {
        const newBtn = btnConfirm.cloneNode(true); // Clona o botão sem os listeners
        btnConfirm.parentNode.replaceChild(newBtn, btnConfirm); // Substitui no DOM

        newBtn.addEventListener('click', async () => {
            const idCandidato = document.getElementById('idCandidatoRejeicao').value;
            if (idCandidato) {
                await rejeitarCandidatoLista(idCandidato); // Atualiza no BD
                modalRejeicao.style.display = 'none';
            }
        });
    }

    // Fecha o modal de rejeição ao clicar no overlay
    if (modalRejeicao) {
        window.addEventListener('click', (e) => {
            if (e.target === modalRejeicao) {
                modalRejeicao.style.display = 'none';
            }
        });
    }
}

/**
 * Atualiza o status de um candidato para "Rejeitado" na base de dados
 * e recarrega a lista e os contadores da página de Candidatos.
 *
 * Nota: A rejeição NÃO elimina o registo do candidato da base de dados.
 * Apenas muda o campo `status` para "Rejeitado", o que faz com que
 * `carregarUsuarios()` o ignore na próxima renderização.
 *
 * @param {string|number} id - ID do candidato a rejeitar
 */
async function rejeitarCandidatoLista(id) {
    const { error } = await supabaseClient
        .from('candidatos')
        .update({ status: 'Rejeitado' }) // Muda apenas o campo status
        .eq('id', id);

    if (error) {
        console.error('Erro ao rejeitar candidato:', error);
        alert('Erro ao rejeitar candidato.');
    } else {
        // Recarrega a lista de cards (o candidato rejeitado desaparece)
        await carregarUsuarios();
        // Atualiza os contadores (total, qualificados, aguardando)
        await carregarCandidatos();
    }
}

/**
 * Carrega as métricas de candidatos e atualiza os cards de estatísticas.
 *
 * Métricas calculadas:
 *   - Total: número total de candidatos na base de dados
 *   - Qualificados: candidatos com nota >= 80%
 *   - Aguardando: candidatos sem status ou com status "Aplicado"
 *
 * Esta função atualiza elementos em duas páginas diferentes:
 *   - index.html: atualiza o primeiro card genérico (`.card:first-child p`)
 *   - Candidatos.html: atualiza os elementos com IDs específicos
 *     (#total-candidatos-val, #qualificados-val, #aguardando-val)
 */
async function carregarCandidatos() {
    // Busca apenas os campos necessários para calcular as métricas
    const { data: candidatos, error } = await supabaseClient
        .from("candidatos")
        .select("id, nota, status");

    if (error) {
        console.error("Erro ao carregar métricas de candidatos:", error);
        return;
    }

    // Calcula as métricas
    const total = candidatos.length;
    const qualificados = candidatos.filter(c => (parseFloat(c.nota) || 0) >= 80).length;
    const aguardando = candidatos.filter(c => !c.status || c.status === 'Aplicado').length;

    // ── Atualiza o card da Home (index.html) ──────────────────────────────
    // Usa um seletor genérico pois a Home não tem IDs específicos nos cards
    const candidateCountElement = document.querySelector(".card:first-child p");
    if (candidateCountElement) {
        candidateCountElement.textContent = total;
    }

    // ── Atualiza os cards específicos da página de Candidatos ─────────────
    const totalEl = document.getElementById("total-candidatos-val");
    const qualificadosEl = document.getElementById("qualificados-val");
    const aguardandoEl = document.getElementById("aguardando-val");

    if (totalEl) totalEl.textContent = total;
    if (qualificadosEl) qualificadosEl.textContent = qualificados;
    if (aguardandoEl) aguardandoEl.textContent = aguardando;
}
