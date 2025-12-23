// ============================================
// DASHBOARD - GERENCIAMENTO DE CANDIDATOS E VAGAS
// ============================================

// ============================================
// SEÇÃO 1: FUNÇÕES UTILITÁRIAS
// ============================================

/**
 * Retorna a cor baseada na pontuação
 * @param {number} nota - Pontuação de 0 a 100
 * @returns {string} Cor em formato hex
 */
function getCorPorPontuacao(nota) {
  if (nota >= 67) return '#28a745'; // Verde para alta
  if (nota >= 34) return '#ffc107'; // Amarelo para média
  return '#dc3545'; // Vermelho para baixa
}

/**
 * Formata uma data ISO para o formato angolano com hora (fuso horário UTC+1)
 * @param {string} dataISO - Data no formato ISO
 * @returns {string} Data formatada (DD/MM/AAAA (HH:MM))
 */
function formatarData(dataISO) {
  if (!dataISO) return '';
  const data = new Date(dataISO);
  if (isNaN(data.getTime())) return dataISO;

  // Converte para o fuso horário de Angola (Africa/Luanda - UTC+1)
  const formatter = new Intl.DateTimeFormat('pt-AO', {
    timeZone: 'Africa/Luanda',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const partes = formatter.formatToParts(data);
  const dia = partes.find(p => p.type === 'day').value;
  const mes = partes.find(p => p.type === 'month').value;
  const ano = partes.find(p => p.type === 'year').value;
  const hora = partes.find(p => p.type === 'hour').value;
  const min = partes.find(p => p.type === 'minute').value;

  return `${dia}/${mes}/${ano} (${hora}:${min})`;
}

// ============================================
// SEÇÃO 2: CARREGAMENTO DE DADOS
// ============================================

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
    let vagaData = null;
    // Se vaga_sugerida for um número/ID, buscar dados da vaga
    if (candidato.vaga_sugerida && candidato.vaga_sugerida.toString().trim() !== '' && !isNaN(candidato.vaga_sugerida)) {
      const { data: vaga, error: vagaError } = await supabaseClient
        .from("Vagas")
        .select("Titulo, data_abertura")
        .eq("id", parseInt(candidato.vaga_sugerida))
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
    <div class="candidato-actions">
      <button class="btn-ver-perfil" data-id="${candidato.id}">
        <i class="fa-solid fa-external-link"></i>
        Ver Perfil
      </button>
    </div>
  `;

  // Adicionar event listener ao botão
  const btnVerPerfil = card.querySelector('.btn-ver-perfil');
  if (btnVerPerfil) {
    btnVerPerfil.onclick = function () {
      abrirModalDetalhes(candidato, vagaData);
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
}

/**
 * Carrega a contagem total de candidatos para o card de métricas
 */
async function carregarCandidatos() {
  const { count, error } = await supabaseClient
    .from("candidatos")
    .select("*", { count: "exact" });

  if (error) {
    console.error("Erro ao carregar contagem de candidatos:", error);
    return;
  }

  const totalCandidatos = count || 0;
  const candidateCountElement = document.querySelector(".card:first-child p");
  if (candidateCountElement) {
    candidateCountElement.textContent = totalCandidatos;
  }
}

/**
 * Carrega e exibe as vagas com seus candidatos relacionados
 * Configura os event handlers para editar, visualizar e excluir
 */
async function carregarVagas() {
  const { data, error } = await supabaseClient
    .from("Vagas")
    .select("*, candidatos(id)")
    .order('id', { ascending: false });

  if (error) {
    console.error("Erro ao carregar vagas:", error);
    return;
  }

  const container = document.getElementById('vagasContainer');
  if (!container) {
    console.error('Container de vagas não encontrado: #vagasContainer');
    return;
  }

  container.innerHTML = '';

  // Renderiza os cards de vagas
  data.forEach(vaga => {
    const card = document.createElement('div');
    card.className = 'card-vaga';
    const candidatosCount = vaga.candidatos ? vaga.candidatos.length : 0;

    card.innerHTML = `
      <div class="card-top">
        <div class="title-area">
          <div class="job-title">${vaga.Titulo || ''}</div>
          <div class="chip-status">${vaga.status_vagas || 'aberto'}</div>
        </div>
        <div class="card-actions">
          <button class="btn-link view-btn" data-id="${vaga.id}">Ver detalhes</button>
          <button class="btn-link edit-btn" data-id="${vaga.id}">Editar</button>
          <button class="btn-link delete-btn" data-id="${vaga.id}">Apagar</button>
        </div>
      </div>
      <div class="card-bottom">
        <span><i class="fa-solid fa-calendar"></i> ${vaga.data_encerramento ? formatarData(vaga.data_encerramento) : ''}</span>
        <span><i class="fa-solid fa-users"></i> ${candidatosCount} candidatos</span>
      </div>
    `;
    container.appendChild(card);
  });

  // Configura event handlers para os botões
  configurarEventosVagas(container, data);
}

/**
 * Configura os event handlers para os botões de ação das vagas
 * @param {HTMLElement} container - Container que contém os cards de vagas
 * @param {Array} data - Array com os dados das vagas
 */
function configurarEventosVagas(container, data) {
  // Botão Editar
  container.querySelectorAll('.edit-btn').forEach(btn => {
    btn.onclick = function () {
      const id = this.getAttribute('data-id');
      const vaga = data.find(v => v.id == id);
      if (!vaga) return;

      document.getElementById('vagaId').value = vaga.id;
      document.getElementById('titulo').value = vaga.Titulo || '';
      document.getElementById('descricao').value = vaga.Descricao || '';
      document.getElementById('requisitos').value = vaga.Requisitos || '';
      document.getElementById('dataEncerramento').value = vaga.data_encerramento
        ? vaga.data_encerramento.substring(0, 10)
        : '';
      document.getElementById('vagaModal').style.display = 'flex';
    };
  });

  // Botão Excluir
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = function () {
      const id = this.getAttribute('data-id');
      const vaga = data.find(v => v.id == id);
      if (!vaga) return;

      const confirmModal = document.getElementById('confirmDeleteModal');
      const deleteTitulo = document.getElementById('deleteVagaTitulo');
      const confirmarBtn = document.getElementById('confirmarDeleteBtn');

      if (deleteTitulo) {
        deleteTitulo.textContent = vaga.Titulo ? `Vaga: ${vaga.Titulo}` : '';
      }
      if (confirmarBtn) {
        confirmarBtn.setAttribute('data-id', id);
      }
      if (confirmModal) {
        confirmModal.style.display = 'flex';
      }
    };
  });

  // Botão Ver Detalhes
  container.querySelectorAll('.view-btn').forEach(btn => {
    btn.onclick = function () {
      const id = this.getAttribute('data-id');
      const vaga = data.find(v => v.id == id);
      if (!vaga) return;

      preencherModalDetalhes(vaga);
      const detalhesModal = document.getElementById('vagaDetalhesModal');
      if (detalhesModal) {
        detalhesModal.style.display = 'flex';
      }
    };
  });
}

/**
 * Preenche o modal de detalhes com os dados da vaga
 * @param {Object} vaga - Objeto com os dados da vaga
 */
function preencherModalDetalhes(vaga) {
  const elementos = {
    titulo: document.getElementById('det-titulo'),
    descricao: document.getElementById('det-descricao'),
    requisitos: document.getElementById('det-requisitos'),
    status: document.getElementById('det-status'),
    abertura: document.getElementById('det-abertura'),
    encerramento: document.getElementById('det-encerramento')
  };

  if (elementos.titulo) elementos.titulo.textContent = vaga.Titulo || '';
  if (elementos.descricao) elementos.descricao.textContent = vaga.Descricao || '';
  if (elementos.requisitos) elementos.requisitos.textContent = vaga.Requisitos || '';
  if (elementos.status) elementos.status.textContent = vaga.status_vagas || '';
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
 * Carrega a contagem de vagas abertas para o card de métricas
 */
async function carregarVagasAbertas() {
  const { count, error } = await supabaseClient
    .from("Vagas")
    .select("*", { count: "exact" })
    .eq('status_vagas', 'aberta');

  if (error) {
    console.error("Erro ao carregar contagem de vagas abertas:", error);
    return;
  }

  const totalVagasAbertas = count || 0;
  const vagasAbertasCountElement = document.querySelector(".card:nth-child(3) p");
  if (vagasAbertasCountElement) {
    vagasAbertasCountElement.textContent = totalVagasAbertas;
  }
}

/**
 * Carrega e exibe as próximas entrevistas agendadas
 */
async function carregarEntrevistas() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeISO = hoje.toISOString().split('T')[0];

  const { data, error } = await supabaseClient
    .from("Entrevistas")
    .select(`
      *,
      Vagas(Titulo),
      candidatos(nome)
    `)
    .gte('Data', hojeISO)
    .order('Data', { ascending: true })
    .limit(7);

  if (error) {
    console.error("Erro ao carregar entrevistas:", error);
    const container = document.getElementById('entrevistasContainer');
    if (container) {
      container.innerHTML = '<p style="color: var(--secondary-color); text-align: center; padding: 20px;">Erro ao carregar entrevistas.</p>';
    }
    return;
  }

  const container = document.getElementById('entrevistasContainer');
  if (!container) {
    console.error('Container de entrevistas não encontrado: #entrevistasContainer');
    return;
  }

  container.innerHTML = '';

  if (!data || data.length === 0) {
    container.innerHTML = '<p style="color: var(--secondary-color); text-align: center; padding: 20px;">Nenhuma entrevista agendada.</p>';
    return;
  }

  // Renderiza os cards de entrevistas
  data.forEach(entrevista => {
    const card = criarCardEntrevista(entrevista);
    container.appendChild(card);
  });
}

/**
 * Cria um card HTML para uma entrevista
 * @param {Object} entrevista - Objeto com os dados da entrevista
 * @returns {HTMLElement} Elemento div com o card da entrevista
 */
function criarCardEntrevista(entrevista) {
  const card = document.createElement('div');
  card.className = 'card-entrevista';

  // Extrai nome da vaga e do candidato dos relacionamentos
  const nomeVaga = extrairNomeVaga(entrevista);
  const nomeCandidato = extrairNomeCandidato(entrevista);
  const dataFormatada = entrevista.Data ? formatarData(entrevista.Data) : 'Data não definida';
  const status = entrevista.Status || 'Agendada';
  const statusClass = status.toLowerCase().replace(/\s+/g, '-');
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
      <span><i class="fa-solid fa-user"></i> ${entrevista.Entrevistador || 'Não definido'}</span>
    </div>
    ${observacoesHTML}
  `;

  return card;
}

/**
 * Extrai o nome da vaga do relacionamento Supabase
 * @param {Object} entrevista - Objeto da entrevista
 * @returns {string} Nome da vaga
 */
function extrairNomeVaga(entrevista) {
  if (!entrevista.Vagas) return 'Vaga não encontrada';

  if (Array.isArray(entrevista.Vagas) && entrevista.Vagas.length > 0) {
    return entrevista.Vagas[0].Titulo || 'Vaga não encontrada';
  } else if (entrevista.Vagas.Titulo) {
    return entrevista.Vagas.Titulo;
  }

  return 'Vaga não encontrada';
}

/**
 * Extrai o nome do candidato do relacionamento Supabase
 * @param {Object} entrevista - Objeto da entrevista
 * @returns {string} Nome do candidato
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
// SEÇÃO 3: GERENCIAMENTO DE MODAIS
// ============================================

/**
 * Configura todos os event handlers dos modais
 */
function configurarModais() {
  const elementos = {
    btnAbrirModal: document.getElementById('btnAbrirModal'),
    vagaModal: document.getElementById('vagaModal'),
    btnFecharModal: document.getElementById('btnFecharModal'),
    btnCancelar: document.getElementById('btnCancelar'),
    confirmDeleteModal: document.getElementById('confirmDeleteModal'),
    fecharConfirmDelete: document.getElementById('fecharConfirmDelete'),
    cancelarDeleteBtn: document.getElementById('cancelarDeleteBtn'),
    confirmarDeleteBtn: document.getElementById('confirmarDeleteBtn'),
    detalhesModal: document.getElementById('vagaDetalhesModal'),
    fecharDetalhes: document.getElementById('fecharDetalhes'),
    fecharDetalhesBtn: document.getElementById('fecharDetalhesBtn')
  };

  // Modal de criação/edição de vaga
  if (elementos.btnAbrirModal && elementos.vagaModal) {
    elementos.btnAbrirModal.onclick = function () {
      document.getElementById('vagaForm').reset();
      document.getElementById('vagaId').value = '';
      elementos.vagaModal.style.display = 'flex';
    };
  }

  if (elementos.btnFecharModal && elementos.vagaModal) {
    elementos.btnFecharModal.onclick = function () {
      elementos.vagaModal.style.display = 'none';
    };
  }

  if (elementos.btnCancelar && elementos.vagaModal) {
    elementos.btnCancelar.onclick = function (e) {
      e.preventDefault();
      elementos.vagaModal.style.display = 'none';
    };
  }

  // Modal de confirmação de exclusão
  if (elementos.fecharConfirmDelete && elementos.confirmDeleteModal) {
    elementos.fecharConfirmDelete.onclick = function () {
      elementos.confirmDeleteModal.style.display = 'none';
    };
  }

  if (elementos.cancelarDeleteBtn && elementos.confirmDeleteModal) {
    elementos.cancelarDeleteBtn.onclick = function () {
      elementos.confirmDeleteModal.style.display = 'none';
    };
  }

  if (elementos.confirmarDeleteBtn && elementos.confirmDeleteModal) {
    elementos.confirmarDeleteBtn.onclick = async function () {
      const id = this.getAttribute('data-id');
      if (!id) return;

      const { error } = await supabaseClient
        .from('Vagas')
        .delete()
        .eq('id', id);

      if (error) {
        alert('Erro ao apagar vaga: ' + error.message);
      } else {
        carregarVagas();
      }

      elementos.confirmDeleteModal.style.display = 'none';
    };
  }

  // Modal de detalhes
  if (elementos.fecharDetalhes && elementos.detalhesModal) {
    elementos.fecharDetalhes.onclick = function () {
      elementos.detalhesModal.style.display = 'none';
    };
  }

  if (elementos.fecharDetalhesBtn && elementos.detalhesModal) {
    elementos.fecharDetalhesBtn.onclick = function () {
      elementos.detalhesModal.style.display = 'none';
    };
  }

  // Fecha modais ao clicar fora do conteúdo
  window.onclick = function (event) {
    if (event.target === elementos.vagaModal) {
      elementos.vagaModal.style.display = 'none';
    }
    if (elementos.confirmDeleteModal && event.target === elementos.confirmDeleteModal) {
      elementos.confirmDeleteModal.style.display = 'none';
    }
    if (elementos.detalhesModal && event.target === elementos.detalhesModal) {
      elementos.detalhesModal.style.display = 'none';
    }
  };

  // Fecha modais com tecla ESC
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (elementos.vagaModal && elementos.vagaModal.style.display === 'flex') {
        elementos.vagaModal.style.display = 'none';
      }
      if (elementos.confirmDeleteModal && elementos.confirmDeleteModal.style.display === 'flex') {
        elementos.confirmDeleteModal.style.display = 'none';
      }
      if (elementos.detalhesModal && elementos.detalhesModal.style.display === 'flex') {
        elementos.detalhesModal.style.display = 'none';
      }
    }
  });
}

