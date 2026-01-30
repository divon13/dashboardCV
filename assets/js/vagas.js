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
    // Configura menu Kebab
    container.querySelectorAll('.kebab-btn').forEach(btn => {
        btn.onclick = function (e) {
            e.stopPropagation();
            const id = this.getAttribute('data-id');
            const menu = document.getElementById(`menu-${id}`);

            // Fecha outros menus
            document.querySelectorAll('.kebab-dropdown').forEach(m => {
                if (m.id !== `menu-${id}`) m.classList.remove('show');
            });
            document.querySelectorAll('.kebab-btn').forEach(b => {
                if (b !== this) b.classList.remove('active');
            });

            // Toggle menu atual
            if (menu) menu.classList.toggle('show');
            this.classList.toggle('active');
        };
    });

    // Fecha menu ao clicar em uma opção
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
    // Ajuste se necessário para seletor mais específico
    const vagasAbertasCountElement = document.querySelector(".card:nth-child(3) p");
    if (vagasAbertasCountElement) {
        vagasAbertasCountElement.textContent = totalVagasAbertas;
    }
}

// Handler do formulário de criação/edição de vagas
document.addEventListener('DOMContentLoaded', () => {
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
                if (typeof carregarVagas === 'function') carregarVagas();

                const modal = document.getElementById('vagaModal');
                if (modal) modal.style.display = 'none';

                vagaForm.reset();
                document.getElementById('vagaId').value = '';
            } catch (err) {
                console.error('Erro ao salvar vaga:', err.message || err);
                alert('Erro ao salvar vaga: ' + (err.message || err));
            }
        });
    }

    // Fecha menus ao clicar fora
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
