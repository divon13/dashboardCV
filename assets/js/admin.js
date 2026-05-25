/**
 * admin.js — Painel de administração
 * Inicializa após o evento 'authReady' despachado por requireAuthEquipa.js,
 * garantindo que o perfil está carregado antes de tentar aceder ao Supabase.
 */

let adminEntrevistadores = [];
let allUsers = []; // cache para filtro de pesquisa
let allEnts  = []; // cache de entrevistadores para filtro

// ─── Notificação toast ────────────────────────────────────────────────────────
function showAdminToast(msg, type = 'success') {
  const t = document.getElementById('adminToast');
  if (!t) return;
  const icon = type === 'success'
    ? '<i class="fa-solid fa-circle-check"></i>'
    : '<i class="fa-solid fa-circle-exclamation"></i>';
  t.innerHTML = icon + ' ' + msg;
  t.className = 'show ' + type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.className = ''; }, 3500);
}

// Compatibilidade com utils.js (que usa showNotification)
function showNotification(msg, type) { showAdminToast(msg, type); }

// ─── Inicialização ────────────────────────────────────────────────────────────
async function initAdminPage() {
  if (!document.querySelector('.admin-page-inner')) return;
  if (typeof isAdmin === 'function' && !isAdmin()) return;

  setupAdminTabs();
  setupAdminModals();
  setupSearch();

  await Promise.all([
    carregarUtilizadoresAdmin(),
    carregarEntrevistadoresAdmin(),
    carregarConfiguracoesAdmin()
  ]);
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────
function setupAdminTabs() {
  document.querySelectorAll('.admin-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.admin-panel').forEach((p) => p.classList.remove('active'));
      tab.classList.add('active');
      const panel = document.getElementById(tab.dataset.panel);
      if (panel) panel.classList.add('active');
    });
  });
}

// ─── Modais ───────────────────────────────────────────────────────────────────
function setupAdminModals() {
  // Modal Utilizadores
  const btnNovoUser = document.getElementById('btnNovoUtilizador');
  const modalUser   = document.getElementById('adminUserModal');
  if (btnNovoUser && modalUser) btnNovoUser.onclick = () => openAdminUserModal(null);
  document.getElementById('closeAdminUserModal')?.addEventListener('click', () => closeModal(modalUser));
  document.getElementById('cancelAdminUser')?.addEventListener('click',     () => closeModal(modalUser));
  document.getElementById('adminUserForm')?.addEventListener('submit', handleAdminUserSubmit);

  // Mostrar/ocultar campo de entrevistador conforme role
  document.getElementById('adminUserRole')?.addEventListener('change', (e) => {
    const grp = document.getElementById('adminEntrevistadorGroup');
    if (grp) grp.style.display = e.target.value === 'entrevistador' ? 'flex' : 'none';
  });

  // Modal Entrevistadores
  const btnNovoEnt = document.getElementById('btnNovoEntrevistador');
  const modalEnt   = document.getElementById('adminEntrevistadorModal');
  if (btnNovoEnt && modalEnt) btnNovoEnt.onclick = () => openAdminEntrevistadorModal(null);
  document.getElementById('closeAdminEntModal')?.addEventListener('click', () => closeModal(modalEnt));
  document.getElementById('cancelAdminEnt')?.addEventListener('click',     () => closeModal(modalEnt));
  document.getElementById('adminEntForm')?.addEventListener('submit', handleAdminEntrevistadorSubmit);

  // Configurações
  document.getElementById('adminConfigForm')?.addEventListener('submit', handleAdminConfigSubmit);

  // Fechar ao clicar fora do modal
  [modalUser, modalEnt].forEach((m) => {
    if (!m) return;
    m.addEventListener('click', (e) => { if (e.target === m) closeModal(m); });
  });
}

function closeModal(modal) {
  if (modal) modal.style.display = 'none';
}

function openModal(modal) {
  if (modal) modal.style.display = 'flex';
}

// ─── Pesquisa / filtro ────────────────────────────────────────────────────────
function setupSearch() {
  document.getElementById('adminUserSearch')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    renderUsersTable(allUsers.filter((u) =>
      (u.nome || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.role  || '').toLowerCase().includes(q)
    ));
  });

  document.getElementById('adminEntSearch')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    renderEntsTable(allEnts.filter((ent) =>
      (ent.Nome || '').toLowerCase().includes(q)
    ));
  });
}

