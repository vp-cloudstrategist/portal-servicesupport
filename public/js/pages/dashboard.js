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

    // --- FUNÇÕES DE LÓGICA INTERNA ---

    async function carregarDadosUsuario() {
        try {
            const response = await fetch('/api/auth/session');
            if (!response.ok) {
                window.location.href = '/login';
                return;
            }
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
        try {
            await fetch('/api/auth/logout', { method: 'POST' });
        } catch (error) {
            console.error('Logout failed:', error);
        } finally {
            window.location.href = '/login';
        }
    }

    async function carregarEmpresas() {
        const selectEmpresa = document.getElementById('selectEmpresa');
        if (!selectEmpresa) return;

        try {
            const response = await fetch('/api/companies');
            if (!response.ok) {
                throw new Error('Falha ao buscar empresas.');
            }
            const companies = await response.json();

            selectEmpresa.innerHTML = '<option value="">-- Selecione uma empresa --</option>'; // Limpa opções antigas

            companies.forEach(company => {
                const option = document.createElement('option');
                option.value = company.id;
                option.textContent = company.name;
                selectEmpresa.appendChild(option);
            });

            // Se houver apenas uma empresa, seleciona-a automaticamente
            if (companies.length === 1) {
                selectEmpresa.value = companies[0].id;
            }

        } catch (error) {
            console.error(error);
            selectEmpresa.innerHTML = '<option value="">Erro ao carregar empresas</option>';
        }
    }

    // --- CONFIGURAÇÃO DE TODOS OS EVENTOS ---

    // Eventos de Logout
    document.getElementById('logout-button')?.addEventListener('click', () => toggleModal('modalConfirmarLogout', true));
    document.getElementById('logout-menu-button')?.addEventListener('click', () => toggleModal('modalConfirmarLogout', true));
    document.getElementById('confirm-logout-button')?.addEventListener('click', logout);
    document.getElementById('cancel-logout-button')?.addEventListener('click', () => toggleModal('modalConfirmarLogout', false));

    // Evento do Menu de Administração
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

    // Evento do Formulário de Criar Empresa
    const formCriarEmpresa = document.getElementById('formCriarEmpresa');
    if (formCriarEmpresa) {
        formCriarEmpresa.addEventListener('submit', async (event) => {
            event.preventDefault();
            const name = formCriarEmpresa.querySelector('input[name="company_name"]').value;

            try {
                const response = await fetch('/api/companies', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name }),
                });
                const result = await response.json();

                if (response.ok) {
                    showStatusModal('Sucesso!', result.message, false);
                    toggleModal('modalCriarEmpresa', false);
                    formCriarEmpresa.reset();
                    carregarEmpresas(); // Atualiza a lista de empresas no outro modal
                } else {
                    showStatusModal('Erro!', result.message, true);
                }
            } catch (error) {
                showStatusModal('Erro de Conexão', 'Não foi possível se comunicar com o servidor.', true);
            }
        });
    }

    // Evento do Formulário de Criar Usuário
    const formCriarUsuario = document.getElementById('formCriarUsuario');
    if (formCriarUsuario) {
        const selectPerfil = document.getElementById('selectPerfil');
        const camposUser = document.getElementById('campos-user');
        const camposSupport = document.getElementById('campos-support');
        const botaoSalvarContainer = document.getElementById('botao-salvar-container');

        selectPerfil.addEventListener('change', () => {
            const perfil = selectPerfil.value;
            camposUser.classList.toggle('hidden', perfil !== 'user');
            camposSupport.classList.toggle('hidden', perfil !== 'support' && perfil !== 'admin');
            botaoSalvarContainer.classList.toggle('hidden', !perfil);
        });

        formCriarUsuario.addEventListener('submit', async (event) => {
            event.preventDefault();

            const perfil = formCriarUsuario.querySelector('#selectPerfil').value;
            let data = { perfil };
            let emailInput;

            if (perfil === 'user') {
                data.nome = formCriarUsuario.querySelector('input[name="nome_user"]').value;
                data.sobrenome = formCriarUsuario.querySelector('input[name="sobrenome_user"]').value;
                data.login = formCriarUsuario.querySelector('input[name="login_user"]').value;
                data.telefone = formCriarUsuario.querySelector('input[name="telefone_user"]').value;
                data.company_id = formCriarUsuario.querySelector('#selectEmpresa').value;
                emailInput = data.login;
            } else if (perfil === 'support' || perfil === 'admin') {
                data.nome = formCriarUsuario.querySelector('input[name="nome_support"]').value;
                data.sobrenome = formCriarUsuario.querySelector('input[name="sobrenome_support"]').value;
                data.login = formCriarUsuario.querySelector('input[name="login_support"]').value;
                emailInput = data.login;
            }

            // Validações
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailInput || !emailRegex.test(emailInput)) {
                showStatusModal('Erro de Validação', 'Por favor, insira um formato de e-mail válido.', true);
                return;
            }
            if (perfil === 'user' && !data.company_id) {
                showStatusModal('Erro de Validação', 'Por favor, selecione uma empresa.', true);
                return;
            }

            try {
                const response = await fetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                });
                const result = await response.json();
                if (response.ok) {
                    showStatusModal('Sucesso!', result.message, false);
                    toggleModal('modalCriarUsuario', false);
                    formCriarUsuario.reset();
                    selectPerfil.dispatchEvent(new Event('change'));
                } else {
                    showStatusModal('Erro!', result.message, true);
                }
            } catch (error) {
                showStatusModal('Erro de Conexão', 'Não foi possível se comunicar com o servidor.', true);
            }
        });
    }

    // --- CHAMADAS INICIAIS AO CARREGAR A PÁGINA ---
    carregarDadosUsuario();
    carregarEmpresas();

});