function toggleForgotPasswordModal(show) {
    const modal = document.getElementById('modalEsqueciSenha');
    if (modal) {
        modal.classList.toggle('hidden', !show);
    }
}
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const errorMessageDiv = document.getElementById('error-message'); 
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const forgotMessageContainer = document.getElementById('forgot-message-container');
    if (loginForm) {
        loginForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            const login = document.getElementById('login').value;
            const password = document.getElementById('password').value;
            if (errorMessageDiv) errorMessageDiv.textContent = '';

            try {
                const response = await fetch('/api/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ login: login, password: password }),
                });

                const result = await response.json();

                if (response.ok) {
                    window.location.href = '/dashboard';
                } else {
                    if (errorMessageDiv) errorMessageDiv.textContent = result.message || 'Erro desconhecido.';
                }
            } catch (error) {
                if (errorMessageDiv) errorMessageDiv.textContent = 'Erro de conexão com o servidor.';
            }
        });
    }
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const email = document.getElementById('forgot-email').value;
            if (forgotMessageContainer) forgotMessageContainer.textContent = '';

            try {
                const response = await fetch('/api/auth/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email }),
                });
                const result = await response.json();
                
                if (forgotMessageContainer) {
                    forgotMessageContainer.textContent = result.message;
                    forgotMessageContainer.classList.add('text-green-600');
                }
                forgotPasswordForm.querySelector('button').disabled = true;
                
            } catch (error) {
                if (forgotMessageContainer) {
                    forgotMessageContainer.textContent = 'Erro de conexão. Tente novamente.';
                    forgotMessageContainer.classList.add('text-red-600');
                }
            }
        });
    }
});