// Funções globais que podem ser chamadas pelo HTML
function toggleModal(modalId, show) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.toggle('hidden', !show);
  }
}

function showStatusModal(title, message, isError = false) {
    const modal = document.getElementById('modalStatus');
    const statusTitulo = document.getElementById('statusTitulo');
    const statusMensagem = document.getElementById('statusMensagem');
    const statusBotaoFechar = document.getElementById('statusBotaoFechar');
    if (modal && statusTitulo && statusMensagem && statusBotaoFechar) {
        statusTitulo.innerHTML = title;
        statusMensagem.innerHTML = message.replace(/\n/g, '<br>');
        if (isError) {
            statusTitulo.className = "text-xl font-bold mb-2 text-red-600";
            statusBotaoFechar.className = "px-6 py-2 text-white rounded bg-red-600 hover:bg-red-700";
        } else {
            statusTitulo.className = "text-xl font-bold mb-2 text-green-600";
            statusBotaoFechar.className = "px-6 py-2 text-white rounded bg-green-600 hover:bg-green-700";
        }
        statusBotaoFechar.onclick = () => modal.classList.add('hidden');
        modal.classList.remove('hidden');
    }
}

// Lógica principal do Dashboard
document.addEventListener('DOMContentLoaded', () => {
    
    async function carregarDadosUsuario() {
      try {
        const response = await fetch('/api/auth/session');
        if (!response.ok) { window.location.href = '/login'; return; }
        const usuario = await response.json();
        const nomeUsuarioEl = document.getElementById('nome-usuario');
        if (nomeUsuarioEl) nomeUsuarioEl.textContent = `${usuario.nome || ''} ${usuario.sobrenome || ''}`.trim();
        
        const adminMenu = document.getElementById('admin-menu');
        if (adminMenu && usuario.perfil === 'admin') {
          adminMenu.classList.remove('hidden');
        }
      } catch (error) { 
        console.error("Erro ao carregar dados do usuário, redirecionando para login.", error);
        window.location.href = '/login'; 
      }
    }

    async function logout() {
        try { await fetch('/api/auth/logout', { method: 'POST' }); } 
        catch (error) { console.error('Logout failed:', error); }
        finally { window.location.href = '/login'; }
    }

    // --- CONFIGURAÇÃO DE TODOS OS EVENTOS ---
    
    // Logout
    document.getElementById('logout-button')?.addEventListener('click', () => toggleModal('modalConfirmarLogout', true));
    document.getElementById('logout-menu-button')?.addEventListener('click', () => toggleModal('modalConfirmarLogout', true));
    document.getElementById('confirm-logout-button')?.addEventListener('click', logout);

    // Dropdown do Menu Admin
    const adminMenu = document.getElementById('admin-menu');
    if (adminMenu) {
        const button = adminMenu.querySelector('[data-menu-button]');
        const content = adminMenu.querySelector('[data-menu-content]');
        const arrow = button.querySelector('svg');
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            content.classList.toggle('hidden');
            arrow.classList.toggle('rotate-180');
        });
    }

    // Modal de Criar Usuário (LÓGICA COMPLETA E CORRIGIDA)
    const formCriarUsuario = document.getElementById('formCriarUsuario');
    if (formCriarUsuario) {
        const selectPerfil = document.getElementById('selectPerfil');
        const camposUser = document.getElementById('campos-user');
        const camposSupport = document.getElementById('campos-support');
        const botaoSalvarContainer = document.getElementById('botao-salvar-container');
        const passwordUserInput = document.getElementById('password-user-input');
        const passwordSupportInput = document.getElementById('password-support-input');

        // Lógica da Validação Visual da Senha
        function validarSenhaVisual(password, reqListId) {
            const reqs = {
                length: document.getElementById(`${reqListId}-length`),
                lower: document.getElementById(`${reqListId}-lower`),
                upper: document.getElementById(`${reqListId}-upper`),
                number: document.getElementById(`${reqListId}-number`),
                special: document.getElementById(`${reqListId}-special`),
            };
            let isValida = true;
            const defaultColor = '#6b7280'; // Cor cinza padrão do texto
            const successColor = 'green';

            const tem8Chars = password.length >= 8;
            reqs.length.style.color = tem8Chars ? successColor : defaultColor;
            if (!tem8Chars) isValida = false;

            const temMinuscula = /[a-z]/.test(password);
            reqs.lower.style.color = temMinuscula ? successColor : defaultColor;
            if (!temMinuscula) isValida = false;

            const temMaiuscula = /[A-Z]/.test(password);
            reqs.upper.style.color = temMaiuscula ? successColor : defaultColor;
            if (!temMaiuscula) isValida = false;

            const temNumero = /\d/.test(password);
            reqs.number.style.color = temNumero ? successColor : defaultColor;
            if (!temNumero) isValida = false;

            const temEspecial = /[\W_]/.test(password);
            reqs.special.style.color = temEspecial ? successColor : defaultColor;
            if (!temEspecial) isValida = false;

            return isValida;
        }
        
        if(passwordUserInput) passwordUserInput.addEventListener('input', (e) => validarSenhaVisual(e.target.value, 'req-user'));
        if(passwordSupportInput) passwordSupportInput.addEventListener('input', (e) => validarSenhaVisual(e.target.value, 'req-support'));
        
        selectPerfil.addEventListener('change', () => {
            const perfil = selectPerfil.value;
            camposUser.classList.toggle('hidden', perfil !== 'user');
            camposSupport.classList.toggle('hidden', perfil !== 'support' && perfil !== 'admin');
            botaoSalvarContainer.classList.toggle('hidden', !perfil);
        });

        formCriarUsuario.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            const formData = new FormData(formCriarUsuario);
            const data = Object.fromEntries(formData.entries());
            const perfil = data.perfil;
            let payload = { perfil };
            
            if (perfil === 'user') {
                payload = { ...payload, nome: data.nome_user, sobrenome: data.sobrenome_user, login: data.login_user, telefone: data.telefone_user, empresa: data.empresa_user, password: data.password_user };
            } else if (perfil === 'support' || perfil === 'admin') {
                payload = { ...payload, nome: data.nome_support, sobrenome: data.sobrenome_support, login: data.login_support, password: data.password_support };
            }

            // Validações antes de enviar
            if (!payload.perfil || !payload.nome || !payload.sobrenome || !payload.login || !payload.password) {
                showStatusModal('Erro de Validação', 'Nome, Sobrenome, Email e Senha são obrigatórios.', true);
                return;
            }
            if (payload.perfil === 'user' && (!payload.telefone || !payload.empresa)) {
                showStatusModal('Erro de Validação', 'Para Usuário Cliente, Telefone e Empresa também são obrigatórios.', true);
                return;
            }
            if (!validarSenhaVisual(payload.password, perfil === 'user' ? 'req-user' : 'req-support')) {
                showStatusModal('Senha Fraca', 'A senha não cumpre todos os requisitos de segurança.', true);
                return;
            }

            try {
                const response = await fetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
                const result = await response.json();
                if (response.ok) {
                    showStatusModal('Sucesso!', result.message, false);
                    toggleModal('modalCriarUsuario', false);
                    formCriarUsuario.reset();
                    camposUser.classList.add('hidden');
                    camposSupport.classList.add('hidden');
                    botaoSalvarContainer.classList.add('hidden');
                } else {
                    showStatusModal('Erro!', result.message, true);
                }
            } catch (error) {
                showStatusModal('Erro de Conexão', 'Não foi possível se comunicar com o servidor.', true);
            }
        });
    }
    carregarDadosUsuario();
});