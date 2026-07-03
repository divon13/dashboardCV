/**
 * minha-agenda.js - Agenda pessoal do entrevistador (MinhaAgenda.html)
 */
let minhaAgendaCache = [];
let minhaAgendaSelectedDate = new Date();
let minhaAgendaCurrentDate = new Date();
let minhaAgendaInitialized = false;

const BASE_QUERY_AGENDA = `
  *,
  Vagas(id, Titulo, status_vagas),
  candidatos(id, nome, vaga_ID, status, email, telefone, url_curriculo, perguntas_sugeridas),
  profiles(id, nome)
`;

function minhaAgendaEntrevistadorId() {
  return typeof currentUserProfile !== 'undefined' && currentUserProfile ? currentUserProfile.id : null;
}

function maEscape(value) {
  return typeof escapeHtml === 'function' ? escapeHtml(value) : String(value ?? '');
}

function maNormalizeStatus(status) {
  return String(status || 'Agendada')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function maIsConcluida(interview) {
  return (interview.status || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes('conclu');
}

function maInterviewDate(interview) {
  if (!interview?.Data) return null;
  const date = new Date(interview.Data);
  return Number.isNaN(date.getTime()) ? null : date;
}

function maInterviewDateKey(interview) {
  const date = maInterviewDate(interview);
  return date ? getLocalIsoDate(date) : '';
}

function maIsUpcoming(interview, now = new Date()) {
  const date = maInterviewDate(interview);
  return Boolean(date && date.getTime() >= now.getTime() && !maIsConcluida(interview));
}

function maIsPastOrConcluded(interview, now = new Date()) {
  const date = maInterviewDate(interview);
  return maIsConcluida(interview) || !date || date.getTime() < now.getTime();
}

function maSortByInterviewDate(a, b) {
  const da = maInterviewDate(a)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const db = maInterviewDate(b)?.getTime() ?? Number.MAX_SAFE_INTEGER;
  return da - db;
}

async function initMinhaAgendaPage() {
  if (!document.querySelector('.main-minha-agenda') || minhaAgendaInitialized) return;
  minhaAgendaInitialized = true;

  const displayName = typeof getDisplayName === 'function' ? getDisplayName() : 'Utilizador';
  const heroName = document.getElementById('maHeroNome');
  const topbarName = document.getElementById('maTopbarUserName');
  if (heroName) heroName.textContent = displayName;
  if (topbarName) topbarName.textContent = displayName;

  setupMinhaAgendaTabs();
  setupMinhaAgendaCalendarNav();
  setupMinhaAgendaModals();
  await fetchMinhaAgendaInterviews();
}

function setupMinhaAgendaTabs() {
  document.querySelectorAll('.ma-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.ma-tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.ma-panel').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.getElementById(tab.dataset.panel);
      if (panel) panel.classList.add('active');
      if (tab.dataset.panel === 'maPanelHistorico') renderMinhaAgendaHistorico();
      if (tab.dataset.panel === 'maPanelProximas') renderMinhaAgendaProximas();
      if (tab.dataset.panel === 'maPanelCalendario') {
        renderMinhaAgendaCalendar(minhaAgendaCurrentDate);
        renderMinhaAgendaSidePanel(minhaAgendaSelectedDate);
      }
    });
  });
}

function setupMinhaAgendaCalendarNav() {
  const prev = document.getElementById('maPrevMonth');
  const next = document.getElementById('maNextMonth');
  const today = document.getElementById('maGoToday');
  if (prev) prev.onclick = () => {
    minhaAgendaCurrentDate.setMonth(minhaAgendaCurrentDate.getMonth() - 1);
    renderMinhaAgendaCalendar(minhaAgendaCurrentDate);
  };
  if (next) next.onclick = () => {
    minhaAgendaCurrentDate.setMonth(minhaAgendaCurrentDate.getMonth() + 1);
    renderMinhaAgendaCalendar(minhaAgendaCurrentDate);
  };
  if (today) today.onclick = () => {
    minhaAgendaCurrentDate = new Date();
    minhaAgendaSelectedDate = new Date();
    renderMinhaAgendaCalendar(minhaAgendaCurrentDate);
    renderMinhaAgendaSidePanel(minhaAgendaSelectedDate);
  };
}

