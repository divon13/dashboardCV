/**
 * Carrega e exibe a lista de candidatos em cards
 */
async function carregarUsuarios() {
    const { data, error } = await supabaseClient
        .from("candidatos")
        .select("*");

    if (error) {
        console.error("Erro ao carregar candidatos:", error);
        return;
    }

    const container = document.getElementById("candidatesCardsContainer");
    if (!container) {
        console.error("Container de cards não encontrado: #candidatesCardsContainer");
        return;
    }

    container.innerHTML = "";

    if (!data || data.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--secondary-color); padding:40px;">Nenhum candidato encontrado.</p>';
        return;
    }

    // Carregar informações de vagas para todos os candidatos
    for (const candidato of data) {
        // Pula candidatos rejeitados se quiser que eles sumam ao rejeitar
        if (candidato.status === 'Rejeitado') continue;

        let vagaData = null;

        // Se vaga_sugerida for uma string não vazia, buscar dados da vaga pelo título
        if (candidato.vaga_sugerida && candidato.vaga_sugerida.toString().trim() !== '') {
            const { data: vaga, error: vagaError } = await supabaseClient
                .from("Vagas")
                .select("Titulo, data_abertura")
                .eq("Titulo", candidato.vaga_sugerida)
                .single();

            if (!vagaError && vaga) {
                vagaData = vaga;
            }
        }

        const card = criarCardCandidato(candidato, vagaData);
        container.appendChild(card);
    }
}

/**
 * Cria um card HTML para um candidato
 * @param {Object} candidato - Objeto com os dados do candidato
 * @param {Object|null} vagaData - Dados da vaga relacionada (Titulo, data_abertura)
 * @returns {HTMLElement} Elemento div com o card do candidato
 */
function criarCardCandidato(candidato, vagaData) {
    const card = document.createElement('div');
    card.className = 'card-candidato';

    // Processar capacidades
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

    const capacidadesPills = capacidades.slice(0, 3).map(cap =>
        `<span class="capacidade-pill">${cap}</span>`
    ).join('');
    const capacidadesRestantes = capacidades.length > 3 ? capacidades.length - 3 : 0;
    const maisCapacidades = capacidadesRestantes > 0 ? `<span class="capacidade-pill capacidade-pill-more">+${capacidadesRestantes} mais</span>` : '';

    // Nome da vaga
    const nomeVaga = vagaData ? vagaData.Titulo : (candidato.vaga_sugerida || 'Não especificada');

    // Calcular porcentagem da nota (assumindo escala 0-100)
    const nota = parseFloat(candidato.nota) || 0;
    const porcentagemNota = nota > 100 ? 100 : (nota < 0 ? 0 : nota);
    const circunferencia = 2 * Math.PI * 40; // raio 40
    const offset = circunferencia - (porcentagemNota / 100) * circunferencia;
    const corCirculo = getCorPorPontuacao(porcentagemNota);

    // Processar experiência e formação
    let experienciaTexto = '';
    if (candidato.Experiencias) {
        if (isNaN(candidato.Experiencias)) {
            experienciaTexto = candidato.Experiencias;
        } else {
            experienciaTexto = candidato.Experiencias + ' anos de experiência';
        }
    }
    const formacaoTexto = candidato.formacao_academica || '';
    const experienciaFormacao = experienciaTexto && formacaoTexto
        ? `${experienciaTexto} • ${formacaoTexto}`
        : (experienciaTexto || formacaoTexto || 'Não informado');

    // Criar HTML do círculo de nota
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

    card.innerHTML = `
    <div class="candidato-header">
      <div class="candidato-header-left">
        <div class="candidato-nome">${candidato.nome || 'Nome não informado'}</div>
        <div class="candidato-vaga">${nomeVaga}</div>
      </div>
      <div class="candidato-header-right">
        ${scoreCircle}
      </div>
    </div>
    <div class="candidato-contato">
      <div class="candidato-contato-item">
        <i class="fa-solid fa-location-dot"></i>
        <span>${candidato.Endereco || 'Não informado'}</span>
      </div>
      <div class="candidato-contato-item">
        <i class="fa-solid fa-envelope"></i>
        <span>${candidato.email || 'Não informado'}</span>
      </div>
      <div class="candidato-contato-item">
        <i class="fa-solid fa-phone"></i>
        <span>${candidato.telefone || 'Não informado'}</span>
      </div>
    </div>
    <div class="candidato-experiencia-formacao">
      ${experienciaFormacao}
    </div>
    <div class="candidato-capacidades">
      ${capacidadesPills}
      ${maisCapacidades}
    </div>
    <div class="candidato-actions" style="display: flex; gap: 10px;">
      <button class="btn-ver-perfil" data-id="${candidato.id}">
        <i class="fa-solid fa-external-link"></i>
        Ver Perfil
      </button>
      <button class="btn-rejeitar" data-id="${candidato.id}" style="
          background-color: var(--surface-dark);
          color: var(--error-color);
          border: 1px solid var(--error-color);
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.3s ease;
      " onmouseover="this.style.backgroundColor='var(--error-color)'; this.style.color='white'"
        onmouseout="this.style.backgroundColor='var(--surface-dark)'; this.style.color='var(--error-color)'">
        <i class="fa-solid fa-xmark"></i>
        Rejeitar
      </button>
    </div>
  `;

    // Adicionar event listener ao botão ver perfil
    const btnVerPerfil = card.querySelector('.btn-ver-perfil');
    if (btnVerPerfil) {
        btnVerPerfil.onclick = function () {
            abrirModalDetalhes(candidato, vagaData);
        };
    }

    // Adicionar event listener ao botão rejeitar
    const btnRejeitar = card.querySelector('.btn-rejeitar');
    if (btnRejeitar) {
        btnRejeitar.onclick = function () {
            const modal = document.getElementById('confirmRejeicaoModal');
            const inputId = document.getElementById('idCandidatoRejeicao');
            if (modal && inputId) {
                inputId.value = candidato.id;
                modal.style.display = 'flex';
            }
        };
    }

    return card;
}

