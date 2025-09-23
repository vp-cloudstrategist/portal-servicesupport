document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('force-reset-form');
    const newPasswordField = document.getElementById('new-password');
    const confirmPasswordField = document.getElementById('confirm-password');
    
    const requirements = {
        length: document.getElementById('req-length'),
        lowercase: document.getElementById('req-lowercase'),
        uppercase: document.getElementById('req-uppercase'),
        number: document.getElementById('req-number'),
        special: document.getElementById('req-special'),
    };
    function showStatusModal(title, message, isError = false, onConfirm = null) {
        const modal = document.getElementById('modalStatus');
        const statusTitulo = document.getElementById('statusTitulo');
        const statusMensagem = document.getElementById('statusMensagem');
        const statusBotaoFechar = document.getElementById('statusBotaoFechar');
        
        if (modal && statusTitulo && statusMensagem && statusBotaoFechar) {
            statusTitulo.innerHTML = title;
            statusMensagem.innerHTML = message.replace(/\n/g, '<br>');
            
            statusBotaoFechar.className = isError 
                ? "px-6 py-2 text-white rounded bg-red-600 hover:bg-red-700"
                : "px-6 py-2 text-white rounded bg-green-600 hover:bg-green-700";
            
            statusTitulo.className = isError
                ? "text-xl font-bold mb-2 text-red-600"
                : "text-xl font-bold mb-2 text-green-600";
            
            statusBotaoFechar.onclick = () => {
                modal.classList.add('hidden');
                if (onConfirm) {
                    onConfirm();
                }
            };
            modal.classList.remove('hidden');
        }
    }

    newPasswordField.addEventListener('input', () => {
        const value = newPasswordField.value;
        const checks = {
            length: value.length >= 8,
            lowercase: /[a-z]/.test(value),
            uppercase: /[A-Z]/.test(value),
            number: /\d/.test(value),
            special: /[@$!%*?&]/.test(value),
        };
        for (const key in requirements) {
            requirements[key].style.color = checks[key] ? 'green' : 'gray';
        }
    });
    
    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        const newPassword = newPasswordField.value;
        const confirmPassword = confirmPasswordField.value;

        try {
            const response = await fetch('/api/auth/force-reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newPassword, confirmPassword })
            });

            const result = await response.json();

            if (response.ok) {
                showStatusModal('Sucesso!', result.message, false, () => {
                    window.location.href = '/login';
                });
            } else {
                showStatusModal('Erro!', result.message, true);
            }

        } catch (error) {
            showStatusModal('Erro de Conexão', 'Erro de conexão com o servidor.', true);
        }
    });
});