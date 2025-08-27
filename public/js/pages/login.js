document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const errorMessageDiv = document.getElementById('error-message');

  loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const login = document.getElementById('login').value;
    const password = document.getElementById('password').value;
    errorMessageDiv.textContent = '';

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
        errorMessageDiv.textContent = result.message;
      }
    } catch (error) {
      errorMessageDiv.textContent = 'Erro de conexão. Tente novamente.';
    }
  });
});