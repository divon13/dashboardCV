// auth.js — Login único para todos os utilizadores

/**
 * Redireciona o utilizador para a sua área correta após login ou ao carregar a página.
 *
 * admin         → Admin.html
 * entrevistador → MinhaAgenda.html
 * recrutador    → index.html
 */
async function redirectAfterLogin() {
    const session = await getAuthenticatedSession();
    if (!session) return;

    if (typeof loadUserProfile === 'function') {
        await loadUserProfile(session);
    }

    // loadUserProfile já redireciona sozinho se não houver perfil
    if (!currentUserProfile) return;

    if (currentUserProfile.role === 'admin') {
        window.location.href = 'Admin.html';
    } else if (currentUserProfile.role === 'entrevistador') {
        window.location.href = 'MinhaAgenda.html';
    } else {
        // recrutador (e qualquer outro role válido)
        window.location.href = 'index.html';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const loginForm    = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const btnSubmit    = document.getElementById('btnSubmit');

    // Se já tem sessão ativa, redireciona imediatamente
    getAuthenticatedSession().then((session) => {
        if (session) {
            redirectAfterLogin();
        } else {
            document.body.style.visibility = 'visible';
            document.body.style.opacity    = '1';
        }
    });

    // Mensagens via URL
    const params = new URLSearchParams(window.location.search);
    const msg    = params.get('msg');

    if (msg && errorMessage) {
        const mensagens = {
            conta_desativada: 'A sua conta foi desativada. Contacte o administrador.',
            sem_perfil:       'Conta sem perfil associado. Contacte o administrador.',
            acesso_negado:    'Não tem permissão para aceder a esta área.',
        };
        const texto = mensagens[msg] || 'Ocorreu um erro. Tente novamente.';
        errorMessage.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${texto}`;
        errorMessage.style.display = 'flex';
        errorMessage.classList.add('show');
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email    = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;

            errorMessage.style.display = 'none';
            errorMessage.classList.remove('show');
            btnSubmit.disabled     = true;
            btnSubmit.innerHTML    = '<i class="fa-solid fa-spinner fa-spin"></i> A entrar...';

            const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

            if (error) {
                errorMessage.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Email ou palavra-passe incorretos.';
                errorMessage.style.display = 'flex';
                setTimeout(() => errorMessage.classList.add('show'), 10);
                btnSubmit.disabled  = false;
                btnSubmit.innerHTML = 'Entrar no Dashboard <i class="fa-solid fa-arrow-right"></i>';
            } else {
                btnSubmit.innerHTML      = '<i class="fa-solid fa-check"></i> Autenticado!';
                btnSubmit.style.background = '#22c55e';
                setTimeout(() => redirectAfterLogin(), 800);
            }
        });
    }
});
