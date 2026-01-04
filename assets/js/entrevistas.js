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
      candidatos(nome),
      Entrevistador(Nome)
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
        // Pode não ser erro se estiver em outra página
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
      <span><i class="fa-solid fa-user"></i> ${entrevista.Entrevistador ? entrevista.Entrevistador.Nome : 'Não definido'}</span>
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
// REDESIGN ENTREVISTAS (CALENDAR LOGIC)
// ============================================

let currentDate = new Date();
let selectedDate = new Date();
let interviewsCache = []; // Store fetched interviews

async function initCalendarPage() {
    console.log('Iniciando página de entrevistas...');

    // Initial Render
    renderCalendar(currentDate);
    updateStatsCounters(); // Initialize stats

    // Event Listeners
    const prevMonth = document.getElementById('prevMonth');
    if (prevMonth) prevMonth.addEventListener('click', () => changeMonth(-1));

    const nextMonth = document.getElementById('nextMonth');
    if (nextMonth) nextMonth.addEventListener('click', () => changeMonth(1));

    const goToday = document.getElementById('goToday');
    if (goToday) goToday.addEventListener('click', () => {
        currentDate = new Date();
        selectedDate = new Date();
        renderCalendar(currentDate);
        fetchMonthInterviews(currentDate);
    });

    // Filters
    const btnClearFilters = document.getElementById('btnClearFilters');
    if (btnClearFilters) btnClearFilters.addEventListener('click', () => {
        document.getElementById('filterType').value = 'all';
        document.getElementById('filterStatus').value = 'all';
        renderSidePanel(selectedDate); // Re-render with cleared filters
    });

    const filterType = document.getElementById('filterType');
    if (filterType) filterType.addEventListener('change', () => renderSidePanel(selectedDate));

    const filterStatus = document.getElementById('filterStatus');
    if (filterStatus) filterStatus.addEventListener('change', () => renderSidePanel(selectedDate));

    // Toggle Views (Placeholder visual only for now)
    const viewCalendar = document.getElementById('viewCalendar');
    if (viewCalendar) viewCalendar.addEventListener('click', (e) => setActiveView(e.target, 'calendar'));

    const viewList = document.getElementById('viewList');
    if (viewList) viewList.addEventListener('click', (e) => setActiveView(e.target, 'list'));

    // Initial Fetch
    await fetchMonthInterviews(currentDate);

    // Modal Logic
    setupAgendamentoModal();
}

function setupAgendamentoModal() {
    const modal = document.getElementById('agendamentoModal');
    const btnOpen = document.getElementById('btnNovoAgendamento');
    const btnClose = document.getElementById('closeAgendamentoModal');
    const btnCancel = document.getElementById('cancelAgendamento');
    const form = document.getElementById('agendamentoForm');

    if (btnOpen) {
        btnOpen.addEventListener('click', async () => {
            modal.style.display = 'flex';
            await populateModalSelects();
        });
    }

    const closeModal = () => { if (modal) modal.style.display = 'none'; if (form) form.reset(); };
    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);

    // Close on click outside
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleAgendamentoSubmit(form);
            closeModal();
            fetchMonthInterviews(currentDate); // Refresh calendar
        });
    }
}

async function populateModalSelects() {
    const candSelect = document.getElementById('agCandidato');
    const { data: candidates } = await supabaseClient.from('candidatos').select('id, nome');
    if (candidates && candSelect) {
        candSelect.innerHTML = '<option value="">Selecione um candidato...</option>';
        candidates.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.nome;
            candSelect.appendChild(opt);
        });
    }

    // Populate Vagas
    const vagaSelect = document.getElementById('agVaga');
    const { data: vagas } = await supabaseClient.from('Vagas').select('id, Titulo');
    if (vagas && vagaSelect) {
        vagaSelect.innerHTML = '<option value="">Selecione uma vaga...</option>';
        vagas.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v.id;
            opt.textContent = v.Titulo;
            vagaSelect.appendChild(opt);
        });
    }

    // Populate Entrevistadores
    const entrevistadorSelect = document.getElementById('agEntrevistador');
    const { data: entrevistadores } = await supabaseClient.from('Entrevistador').select('id, Nome');
    if (entrevistadores && entrevistadorSelect) {
        entrevistadorSelect.innerHTML = '<option value="">Selecione um entrevistador...</option>';
        entrevistadores.forEach(e => {
            const opt = document.createElement('option');
            opt.value = e.id;
            opt.textContent = e.Nome;
            entrevistadorSelect.appendChild(opt);
        });
    }
}

