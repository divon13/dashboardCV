async function carregarUsuarios() {
  const { data, error } = await supabaseClient
    .from("candidatos")
    .select("*");

  if (error) {
    console.error("Erro ao carregar:", error);
    return;
  }

  const tbody = document.querySelector("#candidatesTable tbody");
  if (!tbody) {
    console.error("Tabela não encontrada: #candidatesTable tbody");
    return;
  }
  tbody.innerHTML = "";

  data.forEach(candidatos => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
    <td>${candidatos.nome}</td>
    <td>${candidatos.email}</td>
    <td>${candidatos.Endereco}</td>
    <td>${candidatos.nota}</td>
    <td>${candidatos.vaga_sugerida}</td>
    `;

    tbody.appendChild(tr);
  });
}

carregarUsuarios();

async function carregarVagas() {
  // Pega as vagas e inclui os candidatos relacionados para poder contar
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

  data.forEach(vaga => {
    const card = document.createElement('div');
    card.className = 'card-vaga';
    // calcula quantidade de candidatos a partir do relacionamento retornado
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

  // eventos
  container.querySelectorAll('.edit-btn').forEach(btn => {
    btn.onclick = function() {
      const id = this.getAttribute('data-id');
      const vaga = data.find(v => v.id == id);
      if (!vaga) return;
      document.getElementById('vagaId').value = vaga.id;
      document.getElementById('titulo').value = vaga.Titulo || '';
      document.getElementById('descricao').value = vaga.Descricao || '';
      document.getElementById('requisitos').value = vaga.Requisitos || '';
      document.getElementById('dataEncerramento').value = vaga.data_encerramento ? vaga.data_encerramento.substring(0,10) : '';
      document.getElementById('vagaModal').style.display = 'flex';
    };
  });

  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.onclick = function() {
      const id = this.getAttribute('data-id');
      const vaga = data.find(v => v.id == id);
      if (!vaga) return;
      // abre modal de confirmação e mostra título
      const confirmModal = document.getElementById('confirmDeleteModal');
      const deleteTitulo = document.getElementById('deleteVagaTitulo');
      const confirmarBtn = document.getElementById('confirmarDeleteBtn');
      if (deleteTitulo) deleteTitulo.textContent = vaga.Titulo ? `Vaga: ${vaga.Titulo}` : '';
      if (confirmarBtn) confirmarBtn.setAttribute('data-id', id);
      if (confirmModal) confirmModal.style.display = 'flex';
    };
  });

  container.querySelectorAll('.view-btn').forEach(btn => {
    btn.onclick = function() {
      const id = this.getAttribute('data-id');
      const vaga = data.find(v => v.id == id);
      if (!vaga) return;
      // popular campos do modal de detalhes
      const detTitulo = document.getElementById('det-titulo');
      const detDescricao = document.getElementById('det-descricao');
      const detRequisitos = document.getElementById('det-requisitos');
      const detStatus = document.getElementById('det-status');
      const detAbertura = document.getElementById('det-abertura');
      const detEncerramento = document.getElementById('det-encerramento');

      if (detTitulo) detTitulo.textContent = vaga.Titulo || '';
      if (detDescricao) detDescricao.textContent = vaga.Descricao || '';
      if (detRequisitos) detRequisitos.textContent = vaga.Requisitos || '';
      if (detStatus) detStatus.textContent = vaga.status_vagas || '';
      if (detAbertura) detAbertura.textContent = vaga.data_abertura ? formatarData(vaga.data_abertura) : '';
      if (detEncerramento) detEncerramento.textContent = vaga.data_encerramento ? formatarData(vaga.data_encerramento) : '';

      const detalhesModal = document.getElementById('vagaDetalhesModal');
      if (detalhesModal) detalhesModal.style.display = 'flex';
    };
  });
}

carregarVagas();

async function carregarCandidatos() {
  const { count, error } = await supabaseClient.from("candidatos").select("*", { count: "exact" });
  
  if (error) {
    console.error("Erro ao carregar contagem de candidatos:", error);
    return;
  } else {
    const totalCandidatos = count || 0;
    const candidateCountElement = document.querySelector(".card:first-child p")
    if (candidateCountElement) {
      candidateCountElement.textContent = totalCandidatos;
    }
  }
}

carregarCandidatos();
async function carregarVagasAbertas() {
  const { count, error } = await supabaseClient.from("Vagas").select("*", { count: "exact" }).eq('status_vagas', 'aberta');

  if (error) {
    console.error("Erro ao carregar contagem de vagas abertas:", error);
    return;
  } else {
    const totalVagasAbertas = count || 0;
    const vagasAbertasCountElement = document.querySelector(".card:nth-child(3) p")
    if (vagasAbertasCountElement) {
      vagasAbertasCountElement.textContent = totalVagasAbertas;
    }
  }
}

carregarVagasAbertas();

// CRUD Vagas - Modal

document.addEventListener('DOMContentLoaded', function() {
  const btnAbrirModal = document.getElementById('btnAbrirModal');
  const vagaModal = document.getElementById('vagaModal');
  const btnFecharModal = document.getElementById('btnFecharModal');
  const btnCancelar = document.getElementById('btnCancelar');

  // Modal de confirmação de exclusão
  const confirmDeleteModal = document.getElementById('confirmDeleteModal');
  const fecharConfirmDelete = document.getElementById('fecharConfirmDelete');
  const cancelarDeleteBtn = document.getElementById('cancelarDeleteBtn');
  const confirmarDeleteBtn = document.getElementById('confirmarDeleteBtn');
  // Modal de detalhes
  const detalhesModal = document.getElementById('vagaDetalhesModal');
  const fecharDetalhes = document.getElementById('fecharDetalhes');
  const fecharDetalhesBtn = document.getElementById('fecharDetalhesBtn');

  if (btnAbrirModal && vagaModal) {
    btnAbrirModal.onclick = function() {
      // Limpa o formulário para criar nova vaga
      document.getElementById('vagaForm').reset();
      document.getElementById('vagaId').value = '';
      vagaModal.style.display = 'flex';
    };
  }
  if (btnFecharModal && vagaModal) {
    btnFecharModal.onclick = function() {
      vagaModal.style.display = 'none';
    };
  }
  if (btnCancelar && vagaModal) {
    btnCancelar.onclick = function(e) {
      e.preventDefault();
      vagaModal.style.display = 'none';
    };
  }

  // Handlers para modal de confirmação
  if (fecharConfirmDelete && confirmDeleteModal) {
    fecharConfirmDelete.onclick = function() { confirmDeleteModal.style.display = 'none'; };
  }
  if (cancelarDeleteBtn && confirmDeleteModal) {
    cancelarDeleteBtn.onclick = function() { confirmDeleteModal.style.display = 'none'; };
  }
  if (confirmarDeleteBtn && confirmDeleteModal) {
    confirmarDeleteBtn.onclick = async function() {
      const id = this.getAttribute('data-id');
      if (!id) return;
      const { error } = await supabaseClient.from('Vagas').delete().eq('id', id);
      if (error) {
        alert('Erro ao apagar vaga: ' + error.message);
      } else {
        carregarVagas();
      }
      confirmDeleteModal.style.display = 'none';
    };
  }

  // Fecha modais ao clicar fora do conteúdo
  window.onclick = function(event) {
    if (event.target === vagaModal) {
      vagaModal.style.display = 'none';
    }
    if (confirmDeleteModal && event.target === confirmDeleteModal) {
      confirmDeleteModal.style.display = 'none';
    }
    if (detalhesModal && event.target === detalhesModal) {
      detalhesModal.style.display = 'none';
    }
  };

  // Fecha modais com ESC
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      if (vagaModal && vagaModal.style.display === 'flex') vagaModal.style.display = 'none';
      if (confirmDeleteModal && confirmDeleteModal.style.display === 'flex') confirmDeleteModal.style.display = 'none';
      if (detalhesModal && detalhesModal.style.display === 'flex') detalhesModal.style.display = 'none';
    }
  });
  // Handlers para modal de detalhes (X e botão Fechar)
  if (fecharDetalhes && detalhesModal) {
    fecharDetalhes.onclick = function() { detalhesModal.style.display = 'none'; };
  }
  if (fecharDetalhesBtn && detalhesModal) {
    fecharDetalhesBtn.onclick = function() { detalhesModal.style.display = 'none'; };
  }
});

function formatarData(dataISO) {
  if (!dataISO) return '';
  const data = new Date(dataISO);
  if (isNaN(data.getTime())) return dataISO;
  const dia = String(data.getDate()).padStart(2, '0');
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const ano = data.getFullYear();
  const hora = String(data.getHours()).padStart(2, '0');
  const min = String(data.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${ano} (${hora}:${min})`;
}

// 4. meter dados do formulário no banco de dados
vagaForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  // Coleta os dados do formulário
  const id = document.getElementById('vagaId').value;
  const Titulo = document.getElementById('titulo').value;
  const Descricao = document.getElementById('descricao').value;
  const Requisitos = document.getElementById('requisitos').value;
  const data_encerramento = document.getElementById('dataEncerramento').value;
  const AdminID = 1; // placeholder

  const dadosVaga = {
    Titulo,
    Descricao,
    Requisitos,
    data_encerramento,
    AdminID
  };

  try {
    if (id) {
      // Atualiza vaga existente
      console.log('Atualizando vaga id=', id, dadosVaga);
      const { data, error } = await supabaseClient
        .from('Vagas')
        .update(dadosVaga)
        .eq('id', id)
        .select();

      if (error) throw error;
      console.log('Vaga atualizada:', data[0]);
    } else {
      // Insere nova vaga
      console.log('Inserindo nova vaga:', dadosVaga);
      const { data, error } = await supabaseClient
        .from('Vagas')
        .insert([dadosVaga])
        .select();

      if (error) throw error;
      console.log('Vaga criada:', data[0]);
    }

    // sucesso: recarrega e fecha modal
    carregarVagas();
    document.getElementById('vagaModal').style.display = 'none';
    document.getElementById('vagaForm').reset();
    document.getElementById('vagaId').value = '';
  } catch (err) {
    console.error('Erro ao salvar vaga:', err.message || err);
    alert('Erro ao salvar vaga: ' + (err.message || err));
  }
});