/**
 * Abre o modal de detalhes do candidato
 * @param {Object} candidato - Objeto com os dados do candidato
 * @param {Object|null} vagaData - Dados da vaga relacionada
 */
function abrirModalDetalhes(candidato, vagaData) {
    const modal = document.getElementById('candidatoDetalhesModal');
    if (!modal) return;

    // Preencher informações principais
    document.getElementById('modal-descricao-IA').textContent = candidato.descricao_IA || 'Não disponível';
    document.getElementById('modal-registro').textContent = candidato.registro ? formatarData(candidato.registro) : 'Não informado';
    document.getElementById('modal-nome').textContent = candidato.nome || 'Não informado';
    document.getElementById('modal-email').textContent = candidato.email || 'Não informado';
    document.getElementById('modal-telefone').textContent = candidato.telefone || 'Não informado';
    const experiencias = candidato.Experiencias;
    const experienciasText = experiencias ? (isNaN(experiencias) ? experiencias : `${experiencias} anos`) : 'Não informado';
    document.getElementById('modal-experiencias').textContent = experienciasText;
    document.getElementById('modal-formacao').textContent = candidato.formacao_academica || 'Não informado';
    const notaModal = parseFloat(candidato.nota);
    document.getElementById('modal-nota').textContent = !isNaN(notaModal) ? notaModal.toFixed(1) : 'N/A';
    document.getElementById('modal-endereco').textContent = candidato.Endereco || 'Não informado';

    // Preencher capacidades
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
            capacidadesContainer.innerHTML = capacidades.map(cap =>
                `<span class="capacidade-pill capacidade-pill-full">${cap}</span>`
            ).join('');
        } else {
            capacidadesContainer.innerHTML = '<span style="color: var(--secondary-color);">Nenhuma capacidade informada</span>';
        }
    }

    // Preencher informações da vaga
    const nomeVaga = vagaData ? vagaData.Titulo : (candidato.vaga_sugerida || 'Não especificada');
    const dataAbertura = vagaData && vagaData.data_abertura ? formatarData(vagaData.data_abertura) : 'Não disponível';
    document.getElementById('modal-vaga-nome').textContent = nomeVaga;
    document.getElementById('modal-vaga-data-abertura').textContent = dataAbertura;

    // Configurar botão de download do currículo
    const btnDownload = document.getElementById('btnDownloadCurriculo');
    if (btnDownload) {
        if (candidato.url_curriculo) {
            btnDownload.onclick = function () {
                window.open(candidato.url_curriculo, '_blank');
            };
            btnDownload.disabled = false;
            btnDownload.style.opacity = '1';
        } else {
            btnDownload.disabled = true;
            btnDownload.style.opacity = '0.5';
            btnDownload.onclick = null;
        }
    }

    // Resetar painel expansível
    const descricaoContent = document.getElementById('descricaoIAContent');
    const descricaoChevron = document.getElementById('descricaoIAChevron');
    if (descricaoContent) {
        descricaoContent.style.display = 'none';
    }
    if (descricaoChevron) {
        descricaoChevron.style.transform = 'rotate(0deg)';
    }

    modal.style.display = 'flex';
}