function setupMinhaAgendaModals() {
  const detalheModal = document.getElementById('maDetalheModal');
  const closeDetalhe = document.getElementById('maCloseDetalhe');
  if (closeDetalhe && detalheModal) closeDetalhe.onclick = () => { detalheModal.style.display = 'none'; };
  if (detalheModal) detalheModal.onclick = (e) => { if (e.target === detalheModal) detalheModal.style.display = 'none'; };

  const concluirModal = document.getElementById('maConcluirModal');
  const closeConcluir = document.getElementById('maCloseConcluir');
  const cancelConcluir = document.getElementById('maCancelConcluir');
  if (closeConcluir && concluirModal) closeConcluir.onclick = () => { concluirModal.style.display = 'none'; };
  if (cancelConcluir && concluirModal) cancelConcluir.onclick = () => { concluirModal.style.display = 'none'; };
  if (concluirModal) concluirModal.onclick = (e) => { if (e.target === concluirModal) concluirModal.style.display = 'none'; };

  document.getElementById('maConcluirForm')?.addEventListener('submit', handleMinhaAgendaConclusao);
}

async function fetchMinhaAgendaInterviews() {
  const entId = minhaAgendaEntrevistadorId();

  if (!entId) {
    minhaAgendaCache = [];
    updateMinhaAgendaStats();
    renderMinhaAgendaProximas();
    renderMinhaAgendaHistorico();
    renderMinhaAgendaCalendar(minhaAgendaCurrentDate);
    renderMinhaAgendaSidePanel(minhaAgendaSelectedDate);
    return;
  }

  const { data, error } = await supabaseClient
    .from('Entrevistas')
    .select(BASE_QUERY_AGENDA)
    .eq('entrevistador', entId)
    .order('Data', { ascending: true });

  if (error) {
    console.error('Erro ao carregar agenda:', error);
    if (typeof showNotification === 'function') showNotification('Erro ao carregar a sua agenda', 'error');
    return;
  }

  minhaAgendaCache = data || [];
  updateMinhaAgendaStats();
  renderMinhaAgendaProximas();
  renderMinhaAgendaHistorico();
  renderMinhaAgendaCalendar(minhaAgendaCurrentDate);
  renderMinhaAgendaSidePanel(minhaAgendaSelectedDate);
}

function updateMinhaAgendaStats() {
  const hoje = getLocalIsoDate();
  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndIso = getLocalIsoDate(weekEnd);

  let hojeCount = 0;
  let semanaCount = 0;
  let proximasCount = 0;
  let concluidasCount = 0;

  minhaAgendaCache.forEach((i) => {
    const d = maInterviewDateKey(i);
    const concluida = maIsConcluida(i);
    if (concluida) concluidasCount++;
    if (d === hoje && maIsUpcoming(i, now)) hojeCount++;
    if (d >= hoje && d <= weekEndIso && maIsUpcoming(i, now)) semanaCount++;
    if (maIsUpcoming(i, now)) proximasCount++;
  });

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('maStatHoje', hojeCount);
  set('maStatSemana', semanaCount);
  set('maStatProximas', proximasCount);
  set('maStatConcluidas', concluidasCount);
  set('maHeroTodayCount', hojeCount);

  const label = document.getElementById('maHeroTodayLabel');
  if (label) {
    label.textContent = new Date().toLocaleDateString('pt-AO', { weekday: 'long', day: '2-digit', month: 'short' });
  }
}

function renderMinhaAgendaProximas() {
  const container = document.getElementById('maProximasList');
  if (!container) return;

  const now = new Date();
  const upcoming = minhaAgendaCache
    .filter((i) => maIsUpcoming(i, now))
    .sort(maSortByInterviewDate);

  container.innerHTML = '';
  if (upcoming.length === 0) {
    container.innerHTML = createMinhaAgendaEmptyState(
      'fa-regular fa-calendar-check',
      'Sem entrevistas pendentes',
      'Quando uma entrevista for marcada para si, ela aparece aqui com ações rápidas.'
    );
    return;
  }

  upcoming.forEach((i) => container.appendChild(createMinhaAgendaCard(i, false)));
}

