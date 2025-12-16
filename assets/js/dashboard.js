// ============================================
// DASHBOARD - GERENCIAMENTO DE CANDIDATOS E VAGAS
// ============================================

// ============================================
// SEÇÃO 1: FUNÇÕES UTILITÁRIAS
// ============================================

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
 * Carrega e exibe a lista de candidatos na tabela
 */
async function carregarUsuarios() {
  const { data, error } = await supabaseClient
    .from("candidatos")
    .select("*");

  if (error) {
    console.error("Erro ao carregar candidatos:", error);
    return;
  }

  const tbody = document.querySelector("#candidatesTable tbody");
  if (!tbody) {
    console.error("Tabela não encontrada: #candidatesTable tbody");
    return;
  }
  
  tbody.innerHTML = "";

  data.forEach(candidato => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${candidato.nome}</td>
      <td>${candidato.email}</td>
      <td>${candidato.Endereco}</td>
      <td>${candidato.nota}</td>
      <td>${candidato.vaga_sugerida}</td>
    `;
    tbody.appendChild(tr);
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
        <span>🗓️ ${vaga.data_encerramento ? formatarData(vaga.data_encerramento) : ''}</span>
        <span>👤 ${candidatosCount} candidatos</span>
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
    btn.onclick = function() {
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
    btn.onclick = function() {
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
    btn.onclick = function() {
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
    elementos.btnAbrirModal.onclick = function() {
      document.getElementById('vagaForm').reset();
      document.getElementById('vagaId').value = '';
      elementos.vagaModal.style.display = 'flex';
    };
  }

  if (elementos.btnFecharModal && elementos.vagaModal) {
    elementos.btnFecharModal.onclick = function() {
      elementos.vagaModal.style.display = 'none';
    };
  }

  if (elementos.btnCancelar && elementos.vagaModal) {
    elementos.btnCancelar.onclick = function(e) {
      e.preventDefault();
      elementos.vagaModal.style.display = 'none';
    };
  }

  // Modal de confirmação de exclusão
  if (elementos.fecharConfirmDelete && elementos.confirmDeleteModal) {
    elementos.fecharConfirmDelete.onclick = function() {
      elementos.confirmDeleteModal.style.display = 'none';
    };
  }

  if (elementos.cancelarDeleteBtn && elementos.confirmDeleteModal) {
    elementos.cancelarDeleteBtn.onclick = function() {
      elementos.confirmDeleteModal.style.display = 'none';
    };
  }

  if (elementos.confirmarDeleteBtn && elementos.confirmDeleteModal) {
    elementos.confirmarDeleteBtn.onclick = async function() {
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
    elementos.fecharDetalhes.onclick = function() {
      elementos.detalhesModal.style.display = 'none';
    };
  }

  if (elementos.fecharDetalhesBtn && elementos.detalhesModal) {
    elementos.fecharDetalhesBtn.onclick = function() {
      elementos.detalhesModal.style.display = 'none';
    };
  }

  // Fecha modais ao clicar fora do conteúdo
  window.onclick = function(event) {
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
  document.addEventListener('keydown', function(e) {
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
// SEÇÃO 5: INICIALIZAÇÃO
// ============================================

// Aguarda o DOM estar pronto antes de inicializar
document.addEventListener('DOMContentLoaded', function() {
  configurarModais();
  
  // Carrega os dados iniciais
  carregarUsuarios();
  carregarCandidatos();
  carregarVagas();
  carregarVagasAbertas();
  carregarEntrevistas();
});
