document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('reset-password-form');
    const messageContainer = document.getElementById('message-container');
    const token = new URLSearchParams(window.location.search).get('token');

    if (!token) {
        messageContainer.textContent = 'Token de redefinição não encontrado. Por favor, solicite um novo link.';
        messageContainer.classList.add('text-red-600');
        form.classList.add('hidden');
        return;
    }

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirm-password').value;
        messageContainer.textContent = '';

        if (password !== confirmPassword) {
            messageContainer.textContent = 'As senhas não coincidem.';
            messageContainer.classList.add('text-red-600');
            return;
        }

        try {
            const response = await fetch('/api/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: token, password: password }),
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
});