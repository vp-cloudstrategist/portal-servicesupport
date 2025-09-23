document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos dos formulários e modais ---
    const mainLoginContainer = document.getElementById('main-login-container');
    const loginForm = document.getElementById('login-form');
    const modalEsqueciSenha = document.getElementById('modalEsqueciSenha');
    const forgotPasswordButton = document.getElementById('forgot-password-button');
    const closeForgotModalButton = document.getElementById('close-forgot-modal-button');
    const forgotPasswordForm = document.getElementById('forgot-password-form');
    const modal2FA = document.getElementById('modal-2fa');
    const form2FA = document.getElementById('form-2fa');

    // Variável para guardar o login entre as etapas
    let loginParaVerificar = '';

    // --- Lógica para Abrir/Fechar o Modal "Esqueci a Senha" ---
    if (forgotPasswordButton) {
        forgotPasswordButton.addEventListener('click', () => {
            if (modalEsqueciSenha) modalEsqueciSenha.classList.remove('hidden');
        });
    }
    if (closeForgotModalButton) {
        closeForgotModalButton.addEventListener('click', () => {
            if (modalEsqueciSenha) modalEsqueciSenha.classList.add('hidden');
        });
    }

    // --- Lógica do Formulário de Login Principal ---
    if (loginForm) {
        const errorMessageDiv = document.getElementById('error-message');
        const passwordField = document.getElementById('password');

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
        
        if (response.status === 206) {

            loginParaVerificar = result.login;
            if (mainLoginContainer) mainLoginContainer.classList.add('hidden');
            if (modal2FA) modal2FA.classList.remove('hidden');
        } 
        else if (response.status === 202) {
            window.location.href = '/force-reset-password';
        }
        else if (response.ok) { 
            window.location.href = '/dashboard';
        } else {
            if (errorMessageDiv) errorMessageDiv.textContent = result.message || 'Erro desconhecido.';
        }
    } catch (error) {
        if (errorMessageDiv) errorMessageDiv.textContent = 'Erro de conexão com o servidor.';
    }
});

        // Lógica para mostrar/ocultar senha
        const togglePasswordBtn = document.getElementById('togglePassword');
        if (togglePasswordBtn && passwordField) {
            togglePasswordBtn.addEventListener('click', () => {
                const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordField.setAttribute('type', type);
                togglePasswordBtn.textContent = type === 'password' ? 'Mostrar' : 'Ocultar';
            });
        }
    }
    
    // --- Lógica do Formulário do Modal "Esqueci Minha Senha" ---
    if (forgotPasswordForm) {
        const forgotMessageContainer = document.getElementById('forgot-message-container');
        forgotPasswordForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const email = document.getElementById('forgot-email').value;
            if (forgotMessageContainer) {
                forgotMessageContainer.textContent = 'Enviando...';
                forgotMessageContainer.className = 'mt-4 text-sm h-5 text-gray-500';
            }
            try {
                const response = await fetch('/api/auth/forgot-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email }),
                });
                const result = await response.json();
                if (forgotMessageContainer) {
                    forgotMessageContainer.textContent = result.message;
                    forgotMessageContainer.className = response.ok ? 'mt-4 text-sm h-5 text-green-600' : 'mt-4 text-sm h-5 text-red-600';
                }
                forgotPasswordForm.querySelector('button').disabled = true;
            } catch (error) {
                if (forgotMessageContainer) {
                    forgotMessageContainer.textContent = 'Erro de conexão. Tente novamente.';
                    forgotMessageContainer.className = 'mt-4 text-sm h-5 text-red-600';
                }
            }
        });
    }

    // --- Lógica do Formulário de 2 Fatores (2FA) ---
   if (form2FA) {
        const errorMessage2FA = document.getElementById('2fa-error-message');
        const tokenInput2FA = document.getElementById('2fa-token-input');
        
        form2FA.addEventListener('submit', async (event) => {
            event.preventDefault();
            const otpToken = tokenInput2FA.value;
            if (errorMessage2FA) errorMessage2FA.textContent = '';

            try {
                const response = await fetch('/api/auth/verify-2fa', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ login: loginParaVerificar, otpToken: otpToken })
                });

                if (response.ok) {
                    window.location.href = '/dashboard';
                } else {
                    const result = await response.json();
                    if (errorMessage2FA) errorMessage2FA.textContent = result.message;
                }
            } catch (error) {
                if (errorMessage2FA) errorMessage2FA.textContent = 'Erro de conexão com o servidor.';
            }
        });
    }

});