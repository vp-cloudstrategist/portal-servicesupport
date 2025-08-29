document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('forgot-password-form');
    const messageContainer = document.getElementById('message-container');
    const formContainer = document.getElementById('form-container');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const email = document.getElementById('email').value;
        messageContainer.textContent = '';

        try {
            const response = await fetch('/api/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email }),
            });

            const result = await response.json();
            formContainer.classList.add('hidden');
            messageContainer.textContent = result.message;
            messageContainer.classList.add('text-green-600');

        } catch (error) {
            messageContainer.textContent = 'Erro de conexão. Tente novamente.';
            messageContainer.classList.add('text-red-600');
        }
    });
});