function renderMinhaAgendaHistorico() {
  const container = document.getElementById('maHistoricoList');
  if (!container) return;

  const now = new Date();
  const past = minhaAgendaCache
    .filter((i) => maIsPastOrConcluded(i, now))
    .sort((a, b) => maSortByInterviewDate(b, a));

  container.innerHTML = '';
  if (past.length === 0) {
    container.innerHTML = createMinhaAgendaEmptyState(
      'fa-solid fa-clock-rotate-left',
      'Histórico ainda vazio',
      'As entrevistas concluídas vão ficar guardadas aqui com as notas e decisões.'
    );
    return;
  }

  past.forEach((i) => container.appendChild(createMinhaAgendaCard(i, true)));
}

function createMinhaAgendaEmptyState(icon, title, text) {
  return `
    <div class="ma-empty-state">
      <i class="${icon}"></i>
      <strong>${maEscape(title)}</strong>
      <span>${maEscape(text)}</span>
    </div>
  `;
}

function createMinhaAgendaCard(i, isHistorico) {
  const card = document.createElement('article');
  card.className = 'ma-interview-card';

  const cand = Array.isArray(i.candidatos) ? i.candidatos[0] : i.candidatos;
  const vaga = Array.isArray(i.Vagas) ? i.Vagas[0] : i.Vagas;
  const candName = cand?.nome || 'Candidato';
  const vagaName = vaga?.Titulo || 'Vaga';
  const status = i.status || 'Agendada';
  const statusClass = maNormalizeStatus(status);
  const dateStr = i.Data ? formatarData(i.Data) : 'Sem data';
  const obs = i.Observacoes || i.Observação || '';
  const notasHtml = formatNotasEntrevista(i.notas_entrevista);
  const decisao = i.decisao_final ? `<span class="ma-decisao ma-decisao--${maNormalizeStatus(i.decisao_final)}">${maEscape(i.decisao_final)}</span>` : '';
  const concluida = maIsConcluida(i);

  card.innerHTML = `
    <div class="ma-card-header">
      <div>
        <h4>${maEscape(candName)}</h4>
        <p class="ma-card-vaga">${maEscape(vagaName)}</p>
      </div>
      <span class="chip-status chip-status-${statusClass}">${maEscape(status)}</span>
    </div>
    <div class="ma-card-meta">
      <span><i class="fa-regular fa-calendar"></i> ${maEscape(dateStr)}</span>
      <span><i class="fa-solid fa-${(i.tipo_entrevista || '').toLowerCase().includes('online') ? 'video' : 'building'}"></i> ${maEscape(i.tipo_entrevista || 'Presencial')}</span>
      ${decisao}
    </div>
    ${obs ? `<p class="ma-card-obs"><strong>Observações:</strong> ${maEscape(obs)}</p>` : ''}
    ${isHistorico && notasHtml ? `<div class="ma-card-notas">${notasHtml}</div>` : ''}
    <div class="ma-card-actions">
      <button type="button" class="btn-text ma-btn-detalhe"><i class="fa-solid fa-eye"></i> Ver detalhes</button>
      ${!concluida ? '<button type="button" class="ma-btn-concluir"><i class="fa-solid fa-clipboard-question"></i> Conduzir</button>' : ''}
    </div>
  `;

  card.querySelector('.ma-btn-detalhe')?.addEventListener('click', () => openMinhaAgendaDetalheModal(i));
  card.querySelector('.ma-btn-concluir')?.addEventListener('click', () => openMinhaAgendaConcluirModal(i));
  return card;
}