// ============================================
// SEÇÃO 4: FORMULÁRIO DE VAGAS
// ============================================

/**
 * Handler do formulário de criação/edição de vagas
 */
const vagaForm = document.getElementById('vagaForm');
if (vagaForm) {
  vagaForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const dadosVaga = {
      Titulo: document.getElementById('titulo').value,
      Descricao: document.getElementById('descricao').value,
      Requisitos: document.getElementById('requisitos').value,
      data_encerramento: document.getElementById('dataEncerramento').value,
      AdminID: 1 // placeholder
    };

    const id = document.getElementById('vagaId').value;

    try {
      if (id) {
        // Atualiza vaga existente
        const { data, error } = await supabaseClient
          .from('Vagas')
          .update(dadosVaga)
          .eq('id', id)
          .select();

        if (error) throw error;
        console.log('Vaga atualizada:', data[0]);
      } else {
        // Insere nova vaga
        const { data, error } = await supabaseClient
          .from('Vagas')
          .insert([dadosVaga])
          .select();

        if (error) throw error;
        console.log('Vaga criada:', data[0]);
      }

      // Sucesso: recarrega lista e fecha modal
      carregarVagas();
      document.getElementById('vagaModal').style.display = 'none';
      document.getElementById('vagaForm').reset();
      document.getElementById('vagaId').value = '';
    } catch (err) {
      console.error('Erro ao salvar vaga:', err.message || err);
      alert('Erro ao salvar vaga: ' + (err.message || err));
    }
  });
}


