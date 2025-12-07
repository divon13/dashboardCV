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
          <button class="btn-link view-btn" data-id="${vaga.id}">View Details</button>
          <button class="btn-link edit-btn" data-id="${vaga.id}">Edit</button>
          <button class="btn-link delete-btn" data-id="${vaga.id}">Delete</button>
        </div>
      </div>
      <div class="card-bottom">
        <span>🗓️ ${vaga.data_abertura ? formatarData(vaga.data_abertura) : ''}</span>
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
    btn.onclick = async function() {
      const id = this.getAttribute('data-id');
      if (!confirm('Tem certeza que deseja apagar esta vaga?')) return;
      const { error } = await supabaseClient.from('Vagas').delete().eq('id', id);
      if (error) {
        alert('Erro ao apagar vaga: ' + error.message);
      } else {
        carregarVagas();
      }
    };
  });

  container.querySelectorAll('.view-btn').forEach(btn => {
    btn.onclick = function() {
      const id = this.getAttribute('data-id');
      const vaga = data.find(v => v.id == id);
      if (!vaga) return;
      alert(`\n${vaga.Titulo}\n\n${vaga.Descricao}`);
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
  // Fecha modal ao clicar fora do conteúdo
  window.onclick = function(event) {
    if (event.target === vagaModal) {
      vagaModal.style.display = 'none';
    }
  };
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