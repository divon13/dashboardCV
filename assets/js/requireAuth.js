// requireAuth.js
// Deve ser carregado após o supabaseClient.js em todas as páginas protegidas

document.addEventListener('DOMContentLoaded', async () => {
    // Verifica se há uma sessão ativa
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    
    if (!session) {
        // Se não houver sessão, redireciona para o login
        window.location.href = 'login.html';
    } else {
        // Exibe o conteúdo principal apenas após confirmar a sessão
        // (Isso previne que a página pisque enquanto verifica)
        document.body.style.visibility = 'visible';
    }

    // Configura o evento do botão de logout (se existir)
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
