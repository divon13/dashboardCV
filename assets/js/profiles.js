/**
 * profiles.js — Perfis de utilizador e controlo de acesso por área.
 *
 * Roles disponíveis:
 *   - 'admin'         → só acede a Admin.html
 *   - 'entrevistador' → só acede a MinhaAgenda.html
 *   - 'recrutador'    → acede ao painel principal (index, candidatos, vagas, pipeline, entrevistas)
 */
let currentUserProfile = null;

const ROLE_ADMIN         = 'admin';
const ROLE_ENTREVISTADOR = 'entrevistador';
const ROLE_RECRUTADOR    = 'recrutador';

const MAIN_APP_PAGES = ['index.html', 'Candidatos.html', 'vagas.html', 'Pipeline.html', 'Entrevistas.html'];
const EQUIPA_PAGES   = ['MinhaAgenda.html', 'Admin.html'];

function isAdmin() {
  return currentUserProfile?.role === ROLE_ADMIN;
}

function isEntrevistador() {
  return currentUserProfile?.role === ROLE_ENTREVISTADOR;
}

function isRecrutador() {
  return currentUserProfile?.role === ROLE_RECRUTADOR;
}

function isEquipaPortalPage() {
  const page = window.location.pathname.split('/').pop() || '';
  return EQUIPA_PAGES.includes(page);
}

function getEntrevistadorId() {
  return currentUserProfile?.entrevistador_id ?? null;
}

/**
 * Carrega o perfil do utilizador autenticado a partir da tabela 'profiles'.
 * Se não existir perfil, termina a sessão e redireciona para login com erro.
 */
async function loadUserProfile(session) {
  if (!session?.user) return null;

  const { data, error } = await supabaseClient
    .from('profiles')
    .select('id, email, nome, role, entrevistador_id, ativo')
    .eq('id', session.user.id)
    .maybeSingle();

  if (error || !data) {
    // Sem perfil → não assumir role algum, redirecionar para login com erro
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html?msg=sem_perfil';
    return null;
  }

  if (!data.ativo) {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html?msg=conta_desativada';
    return null;
  }

  currentUserProfile = data;
  return currentUserProfile;
}

/** Navegação lateral apenas nas páginas da área da equipa */
function applyEquipaNavigation() {
  const role    = currentUserProfile?.role;
  const navAdmin = document.getElementById('navEquipaAdmin');
  if (navAdmin) {
    navAdmin.style.display = role === ROLE_ADMIN ? '' : 'none';
  }

  const userLabel = document.getElementById('sidebarUserLabel');
  if (userLabel && currentUserProfile) {
    const roleLabel = role === ROLE_ADMIN ? 'Administrador' : 'Entrevistador';
    userLabel.textContent = `${currentUserProfile.nome || currentUserProfile.email} · ${roleLabel}`;
  }
}

/**
 * Bloqueia o acesso ao painel principal (recrutamento) para quem não é recrutador.
 * Admin  → Admin.html
 * Entrevistador → MinhaAgenda.html
 */
function enforceMainAppAccess() {
  if (isEquipaPortalPage()) return;
  const page = window.location.pathname.split('/').pop() || 'index.html';
  if (!MAIN_APP_PAGES.includes(page) || !currentUserProfile) return;

  if (currentUserProfile.role === ROLE_ADMIN) {
    window.location.href = 'Admin.html';
  } else if (currentUserProfile.role === ROLE_ENTREVISTADOR) {
    window.location.href = 'MinhaAgenda.html';
  } else if (currentUserProfile.role !== ROLE_RECRUTADOR) {
    // Role desconhecido → login
    window.location.href = 'login.html';
  }
  // ROLE_RECRUTADOR → acesso permitido, não faz nada
}

function getDisplayName() {
  return currentUserProfile?.nome || currentUserProfile?.email || 'Utilizador';
}
