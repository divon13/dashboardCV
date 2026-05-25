/**
 * profiles.js — Perfis de utilizador e controlo de acesso por área.
 *
 * Roles disponíveis:
 *   - 'admin'         → só acede a Admin.html
 *   - 'entrevistador' → só acede a MinhaAgenda.html
 *   - 'recrutador'    → acede ao painel principal (index, candidatos, vagas, pipeline, entrevistas)
 */
let currentUserProfile = null;

const ROLE_ADMIN = 'admin';

function isAdmin() {
  return currentUserProfile?.role === ROLE_ADMIN;
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

function getDisplayName() {
  return currentUserProfile?.nome || currentUserProfile?.email || 'Utilizador';
}