function formatNotasEntrevista(notas) {
  if (!notas) return '';
  let obj = notas;
  if (typeof notas === 'string') {
    try { obj = JSON.parse(notas); } catch { return `<p>${maEscape(notas)}</p>`; }
  }
  if (typeof obj !== 'object') return `<p>${maEscape(obj)}</p>`;

  let html = '<ul class="ma-notas-list">';
  if (obj.tecnica) html += `<li><strong>Técnica:</strong> ${maEscape(obj.tecnica)}/5</li>`;
  if (obj.comunicacao) html += `<li><strong>Comunicação:</strong> ${maEscape(obj.comunicacao)}/5</li>`;
  if (obj.pontos_fortes) html += `<li><strong>Pontos fortes:</strong> ${maEscape(obj.pontos_fortes)}</li>`;
  if (obj.pontos_fracos) html += `<li><strong>Pontos fracos:</strong> ${maEscape(obj.pontos_fracos)}</li>`;
  if (obj.observacoes) html += `<li><strong>Notas:</strong> ${maEscape(obj.observacoes)}</li>`;
  if (obj.notas_gerais) html += `<li><strong>Notas:</strong> ${maEscape(obj.notas_gerais)}</li>`;
  if (obj.comentario_final) html += `<li><strong>Comentário:</strong> ${maEscape(obj.comentario_final)}</li>`;
  Object.keys(obj).forEach((k) => {
    if (['tecnica', 'comunicacao', 'pontos_fortes', 'pontos_fracos', 'observacoes', 'notas_gerais', 'comentario_final'].includes(k)) return;
    if (obj[k]) html += `<li><strong>${maEscape(k)}:</strong> ${maEscape(obj[k])}</li>`;
  });
  html += '</ul>';
  return html;
}

function openMinhaAgendaDetalheModal(i) {
  const modal = document.getElementById('maDetalheModal');
  if (!modal) return;

  const cand = Array.isArray(i.candidatos) ? i.candidatos[0] : i.candidatos;
  const vaga = Array.isArray(i.Vagas) ? i.Vagas[0] : i.Vagas;
  const contacto = document.getElementById('maDetalheContacto');

  document.getElementById('maDetalheCandidato').textContent = cand?.nome || '-';
  document.getElementById('maDetalheVaga').textContent = vaga?.Titulo || '-';
  document.getElementById('maDetalheData').textContent = i.Data ? formatarData(i.Data) : '-';
  document.getElementById('maDetalheTipo').textContent = i.tipo_entrevista || '-';
  document.getElementById('maDetalheStatus').textContent = i.status || '-';
  document.getElementById('maDetalheObs').textContent = i.Observacoes || i.Observação || 'Nenhuma';
  document.getElementById('maDetalheDecisao').textContent = i.decisao_final || '-';
  document.getElementById('maDetalheNotas').innerHTML = formatNotasEntrevista(i.notas_entrevista) || '<p class="text-muted">Sem notas registadas.</p>';

  if (contacto) {
    const parts = [];
    if (cand?.email) parts.push(`<span><i class="fa-solid fa-envelope"></i> ${maEscape(cand.email)}</span>`);
    if (cand?.telefone) parts.push(`<span><i class="fa-solid fa-phone"></i> ${maEscape(cand.telefone)}</span>`);
    contacto.innerHTML = parts.join(' ') || '';
  }

  modal.style.display = 'flex';
}

