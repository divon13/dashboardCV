/**
 * Carrega o pipeline de candidatos
 */
async function carregarPipeline() {
    const mapStatusToColumn = {
        'Aplicado': 1,
        'Triagem': 2,
        'Entrevista técnica': 3,
        'Adequação à cultura': 4,
        'Oferta enviada': 5,
        'Contratado': 6
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
        .select("id, Titulo, data_abertura");

    const mapaVagas = {};
    const mapaVagasPorTitulo = {};
    const filtroSelect = document.getElementById('filtroVaga');

    // Preserva seleção atual
    const filtroAtual = filtroSelect ? filtroSelect.value : 'todos';

    if (vagas) {
        vagas.forEach(v => {
            mapaVagas[v.id] = v.Titulo;
            mapaVagasPorTitulo[v.Titulo] = v;
        });

        // Popula o select se ele existir e estiver vazio (exceto 'todos')
        if (filtroSelect && filtroSelect.options.length <= 1) {
            vagas.forEach(v => {
                const option = document.createElement('option');
                option.value = v.Titulo; // Use Título as value to match candidate data
                option.textContent = v.Titulo;
                filtroSelect.appendChild(option);
            });

            // Re-aplica listeners quando mudar
            filtroSelect.onchange = carregarPipeline;
        }
    }

    // Restaura seleção se possível
    if (filtroSelect) filtroSelect.value = filtroAtual;

    // Reset UI
    for (let i = 1; i <= 6; i++) {
        const colBody = document.querySelector(`.pipeline-column-${i} .pipeline-column-body`);
        if (colBody) colBody.innerHTML = '';
        const colCount = document.querySelector(`.pipeline-column-${i} .pipeline-column-count`);
        if (colCount) colCount.textContent = '0';
    }
    document.querySelectorAll('.pipeline-summary-count').forEach(el => el.textContent = '0');

    const contadores = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    let countRejeitados = 0;

    for (const candidato of candidatos) {
        // Filtragem por vaga
        // Se filtro != todos, e candidato.vaga_sugerida != id, skip
        if (filtroAtual !== 'todos' && String(candidato.vaga_sugerida) !== String(filtroAtual)) {
            continue;
        }

        // Skip rejected candidates
        if (candidato.status === 'Rejeitado') {
            countRejeitados++;
            continue;
        }

        let status = candidato.status ? candidato.status.toLowerCase().trim() : 'Aplicado';
        if (!mapStatusToColumn[status]) status = 'Aplicado';

        const colIndex = mapStatusToColumn[status];
        const colBody = document.querySelector(`.pipeline-column-${colIndex} .pipeline-column-body`);

        if (colBody) {
            const vagaObj = candidato.vaga_sugerida ? mapaVagasPorTitulo[candidato.vaga_sugerida] : null;

            const nomeVaga = vagaObj ? vagaObj.Titulo : (candidato.vaga_sugerida || 'Geral');

            const card = criarCardPipeline(candidato, nomeVaga, vagaObj);
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

    // Update Rejected count
    const rejectedCountEl = document.getElementById('count-rejeitados');
    if (rejectedCountEl) rejectedCountEl.textContent = countRejeitados;

    configurarDragAndDrop();
}

// Recarrega pipeline quando uma entrevista é agendada com sucesso
window.addEventListener('interview-scheduled', () => {
    carregarPipeline();
});

function criarCardPipeline(candidato, nomeVaga, vagaObj) {
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
    <div class="pipeline-card-header" style="justify-content: space-between;">
      <div style="display:flex; align-items:center;">
          <div class="pipeline-card-menu" style="cursor: grab; margin-right:8px;"><i class="fa-solid fa-grip-vertical"></i></div>
          <div class="pipeline-card-name">${candidato.nome || 'Sem Nome'}</div>
      </div>
      <div class="kebab-menu-container">
        <button type="button" class="kebab-btn" data-id="${candidato.id}"><i class="fa-solid fa-ellipsis"></i></button>
        <div id="pipeline-menu-${candidato.id}" class="kebab-dropdown">
            <button class="dropdown-item" data-id="${candidato.id}"><i class="fa-regular fa-eye"></i> Ver Perfil</button>
            <button class="dropdown-item" data-id="${candidato.id}"><i class="fa-regular fa-calendar-plus"></i> Agendar Entrevista</button>
            <button class="dropdown-item delete-btn" data-id="${candidato.id}"><i class="fa-regular fa-circle-xmark"></i> Rejeitar</button>
        </div>
      </div>
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

    // Configura evento do menu kebab
    const kebabBtn = card.querySelector('.kebab-btn');
    const dropdown = card.querySelector('.kebab-dropdown');

    if (kebabBtn && dropdown) {
        kebabBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Impede drag start
            e.preventDefault();

            // Fecha outros menus abertos
            document.querySelectorAll('.kebab-dropdown.show').forEach(m => {
                if (m !== dropdown) {
                    m.classList.remove('show');
                    // Remove active-card do pai se existir
                    const parentCard = m.closest('.pipeline-card');
                    if (parentCard) parentCard.classList.remove('active-card');
                }
            });
            document.querySelectorAll('.kebab-btn.active').forEach(b => {
                if (b !== kebabBtn) b.classList.remove('active');
            });

            dropdown.classList.toggle('show');
            kebabBtn.classList.toggle('active');

            // Toggle z-index fix no card pai
            card.classList.toggle('active-card');
        });
    }

    // Impede que clicks no dropdown iniciem drag
    if (dropdown) {
        dropdown.addEventListener('mousedown', (e) => e.stopPropagation());
        dropdown.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Impede propagação para o card

                // Fecha menu
                dropdown.classList.remove('show');
                kebabBtn.classList.remove('active');
                card.classList.remove('active-card');

                const actionText = btn.textContent.trim();

                if (actionText.includes('Ver Perfil')) {
                    if (typeof abrirModalDetalhes === 'function') {
                        abrirModalDetalhes(candidato, vagaObj);
                    }
                } else if (actionText.includes('Agendar Entrevista')) {
                    const modal = document.getElementById('agendamentoModal');
                    if (modal) {
                        modal.style.display = 'flex';
                        if (typeof populateModalSelects === 'function') {
                            await populateModalSelects();
                        }

                        // Preencher candidato
                        const input = document.getElementById('searchCandidato');
                        const hidden = document.getElementById('agCandidato');
                        if (input && hidden) {
                            input.value = candidato.nome || '';
                            hidden.value = candidato.id;
                        }

                        // Preencher vaga se existir
                        if (vagaObj) {
                            const inputV = document.getElementById('searchVaga');
                            const hiddenV = document.getElementById('agVaga');
                            if (inputV && hiddenV) {
                                inputV.value = vagaObj.Titulo || '';
                                hiddenV.value = vagaObj.id || '';
                            }
                        }
                    }
                } else if (actionText.includes('Rejeitar')) {
                    // Abre modal de confirmação
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

                // VICE VERSA: Se moveu para Entrevista técnica, abrir modal de agendamento 
                // E SÓ DEPOIS confirmar a mudança. Se cancelar, reverter.
                if (novoStatusTitulo === 'Entrevista técnica') {
                    // Visually move first
                    column.appendChild(card);
                    recalcularContadores();

                    const modal = document.getElementById('agendamentoModal');
                    if (modal) {
                        modal.style.display = 'flex';

                        // Populate selects
                        if (typeof populateModalSelects === 'function') {
                            await populateModalSelects();
                        }

                        // Pre-fill candidate
                        const candidateName = card.querySelector('.pipeline-card-name').textContent;
                        const input = document.getElementById('searchCandidato');
                        const hidden = document.getElementById('agCandidato');

                        if (input && hidden) {
                            input.value = candidateName;
                            hidden.value = cardId;
                            input.dispatchEvent(new Event('input')); // Trigger filters if needed
                        }

                        // REVERT LOGIC
                        const btnClose = document.getElementById('closeAgendamentoModal');
                        const btnCancel = document.getElementById('cancelAgendamento');
                        const originalParent = document.querySelector(`.pipeline-column-body[data-original-parent="${cardId}"]`) || document.querySelector(`.pipeline-card[data-id="${cardId}"]`)?.parentElement;
                        // Note: we can't easily grab originalParent here unless we saved it before appendChild.
                        // However, we can simply infer "revert" means go back to where it was? 
                        // Actually, 'card' is already in 'column'. 'originalParent' is lost unless we grabbed it.
                        // Wait, we can't grab it here easily because we already did appendChild above.
                        // BUT, we have 'card.dataset.status' which holds the OLD status (we haven't updated it locally or DB yet).
                        // So we can find the old column based on card.dataset.status.

                        const oldStatus = card.dataset.status;
                        const mapStatusToColumn = {
                            'Aplicado': 1, 'Triagem': 2, 'Entrevista técnica': 3,
                            'Adequação à cultura': 4, 'Oferta enviada': 5, 'Contratado': 6
                        };
                        const oldColIndex = mapStatusToColumn[oldStatus] || 1;
                        const revertTarget = document.querySelector(`.pipeline-column-${oldColIndex} .pipeline-column-body`);

                        // Cleanup function
                        const cleanup = () => {
                            window.removeEventListener('interview-scheduled', onSuccess);
                            if (btnClose) btnClose.removeEventListener('click', onRevert);
                            if (btnCancel) btnCancel.removeEventListener('click', onRevert);
                            window.removeEventListener('click', onOutside);
                        };

                        const onSuccess = () => {
                            // Interview booked! Status is updated in DB by entrevistas.js.
                            // We just need to update local card dataset
                            card.dataset.status = 'Entrevista técnica';
                            cleanup();
                        };

                        const onRevert = () => {
                            // Move card back
                            if (revertTarget) {
                                revertTarget.appendChild(card);
                                recalcularContadores();
                            }
                            cleanup();
                        };

                        const onOutside = (e) => {
                            if (e.target === modal) onRevert();
                        }

                        // Attach listeners
                        window.addEventListener('interview-scheduled', onSuccess);
                        if (btnClose) btnClose.addEventListener('click', onRevert);
                        if (btnCancel) btnCancel.addEventListener('click', onRevert);
                        window.addEventListener('click', onOutside);
                    }
                } else {
                    // Normal flow for other columns
                    await atualizarStatusCandidato(cardId, novoStatusTitulo);
                    recalcularContadores();
                }
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

// Fechar menus ao clicar fora
document.addEventListener('click', (e) => {
    if (!e.target.closest('.kebab-menu-container')) {
        document.querySelectorAll('.kebab-dropdown.show').forEach(m => {
            m.classList.remove('show');
            const parentCard = m.closest('.pipeline-card');
            if (parentCard) parentCard.classList.remove('active-card');
        });
        document.querySelectorAll('.kebab-btn.active').forEach(b => b.classList.remove('active'));
    }
});

// Setup modal de rejeição
document.addEventListener('DOMContentLoaded', () => {
    const modalRejeicao = document.getElementById('confirmRejeicaoModal');
    const btnCancel = document.getElementById('cancelarRejeicao');
    const btnConfirm = document.getElementById('confirmarRejeicao');

    if (btnCancel && modalRejeicao) {
        btnCancel.addEventListener('click', () => {
            modalRejeicao.style.display = 'none';
        });
    }

    if (btnConfirm && modalRejeicao) {
        btnConfirm.addEventListener('click', async () => {
            const idCandidato = document.getElementById('idCandidatoRejeicao').value;
            if (idCandidato) {
                await rejeitarCandidato(idCandidato);
                modalRejeicao.style.display = 'none';
            }
        });
    }

    // Fechar ao clicar fora
    window.addEventListener('click', (e) => {
        if (e.target === modalRejeicao) {
            modalRejeicao.style.display = 'none';
        }
    });
});

async function rejeitarCandidato(id) {
    const { error } = await supabaseClient
        .from('candidatos')
        .update({ status: 'Rejeitado' })
        .eq('id', id);

    if (error) {
        console.error('Erro ao rejeitar candidato:', error);
        alert('Erro ao rejeitar candidato.');
    } else {
        // Recarrega o pipeline
        carregarPipeline();
    }
}
