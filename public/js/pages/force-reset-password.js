// public/js/pages/force-reset-password.js

document.addEventListener('DOMContentLoaded', () => {
    // Elementos do Formulário de Senha
    const mainResetContainer = document.querySelector('.container'); // Container principal que será escondido
    const form = document.getElementById('force-reset-form');
    const newPasswordField = document.getElementById('new-password');
    const confirmPasswordField = document.getElementById('confirm-password');

    // Requisitos visuais da senha
    const requirements = {
        length: document.getElementById('req-length'),
        lowercase: document.getElementById('req-lowercase'),
        uppercase: document.getElementById('req-uppercase'),
        number: document.getElementById('req-number'),
        special: document.getElementById('req-special'),
    };

    // Elementos do Modal 2FA (USANDO OS IDs CORRETOS)
    const modal2FA = document.getElementById('modal-2fa');
    const form2FA = document.getElementById('form-2fa');
    const tokenInput2FA = document.getElementById('2fa-token-input');
    const errorMessage2FA = document.getElementById('2fa-error-message');

    // Variável para guardar o login entre as etapas (igual ao login.js)
    let loginParaVerificar = '';

    // Função para o modal de status (erros/sucesso genéricos)
    function showStatusModal(title, message, isError = true) {
        // Esta função é um fallback, caso o modal principal de 2FA não possa ser mostrado.
        // Se você tiver um modal genérico de status, a lógica vai aqui.
        console.error(`${title}: ${message}`);
        alert(`${title}\n${message}`); // Fallback
    }

    // Feedback visual da senha (não muda)
    newPasswordField.addEventListener('input', () => {
        const value = newPasswordField.value;
        const checks = {
            length: value.length >= 8,
            lowercase: /[a-z]/.test(value),
            uppercase: /[A-Z]/.test(value),
            number: /\d/.test(value),
            special: /[^a-zA-Z0-9]/.test(value),
        };
        for (const key in requirements) {
            if (requirements[key]) {
                requirements[key].style.color = checks[key] ? 'green' : 'gray';
            }
        }
    });

    // ETAPA 1: Envio do formulário de NOVA SENHA
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const newPassword = newPasswordField.value;
        const confirmPassword = confirmPasswordField.value;

        if (newPassword !== confirmPassword) {
            showStatusModal('Erro', 'As senhas não coincidem.');
            return;
        }
        if (!(newPassword.length >= 8 && /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) && /\d/.test(newPassword) && /[^a-zA-Z0-9]/.test(newPassword))) {
            showStatusModal('Erro', 'A senha não atende a todos os requisitos.');
            return;
        }

        try {
            const response = await fetch('/api/auth/force-reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ novaSenha: newPassword })
            });
            const result = await response.json();

            if (response.ok) {
                // SUCESSO! Esconde o form de senha e abre o modal de 2FA
                loginParaVerificar = result.login;
                if (mainResetContainer) mainResetContainer.classList.add('hidden');
                if (modal2FA) modal2FA.classList.remove('hidden');
            } else {
                showStatusModal('Erro!', result.message);
            }
        } catch (error) {
            showStatusModal('Erro de Conexão', 'Não foi possível se comunicar com o servidor.');
        }
    });

    // ETAPA 2: Envio do formulário de 2FA
    if (form2FA) {
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
                if (errorMessage2FA) errorMessage2FA.textContent = 'Erro de conexão ao verificar o código.';
            }
        });
    }
});