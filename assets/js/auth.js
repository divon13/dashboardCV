// auth.js
// Script exclusivo para a página de login.html

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const errorMessage = document.getElementById('errorMessage');
    const btnSubmit = document.getElementById('btnSubmit');

    // Verifica se já está logado, se sim, manda para o dashboard
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
        if (session) {
            window.location.href = 'index.html';
        } else {
            // Torna o corpo visível após confirmar que não há sessão
            document.body.style.visibility = 'visible';
            document.body.style.opacity = '1';
        }
    });

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            errorMessage.style.display = 'none';
            errorMessage.classList.remove('show');
            btnSubmit.disabled = true;
            btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Entrando...';

            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password,
            });

            if (error) {
                errorMessage.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> Email ou senha incorretos.';
                errorMessage.style.display = 'flex';
                // Pequeno delay para a animação
                setTimeout(() => {
                    errorMessage.classList.add('show');
                }, 10);
                
                btnSubmit.disabled = false;
                btnSubmit.innerHTML = 'Entrar no Dashboard';
            } else {
                // Animação de sucesso no botão
                btnSubmit.innerHTML = '<i class="fa-solid fa-check"></i> Autenticado com sucesso!';
                btnSubmit.style.background = '#22c55e'; // success-color
                
                setTimeout(() => {
                    window.location.href = 'index.html';
                }, 800);
            }
        });
    }
});
