document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('reset-password-form');
    const messageContainer = document.getElementById('message-container');
    const togglePasswordButtons = document.querySelectorAll('[data-toggle-password]');
    
    const userParam = new URLSearchParams(window.location.search).get('user');

    if (!userParam) {
        messageContainer.textContent = 'Link de redefinição inválido ou ausente. Por favor, solicite um novo link.';
        messageContainer.classList.add('text-red-600');
        if (form) form.classList.add('hidden');
        return;
    }

    if (form) {
        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            messageContainer.textContent = '';

            if (password.length < 6) {
                messageContainer.textContent = 'A senha deve ter no mínimo 6 caracteres.';
                messageContainer.classList.add('text-red-600');
                return;
            }

            if (password !== confirmPassword) {
                messageContainer.textContent = 'As senhas não coincidem.';
                messageContainer.classList.add('text-red-600');
                return;
            }

            try {
                const response = await fetch('/api/auth/reset-password', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user: userParam, password: password }),
                });

                const result = await response.json();

                if (response.ok) {
                    messageContainer.textContent = 'Senha redefinida com sucesso! Redirecionando para o login...';
                    messageContainer.classList.remove('text-red-600');
                    messageContainer.classList.add('text-green-600');
                    form.classList.add('hidden');
                    setTimeout(() => {
                        window.location.href = '/login';
                    }, 3000); 
                } else {
                    messageContainer.textContent = result.message;
                    messageContainer.classList.add('text-red-600');
                }
            } catch (error) {
                messageContainer.textContent = 'Erro de conexão. Tente novamente.';
                messageContainer.classList.add('text-red-600');
            }
        });
    }

    togglePasswordButtons.forEach(button => {
        button.addEventListener('click', () => {
            const targetId = button.getAttribute('data-toggle-password');
            const passwordField = document.getElementById(targetId);
            if (passwordField) {
                const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
                passwordField.setAttribute('type', type);
                button.textContent = type === 'password' ? 'Mostrar' : 'Ocultar';
            }
        });
    });
});