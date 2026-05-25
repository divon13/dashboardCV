// auth-equipa.js — Login da área entrevistadores / administração do sistema

async function redirectAfterEquipaLogin() {
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) return;

  if (typeof loadUserProfile === 'function') {
    await loadUserProfile(session);
  }

  if (typeof isEntrevistador === 'function' && isEntrevistador()) {
    window.location.href = 'MinhaAgenda.html';
    return;
  }
  if (typeof isAdmin === 'function' && isAdmin()) {
    window.location.href = 'Admin.html';
    return;
  }

  await supabaseClient.auth.signOut();
  const err = document.getElementById('errorMessage');
  if (err) {
    err.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Esta conta não tem acesso à área da equipa. Use o login do painel de recrutamento ou contacte o administrador.';
    err.style.display = 'flex';
    err.classList.add('show');
  }
  document.body.style.visibility = 'visible';
  document.body.style.opacity = '1';
}

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const errorMessage = document.getElementById('errorMessage');
  const btnSubmit = document.getElementById('btnSubmit');

  supabaseClient.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      redirectAfterEquipaLogin();
    } else {
      document.body.style.visibility = 'visible';
      document.body.style.opacity = '1';
    }
  });

  const params = new URLSearchParams(window.location.search);
  if (params.get('msg') === 'conta_desativada' && errorMessage) {
    errorMessage.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> A sua conta foi desativada. Contacte o administrador.';
    errorMessage.style.display = 'flex';
    errorMessage.classList.add('show');
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;

      errorMessage.style.display = 'none';
      errorMessage.classList.remove('show');
      btnSubmit.disabled = true;
      btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A entrar...';

      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

      if (error) {
        errorMessage.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Email ou palavra-passe incorretos.';
        errorMessage.style.display = 'flex';
        setTimeout(() => errorMessage.classList.add('show'), 10);
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = 'Entrar na área da equipa <i class="fa-solid fa-arrow-right"></i>';
      } else {
        btnSubmit.innerHTML = '<i class="fa-solid fa-check"></i> Autenticado!';
        btnSubmit.style.background = '#22c55e';
        setTimeout(() => redirectAfterEquipaLogin(), 800);
      }
    });
  }
});