async function handleAgendamentoSubmit(form) {
    const candidatoId = document.getElementById('agCandidato').value;
    const vagaId = document.getElementById('agVaga').value;
    const tipo = document.getElementById('agTipo').value;
    const dataHora = document.getElementById('agDataHora').value;
    const entrevistadorId = document.getElementById('agEntrevistador').value;
    const obs = document.getElementById('agObs').value;

    const { error } = await supabaseClient.from('Entrevistas').insert([{
        "Candidato_ID": candidatoId,
        "Vagas_ID": vagaId,
        "Data": dataHora,
        "Entrevistador": entrevistadorId,
        "Observacoes": obs,
        "status": 'Agendada',
        "Tipo de entrevista": tipo
    }]);

    if (error) {
        console.error('Error saving interview:', error);
        alert('Erro ao agendar entrevista: ' + error.message);
    } else {
        alert('Entrevista agendada com sucesso!');
    }
}

function setActiveView(btn, view) {
    document.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
    // Handle icon click vs button click
    const target = btn.closest('.toggle-btn');
    if (target) target.classList.add('active');

    if (view === 'list') {
        alert('Visualização em lista em desenvolvimento. Voltando ao calendário.');
        const viewCalendar = document.getElementById('viewCalendar');
        if (viewCalendar) viewCalendar.click();
    }
}

function changeMonth(delta) {
    currentDate.setMonth(currentDate.getMonth() + delta);
    renderCalendar(currentDate);
    fetchMonthInterviews(currentDate);
}

function renderCalendar(date) {
    const year = date.getFullYear();
    const month = date.getMonth();

    // Update Header
    const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    const display = document.getElementById('currentMonthDisplay');
    if (display) display.textContent = `${monthNames[month]} ${year}`;

    const daysGrid = document.getElementById('calendarDaysGrid');
    if (!daysGrid) return;

    daysGrid.innerHTML = '';

    // Logic to generate days
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 (Sun) - 6 (Sat)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    // Prev Month Days
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        const dayCell = createDayCell(day, true, false);
        daysGrid.appendChild(dayCell);
    }

    // Current Month Days
    for (let i = 1; i <= daysInMonth; i++) {
        const isToday = i === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
        const isSelected = i === selectedDate.getDate() && month === selectedDate.getMonth() && year === selectedDate.getFullYear();
        const dayCell = createDayCell(i, false, isToday, isSelected, new Date(year, month, i));
        daysGrid.appendChild(dayCell);
    }

    // Next Month Days (fill row)
    const totalCells = daysGrid.children.length;
    // const remainingCells = 42 - totalCells; // 6 rows * 7
    const rowsNeeded = Math.ceil((daysInMonth + firstDayOfMonth) / 7);
    const totalSlots = rowsNeeded * 7;
    const remainingParams = totalSlots - totalCells; // Just fill the row

    for (let i = 1; i <= remainingParams; i++) {
        const dayCell = createDayCell(i, true, false);
        daysGrid.appendChild(dayCell);
    }

    // Add Event Dots (if data exists)
    updateCalendarDots();
}

function createDayCell(day, isOtherMonth, isToday, isSelected = false, dateObj = null) {
    const el = document.createElement('div');
    el.className = `day-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}`;

    if (!isOtherMonth && dateObj) {
        el.onclick = () => {
            selectedDate = dateObj;
            document.querySelectorAll('.day-cell').forEach(c => c.classList.remove('selected'));
            el.classList.add('selected');
            renderSidePanel(selectedDate);
        };
        el.setAttribute('data-date', dateObj.toISOString().split('T')[0]); // YYYY-MM-DD
    }

    el.innerHTML = `
    <div class="day-number">${day}</div>
    <div class="day-events-dots"></div>
  `;
    return el;
}

async function fetchMonthInterviews(date) {
    // Fetching all for simplicity as per original code
    const { data, error } = await supabaseClient
        .from("Entrevistas")
        .select(`
      *,
      Vagas(Titulo),
      candidatos(nome)
    `)
        .order('Data', { ascending: true });

    if (error) {
        console.error('Error fetching interviews', error);
        return;
    }

    interviewsCache = data || [];
    updateCalendarDots();
    renderSidePanel(selectedDate);
    updateStatsCounters();
}

