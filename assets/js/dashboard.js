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
  const { data, error } = await supabaseClient
    .from("Vagas")
    .select("*");

  if (error) {
    console.error("Erro ao carregar:", error);
    return;
  }

  const tbody = document.querySelector("#vagasTable tbody");
  if (!tbody) {
    console.error("Tabela não encontrada: #vagasTable tbody");
    return;
  }
  tbody.innerHTML = "";

  data.forEach(Vagas => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
    <td>${Vagas.Titulo}</td>
    <td>${Vagas.Descricao}</td>
    <td>${Vagas.Requisitos}</td>
    <td>${Vagas.status_vagas}</td>
    <td>${formatarData(Vagas.data_abertura)}</td>
    <td>${formatarData(Vagas.data_encerramento)}</td>
    `;

    tbody.appendChild(tr);
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
    const Titulo = document.getElementById('titulo').value;
    const Descricao = document.getElementById('descricao').value;
    const Requisitos = document.getElementById('requisitos').value;
    const AdminID = 1 ; // placeholder
    const data_encerramento = document.getElementById('dataEncerramento').value;

    const dadosVaga = {
        Titulo,
        Descricao,
        Requisitos,
        data_encerramento,
        AdminID
    };

    console.log('Tentando inserir nova vaga:', dadosVaga);

    const { data, error } = await supabaseClient
        .from('Vagas')
        .insert([dadosVaga])
        .select(); 

    if (error) {
        console.error('❌ Erro ao criar a vaga:', error.message);
        alert('Erro ao criar a vaga: ' + error.message);
    } else {
        console.log('✅ Vaga criada com sucesso:', data[0]);
        carregarVagas();
        document.getElementById('vagaModal').style.display = 'none';
        document.getElementById('vagaForm').reset();
    }
});