// ============================================
// SEÇÃO 5: PIPELINE DE RECRUTAMENTO
// ============================================

/**
 * Carrega o pipeline de candidatos
 */
async function carregarPipeline() {
  const mapStatusToColumn = {
    'aplicado': 1,
    'triagem': 2,
    'entrevista técnica': 3,
    'adequação à cultura': 4,
    'oferta enviada': 5,
    'contratado': 6
  };

  const { data: candidatos, error } = await supabaseClient
    .from("candidatos")
    .select("*");

  if (error) {
    console.error("Erro ao buscar candidatos:", error);
    return;
  }

  const { data: vagas } = await supabaseClient
    .from("Vagas")
    .select("id, Titulo");

  const mapaVagas = {};
  if (vagas) vagas.forEach(v => mapaVagas[v.id] = v.Titulo);

  // Reset UI
  for (let i = 1; i <= 6; i++) {
    const colBody = document.querySelector(`.pipeline-column-${i} .pipeline-column-body`);
    if (colBody) colBody.innerHTML = '';
    const colCount = document.querySelector(`.pipeline-column-${i} .pipeline-column-count`);
    if (colCount) colCount.textContent = '0';
  }
  document.querySelectorAll('.pipeline-summary-count').forEach(el => el.textContent = '0');

  const contadores = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };

  for (const candidato of candidatos) {
    let status = candidato.status ? candidato.status.toLowerCase().trim() : 'aplicado';
    if (!mapStatusToColumn[status]) status = 'aplicado';

    const colIndex = mapStatusToColumn[status];
    const colBody = document.querySelector(`.pipeline-column-${colIndex} .pipeline-column-body`);

    if (colBody) {
      const nomeVaga = candidato.vaga_sugerida && mapaVagas[candidato.vaga_sugerida]
        ? mapaVagas[candidato.vaga_sugerida]
        : (candidato.vaga_sugerida || 'Geral');

      const card = criarCardPipeline(candidato, nomeVaga);
      colBody.appendChild(card);
      contadores[colIndex]++;
    }
  }

  // Update counts
  for (let i = 1; i <= 6; i++) {
    const colCount = document.querySelector(`.pipeline-column-${i} .pipeline-column-count`);
    if (colCount) colCount.textContent = contadores[i];

    const summaryCounts = document.querySelectorAll('.pipeline-summary-count');
    if (summaryCounts[i - 1]) summaryCounts[i - 1].textContent = contadores[i];
  }

  configurarDragAndDrop();
}

