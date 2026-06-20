/**
 * admin.js — Painel de administração
 * Inicializa após o evento 'authReady' despachado por requireAuthEquipa.js,
 * garantindo que o perfil está carregado antes de tentar aceder ao Supabase.
 */

let allUsers = []; // cache para filtro de pesquisa

// ─── Notificação toast ────────────────────────────────────────────────────────
function showAdminToast(msg, type = 'success') {
  const t = document.getElementById('adminToast');
  if (!t) return;
  const icon = type === 'success'
    ? '<i class="fa-solid fa-circle-check"></i>'
    : '<i class="fa-solid fa-circle-exclamation"></i>';
  t.innerHTML = icon + ' ' + escapeHtml(msg);
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

  document.getElementById('adminConfigForm')?.addEventListener('submit', handleAdminConfigSubmit);

  // Fechar ao clicar fora do modal
  [modalUser].forEach((m) => {
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

}

// ─── Utilizadores ─────────────────────────────────────────────────────────────
async function carregarUtilizadoresAdmin() {
  const tbody = document.getElementById('adminUsersTableBody');
  if (!tbody) return;

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, email, nome, role, ativo')
    .order('nome');

  if (error) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="admin-table-empty">
      <i class="fa-solid fa-triangle-exclamation"></i>
      <p>Erro ao carregar utilizadores: ${escapeHtml(error.message)}</p>
    </div></td></tr>`;
    return;
  }

  allUsers = data || [];
  renderUsersTable(allUsers);
}

function renderUsersTable(users) {
  const tbody = document.getElementById('adminUsersTableBody');
  if (!tbody) return;

  tbody.innerHTML = '';
  users.forEach((u) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${escapeHtml(u.nome || '—')}</strong></td>
      <td style="color:#64748b">${escapeHtml(u.email)}</td>
      <td><span class="admin-badge admin-badge--${safeCssClass(u.role)}">${escapeHtml(roleLabel(u.role))}</span></td>
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

function openAdminUserModal(user) {
  const modal   = document.getElementById('adminUserModal');
  const idField = document.getElementById('adminUserId');
  const title   = document.getElementById('adminUserModalTitle');
  const passGrp = document.getElementById('adminUserPasswordGroup');
  if (!modal || !idField) return;

  document.getElementById('adminUserNome').value   = user?.nome  || '';
  document.getElementById('adminUserEmail').value  = user?.email || '';
  document.getElementById('adminUserEmail').readOnly = !!user;
  document.getElementById('adminUserRole').value   = user?.role  || 'recrutador';
  document.getElementById('adminUserPassword').value = '';
  idField.value = user?.id || '';

  if (title) title.textContent = user ? 'Editar utilizador' : 'Nova conta';
  if (passGrp) passGrp.style.display = user ? 'none' : 'flex';

  openModal(modal);
}

async function handleAdminUserSubmit(e) {
  e.preventDefault();
  const id              = document.getElementById('adminUserId').value;
  const nome            = document.getElementById('adminUserNome').value.trim();
  const email           = document.getElementById('adminUserEmail').value.trim();
  const password        = document.getElementById('adminUserPassword').value;
  const role            = document.getElementById('adminUserRole').value;

  if (!nome || !email) { showAdminToast('Preencha nome e email.', 'error'); return; }

  if (!id) {
    // Criar nova conta
    if (!password || password.length < 8) {
      showAdminToast('A palavra-passe deve ter pelo menos 8 caracteres.', 'error');
      return;
    }
    const { data: { session: adminSession } } = await supabaseClient.auth.getSession();
    const { data: signData, error: signErr } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { nome } }
    });
    if (signErr) { showAdminToast(signErr.message, 'error'); return; }

    const newId = signData.user?.id;
    if (newId) {
      await supabaseClient.from('profiles').upsert({
        id: newId, email, nome, role,
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

  const { error } = await supabaseClient.from('profiles').update({
    nome,
    role,
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