// ─── Utilizadores ─────────────────────────────────────────────────────────────
async function carregarUtilizadoresAdmin() {
  const tbody = document.getElementById('adminUsersTableBody');
  if (!tbody) return;

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, email, nome, role, entrevistador_id, ativo')
    .order('nome');

  if (error) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="admin-table-empty">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <p>Erro ao carregar utilizadores: ${error.message}</p>
    </div></td></tr>`;
    return;
  }

  await refreshEntrevistadoresForSelect();
  allUsers = data || [];
  renderUsersTable(allUsers);
}

function renderUsersTable(users) {
  const tbody = document.getElementById('adminUsersTableBody');
  if (!tbody) return;

  const entMap = {};
  adminEntrevistadores.forEach((e) => { entMap[e.id] = e.Nome; });

  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="admin-table-empty">
      <i class="fa-solid fa-users-slash"></i>
      <p>Nenhum utilizador encontrado</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  users.forEach((u) => {
    const entNome = u.entrevistador_id ? (entMap[u.entrevistador_id] || `#${u.entrevistador_id}`) : '—';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${u.nome || '—'}</strong></td>
      <td style="color:#64748b">${u.email}</td>
      <td><span class="admin-badge admin-badge--${u.role}">${roleLabel(u.role)}</span></td>
      <td>${entNome}</td>
      <td><span class="admin-status ${u.ativo ? 'ativo' : 'inativo'}">
        <i class="fa-solid fa-circle" style="font-size:8px;margin-right:4px"></i>${u.ativo ? 'Ativo' : 'Inativo'}
      </span></td>
      <td class="admin-actions">
        <button type="button" class="btn-icon-only btn-edit-user" title="Editar">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button type="button" class="btn-icon-only ${u.ativo ? 'btn-danger' : ''} btn-toggle-user"
          title="${u.ativo ? 'Desativar conta' : 'Ativar conta'}">
          <i class="fa-solid fa-${u.ativo ? 'ban' : 'check'}"></i>
        </button>
      </td>
    `;
    tr.querySelector('.btn-edit-user').onclick   = () => openAdminUserModal(u);
    tr.querySelector('.btn-toggle-user').onclick = () => toggleUtilizadorAtivo(u);
    tbody.appendChild(tr);
  });
}

function roleLabel(role) {
  return { admin: 'Admin', entrevistador: 'Entrevistador', recrutador: 'Recrutador' }[role] || role;
}

async function refreshEntrevistadoresForSelect() {
  const { data } = await supabaseClient.from('Entrevistador').select('id, Nome').order('Nome');
  adminEntrevistadores = data || [];

  const sel = document.getElementById('adminUserEntrevistador');
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Nenhum —</option>';
  adminEntrevistadores.forEach((e) => {
    const opt = document.createElement('option');
    opt.value = e.id;
    opt.textContent = e.Nome;
    sel.appendChild(opt);
  });
  if (cur) sel.value = cur;
}

function openAdminUserModal(user) {
  const modal    = document.getElementById('adminUserModal');
  const title    = document.getElementById('adminUserModalTitle');
  const idField  = document.getElementById('adminUserId');
  const passGrp  = document.getElementById('adminUserPasswordGroup');
  const entGrp   = document.getElementById('adminEntrevistadorGroup');
  if (!modal) return;

  document.getElementById('adminUserNome').value   = user?.nome  || '';
  document.getElementById('adminUserEmail').value  = user?.email || '';
  document.getElementById('adminUserEmail').readOnly = !!user;
  document.getElementById('adminUserRole').value   = user?.role  || 'recrutador';
  document.getElementById('adminUserEntrevistador').value = user?.entrevistador_id || '';
  document.getElementById('adminUserPassword').value = '';
  idField.value = user?.id || '';

  if (title) title.textContent = user ? 'Editar utilizador' : 'Nova conta';
  if (passGrp) passGrp.style.display = user ? 'none' : 'flex';

  // Mostrar campo entrevistador apenas se role = entrevistador
  if (entGrp) {
    entGrp.style.display = (user?.role === 'entrevistador' || !user) ? 'flex' : 'none';
  }

  openModal(modal);
}

async function handleAdminUserSubmit(e) {
  e.preventDefault();
  const id              = document.getElementById('adminUserId').value;
  const nome            = document.getElementById('adminUserNome').value.trim();
  const email           = document.getElementById('adminUserEmail').value.trim();
  const password        = document.getElementById('adminUserPassword').value;
  const role            = document.getElementById('adminUserRole').value;
  const entrevistador_id = document.getElementById('adminUserEntrevistador').value;
  const entId           = entrevistador_id ? parseInt(entrevistador_id, 10) : null;

  if (!nome || !email) { showAdminToast('Preencha nome e email.', 'error'); return; }

  if (!id) {
    // Criar nova conta
    if (!password || password.length < 6) {
      showAdminToast('A palavra-passe deve ter pelo menos 6 caracteres.', 'error');
      return;
    }
    const { data: { session: adminSession } } = await supabaseClient.auth.getSession();
    const { data: signData, error: signErr } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { nome, role } }
    });
    if (signErr) { showAdminToast(signErr.message, 'error'); return; }

    const newId = signData.user?.id;
    if (newId) {
      await supabaseClient.from('profiles').upsert({
        id: newId, email, nome, role,
        entrevistador_id: role === 'entrevistador' ? entId : null,
        ativo: true,
        updated_at: new Date().toISOString()
      });
    }
    // Restaurar sessão admin
    if (adminSession) {
      await supabaseClient.auth.signOut();
      await supabaseClient.auth.setSession({
        access_token:  adminSession.access_token,
        refresh_token: adminSession.refresh_token
      });
    }
    showAdminToast('Conta criada com sucesso!', 'success');
    closeModal(document.getElementById('adminUserModal'));
    await carregarUtilizadoresAdmin();
    return;
  }

  // Atualizar conta existente
  const { error } = await supabaseClient.from('profiles').update({
    nome,
    role,
    entrevistador_id: role === 'entrevistador' ? entId : null,
    updated_at: new Date().toISOString()
  }).eq('id', id);

  if (error) { showAdminToast(error.message, 'error'); return; }
  showAdminToast('Utilizador atualizado.', 'success');
  closeModal(document.getElementById('adminUserModal'));
  await carregarUtilizadoresAdmin();
}

async function toggleUtilizadorAtivo(user) {
  const novo    = !user.ativo;
  const label   = novo ? 'ativar' : 'desativar';
  if (!confirm(`Tens a certeza que queres ${label} a conta de "${user.nome || user.email}"?`)) return;

  const { error } = await supabaseClient.from('profiles').update({ ativo: novo }).eq('id', user.id);
  if (error) { showAdminToast(error.message, 'error'); return; }
  showAdminToast(novo ? 'Conta ativada.' : 'Conta desativada.', 'success');
  await carregarUtilizadoresAdmin();
}

// ─── Entrevistadores ──────────────────────────────────────────────────────────
async function carregarEntrevistadoresAdmin() {
  const tbody = document.getElementById('adminEntTableBody');
  if (!tbody) return;

  const { data, error } = await supabaseClient
    .from('Entrevistador')
    .select('id, Nome')
    .order('Nome');

  if (error) {
    tbody.innerHTML = `<tr><td colspan="3"><div class="admin-table-empty">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <p>Erro ao carregar entrevistadores.</p>
    </div></td></tr>`;
    return;
  }

  allEnts = data || [];
  renderEntsTable(allEnts);
}

async function renderEntsTable(ents) {
  const tbody = document.getElementById('adminEntTableBody');
  if (!tbody) return;

  if (!ents.length) {
    tbody.innerHTML = `<tr><td colspan="3"><div class="admin-table-empty">
      <i class="fa-solid fa-user-slash"></i>
      <p>Nenhum entrevistador encontrado</p>
    </div></td></tr>`;
    return;
  }

  // Buscar utilizadores associados a cada entrevistador
  const { data: profData } = await supabaseClient
    .from('profiles')
    .select('entrevistador_id, nome, email')
    .in('entrevistador_id', ents.map((e) => e.id));

  const entUsersMap = {};
  (profData || []).forEach((p) => {
    if (!entUsersMap[p.entrevistador_id]) entUsersMap[p.entrevistador_id] = [];
    entUsersMap[p.entrevistador_id].push(p.nome || p.email);
  });

  tbody.innerHTML = '';
  ents.forEach((ent) => {
    const usuarios = entUsersMap[ent.id] || [];
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${ent.Nome}</strong></td>
      <td style="color:#64748b;font-size:13px">
        ${usuarios.length ? usuarios.join(', ') : '<em>Nenhum utilizador associado</em>'}
      </td>
      <td class="admin-actions">
        <button type="button" class="btn-icon-only btn-edit-ent" title="Editar">
          <i class="fa-solid fa-pen"></i>
        </button>
        <button type="button" class="btn-icon-only btn-danger btn-del-ent" title="Eliminar">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </td>
    `;
    tr.querySelector('.btn-edit-ent').onclick = () => openAdminEntrevistadorModal(ent);
    tr.querySelector('.btn-del-ent').onclick  = () => eliminarEntrevistadorAdmin(ent);
    tbody.appendChild(tr);
  });
}

