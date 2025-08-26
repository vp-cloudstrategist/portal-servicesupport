function toggleModal(modalId, show) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.toggle('hidden', !show);
  }
}

async function carregarDadosUsuario() {
  try {
    const response = await fetch('/api/auth/session');
    if (!response.ok) {
      window.location.href = '/login';
      return;
    }
    const usuario = await response.json();
    
    const nomeUsuarioEl = document.getElementById('nome-usuario');
    if (nomeUsuarioEl) {
      nomeUsuarioEl.textContent = `${usuario.nome} ${usuario.sobrenome || ''}`.trim();
    }
  } catch (error) {
    console.error('Erro ao buscar dados da sessão:', error);
    window.location.href = '/login';
  }
}

async function carregarInfoCards() {
  try {
    const response = await fetch('/api/tickets/cards-info');
    const data = await response.json();
    
    document.getElementById('card-total').textContent = data.total;
    document.getElementById('card-abertos').textContent = data.abertos;
    document.getElementById('card-resolvidos').textContent = data.resolvidos;
    document.getElementById('card-aprovacao').textContent = data.aprovacao;
    document.getElementById('card-encerrados').textContent = data.encerrados;
  } catch (error) {
    console.error('Erro ao carregar info dos cards:', error);
  }
}

async function logout() {
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login';
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
        window.location.href = '/login';
    }
}

document.addEventListener('DOMContentLoaded', () => {
 // carregarDadosUsuario();
 // carregarInfoCards();

  const logoutButton = document.getElementById('logout-button');
  const logoutMenuButton = document.getElementById('logout-menu-button');
  const confirmLogoutButton = document.getElementById('confirm-logout-button');

  if (logoutButton) logoutButton.addEventListener('click', () => toggleModal('modalConfirmarLogout', true));
  if (logoutMenuButton) logoutMenuButton.addEventListener('click', () => toggleModal('modalConfirmarLogout', true));
  if (confirmLogoutButton) confirmLogoutButton.addEventListener('click', logout);
  
});