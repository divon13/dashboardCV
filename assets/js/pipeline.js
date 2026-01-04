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