function updateCalendarDots() {
    document.querySelectorAll('.day-events-dots').forEach(d => d.innerHTML = '');

    interviewsCache.forEach(interview => {
        if (!interview.Data) return;
        const dateKey = interview.Data.split('T')[0];
        const cell = document.querySelector(`.day-cell[data-date="${dateKey}"]`);

        if (cell) {
            const dotsContainer = cell.querySelector('.day-events-dots');
            if (dotsContainer.children.length < 3) {
                const dot = document.createElement('div');
                dot.className = `event-dot ${interview["Tipo de entrevista"] === 'Online' ? 'online' : 'presencial'}`;
                dotsContainer.appendChild(dot);
            }
        }
    });
}

function renderSidePanel(date) {
    const dateKey = date.toISOString().split('T')[0];
    const displayDate = date.toLocaleDateString('pt-AO', { day: 'numeric', month: 'long' });
    const selectedDateDisplay = document.getElementById('selectedDateDisplay');
    if (selectedDateDisplay) selectedDateDisplay.textContent = displayDate;

    const listContainer = document.getElementById('dayEventsList');
    if (!listContainer) return;

    listContainer.innerHTML = '';

    const dayInterviews = interviewsCache.filter(i => i.Data && i.Data.startsWith(dateKey));

    // Client-side filtering
    const filterType = document.getElementById('filterType');
    const filterStatus = document.getElementById('filterStatus');

    const typeFilterValue = filterType ? filterType.value : 'all';
    const statusFilterValue = filterStatus ? filterStatus.value : 'all';

    const filtered = dayInterviews.filter(i => {
        if (typeFilterValue !== 'all' && i["Tipo de entrevista"] && i["Tipo de entrevista"].toLowerCase() !== typeFilterValue) return false;
        if (statusFilterValue !== 'all' && i.status && i.status.toLowerCase() !== statusFilterValue) return false;
        return true;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = `<div class="empty-state-small">Nenhuma entrevista encontrada</div>`;
        return;
    }

    filtered.forEach(i => {
        const time = i.Data.split('T')[1].substring(0, 5); // HH:MM
        const nomeCandidato = i.candidatos ? i.candidatos.nome : 'Candidato desconhecido';
        const nomeVaga = i.Vagas ? i.Vagas.Titulo : 'Vaga não informada';

        const card = document.createElement('div');
        card.className = 'side-event-card';
        card.innerHTML = `
           <div class="event-icon-box">
             <i class="fa-solid ${i["Tipo de entrevista"] === 'Online' ? 'fa-video' : 'fa-building'}"></i>
           </div>
           <div class="event-info">
             <div class="event-title">${nomeCandidato}</div>
             <div class="event-time">${time} - ${nomeVaga}</div>
             <div class="event-status-badge">${i.status}</div>
           </div>
        `;
        listContainer.appendChild(card);
    });
}

function updateStatsCounters() {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Get start of week (Monday)
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
    const startOfWeekStr = startOfWeek.toISOString().split('T')[0];

    // Get end of week (Sunday)
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    const endOfWeekStr = endOfWeek.toISOString().split('T')[0];

    const countToday = interviewsCache.filter(i => i.Data && i.Data.startsWith(todayStr)).length;
    const countWeek = interviewsCache.filter(i => {
        if (!i.Data) return false;
        const dateStr = i.Data.split('T')[0];
        return dateStr >= startOfWeekStr && dateStr <= endOfWeekStr;
    }).length;
    const countPending = interviewsCache.filter(i => i.status === 'Agendada').length;
    const countPresencial = interviewsCache.filter(i => i["Tipo de entrevista"] === 'Presencial').length;

    animateValue("statHoje", 0, countToday, 1000);
    animateValue("statSemana", 0, countWeek, 1000);
    animateValue("statPresenciais", 0, countPresencial, 1000);
    animateValue("statPendentes", 0, countPending, 1000);
}

function updateStatsPlaceholder() {
    updateStatsCounters();
}

function animateValue(id, start, end, duration) {
    if (start === end) return;
    const range = end - start;
    let current = start;
    const increment = end > start ? 1 : -1;
    const stepTime = Math.abs(Math.floor(duration / range));
    const obj = document.getElementById(id);
    if (!obj) return;

    const timer = setInterval(function () {
        current += increment;
        obj.innerHTML = current;
        if (current == end) {
            clearInterval(timer);
        }
    }, stepTime);
}

// Auto-init for new Interviews Page
if (document.querySelector('.main-entrevistas')) {
    document.addEventListener('DOMContentLoaded', initCalendarPage);
}