function openMinhaAgendaConcluirModal(i) {
  const modal = document.getElementById('maConcluirModal');
  if (!modal) return;

  const cand = Array.isArray(i.candidatos) ? i.candidatos[0] : i.candidatos;
  const vaga = Array.isArray(i.Vagas) ? i.Vagas[0] : i.Vagas;
  let notas = i.notas_entrevista || {};
  if (typeof notas === 'string') {
    try { notas = JSON.parse(notas); } catch { notas = { notas_gerais: notas }; }
  }

  document.getElementById('maConcluirEntrevistaId').value = i.id || '';
  document.getElementById('maConcluirCandidatoId').value = cand?.id || '';
  document.getElementById('maConcluirSubtitulo').textContent = `${cand?.nome || 'Candidato'} - ${vaga?.Titulo || 'Vaga'}`;
  document.getElementById('maNotaTecnica').value = notas.tecnica || '';
  document.getElementById('maNotaComunicacao').value = notas.comunicacao || '';
  document.getElementById('maNotasEntrevistador').value = notas.notas_gerais || notas.observacoes || '';
  document.getElementById('maDecisaoFinal').value = i.decisao_final || '';
  renderMinhaAgendaPerguntasSugeridas(cand);

  const iframe = document.getElementById('maIframeCurriculo');
  const noCvMsg = document.getElementById('maNoCurriculoMsg');
  const openCv = document.getElementById('maOpenCurriculo');
  const cvUrl = cand?.url_curriculo || '';
  if (iframe && noCvMsg && openCv) {
    applySafeCvToElements(cvUrl, { iframe, openLink: openCv, noCvMsg });
  }

  modal.style.display = 'flex';
}

function renderMinhaAgendaPerguntasSugeridas(candidato) {
  const list = document.getElementById('maPerguntasSugeridas');
  if (!list) return;

  list.innerHTML = '';
  let perguntasRaw = candidato?.perguntas_sugeridas;
  if (typeof perguntasRaw === 'string') {
    try { perguntasRaw = JSON.parse(perguntasRaw); } catch { perguntasRaw = [perguntasRaw]; }
  }
  const perguntas = Array.isArray(perguntasRaw) ? perguntasRaw.filter(Boolean) : [];

  if (perguntas.length === 0) {
    const li = document.createElement('li');
    li.textContent = 'Nenhuma pergunta sugerida pela IA encontrada para este candidato.';
    li.className = 'ma-pergunta-empty';
    list.appendChild(li);
    return;
  }

  perguntas.forEach((pergunta) => {
    const li = document.createElement('li');
    li.textContent = pergunta;
    list.appendChild(li);
  });
}

async function handleMinhaAgendaConclusao(e) {
  e.preventDefault();
  const entrevistaId = document.getElementById('maConcluirEntrevistaId').value;
  const candidatoId = document.getElementById('maConcluirCandidatoId').value;
  const tecnica = document.getElementById('maNotaTecnica').value;
  const comunicacao = document.getElementById('maNotaComunicacao').value;
  const notasGerais = document.getElementById('maNotasEntrevistador').value.trim();
  const decisao = document.getElementById('maDecisaoFinal').value;

  if (!entrevistaId || !decisao) {
    if (typeof showNotification === 'function') showNotification('Selecione uma decisão final.', 'error');
    return;
  }

  const notasEntrevistaObj = {
    tecnica: parseInt(tecnica, 10),
    comunicacao: parseInt(comunicacao, 10),
    notas_gerais: notasGerais
  };

  const entId = minhaAgendaEntrevistadorId();
  if (!entId) {
    if (typeof showNotification === 'function') showNotification('Sessão inválida.', 'error');
    return;
  }

  const { error: errorEntrevista } = await supabaseClient
    .from('Entrevistas')
    .update({
      notas_entrevista: notasEntrevistaObj,
      decisao_final: decisao,
      status: 'Concluída'
    })
    .eq('id', entrevistaId)
    .eq('entrevistador', entId);

  if (errorEntrevista) {
    console.error('Erro ao salvar avaliação:', errorEntrevista);
    if (typeof showNotification === 'function') showNotification('Erro ao salvar a conclusão.', 'error');
    return;
  }

  if (candidatoId) {
    const novoStatusCandidato = {
      Passar: 'Entrevista feita',
      Guardar: 'Entrevista feita',
      Reprovar: 'Rejeitado'
    }[decisao];

    if (novoStatusCandidato) {
      const { error: errorCand } = await supabaseClient
        .from('candidatos')
        .update({ status: novoStatusCandidato })
        .eq('id', candidatoId);
      if (errorCand) console.error('Erro ao atualizar status do candidato:', errorCand);
    }
  }

  if (typeof showNotification === 'function') showNotification('Entrevista concluída com sucesso.', 'success');
  document.getElementById('maConcluirModal').style.display = 'none';
  await fetchMinhaAgendaInterviews();
  window.dispatchEvent(new CustomEvent('interview-concluded', { detail: { candidatoId } }));
}