function openAdminEntrevistadorModal(ent) {
  const modal = document.getElementById('adminEntrevistadorModal');
  document.getElementById('adminEntId').value    = ent?.id   || '';
  document.getElementById('adminEntNome').value  = ent?.Nome || '';
  document.getElementById('adminEntModalTitle').textContent = ent ? 'Editar entrevistador' : 'Novo entrevistador';
  openModal(modal);
}

async function handleAdminEntrevistadorSubmit(e) {
  e.preventDefault();
  const id   = document.getElementById('adminEntId').value;
  const Nome = document.getElementById('adminEntNome').value.trim();
  if (!Nome) return;

  if (id) {
    const { error } = await supabaseClient.from('Entrevistador').update({ Nome }).eq('id', id);
    if (error) { showAdminToast(error.message, 'error'); return; }
  } else {
    const { error } = await supabaseClient.from('Entrevistador').insert([{ Nome }]);
    if (error) { showAdminToast(error.message, 'error'); return; }
  }
  showAdminToast('Entrevistador guardado.', 'success');
  closeModal(document.getElementById('adminEntrevistadorModal'));
  await carregarEntrevistadoresAdmin();
  await carregarUtilizadoresAdmin();
}

async function eliminarEntrevistadorAdmin(ent) {
  if (!confirm(`Eliminar o entrevistador "${ent.Nome}"?\nOs utilizadores associados perderão o vínculo.`)) return;
  const { error } = await supabaseClient.from('Entrevistador').delete().eq('id', ent.id);
  if (error) {
    showAdminToast('Não foi possível eliminar (pode estar associado a entrevistas).', 'error');
    return;
  }
  showAdminToast('Entrevistador eliminado.', 'success');
  await carregarEntrevistadoresAdmin();
}