/**
 * Configura os event handlers do modal de candidato
 */
function configurarModalCandidato() {
    const modal = document.getElementById('candidatoDetalhesModal');
    const btnFechar = document.getElementById('fecharModalCandidato');
    const descricaoHeader = document.getElementById('descricaoIAHeader');
    const descricaoContent = document.getElementById('descricaoIAContent');
    const descricaoChevron = document.getElementById('descricaoIAChevron');

    // Fechar modal
    if (btnFechar) {
        btnFechar.onclick = function () {
            if (modal) modal.style.display = 'none';
        };
    }

    // Painel expansível da descrição IA
    if (descricaoHeader && descricaoContent && descricaoChevron) {
        descricaoHeader.onclick = function () {
            const isHidden = descricaoContent.style.display === 'none' || !descricaoContent.style.display;
            descricaoContent.style.display = isHidden ? 'block' : 'none';
            descricaoChevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
        };
    }

    // Fechar modal ao clicar fora
    if (modal) {
        window.addEventListener('click', function (event) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    }

    // Fechar modal com ESC
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && modal && modal.style.display === 'flex') {
            modal.style.display = 'none';
        }
    });

    // Setup modal de rejeição (Lista Candidatos)
    const modalRejeicao = document.getElementById('confirmRejeicaoModal');
    const btnCancel = document.getElementById('cancelarRejeicao');
    const btnConfirm = document.getElementById('confirmarRejeicao');

    if (btnCancel && modalRejeicao) {
        btnCancel.addEventListener('click', () => {
            modalRejeicao.style.display = 'none';
        });
    }

    if (btnConfirm && modalRejeicao) {
        // Remover listeners antigos para evitar duplicidade (clonagem simples)
        const newBtn = btnConfirm.cloneNode(true);
        btnConfirm.parentNode.replaceChild(newBtn, btnConfirm);

        newBtn.addEventListener('click', async () => {
            const idCandidato = document.getElementById('idCandidatoRejeicao').value;
            if (idCandidato) {
                await rejeitarCandidatoLista(idCandidato);
                modalRejeicao.style.display = 'none';
            }
        });
    }

    if (modalRejeicao) {
        window.addEventListener('click', (e) => {
            if (e.target === modalRejeicao) {
                modalRejeicao.style.display = 'none';
            }
        });
    }
}

async function rejeitarCandidatoLista(id) {
    const { error } = await supabaseClient
        .from('candidatos')
        .update({ status: 'Rejeitado' })
        .eq('id', id);

    if (error) {
        console.error('Erro ao rejeitar candidato:', error);
        alert('Erro ao rejeitar candidato.');
    } else {
        // Recarrega a lista
        await carregarUsuarios();
        // Atualiza contadores
        await carregarCandidatos();
    }
}

/**
 * Carrega a contagem total de candidatos para o card de métricas
 */
async function carregarCandidatos() {
    const { data: candidatos, error } = await supabaseClient
        .from("candidatos")
        .select("id, nota, status");

    if (error) {
        console.error("Erro ao carregar métricas de candidatos:", error);
        return;
    }

    const total = candidatos.length;
    const qualificados = candidatos.filter(c => (parseFloat(c.nota) || 0) >= 80).length;
    const aguardando = candidatos.filter(c => !c.status || c.status === 'Aplicado').length;

    // Atualiza o primeiro card (compatível com a Home)
    const candidateCountElement = document.querySelector(".card:first-child p");
    if (candidateCountElement) {
        candidateCountElement.textContent = total;
    }

    // Atualiza cards específicos da página de Candidatos (por ID)
    const totalEl = document.getElementById("total-candidatos-val");
    const qualificadosEl = document.getElementById("qualificados-val");
    const aguardandoEl = document.getElementById("aguardando-val");

    if (totalEl) totalEl.textContent = total;
    if (qualificadosEl) qualificadosEl.textContent = qualificados;
    if (aguardandoEl) aguardandoEl.textContent = aguardando;
}