function renderMinhaAgendaCalendar(date) {
  const display = document.getElementById('maCurrentMonthDisplay');
  const grid = document.getElementById('maCalendarDaysGrid');
  if (!grid) return;

  const year = date.getFullYear();
  const month = date.getMonth();
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  if (display) display.textContent = `${monthNames[month]} ${year}`;

  grid.innerHTML = '';
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrev = new Date(year, month, 0).getDate();

  for (let i = firstDay - 1; i >= 0; i--) {
    grid.appendChild(maCreateDayCell(daysInPrev - i, true, false, false, null));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month, d);
    const isToday = d === new Date().getDate() && month === new Date().getMonth() && year === new Date().getFullYear();
    const isSel = d === minhaAgendaSelectedDate.getDate() && month === minhaAgendaSelectedDate.getMonth() && year === minhaAgendaSelectedDate.getFullYear();
    grid.appendChild(maCreateDayCell(d, false, isToday, isSel, dateObj));
  }
  const total = grid.children.length;
  const slots = Math.ceil((daysInMonth + firstDay) / 7) * 7;
  for (let i = 1; i <= slots - total; i++) {
    grid.appendChild(maCreateDayCell(i, true, false, false, null));
  }
  maUpdateCalendarDots();
}

function maCreateDayCell(day, other, today, selected, dateObj) {
  const el = document.createElement('div');
  el.className = `day-cell ${other ? 'other-month' : ''} ${today ? 'today' : ''} ${selected ? 'selected' : ''}`;
  if (!other && dateObj) {
    el.setAttribute('data-date', getLocalIsoDate(dateObj));
    el.onclick = () => {
      minhaAgendaSelectedDate = dateObj;
      document.querySelectorAll('#maCalendarDaysGrid .day-cell').forEach((c) => c.classList.remove('selected'));
      el.classList.add('selected');
      renderMinhaAgendaSidePanel(dateObj);
    };
  }
  el.innerHTML = `<div class="day-number">${day}</div><div class="day-events-dots"></div>`;
  return el;
}

function maUpdateCalendarDots() {
  document.querySelectorAll('#maCalendarDaysGrid .day-events-dots').forEach((d) => { d.innerHTML = ''; });
  minhaAgendaCache.forEach((interview) => {
    if (!interview.Data) return;
    const dateKey = maInterviewDateKey(interview);
    const cell = document.querySelector(`#maCalendarDaysGrid .day-cell[data-date="${dateKey}"]`);
    if (cell) {
      const dots = cell.querySelector('.day-events-dots');
      if (dots && dots.children.length < 3) {
        const dot = document.createElement('div');
        dot.className = `event-dot ${(interview.tipo_entrevista || '').toLowerCase().includes('online') ? 'online' : 'presencial'}`;
        dots.appendChild(dot);
      }
    }
  });
}

function renderMinhaAgendaSidePanel(date) {
  const list = document.getElementById('maDayEventsList');
  const title = document.getElementById('maSelectedDateDisplay');
  if (!list) return;

  const dateKey = getLocalIsoDate(date);
  if (title) title.textContent = date.toLocaleDateString('pt-AO', { day: 'numeric', month: 'long' });

  const dayItems = minhaAgendaCache
    .filter((i) => maInterviewDateKey(i) === dateKey)
    .sort(maSortByInterviewDate);
  list.innerHTML = '';
  if (dayItems.length === 0) {
    list.innerHTML = '<div class="empty-state-small">Nenhuma entrevista neste dia</div>';
    return;
  }
  dayItems.forEach((i) => {
    const mini = createMinhaAgendaCard(i, maIsConcluida(i));
    mini.classList.add('ma-side-card');
    list.appendChild(mini);
  });
}

document.addEventListener('authReady', () => {
  initMinhaAgendaPage();
});
