// requireAuthEquipa.js — Protege MinhaAgenda.html e Admin.html
//
// Apenas admin e entrevistador têm acesso à área da equipa.
// Recrutador   → redireciona para login.html (sem acesso)
// Sem sessão   → redireciona para login.html
// Entrevistador na Admin.html → redireciona para MinhaAgenda.html
//
// Após verificação bem-sucedida, despacha o evento 'authReady'
// para que os scripts de página (admin.js, minha-agenda.js) possam
// inicializar com o perfil já carregado.

document.addEventListener('DOMContentLoaded', async () => {
  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  if (typeof loadUserProfile === 'function') {
    await loadUserProfile(session);
  }

  // loadUserProfile redireciona sozinho em caso de erro/sem perfil
  if (!currentUserProfile) return;

  const role = currentUserProfile.role;
  const page = window.location.pathname.split('/').pop() || '';

  if (role === 'recrutador') {
    window.location.href = 'login.html?msg=acesso_negado';
    return;
  }

  if (role !== 'admin' && role !== 'entrevistador') {
    window.location.href = 'login.html?msg=acesso_negado';
    return;
  }

  if (page === 'Admin.html' && role !== 'admin') {
    window.location.href = 'MinhaAgenda.html';
    return;
  }

  // ✅ Acesso permitido
  document.body.style.visibility = 'visible';

  // Preencher nome na topbar do Admin (se existir)
  const topbarName = document.getElementById('topbarUserName');
  if (topbarName) {
    topbarName.textContent = currentUserProfile.nome || currentUserProfile.email || '—';
  }

  // Logout
  const btnLogout = document.getElementById('btnLogout');
  if (btnLogout) {
    btnLogout.addEventListener('click', async (e) => {
      e.preventDefault();
      await supabaseClient.auth.signOut();
      window.location.href = 'login.html';
    });
  }

  // Despachar evento para que admin.js / minha-agenda.js inicializem
  document.dispatchEvent(new CustomEvent('authReady', {
    detail: { profile: currentUserProfile }
  }));
});
