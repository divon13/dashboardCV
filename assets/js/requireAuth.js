// requireAuth.js — Protege as páginas do painel principal de recrutamento
// Páginas: index.html, Candidatos.html, vagas.html, Pipeline.html, Entrevistas.html
//
// Apenas utilizadores com role 'recrutador' têm acesso.
// Admin       → redireciona para Admin.html
// Entrevistador → redireciona para MinhaAgenda.html
// Sem sessão  → redireciona para login.html

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

    if (role === 'admin') {
        // Admin só acede ao Admin.html
        window.location.href = 'Admin.html';
        return;
    }

    if (role === 'entrevistador') {
        // Entrevistador só acede ao MinhaAgenda.html
        window.location.href = 'MinhaAgenda.html';
        return;
    }

    if (role !== 'recrutador') {
        // Role desconhecido → login
        window.location.href = 'login.html?msg=acesso_negado';
        return;
    }

    // ✅ Recrutador → acesso permitido
    document.body.style.visibility = 'visible';

    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', async (e) => {
            e.preventDefault();
            const { error } = await supabaseClient.auth.signOut();
            if (error) {
                console.error('Erro ao terminar sessão:', error.message);
                if (typeof showNotification === 'function') {
                    showNotification('Erro ao terminar sessão', 'error');
                } else {
                    alert('Erro ao terminar sessão');
                }
            } else {
                window.location.href = 'login.html';
            }
        });
    }
});