function criarCardPipeline(candidato, nomeVaga) {
  const card = document.createElement('div');
  card.className = 'pipeline-card';
  card.draggable = true;
  card.dataset.id = candidato.id;
  card.dataset.status = candidato.status || 'Aplicado';

  let skills = [];
  try {
    if (Array.isArray(candidato.Capacidades)) skills = candidato.Capacidades;
    else if (candidato.Capacidades) skills = JSON.parse(candidato.Capacidades);
  } catch (e) { skills = []; }

  const topSkills = skills.slice(0, 3).map(s => `<span class="skill-tag">${s}</span>`).join('');

  const nota = parseFloat(candidato.nota) || 0;
  const matchScore = nota > 100 ? 100 : (nota < 0 ? 0 : nota);
  const corBarra = getCorPorPontuacao(matchScore);

  card.innerHTML = `
    <div class="pipeline-card-header">
      <div class="pipeline-card-menu" style="cursor: grab;"><i class="fa-solid fa-grip-vertical"></i></div>
      <div class="pipeline-card-name">${candidato.nome || 'Sem Nome'}</div>
    </div>
    
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

  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.setData('text/plain', candidato.id);
    e.dataTransfer.effectAllowed = 'move';
    card.classList.add('dragging');
    setTimeout(() => { card.style.display = 'none'; }, 0);
  });

  card.addEventListener('dragend', () => {
    card.classList.remove('dragging');
    card.style.display = 'block';
    document.querySelectorAll('.pipeline-column-body').forEach(c => c.classList.remove('drag-over'));
  });

  return card;
}

function configurarDragAndDrop() {
  const columns = document.querySelectorAll('.pipeline-column-body');

  columns.forEach(column => {
    column.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      column.classList.add('drag-over');
    });

    column.addEventListener('dragleave', () => {
      column.classList.remove('drag-over');
    });

    column.addEventListener('drop', async (e) => {
      e.preventDefault();
      column.classList.remove('drag-over');

      const cardId = e.dataTransfer.getData('text/plain');
      const card = document.querySelector(`.pipeline-card[data-id="${cardId}"]`);

      if (card) {
        const parentColumn = column.parentElement;
        const novoStatusTitulo = parentColumn.querySelector('h3').textContent.trim();

        card.style.display = 'block';
        column.appendChild(card);

        await atualizarStatusCandidato(cardId, novoStatusTitulo);
        recalcularContadores();
      }
    });
  });
}

async function atualizarStatusCandidato(id, novoStatus) {
  const { error } = await supabaseClient
    .from('candidatos')
    .update({ status: novoStatus })
    .eq('id', id);

  if (error) {
    console.error('Erro ao atualizar status:', error);
    alert('Erro ao mover candidato.');
    carregarPipeline();
  }
}

function recalcularContadores() {
  for (let i = 1; i <= 6; i++) {
    const colBody = document.querySelector(`.pipeline-column-${i} .pipeline-column-body`);
    const count = colBody ? colBody.children.length : 0;

    const colCount = document.querySelector(`.pipeline-column-${i} .pipeline-column-count`);
    if (colCount) colCount.textContent = count;

    const summaryCounts = document.querySelectorAll('.pipeline-summary-count');
    if (summaryCounts[i - 1]) summaryCounts[i - 1].textContent = count;
  }
}

// ============================================
// SEÇÃO 6: INICIALIZAÇÃO
// ============================================

document.addEventListener('DOMContentLoaded', function () {
  configurarModais();
  if (typeof configurarModalCandidato === 'function') configurarModalCandidato();

  if (document.querySelector('.pipeline-main')) {
    carregarPipeline();
  }

  // Carrega dados específicos da página, se os containers existirem
  if (document.getElementById('candidatesCardsContainer')) {
    carregarUsuarios(); // Candidatos card view
    carregarCandidatos(); // Contagem
  }

  if (document.getElementById('vagasContainer')) {
    carregarVagas();
    carregarVagasAbertas();
  }

  // Carrega métricas do dashboard principal (index.html)
  if (document.querySelector('.cards') && !document.getElementById('candidatesCardsContainer') && !document.getElementById('vagasContainer')) {
    carregarCandidatos(); // Contagem total de candidatos
    carregarVagasAbertas(); // Contagem de vagas abertas
  }

  if (document.getElementById('entrevistasContainer')) {
    carregarEntrevistas();
  }
});