// ─── Configurações ────────────────────────────────────────────────────────────
async function carregarConfiguracoesAdmin() {
  const { data, error } = await supabaseClient.from('configuracoes_sistema').select('chave, valor');
  if (error || !data) return;

  const map = {};
  data.forEach((r) => { map[r.chave] = r.valor; });

  const set = (id, key) => {
    const el = document.getElementById(id);
    if (el && map[key] !== undefined) el.value = map[key];
  };
  set('cfgEmpresaNome',  'empresa_nome');
  set('cfgEmpresaEmail', 'empresa_email');
  set('cfgFuso',         'fuso_horario');
  set('cfgLembrete',     'lembrete_dias');
}

async function handleAdminConfigSubmit(e) {
  e.preventDefault();
  const rows = [
    { chave: 'empresa_nome',  valor: document.getElementById('cfgEmpresaNome').value  },
    { chave: 'empresa_email', valor: document.getElementById('cfgEmpresaEmail').value },
    { chave: 'fuso_horario',  valor: document.getElementById('cfgFuso').value          },
    { chave: 'lembrete_dias', valor: document.getElementById('cfgLembrete').value      }
  ];

  for (const row of rows) {
    const { error } = await supabaseClient.from('configuracoes_sistema').upsert({
      chave: row.chave,
      valor: row.valor,
      updated_at: new Date().toISOString()
    });
    if (error) { showAdminToast('Erro ao guardar configurações.', 'error'); return; }
  }
  showAdminToast('Configurações guardadas com sucesso!', 'success');
}

// ─── Arranque — aguarda o evento authReady do requireAuthEquipa.js ────────────
document.addEventListener('authReady', () => {
  if (document.querySelector('.admin-page-inner')) {
    initAdminPage();
  }
});
