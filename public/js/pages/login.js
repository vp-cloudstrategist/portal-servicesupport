document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const togglePasswordBtn = document.getElementById('togglePassword');
  const passwordField = document.getElementById('password');

  const popupErro = document.getElementById('popup-erro');
  const popupMensagem = document.getElementById('popup-mensagem-erro');
  const popupFecharBtn = document.getElementById('popup-fechar-button');

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const login = document.getElementById('login').value;
      const password = passwordField.value;

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
          if (popupMensagem) popupMensagem.textContent = result.message || 'Erro desconhecido.';
          if (popupErro) popupErro.classList.remove('hidden');
        }
      } catch (error) {
        if (popupMensagem) popupMensagem.textContent = 'Erro de conexão com o servidor.';
        if (popupErro) popupErro.classList.remove('hidden');
      }
    });
  }

  if (togglePasswordBtn && passwordField) {
    togglePasswordBtn.addEventListener('click', () => {
      const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordField.setAttribute('type', type);
      togglePasswordBtn.textContent = type === 'password' ? 'Mostrar' : 'Ocultar';
    });
  }

  if (popupFecharBtn && popupErro) {
    popupFecharBtn.addEventListener('click', () => {
      popupErro.classList.add('hidden');
    });
  }
});