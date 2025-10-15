// dashboard.js - VERSÃO COMPLETA E CORRIGIDA

let currentUser = null; 

function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.toggle('hidden', !show);
    }
}

function capitalize(str) {
    if (!str || typeof str !== 'string') return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function showStatusModal(title, message, isError = false, onConfirm = null) {
    const modal = document.getElementById('modalStatus');
    const statusTitulo = document.getElementById('statusTitulo');
    const statusMensagem = document.getElementById('statusMensagem');
    const statusBotaoFechar = document.getElementById('statusBotaoFechar');

    if (modal && statusTitulo && statusMensagem && statusBotaoFechar) {
        statusTitulo.innerHTML = title;
        statusMensagem.innerHTML = message.replace(/\n/g, '<br>');
        statusBotaoFechar.className = isError ? "px-6 py-2 text-white rounded bg-red-600 hover:bg-red-700" : "px-6 py-2 text-white rounded bg-green-600 hover:bg-green-700";
        statusTitulo.className = isError ? "text-xl font-bold mb-2 text-red-600" : "text-xl font-bold mb-2 text-green-600";
        
        statusBotaoFechar.onclick = () => {
            modal.classList.add('hidden');
            if (onConfirm) onConfirm();
        };
        modal.classList.remove('hidden');
    }
}
function abrirModalNovoTicket() {
    const form = document.getElementById('formAbrirTicket');
    if (form) form.reset();

    const now = new Date();
    const formattedDateTime = now.toLocaleString('pt-BR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit'
    }).replace(',', '');

    const inicioAlarmeInput = document.querySelector('#formAbrirTicket input[name="alarme_inicio"]');
    const inicioAtendimentoInput = document.querySelector('#formAbrirTicket input[name="horario_acionamento"]');
    const fimAlarmeInput = document.querySelector('#formAbrirTicket input[name="alarme_fim"]');

    if (inicioAlarmeInput) IMask.find(inicioAlarmeInput)?.setInputValue(formattedDateTime);
    if (inicioAtendimentoInput) IMask.find(inicioAtendimentoInput)?.setInputValue(formattedDateTime);
    if (fimAlarmeInput) IMask.find(fimAlarmeInput)?.setInputValue('');
    
    const podeEditar = currentUser && (currentUser.perfil === 'admin' || currentUser.perfil === 'support');
    
    if (inicioAlarmeInput) {
        inicioAlarmeInput.readOnly = !podeEditar;
        inicioAlarmeInput.classList.toggle('bg-gray-200', !podeEditar);
        inicioAlarmeInput.classList.toggle('cursor-not-allowed', !podeEditar);
    }
    if (inicioAtendimentoInput) {
        inicioAtendimentoInput.readOnly = !podeEditar;
        inicioAtendimentoInput.classList.toggle('bg-gray-200', !podeEditar);
        inicioAtendimentoInput.classList.toggle('cursor-not-allowed', !podeEditar);
    }
    
    toggleModal('modalTicket', true);
}


document.addEventListener('DOMContentLoaded', () => {

    let paginaAtual = 1;
    let ticketIdToDelete = null;
    let pastedFileCreate = null;
    let pastedFileEdit = null;
    let alertaIdToDelete = null;
    let grupoIdToDelete = null;
    let currentAlertsList = [];
    let currentGruposList = [];
    let allUsersCache = [];
    let currentFilters = {};
    
    let columnConfig = [
        { key: 'id', title: 'Ticket#', visible: true },
        { key: 'area_nome', title: 'Área', visible: true },
        { key: 'data_criacao', title: 'Criação', visible: false },
        { key: 'user_nome', title: 'Usuário', visible: true },
        { key: 'prioridade_nome', title: 'Prioridade', visible: true },
        { key: 'status', title: 'Status', visible: true },
        { key: 'alerta_nome', title: 'Alerta', visible: false },
        { key: 'grupo_nome', title: 'Grupo Resp.', visible: false },
        { key: 'alarme_inicio', title: 'Início Alarme', visible: false },
        { key: 'alarme_fim', title: 'Fim Alarme', visible: false },
        { key: 'horario_acionamento', title: 'Atendimento', visible: true },
        { key: 'actions', title: 'Ações', visible: true }
    ];

    const ticketsTable = document.getElementById('tickets-table');
    const adminMenu = document.getElementById('admin-menu');
    const btnGerenciarUsuariosGerente = document.getElementById('btn-gerenciar-usuarios-gerente');
    const formCriarUsuario = document.getElementById('formCriarUsuario');
    const formCriarArea = document.getElementById('formCriarArea');
    const tabelaTicketsBody = ticketsTable?.querySelector('tbody');
    const formAbrirTicket = document.getElementById('formAbrirTicket');
    const formEditarTicket = document.getElementById('formEditarTicket');
    const btnSaveComment = document.getElementById('btn-save-comment');
    const newCommentText = document.getElementById('new-comment-text');
    const btnAbrirFiltros = document.getElementById('btn-abrir-filtros');
    const formFiltros = document.getElementById('formFiltros');
    const btnLimparFiltros = document.getElementById('btn-limpar-filtros');
    const customDateInputs = document.getElementById('custom-date-inputs');

    document.getElementById('btn-customize-view')?.addEventListener('click', () => {
        populateCustomizerModal();
        toggleModal('modalColumnCustomizer', true);
    });

    const visibilityList = document.getElementById('column-visibility-list');
    const orderList = document.getElementById('column-order-list');
    const btnGerenciarUsuarios = document.getElementById('btn-gerenciar-usuarios');
    const btnAbrirModalCriarUsuario = document.getElementById('btn-abrir-modal-criar-usuario');
    const btnAbrirModalListaUsuarios = document.getElementById('btn-abrir-modal-lista-usuarios');
    const userListContainer = document.getElementById('user-list-container');
    const searchUserListInput = document.getElementById('search-user-list');
    const formEditarUsuarioAdmin = document.getElementById('formEditarUsuarioAdmin');
    const nomeUsuarioEditandoSpan = document.getElementById('nome-usuario-editando');

    const btnShowAddGrupo = document.getElementById('btn-show-add-grupo');
    const addGrupoContainer = document.getElementById('add-grupo-container');
    const inputNewGrupo = document.getElementById('input-new-grupo');
    const btnCancelAddGrupo = document.getElementById('btn-cancel-add-grupo');
    const btnSaveNewGrupo = document.getElementById('btn-save-new-grupo');
    const grupoSuggestionsList = document.getElementById('grupo-suggestions-list');
    const btnDeleteGrupo = document.getElementById('btn-delete-grupo-selecionado');

    btnShowAddGrupo?.addEventListener('click', () => {
    const areaSelect = document.getElementById('ticket-area');
    if (!areaSelect || !areaSelect.value) {
        return showStatusModal('Atenção!', 'Por favor, selecione uma Área primeiro.', true);
    }
    addGrupoContainer.classList.remove('hidden');
    btnShowAddGrupo.classList.add('hidden');
    if(btnDeleteGrupo) btnDeleteGrupo.classList.add('hidden');
    inputNewGrupo.focus();
    setupAutocomplete('input-new-grupo', 'grupo-suggestions-list', currentGruposList);
});

    const resetAddGrupoForm = () => {
        if (addGrupoContainer) addGrupoContainer.classList.add('hidden');
        if (btnShowAddGrupo) btnShowAddGrupo.classList.remove('hidden');
        const grupoSelect = document.getElementById('ticket-grupo');
        if (btnDeleteGrupo && grupoSelect?.value) {
            btnDeleteGrupo.classList.remove('hidden');
        }
        if (inputNewGrupo) inputNewGrupo.value = '';
        if (grupoSuggestionsList) grupoSuggestionsList.innerHTML = '';
        if (btnSaveNewGrupo) btnSaveNewGrupo.disabled = false;
    };
    btnCancelAddGrupo?.addEventListener('click', resetAddGrupoForm);

    btnSaveNewGrupo?.addEventListener('click', async () => {
        const nomeNovoGrupo = capitalize(inputNewGrupo.value.trim());
        const areaSelect = document.getElementById('ticket-area');
        const areaId = areaSelect.value;

        if (!nomeNovoGrupo || !areaId) {
            return showStatusModal('Erro!', 'O nome do novo grupo e a área são obrigatórios.', true);
        }

        btnSaveNewGrupo.disabled = true;
        btnSaveNewGrupo.textContent = 'Salvando...';

        try {
            const response = await fetch(`/api/tickets/options/areas/${areaId}/grupos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome: nomeNovoGrupo })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);

            const { novoGrupo } = result;
            const grupoSelect = document.getElementById('ticket-grupo');
            const newOption = new Option(novoGrupo.nome, novoGrupo.id, true, true);
            grupoSelect.add(newOption);
            currentGruposList.push(novoGrupo);
            resetAddGrupoForm();
            grupoSelect.dispatchEvent(new Event('change'));

        } catch (error) {
            showStatusModal('Erro!', error.message, true);
        } finally {
            btnSaveNewGrupo.disabled = false;
            btnSaveNewGrupo.textContent = 'Salvar';
        }
    });

    function handleDeleteGrupo(selectId, areaSelectId) {
        const selectElement = document.getElementById(selectId);
        const areaSelectElement = document.getElementById(areaSelectId);
        const selectedId = selectElement.value;

        if (!selectedId) {
            return showStatusModal('Atenção!', 'Selecione um grupo da lista para excluir.', true);
        }

        grupoIdToDelete = { id: selectedId, areaSelect: areaSelectElement };
        toggleModal('modalConfirmarDeleteGrupo', true);
    }

    btnDeleteGrupo?.addEventListener('click', () => {
        handleDeleteGrupo('ticket-grupo', 'ticket-area');
    });

    document.getElementById('btn-cancel-delete-grupo')?.addEventListener('click', () => {
        grupoIdToDelete = null;
        toggleModal('modalConfirmarDeleteGrupo', false);
    });

    document.getElementById('btn-confirm-delete-grupo')?.addEventListener('click', async () => {
        if (!grupoIdToDelete) return;

        try {
            const response = await fetch(`/api/tickets/options/grupos/${grupoIdToDelete.id}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            toggleModal('modalConfirmarDeleteGrupo', false);

            if (response.ok) {
                showStatusModal('Sucesso!', result.message, false, () => {
                    grupoIdToDelete.areaSelect.dispatchEvent(new Event('change'));
                });
            } else {
                showStatusModal('Erro!', result.message, true);
            }
        } catch (error) {
            toggleModal('modalConfirmarDeleteGrupo', false);
            showStatusModal('Erro de Conexão', 'Não foi possível deletar o grupo.', true);
        } finally {
            grupoIdToDelete = null;
        }
    });

    const maskOptions = {
        mask: 'd/`m/`Y `H:`M',
        pattern: 'd/`m/`Y `H:`M',
        blocks: {
            d: { mask: IMask.MaskedRange, from: 1, to: 31, maxLength: 2, placeholderChar: 'd' },
            m: { mask: IMask.MaskedRange, from: 1, to: 12, maxLength: 2, placeholderChar: 'm' },
            Y: { mask: IMask.MaskedRange, from: 1970, to: 2099, placeholderChar: 'a' },
            H: { mask: IMask.MaskedRange, from: 0, to: 23, maxLength: 2, placeholderChar: 'h' },
            M: { mask: IMask.MaskedRange, from: 0, to: 59, maxLength: 2, placeholderChar: 'm' }
        },
        lazy: false
    };

    ['alarme_inicio', 'horario_acionamento', 'alarme_fim'].forEach(name => {
        const createInput = document.querySelector(`#formAbrirTicket input[name="${name}"]`);
        if(createInput) IMask(createInput, maskOptions);
    });
    ['edit-alarme-inicio', 'edit-horario-acionamento', 'edit-alarme-fim'].forEach(id => {
        const editInput = document.getElementById(id);
        if(editInput) IMask(editInput, maskOptions);
    });
    function convertBrDateToIso(brDate) {
        if (!brDate || brDate.includes('d') || brDate.includes('m') || brDate.includes('a')) return null;
        const parts = brDate.split(' ');
        const dateParts = parts[0].split('/');
        const timeParts = parts[1].split(':');
        const isoDate = new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1]);
        return isoDate.toISOString().slice(0, 19).replace('T', ' ');
    }

    btnGerenciarUsuarios?.addEventListener('click', () => toggleModal('modalGerenciarUsuarios', true));
    
    btnGerenciarUsuariosGerente?.addEventListener('click', () => toggleModal('modalGerenciarUsuarios', true));

    btnGerenciarUsuarios?.addEventListener('click', () => {
        toggleModal('modalGerenciarUsuarios', true);
    });

    btnAbrirModalCriarUsuario?.addEventListener('click', () => {
        toggleModal('modalGerenciarUsuarios', false);
        toggleModal('modalCriarUsuario', true);
    });

    btnAbrirModalListaUsuarios?.addEventListener('click', async () => {
        toggleModal('modalGerenciarUsuarios', false);
        toggleModal('modalListaUsuarios', true);
        userListContainer.innerHTML = '<p class="text-center text-gray-500">Carregando usuários...</p>';
        try {
            const response = await fetch('/api/users');
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.message || 'Falha ao buscar usuários');
            }
            allUsersCache = await response.json();
            renderUserList(allUsersCache);
        } catch (error) {
            console.error(error);
            userListContainer.innerHTML = `<p class="text-center text-red-500">Erro: ${error.message}</p>`;
        }
    });

    function checkPasswordStrength(password) {
        const rules = {
            length: password.length >= 8,
            lowercase: /[a-z]/.test(password),
            uppercase: /[A-Z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[\W_]/.test(password)
        };
        return rules;
    }

    function displayPasswordRules(containerId, rules) {
        const container = document.getElementById(containerId);
        const ruleMessages = {
            length: 'Pelo menos 8 caracteres',
            lowercase: 'Uma letra minúscula',
            uppercase: 'Uma letra maiúscula',
            number: 'Pelo menos um número',
            special: 'Pelo menos um caractere especial (!, @, #, etc.)'
        };

        container.innerHTML = Object.keys(ruleMessages).map(key => {
            const color = rules[key] ? 'text-green-600' : 'text-red-600';
            const icon = rules[key] ? '✓' : '✗';
            return `<div class="${color}">${icon} ${ruleMessages[key]}</div>`;
        }).join('');
    }
    btnAbrirFiltros?.addEventListener('click', async () => {
        toggleModal('modalFiltros', true);
        
        await popularFiltroCheckboxes('filtro-areas-container', '/api/tickets/options/areas', 'areas');
        await popularFiltroCheckboxes('filtro-prioridades-container', '/api/tickets/options/prioridades', 'prioridades');
        await popularFiltroCheckboxes('filtro-usuarios-container', '/api/users', 'usuarios', 'id', 'nome');
        
        const statusList = [
            { id: 'Em Atendimento', nome: 'Em Atendimento' },
            { id: 'Normalizado', nome: 'Normalizado' },
            { id: 'Resolvido', nome: 'Resolvido' }
        ];
        renderCheckboxes('filtro-status-container', statusList, 'status');
    });

    async function popularFiltroCheckboxes(containerId, url, name, keyField = 'id', valueField = 'nome') {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = 'Carregando...';
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Falha ao carregar dados');
            let items = await response.json();

            if (name === 'prioridades') {
                const nomesUnicos = [...new Set(items.map(item => item.nome.split(' ')[0].split('(')[0].trim()))];
                const itensAgrupados = nomesUnicos.map(nomeUnico => ({ id: nomeUnico, nome: nomeUnico }));
                renderCheckboxes(containerId, itensAgrupados, 'prioridades_nomes'); 
            } else {
                renderCheckboxes(containerId, items, name, keyField, valueField);
            }
        } catch (error) {
            container.innerHTML = 'Erro ao carregar opções.';
        }
    }

    function renderCheckboxes(containerId, items, name, keyField = 'id', valueField = 'nome') {
        const container = document.getElementById(containerId);
        if (!container || !items) {
            container.innerHTML = 'Nenhuma opção disponível.';
            return;
        }
        container.innerHTML = items.map(item => `
            <div class="flex items-center">
                <input type="checkbox" id="filter-${name}-${item[keyField]}" name="${name}" value="${item[keyField]}" class="form-checkbox h-4 w-4">
                <label for="filter-${name}-${item[keyField]}" class="ml-2">${item[valueField]}</label>
            </div>
        `).join('');
    }

    formFiltros?.addEventListener('change', (e) => {
        if (e.target.name === 'date_range') {
            customDateInputs.classList.toggle('hidden', e.target.value !== 'custom');
        }
    });

    btnLimparFiltros?.addEventListener('click', () => {
        formFiltros.reset();
        customDateInputs.classList.add('hidden');
        currentFilters = {};
        carregarTickets(1);
        toggleModal('modalFiltros', false);
    });

    formFiltros?.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(formFiltros);
        const filters = {};

        filters.areas = formData.getAll('areas').join(',');
        filters.status = formData.getAll('status').join(',');
        filters.prioridades_nomes = formData.getAll('prioridades_nomes').join(',');
        filters.usuarios = formData.getAll('usuarios').join(',');

        const dateRange = formData.get('date_range');
        if (dateRange === '7days') {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 7);
            filters.startDate = startDate.toISOString().split('T')[0];
            filters.endDate = endDate.toISOString().split('T')[0];
        } else if (dateRange === 'custom') {
            filters.startDate = formData.get('startDate');
            filters.endDate = formData.get('endDate');
        }

        Object.keys(filters).forEach(key => {
            if (!filters[key]) delete filters[key];
        });
        
        currentFilters = filters;
        carregarTickets(1);
        toggleModal('modalFiltros', false);
    });
    
    function createAreaCheckboxes(container, areaList, selectedAreaIds = []) {
        container.innerHTML = '';

        const allCheckboxDiv = document.createElement('div');
        allCheckboxDiv.className = 'flex items-center mb-2';
        const allChecked = selectedAreaIds.length > 0 && selectedAreaIds.length === areaList.length;
        allCheckboxDiv.innerHTML = `
            <input type="checkbox" id="${container.id}-check-all" class="form-checkbox h-4 w-4" ${allChecked ? 'checked' : ''}>
            <label for="${container.id}-check-all" class="ml-2 font-bold">Todos</label>
        `;
        container.appendChild(allCheckboxDiv);

        const allCheckbox = allCheckboxDiv.querySelector('input');

        areaList.forEach(area => {
            const isChecked = selectedAreaIds.includes(area.id);
            const div = document.createElement('div');
            div.className = 'flex items-center';
            div.innerHTML = `
                <input type="checkbox" id="area-${area.id}-${container.id}" name="area_ids" value="${area.id}" class="form-checkbox h-4 w-4 area-checkbox" ${isChecked ? 'checked' : ''}>
                <label for="area-${area.id}-${container.id}" class="ml-2">${area.nome}</label>
            `;
            container.appendChild(div);
        });

        const individualCheckboxes = container.querySelectorAll('.area-checkbox');

        allCheckbox.addEventListener('change', () => {
            individualCheckboxes.forEach(cb => {
                cb.checked = allCheckbox.checked;
            });
        });

        individualCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                const allCheckedResult = [...individualCheckboxes].every(c => c.checked);
                allCheckbox.checked = allCheckedResult;
            });
        });
    }

    function renderComments(comments) {
        const container = document.getElementById('comments-list-container');
        if (!container) return;

        if (comments.length === 0) {
            container.innerHTML = '<p class="text-sm text-center text-gray-500">Nenhum comentário ainda.</p>';
            return;
        }

        container.innerHTML = comments.map(comment => `
            <div class="flex items-start space-x-3">
                <div class="flex-shrink-0">
                    <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 text-sm">
                        ${comment.user_nome.charAt(0)}${comment.user_sobrenome ? comment.user_sobrenome.charAt(0) : ''}
                    </div>
                </div>
                <div class="flex-1 bg-gray-100 p-3 rounded-lg">
                    <div class="flex justify-between items-center">
                        <p class="font-semibold text-sm">${comment.user_nome} ${comment.user_sobrenome || ''}</p>
                        <p class="text-xs text-gray-500">${new Date(comment.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                    <p class="text-sm mt-1">${comment.comment_text.replace(/\n/g, '<br>')}</p>
                </div>
            </div>
        `).join('');
    }

    function appendComment(comment) {
        const container = document.getElementById('comments-list-container');
        if (container.querySelector('p')) {
            container.innerHTML = '';
        }
        
        const commentHtml = `
            <div class="flex items-start space-x-3">
                <div class="flex-shrink-0">
                    <div class="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center font-bold text-gray-600 text-sm">
                        ${comment.user_nome.charAt(0)}${comment.user_sobrenome ? comment.user_sobrenome.charAt(0) : ''}
                    </div>
                </div>
                <div class="flex-1 bg-gray-100 p-3 rounded-lg">
                    <div class="flex justify-between items-center">
                        <p class="font-semibold text-sm">${comment.user_nome} ${comment.user_sobrenome || ''}</p>
                        <p class="text-xs text-gray-500">${new Date(comment.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                    <p class="text-sm mt-1">${comment.comment_text.replace(/\n/g, '<br>')}</p>
                </div>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', commentHtml);
    }

    function renderUserList(users) {
        if (!users || users.length === 0) {
            userListContainer.innerHTML = '<p class="text-center text-gray-500">Nenhum usuário encontrado.</p>';
            return;
        }
        userListContainer.innerHTML = users.map(user => `
            <div class="p-3 border-b hover:bg-gray-50 cursor-pointer user-list-item" data-user-id="${user.id}">
                <p class="font-semibold">${user.nome} ${user.sobre}</p>
                <p class="text-sm text-gray-600">${user.login} - Perfil: ${user.perfil}</p>
            </div>`).join('');
    }

    searchUserListInput?.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        const filteredUsers = allUsersCache.filter(user => 
            user.nome.toLowerCase().includes(searchTerm) ||
            user.sobre.toLowerCase().includes(searchTerm) ||
            user.login.toLowerCase().includes(searchTerm)
        );
        renderUserList(filteredUsers);
    });

    userListContainer?.addEventListener('click', async (e) => {
        const userItem = e.target.closest('.user-list-item');
        if (!userItem) return;
        const userId = userItem.dataset.userId;
        toggleModal('modalListaUsuarios', false);
        toggleModal('modalEditarUsuarioAdmin', true);
        const areaContainer = document.querySelector('#admin-edit-user-area-container .p-2');
        areaContainer.innerHTML = 'Carregando áreas...';
        try {
            const [userResponse, areasResponse] = await Promise.all([
                fetch(`/api/users/${userId}`),
                fetch('/api/tickets/options/areas')
            ]);
            if (!userResponse.ok || !areasResponse.ok) throw new Error('Falha ao buscar dados');
            const user = await userResponse.json();
            const allAreas = await areasResponse.json();
            nomeUsuarioEditandoSpan.textContent = `${user.nome} ${user.sobre}`;
            formEditarUsuarioAdmin.elements['id'].value = user.id;
            formEditarUsuarioAdmin.elements['nome'].value = user.nome;
            formEditarUsuarioAdmin.elements['sobre'].value = user.sobre;
            formEditarUsuarioAdmin.elements['login'].value = user.login;
            formEditarUsuarioAdmin.elements['telef'].value = user.telef || '';
            formEditarUsuarioAdmin.elements['perfil'].value = user.perfil;
            createAreaCheckboxes(areaContainer, allAreas, user.area_ids);
            formEditarUsuarioAdmin.elements['novaSenha'].value = '';
            formEditarUsuarioAdmin.elements['confirmarSenha'].value = '';
            document.getElementById('password-rules-admin').innerHTML = '';
        } catch (error) {
            console.error(error);
            showStatusModal('Erro', 'Não foi possível carregar os dados deste usuário.', true, () => toggleModal('modalEditarUsuarioAdmin', false));
        }
    });
    const fimAlarmeInputEdit = document.getElementById('edit-alarme-fim');
    const statusSelectEdit = document.getElementById('edit-ticket-status');

    if (fimAlarmeInputEdit && statusSelectEdit) {
        fimAlarmeInputEdit.addEventListener('input', () => { 
            if (fimAlarmeInputEdit.value && !fimAlarmeInput.value.includes('d')) {
                statusSelectEdit.value = 'Resolvido';
            } 
        });
    }
    formEditarUsuarioAdmin?.elements['novaSenha'].addEventListener('input', (e) => {
        const rules = checkPasswordStrength(e.target.value);
        displayPasswordRules('password-rules-admin', rules);
    });


    formEditarUsuarioAdmin?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(formEditarUsuarioAdmin);
        const data = Object.fromEntries(formData.entries());
        data.area_ids = formData.getAll('area_ids').map(Number); 
        if (data.novaSenha) {
            const rules = checkPasswordStrength(data.novaSenha);
            if (Object.values(rules).some(rule => !rule)) {
                return showStatusModal('Erro de Validação', 'A nova senha não atende a todos os critérios de segurança.', true);
            }
            if (data.novaSenha !== data.confirmarSenha) {
                return showStatusModal('Erro de Validação', 'As senhas não coincidem.', true);
            }
        }
        
        try {
            const response = await fetch(`/api/users/${data.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();

            if (!response.ok) throw new Error(result.message);

            showStatusModal('Sucesso!', result.message, false, () => {
                toggleModal('modalEditarUsuarioAdmin', false);
                btnAbrirModalListaUsuarios.click(); 
            });

        } catch (error) {
            showStatusModal('Erro', error.message, true);
        }
    });
    const btnMinhaConta = document.getElementById('btn-minha-conta');
    const formMinhaConta = document.getElementById('formMinhaConta');

    btnMinhaConta?.addEventListener('click', async () => {
        toggleModal('modalMinhaConta', true);
        const areaContainer = document.getElementById('minha-conta-area-container');
        areaContainer.innerHTML = 'Carregando...';

        try {
            const response = await fetch('/api/users/me');
            if (!response.ok) throw new Error('Não foi possível carregar seus dados.');
            const user = await response.json();
            
            currentUser = user; 

            formMinhaConta.elements['nome'].value = user.nome || '';
            formMinhaConta.elements['sobrenome'].value = user.sobrenome || '';
            formMinhaConta.elements['login'].value = user.login || '';
            formMinhaConta.elements['telefone'].value = user.telefone || '';
            
            if (user.perfil === 'admin') {
                areaContainer.innerHTML = `
                    <label class="block text-sm font-semibold text-gray-700 mb-2">Áreas</label>
                    <div class="p-2 border rounded-md max-h-32 overflow-y-auto bg-gray-50"></div>
                `;
                const allAreas = await getAreasList();
                createAreaCheckboxes(areaContainer.querySelector('.p-2'), allAreas, user.area_ids);
            } else {
                areaContainer.innerHTML = `
                    <label class="block text-sm font-semibold text-gray-700">Áreas</label>
                    <input type="text" value="${user.areas_nome || 'Nenhuma'}" readonly class="w-full mt-1 border rounded p-2 bg-gray-200 cursor-not-allowed">
                `;
            }

            formMinhaConta.elements['novaSenha'].value = '';
            formMinhaConta.elements['confirmarSenha'].value = '';
            document.getElementById('password-rules-minha-conta').innerHTML = '';

        } catch (error) {
            showStatusModal('Erro!', error.message, true, () => {
                toggleModal('modalMinhaConta', false);
            });
        }
    });

    formMinhaConta?.elements['novaSenha'].addEventListener('input', (e) => {
        const rules = checkPasswordStrength(e.target.value);
        displayPasswordRules('password-rules-minha-conta', rules);
    });

    formMinhaConta?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(formMinhaConta);
        const data = Object.fromEntries(formData.entries());

        if (currentUser && currentUser.perfil === 'admin') {
            data.area_ids = formData.getAll('area_ids').map(Number);
        }

        if (data.novaSenha) {
            const rules = checkPasswordStrength(data.novaSenha);
            if (Object.values(rules).some(rule => !rule)) {
                return showStatusModal('Erro de Validação', 'A nova senha não atende a todos os critérios de segurança.', true);
            }
            if (data.novaSenha !== data.confirmarSenha) {
                return showStatusModal('Erro de Validação', 'As senhas não coincidem.', true);
            }
        }

        try {
            const response = await fetch('/api/users/me', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            
            if (!response.ok) throw new Error(result.message);

            showStatusModal('Sucesso!', result.message, false, () => {
                toggleModal('modalMinhaConta', false);
                document.getElementById('nome-usuario').textContent = `${data.nome} ${data.sobrenome}`;
            });

        } catch (error) {
            showStatusModal('Erro!', error.message, true);
        }
    });
    
    async function getAreasList() {
        try {
            const response = await fetch('/api/tickets/options/areas');
            if (!response.ok) return [];
            return await response.json();
        } catch (error) {
            return [];
        }
    }

    const statusSelect = document.getElementById('edit-ticket-status');
    if (statusSelect) {
        statusSelect.addEventListener('change', (event) => {
            const newStatus = event.target.value;
            const fimAlarmeInput = document.getElementById('edit-alarme-fim');
            if (newStatus === 'Resolvido' || newStatus === 'Normalizado') {
                if (fimAlarmeInput && !fimAlarmeInput.value) { 
                    const now = new Date();
                    const formattedDateTime = now.toLocaleString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');
                    const iMask = IMask.find(fimAlarmeInput);
                    if (iMask) {
                        iMask.value = formattedDateTime;
                    } else {
                        fimAlarmeInput.value = formattedDateTime;
                    }
                }
            }
        });
    }

    function handlePaste(event, targetTextarea, previewElement, fileStoreCallback) {
        event.preventDefault();
        
        const clipboardItems = event.clipboardData.items;
        let foundImage = false;

        fileStoreCallback(null);
        previewElement.innerHTML = '';

        for (const item of clipboardItems) {
            if (item.kind === 'file' && item.type.startsWith('image/')) {
                foundImage = true;
                const imageFile = item.getAsFile();
                
                fileStoreCallback(imageFile); 

                const wrapper = document.createElement('div');
                wrapper.className = 'relative inline-block mt-2'; 

                const img = document.createElement('img');
                img.src = URL.createObjectURL(imageFile);
                img.className = 'max-w-[200px] max-h-[200px] rounded border border-gray-300';
                
                const removeBtn = document.createElement('button');
                removeBtn.textContent = '×';
                removeBtn.type = 'button';
                removeBtn.className = 'absolute top-0 right-0 -mt-2 -mr-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xl font-bold leading-none hover:bg-red-700 focus:outline-none transition-transform transform hover:scale-110';
                removeBtn.title = 'Remover imagem';
                
                removeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    fileStoreCallback(null);      
                    previewElement.innerHTML = ''; 
                });

                wrapper.appendChild(img);
                wrapper.appendChild(removeBtn);
                previewElement.appendChild(wrapper);

                break; 
            }
        }

        if (!foundImage) {
            const text = event.clipboardData.getData('text/plain');
            if (text) {
                const start = targetTextarea.selectionStart;
                const end = targetTextarea.selectionEnd;
                targetTextarea.value = targetTextarea.value.substring(0, start) + text + targetTextarea.value.substring(end);
                targetTextarea.selectionStart = targetTextarea.selectionEnd = start + text.length;
            }
        }
    }

    function setupPasteFunctionality() {
        const createDesc = document.getElementById('ticket-descricao');
        const editDesc = document.getElementById('edit-ticket-descricao');
        const createPreview = document.getElementById('paste-preview-create');
        const editPreview = document.getElementById('paste-preview-edit');

        if (createDesc && createPreview) {
            createDesc.addEventListener('paste', (event) => {
                handlePaste(event, createDesc, createPreview, (file) => { pastedFileCreate = file; });
            });
        }

        if (editDesc && editPreview) {
            editDesc.addEventListener('paste', (event) => {
                handlePaste(event, editDesc, editPreview, (file) => { pastedFileEdit = file; });
            });
        }
    }

    function saveColumnConfig() {
        localStorage.setItem('ticketColumnConfig', JSON.stringify(columnConfig));
    }

    function loadColumnConfig() {
        const savedConfig = localStorage.getItem('ticketColumnConfig');
        if (savedConfig) {
            try {
                const parsedConfig = JSON.parse(savedConfig);
                if (!parsedConfig.find(c => c.key === 'actions')) {
                    parsedConfig.push({ key: 'actions', title: 'Ações', visible: true });
                }
                columnConfig = parsedConfig;
            } catch (e) {
                console.error("Erro ao carregar configuração de colunas, usando padrão.", e);
            }
        }
    }

    function renderTable(tickets) {
        if (!ticketsTable) return;

        if ($(ticketsTable).data('colResizable')) {
            $(ticketsTable).colResizable({ disable: true });
        }
    
        const thead = ticketsTable.querySelector('thead tr');
        const tbody = ticketsTable.querySelector('tbody');
        if (!thead || !tbody) return;
    
        thead.innerHTML = '';
        tbody.innerHTML = '';
        const visibleColumns = columnConfig.filter(col => col.visible);

        visibleColumns.forEach(col => {
            if (col.key === 'actions') {
                thead.innerHTML += `<th class="py-2 px-2 border text-center">${col.title}</th>`;
            } else {
                thead.innerHTML += `<th class="py-2 px-2 border">${col.title}</th>`;
            }
        });
    
        if (!tickets || tickets.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${visibleColumns.length}" class="text-center p-4">Nenhum ticket encontrado.</td></tr>`;
        } else {
            let tableContent = '';
            tickets.forEach(ticket => {
                let rowHtml = '<tr class="border-t text-center hover:bg-gray-50">';
                visibleColumns.forEach(col => {
                    let cellValue = '';
                    const formatDateTime = (dateString) => {
                        if (!dateString) return 'N/A';
                        return new Date(dateString).toLocaleString('pt-BR', {
                            day: '2-digit', month: '2-digit', year: 'numeric',
                            hour: '2-digit', minute: '2-digit'
                        });
                    };
    
                    switch (col.key) {
                        case 'id': 
                            cellValue = `#INC-${ticket.id}`;
                            break;
                        case 'data_criacao':
                            cellValue = new Date(ticket.data_criacao).toLocaleDateString('pt-BR');
                            break;
                        case 'alarme_inicio':
                        case 'alarme_fim':
                        case 'horario_acionamento':
                            cellValue = formatDateTime(ticket[col.key]);
                            break;
                        case 'actions':
                            cellValue = `<button class="p-1 btn-edit-ticket" data-id="${ticket.id}"><img src="/images/editar.png" alt="Editar" class="w-5 h-5 mx-auto" /></button>`;
                            break;
                        default:
                            cellValue = ticket[col.key] || 'N/A';
                    }
                    rowHtml += `<td class="py-2 px-2 border">${cellValue}</td>`;
                });
                rowHtml += '</tr>';
                tableContent += rowHtml;
            });
            tbody.innerHTML = tableContent;
        }
    
        $(ticketsTable).colResizable({
            liveDrag: true,
            gripInnerHtml: "<div class='JCLRgrip'></div>",
            minWidth: 50
        });
    }

    function populateCustomizerModal() {
        if (!visibilityList || !orderList) return;
        visibilityList.innerHTML = '';
        orderList.innerHTML = '';

        columnConfig.forEach((col) => {
            if (col.key === 'actions') return;

            const visibilityItem = document.createElement('div');
            visibilityItem.innerHTML = `<label class="flex items-center space-x-2 cursor-pointer"><input type="checkbox" data-key="${col.key}" class="form-checkbox h-4 w-4" ${col.visible ? 'checked' : ''}><span>${col.title}</span></label>`;
            visibilityList.appendChild(visibilityItem);

            if (col.visible) {
                const orderItem = document.createElement('li');
                orderItem.className = 'bg-gray-100 p-2 rounded cursor-grab border';
                orderItem.textContent = col.title;
                orderItem.setAttribute('draggable', true);
                orderItem.dataset.key = col.key;
                orderList.appendChild(orderItem);
            }
        });
    }

    async function carregarDadosUsuario() {
        try {
            const response = await fetch('/api/auth/session');
            if (!response.ok) {
                window.location.href = '/login';
                return;
            }
            currentUser = await response.json(); 
            const nomeUsuarioEl = document.getElementById('nome-usuario');
            if (nomeUsuarioEl) nomeUsuarioEl.textContent = `${currentUser.nome || ''} ${currentUser.sobrenome || ''}`.trim();
            if (adminMenu && currentUser.perfil === 'admin') {
                adminMenu.classList.remove('hidden');
            }
            if (btnGerenciarUsuariosGerente && currentUser.perfil === 'gerente') {
                btnGerenciarUsuariosGerente.classList.remove('hidden');
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

    
    function popularDropdown(selectId, data, placeholder) {
        const select = document.getElementById(selectId);
        if (!select) return;
        select.innerHTML = `<option value="">-- ${placeholder} --</option>`;
        if (Array.isArray(data)) {
            data.forEach(item => {
                const option = document.createElement('option');
                option.value = item.id;
                option.textContent = item.nome;
                select.appendChild(option);
            });
        }
    }
    async function handleAreaChange(areaSelectElement, tipoSelectId, prioridadeSelectId, grupoSelectId, alertaSelectId) {
        const areaId = areaSelectElement.value;
        
        const tipoSelect = document.getElementById(tipoSelectId);
        const prioridadeSelect = document.getElementById(prioridadeSelectId);
        const grupoSelect = document.getElementById(grupoSelectId);
        const alertaSelect = document.getElementById(alertaSelectId);

        const selects = [
            { element: tipoSelect, placeholder: 'Selecione uma Área' },
            { element: prioridadeSelect, placeholder: 'Selecione uma Área' },
            { element: grupoSelect, placeholder: 'Selecione uma Área' },
            { element: alertaSelect, placeholder: 'Selecione uma Área' },
        ];

        selects.forEach(s => {
            if (s.element) {
                popularDropdown(s.element.id, [], s.placeholder);
                s.element.disabled = true;
            }
        });
        
        document.getElementById('btn-delete-grupo-selecionado')?.classList.add('hidden');
        document.getElementById('btn-delete-alerta-selecionado')?.classList.add('hidden');
        document.getElementById('btn-delete-grupo-selecionado-edit')?.classList.add('hidden');
        
        resetAddGrupoForm();
        resetAddAlertaForm();

        if (areaId) {
            [tipoSelect, prioridadeSelect, grupoSelect, alertaSelect].forEach(s => {
                if (s) s.innerHTML = '<option value="">Carregando...</option>';
            });
            
            try {
                const [tiposRes, prioridadesRes, gruposRes, alertasRes] = await Promise.all([
                    fetch(`/api/tickets/options/areas/${areaId}/tipos`),
                    fetch(`/api/tickets/options/areas/${areaId}/prioridades`),
                    fetch(`/api/tickets/options/areas/${areaId}/grupos`),
                    fetch(`/api/tickets/options/areas/${areaId}/alertas`)
                ]);

                if (!tiposRes.ok || !prioridadesRes.ok || !gruposRes.ok || !alertasRes.ok) {
                    throw new Error('Falha ao buscar dados da área.');
                }
                
                const [tipos, prioridades, grupos, alertas] = await Promise.all([
                    tiposRes.json(), prioridadesRes.json(), gruposRes.json(), alertasRes.json()
                ]);

                currentGruposList = grupos;
                currentAlertsList = alertas;

                popularDropdown(tipoSelectId, tipos, 'Selecione o Tipo');
                popularDropdown(prioridadeSelectId, prioridades, 'Selecione a Prioridade');
                popularDropdown(grupoSelectId, grupos, 'Selecione o Grupo');
                popularDropdown(alertaSelectId, alertas, 'Selecione o Alerta');
                
                [tipoSelect, prioridadeSelect, grupoSelect, alertaSelect].forEach(s => {
                    if (s) s.disabled = false;
                });

            } catch (error) {
                console.error("Erro ao carregar dados da área:", error);
                selects.forEach(s => {
                    if (s.element) popularDropdown(s.element.id, [], 'Erro ao carregar');
                });
            }
        }
    }
    async function popularDropdownsTicket() {
        const fetchAndPopulate = async (selectId, url, placeholder) => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`Falha na requisição para ${url}`);
                const items = await response.json();
                popularDropdown(selectId, items, placeholder);
            } catch (error) {
                console.error(`Erro ao popular o seletor #${selectId}:`, error);
                popularDropdown(selectId, [], 'Erro ao carregar');
            }
        };
        fetchAndPopulate('ticket-area', '/api/tickets/options/areas', 'Selecione a Área');
        fetchAndPopulate('edit-ticket-area', '/api/tickets/options/areas', 'Selecione a Área');
        fetchAndPopulate('selectArea', '/api/tickets/options/areas', 'Selecione a Área');
    }


    async function carregarInfoCards() {
        try {
            const response = await fetch('/api/tickets/cards-info');
            if (!response.ok) throw new Error('Falha ao carregar cards');
            const data = await response.json();
            document.getElementById('card-total').textContent = data.total;
            document.getElementById('card-abertos').textContent = data.abertos;
            document.getElementById('card-resolvidos').textContent = data.resolvidos;
            document.getElementById('card-aprovacao').textContent = data.aprovacao;
            document.getElementById('card-encerrados').textContent = data.encerrados;
        } catch (error) {
            console.error("Erro ao carregar info dos cards:", error);
        }
    }
    
    async function carregarTickets(pagina = 1) {
        paginaAtual = pagina;
        const porPagina = document.getElementById('qtdPorPagina')?.value || 20;
        const criterio = document.getElementById('ordenarPor')?.value || 'id_desc';

        let url = `/api/tickets?pagina=${paginaAtual}&limite=${porPagina}&ordenar=${criterio}`;

        const params = new URLSearchParams(currentFilters);
        const queryString = params.toString();
        if (queryString) {
            url += `&${queryString}`;
        }
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error('Falha ao carregar tickets');
            const dados = await response.json();
            renderTable(dados.tickets);
            atualizarPaginacao(dados.total, dados.pagina, porPagina);
        } catch (error) {
            console.error("Erro em carregarTickets:", error);
            const tbody = document.querySelector('#tickets-table tbody');
            if (tbody) tbody.innerHTML = `<tr><td colspan="12" class="text-center text-red-500 p-4">Erro ao carregar dados.</td></tr>`;
        }
    }

    function atualizarPaginacao(total, pagina, porPagina) {
        const container = document.getElementById('paginacao');
        if (!container) return;
        container.innerHTML = '';
        const totalPaginas = Math.ceil(total / porPagina);

        if (totalPaginas <= 1) return; 

        const btnPrev = document.createElement('button');
        btnPrev.innerHTML = '&laquo;';
        btnPrev.className = 'border px-3 py-1 rounded-md mx-1 text-sm bg-white hover:bg-gray-100';
        btnPrev.disabled = pagina === 1;
        btnPrev.onclick = () => carregarTickets(pagina - 1);
        container.appendChild(btnPrev);
    
        for (let i = 1; i <= totalPaginas; i++) {
            if (i === 1 || i === totalPaginas || (i >= pagina - 2 && i <= pagina + 2)) {
                const btn = document.createElement('button');
                btn.textContent = i;
                btn.className = 'border px-3 py-1 rounded-md mx-1 text-sm ' + (i === pagina ? 'bg-blue-600 text-white font-bold' : 'bg-white hover:bg-gray-100');
                btn.onclick = () => carregarTickets(i);
                container.appendChild(btn);
            } else if (i === pagina - 3 || i === pagina + 3) {
                const span = document.createElement('span');
                span.textContent = '...';
                span.className = 'px-3 py-1';
                container.appendChild(span);
            }
        }
    
        const btnNext = document.createElement('button');
        btnNext.innerHTML = '&raquo;';
        btnNext.className = 'border px-3 py-1 rounded-md mx-1 text-sm bg-white hover:bg-gray-100';
        btnNext.disabled = pagina === totalPaginas;
        btnNext.onclick = () => carregarTickets(pagina + 1);
        container.appendChild(btnNext);
    }

    
    function criarSeletorItensPorPagina() {
        const container = document.getElementById('items-por-pagina-container');
        if (!container) return;

        container.innerHTML = `
            <label for="qtdPorPagina" class="text-sm font-medium">Itens por pág:</label>
            <select id="qtdPorPagina" class="border rounded px-2 py-1 bg-white text-sm">
                <option value="10">10</option>
                <option value="20" selected>20</option>
                <option value="50">50</option>
                <option value="100">100</option>
            </select>
        `;

        document.getElementById('qtdPorPagina').addEventListener('change', () => carregarTickets(1));
    }
    const btnAbrirModalExportar = document.getElementById('btn-abrir-modal-exportar');
    const formExportar = document.getElementById('formExportar');
    const yearSelect = document.getElementById('export-year-select');
    const monthsContainer = document.getElementById('export-months-container');

    btnAbrirModalExportar?.addEventListener('click', () => {
        const currentYear = new Date().getFullYear();
        yearSelect.innerHTML = '';
        for (let i = 0; i < 5; i++) {
            const year = currentYear - i;
            yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
        }

        const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
        monthsContainer.innerHTML = `
            <div class="col-span-3 flex items-center mb-2">
                <input type="checkbox" id="check-all-months" class="form-checkbox h-4 w-4">
                <label for="check-all-months" class="ml-2 font-bold text-sm">Todos os Meses</label>
            </div>
            ${meses.map((mes, index) => `
                <div class="flex items-center">
                    <input type="checkbox" id="month-${index+1}" name="months" value="${index+1}" class="form-checkbox h-4 w-4 month-checkbox">
                    <label for="month-${index+1}" class="ml-2 text-sm">${mes}</label>
                </div>
            `).join('')}
        `;

        const allMonthsCheckbox = document.getElementById('check-all-months');
        const individualMonthCheckboxes = monthsContainer.querySelectorAll('.month-checkbox');
        allMonthsCheckbox.addEventListener('change', () => {
            individualMonthCheckboxes.forEach(cb => cb.checked = allMonthsCheckbox.checked);
        });

        toggleModal('modalExportarRelatorio', true);
    });

    formExportar?.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(formExportar);
        const format = formData.get('format');
        const year = formData.get('year');
        const months = formData.getAll('months');

        if (!year) {
            return showStatusModal('Erro', 'Por favor, selecione um ano.', true);
        }

        const queryString = `?format=${format}&year=${year}${months.length > 0 ? '&months=' + months.join(',') : ''}`;

        window.location.href = `/api/tickets/export${queryString}`;

        toggleModal('modalExportarRelatorio', false);
    });

    async function abrirModalEditar(ticketId) {
        pastedFileEdit = null;
        const preview = document.getElementById('paste-preview-edit');
        if (preview) preview.innerHTML = '';
        formEditarTicket.reset();

        try {
            const commentsContainer = document.getElementById('comments-list-container');
            if(commentsContainer) commentsContainer.innerHTML = '<p class="text-sm text-center text-gray-500">Carregando...</p>';
            
            const [ticketResponse, commentsResponse] = await Promise.all([
                fetch(`/api/tickets/${ticketId}`),
                fetch(`/api/tickets/${ticketId}/comments`)
            ]);

            if (!ticketResponse.ok) {
                throw new Error('Ticket não encontrado');
            }
            const ticket = await ticketResponse.json();

            const formatIsoToBr = (isoString) => {
                if (!isoString) return '';
                const date = new Date(isoString);
                if (isNaN(date)) return '';
                return date.toLocaleString('pt-BR', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                }).replace(',', '');
            };
            
            document.getElementById('edit-ticket-id').value = ticket.id;
            document.getElementById('edit-ticket-status').value = ticket.status;
            document.getElementById('edit-ticket-descricao').value = ticket.descricao;
            IMask.find(document.getElementById('edit-alarme-inicio'))?.setInputValue(formatIsoToBr(ticket.alarme_inicio));
            IMask.find(document.getElementById('edit-horario-acionamento'))?.setInputValue(formatIsoToBr(ticket.horario_acionamento));
            IMask.find(document.getElementById('edit-alarme-fim'))?.setInputValue(formatIsoToBr(ticket.alarme_fim));
            
            const inicioAlarmeInput = document.getElementById('edit-alarme-inicio');
            const inicioAtendimentoInput = document.getElementById('edit-horario-acionamento');
            const podeEditarDatas = currentUser && currentUser.perfil === 'admin';
            [inicioAlarmeInput, inicioAtendimentoInput].forEach(input => {
                if (input) {
                    input.readOnly = !podeEditarDatas;
                    input.classList.toggle('bg-gray-200', !podeEditarDatas);
                    input.classList.toggle('cursor-not-allowed', !podeEditarDatas);
                }
            });
            
            const linkContainer = document.getElementById('current-attachment-container');
            const linkSpan = document.getElementById('current-attachment-link');
            const removeAnexoInput = document.getElementById('edit-remove-anexo');
            if (linkContainer && linkSpan && removeAnexoInput) {
                removeAnexoInput.value = '0';
                linkContainer.classList.add('hidden');
                if (ticket.anexo_path) {
                    const webPath = ticket.anexo_path.replace('public\\', '').replace(/\\/g, '/');
                    linkSpan.innerHTML = `Anexo atual: <a href="/${webPath}" target="_blank" class="text-blue-600 hover:underline">Ver Arquivo</a>`;
                    linkContainer.classList.remove('hidden');
                }
            }

            const areaSelect = document.getElementById('edit-ticket-area');
            areaSelect.value = ticket.area_id; 

            await handleAreaChange(areaSelect, 'edit-ticket-tipo', 'edit-ticket-prioridade', 'edit-ticket-grupo', 'edit-ticket-alerta');
            
            document.getElementById('edit-ticket-tipo').value = ticket.tipo_solicitacao_id;
            document.getElementById('edit-ticket-prioridade').value = ticket.prioridade_id; 
            
            const grupoSelect = document.getElementById('edit-ticket-grupo');
            grupoSelect.value = ticket.grupo_id;
            handleGrupoChange(grupoSelect); // Atualiza visibilidade do botão de deletar
            
            const alertaSelect = document.getElementById('edit-ticket-alerta');
            alertaSelect.value = ticket.alerta_id;
            alertaSelect.dispatchEvent(new Event('change')); // Atualiza visibilidade do botão de deletar
            
            const deleteButton = document.getElementById('btn-delete-ticket');
            if (deleteButton) {
                deleteButton.classList.toggle('hidden', !(currentUser && currentUser.perfil === 'admin'));
            }
            
            if (commentsResponse.ok) {
                const comments = await commentsResponse.json();
                renderComments(comments);
            } else {
                 if(commentsContainer) commentsContainer.innerHTML = '<p class="text-sm text-center text-red-500">Erro ao carregar comentários.</p>';
            }
            
            toggleModal('modalEditarTicket', true);
            
        } catch (error) {
            toggleModal('modalEditarTicket', false);
            console.error("Erro ao abrir modal de edição:", error);
            showStatusModal('Erro!', 'Não foi possível carregar os dados do ticket.', true);
        }
    }

    document.getElementById('ticket-area')?.addEventListener('change', (event) => {
        handleAreaChange(event.target, 'ticket-tipo', 'ticket-prioridade', 'ticket-grupo', 'ticket-alerta');
    });

    document.getElementById('edit-ticket-area')?.addEventListener('change', (event) => {
        handleAreaChange(event.target, 'edit-ticket-tipo', 'edit-ticket-prioridade', 'edit-ticket-grupo', 'edit-ticket-alerta'); 
    });

    document.getElementById('btn-cancel-create')?.addEventListener('click', () => {
        formAbrirTicket.reset(); 
        
        ['ticket-grupo', 'ticket-alerta', 'ticket-tipo', 'ticket-prioridade'].forEach(id => {
            const select = document.getElementById(id);
            if(select) {
                select.innerHTML = '<option value="">-- Selecione uma Área Primeiro --</option>';
                select.disabled = true;
            }
        });

        const preview = document.getElementById('paste-preview-create');
        if (preview) preview.innerHTML = '';
        pastedFileCreate = null;
        
        toggleModal('modalTicket', false); 
    });

    document.getElementById('btn-cancel-edit')?.addEventListener('click', () => {
        toggleModal('modalEditarTicket', false);
    });

    document.getElementById('logout-button')?.addEventListener('click', () => toggleModal('modalConfirmarLogout', true));
    document.getElementById('logout-menu-button')?.addEventListener('click', () => toggleModal('modalConfirmarLogout', true));
    document.getElementById('confirm-logout-button')?.addEventListener('click', logout);
    document.getElementById('cancel-logout-button')?.addEventListener('click', () => toggleModal('modalConfirmarLogout', false));

    const btnShowAddAlerta = document.getElementById('btn-show-add-alerta');
    const addAlertaContainer = document.getElementById('add-alerta-container');
    const inputNewAlerta = document.getElementById('input-new-alerta');
    const btnCancelAddAlerta = document.getElementById('btn-cancel-add-alerta');
    const btnSaveNewAlerta = document.getElementById('btn-save-new-alerta');
    const suggestionsList = document.getElementById('alerta-suggestions-list'); 
    const btnDeleteAlerta = document.getElementById('btn-delete-alerta-selecionado');
    
  // SUBSTITUA ESTA FUNÇÃO
function setupAutocomplete(inputId, suggestionsContainerId, listSource) {
    const input = document.getElementById(inputId);
    const suggestionsContainer = document.getElementById(suggestionsContainerId);
    const btnSave = input.closest('div').querySelector('button[id*="save"]');

    if (!input || !suggestionsContainer) return;

    input.addEventListener('input', () => {
        const query = input.value.trim().toLowerCase();
        suggestionsContainer.innerHTML = ''; 
        if (btnSave) btnSave.disabled = false;

        if (!query) return;

        const exactMatch = listSource.find(item => item.nome.toLowerCase() === query);
        if (exactMatch) {
            suggestionsContainer.innerHTML = `<div class="p-2 text-sm text-red-600 font-bold">Este item já existe.</div>`;
            if (btnSave) btnSave.disabled = true;
            return;
        }

        const similarMatches = listSource.filter(item => item.nome.toLowerCase().includes(query));
        if (similarMatches.length > 0) {
            similarMatches.forEach(item => {
                const option = document.createElement('div');
                option.className = 'p-2 text-sm cursor-pointer hover:bg-blue-100';
                option.textContent = item.nome;
                option.addEventListener('click', () => {
                    input.value = item.nome;
                    suggestionsContainer.innerHTML = '';
                });
                suggestionsContainer.appendChild(option);
            });
        } else {
             const feedback = document.createElement('div');
             feedback.className = 'p-2 text-sm text-green-600';
             feedback.textContent = 'Nome disponível!';
             suggestionsContainer.appendChild(feedback);
        }
    });
}

    function handleDeleteAlerta() {
        const selectElement = document.getElementById('ticket-alerta');
        const areaSelectElement = document.getElementById('ticket-area');
        const selectedId = selectElement.value;

        if (!selectedId) {
            showStatusModal('Atenção!', 'Por favor, selecione um alerta da lista para excluir.', true);
            return;
        }
        
        alertaIdToDelete = { id: selectedId, areaSelect: areaSelectElement };
        toggleModal('modalConfirmarDeleteAlerta', true);
    }

    btnDeleteAlerta?.addEventListener('click', () => {
        handleDeleteAlerta();
    });

    document.getElementById('btn-cancel-delete-alerta')?.addEventListener('click', () => {
        alertaIdToDelete = null;
        toggleModal('modalConfirmarDeleteAlerta', false);
    });

    document.getElementById('btn-confirm-delete-alerta')?.addEventListener('click', async () => {
        if (!alertaIdToDelete) return;

        try {
            const response = await fetch(`/api/tickets/options/alertas/${alertaIdToDelete.id}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            toggleModal('modalConfirmarDeleteAlerta', false);
            
            if (response.ok) {
                showStatusModal('Sucesso!', result.message, false, () => {
                   alertaIdToDelete.areaSelect.dispatchEvent(new Event('change'));
                });
            } else {
                showStatusModal('Erro!', result.message, true);
            }

        } catch (error) {
            toggleModal('modalConfirmarDeleteAlerta', false);
            showStatusModal('Erro de Conexão', 'Não foi possível deletar o alerta.', true);
        } finally {
            alertaIdToDelete = null;
        }
    });

    btnShowAddAlerta?.addEventListener('click', () => {
    const areaSelect = document.getElementById('ticket-area'); 
    if (!areaSelect || !areaSelect.value) {
        return showStatusModal('Atenção!', 'Por favor, selecione uma Área primeiro.', true);
    }
    addAlertaContainer.classList.remove('hidden');
    btnShowAddAlerta.classList.add('hidden');
    if(btnDeleteAlerta) btnDeleteAlerta.classList.add('hidden');
    inputNewAlerta.focus();
    setupAutocomplete('input-new-alerta', 'alerta-suggestions-list', currentAlertsList);
});

    const resetAddAlertaForm = () => {
        if(addAlertaContainer) addAlertaContainer.classList.add('hidden');
        if(btnShowAddAlerta) btnShowAddAlerta.classList.remove('hidden');
        const alertaSelect = document.getElementById('ticket-alerta');
        if(btnDeleteAlerta && alertaSelect?.value) btnDeleteAlerta.classList.remove('hidden');
        if(inputNewAlerta) inputNewAlerta.value = '';
        if(suggestionsList) suggestionsList.innerHTML = '';
        if(btnSaveNewAlerta) btnSaveNewAlerta.disabled = false;
    };
    btnCancelAddAlerta?.addEventListener('click', resetAddAlertaForm);

    btnSaveNewAlerta?.addEventListener('click', async () => {
        const nomeNovoAlerta = capitalize(inputNewAlerta.value.trim());
        const areaSelect = document.getElementById('ticket-area');
        const areaId = areaSelect.value;

        if (!nomeNovoAlerta || !areaId) {
            showStatusModal('Erro!', 'O nome do novo alerta e a área são obrigatórios.', true);
            return;
        }
        
        btnSaveNewAlerta.disabled = true;
        btnSaveNewAlerta.textContent = 'Salvando...';

        try {
            const response = await fetch(`/api/tickets/options/areas/${areaId}/alertas`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome: nomeNovoAlerta })
            });
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Falha ao salvar o alerta.');
            }

            const { novoAlerta } = result;

            const alertaSelect = document.getElementById('ticket-alerta');
            const newOption = new Option(novoAlerta.nome, novoAlerta.id, true, true);
            alertaSelect.add(newOption);
            
            currentAlertsList.push(novoAlerta);
            
            resetAddAlertaForm();
            alertaSelect.dispatchEvent(new Event('change'));

        } catch (error) {
            showStatusModal('Erro!', error.message, true);
        } finally {
            btnSaveNewAlerta.disabled = false;
            btnSaveNewAlerta.textContent = 'Salvar';
        }
    });

    if (adminMenu) {
        const button = adminMenu.querySelector('[data-menu-button]');
        const content = adminMenu.querySelector('[data-menu-content]');
        const arrow = button.querySelector('svg');
        button?.addEventListener('click', (event) => {
            event.stopPropagation();
            content.classList.toggle('hidden');
            arrow.classList.toggle('rotate-180');
        });
    }

    if (formCriarArea) { 
        formCriarArea.addEventListener('submit', async (event) => { 
            event.preventDefault();
            const nome = formCriarArea.querySelector('input[name="area_name"]').value; 
            try {
                const response = await fetch('/api/tickets/options/areas', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nome }), 
                });
                const result = await response.json();
                if (response.ok) {
                    showStatusModal('Sucesso!', result.message, false);
                    toggleModal('modalCriarArea', false);
                    formCriarArea.reset(); 
                    popularDropdownsTicket(); 
                } else {
                    showStatusModal('Erro!', result.message, true);
                }
            } catch (error) {
                showStatusModal('Erro de Conexão', 'Não foi possível se comunicar com o servidor.', true);
            }
        });
    }
    
    if (formCriarUsuario) {
        const selectPerfil = document.getElementById('selectPerfil');
       selectPerfil?.addEventListener('change', async () => {
            const perfil = selectPerfil.value;
            const areaContainer = document.getElementById('container-selecao-area');
            const areaCheckboxContainer = document.getElementById('area-checkbox-container');

            document.getElementById('campos-user').classList.toggle('hidden', perfil !== 'user');
            document.getElementById('campos-support').classList.toggle('hidden', perfil !== 'support' && perfil !== 'admin' && perfil !== 'gerente');

            if (areaContainer) {
                areaContainer.classList.toggle('hidden', !perfil); 
                if (perfil && areaCheckboxContainer) {
                    areaCheckboxContainer.innerHTML = 'Carregando áreas...';
                    const allAreas = await getAreasList();
                    createAreaCheckboxes(areaCheckboxContainer, allAreas, []);
                }
            }

            document.getElementById('botao-salvar-container').classList.toggle('hidden', !perfil);
        });

        formCriarUsuario.addEventListener('submit', async (event) => {
            event.preventDefault();
            const formData = new FormData(formCriarUsuario);
            const data = Object.fromEntries(formData.entries());
            data.area_ids = formData.getAll('area_ids').map(Number);
            
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!data.login || !emailRegex.test(data.login)) {
                return showStatusModal('Erro de Validação', 'Por favor, insira um formato de e-mail válido.', true);
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
    const btnCancelCreateUser = document.getElementById('btn-cancel-create-user');
    if (btnCancelCreateUser) {
        btnCancelCreateUser.addEventListener('click', () => {
            const selectPerfil = document.getElementById('selectPerfil');
            formCriarUsuario.reset();
            if(selectPerfil) {
                selectPerfil.dispatchEvent(new Event('change'));
            }
            toggleModal('modalCriarUsuario', false);
        });
    }

    visibilityList?.addEventListener('change', (event) => {
        if (event.target.type === 'checkbox') {
            const key = event.target.dataset.key;
            const column = columnConfig.find(c => c.key === key);
            if (column) {
                column.visible = event.target.checked;
                saveColumnConfig();
                populateCustomizerModal();
                carregarTickets(paginaAtual);
            }
        }
    });

    let draggedItemKey = null;
    orderList?.addEventListener('dragstart', (event) => {
        if (event.target.tagName === 'LI') {
            draggedItemKey = event.target.dataset.key;
            event.target.classList.add('opacity-50');
        }
    });

    orderList?.addEventListener('dragover', (event) => { event.preventDefault(); });

    orderList?.addEventListener('drop', (event) => {
        event.preventDefault();
        const targetItem = event.target.closest('li');
        if (!targetItem || !draggedItemKey) return;
        
        const droppedOnKey = targetItem.dataset.key;
        if (draggedItemKey === droppedOnKey) return;

        const draggedIndex = columnConfig.findIndex(c => c.key === draggedItemKey);
        const droppedOnIndex = columnConfig.findIndex(c => c.key === droppedOnKey);

        const [draggedItem] = columnConfig.splice(draggedIndex, 1);
        columnConfig.splice(droppedOnIndex, 0, draggedItem);
        
        saveColumnConfig();
        populateCustomizerModal();
        carregarTickets(paginaAtual);
    });

    orderList?.addEventListener('dragend', (event) => {
        if (event.target.tagName === 'LI') {
            event.target.classList.remove('opacity-50');
        }
        draggedItemKey = null;
    });
    function parseBrDate(brDate) {
        if (!brDate || !brDate.includes('/')) return null;
        const parts = brDate.split(' ');
        const dateParts = parts[0].split('/');
        const timeParts = parts[1].split(':');
        return new Date(dateParts[2], dateParts[1] - 1, dateParts[0], timeParts[0], timeParts[1]);
    }
    
    formAbrirTicket?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(formAbrirTicket);

        const inicioAtendimentoVal = formData.get('horario_acionamento');
        const fimAlarmeVal = formData.get('alarme_fim');

        if (inicioAtendimentoVal && fimAlarmeVal) {
            const inicioDate = parseBrDate(inicioAtendimentoVal);
            const fimDate = parseBrDate(fimAlarmeVal);
            if (fimDate && inicioDate && fimDate < inicioDate) {
                return showStatusModal('Erro de Validação', 'O "Fim do Alarme" não pode ser anterior ao "Início do Atendimento".', true);
            }
        }

        formData.set('alarme_inicio', convertBrDateToIso(formData.get('alarme_inicio')));
        formData.set('horario_acionamento', convertBrDateToIso(formData.get('horario_acionamento')));
        formData.set('alarme_fim', convertBrDateToIso(formData.get('alarme_fim')));

        const fileInput = formAbrirTicket.querySelector('input[type="file"][name="anexo"]');
        if (pastedFileCreate && (!fileInput.files || fileInput.files.length === 0)) {
            formData.set('anexo', pastedFileCreate, pastedFileCreate.name);
        }

        try {
            const response = await fetch('/api/tickets', {
                method: 'POST',
                body: formData 
            });
            const result = await response.json();
            toggleModal('modalTicket', false);
            if (response.ok) {
                showStatusModal('Sucesso!', result.message, false);
                formAbrirTicket.reset();
                carregarTickets(); 
                carregarInfoCards();
            } else {
                showStatusModal('Erro!', result.message, true);
            }
        } catch (error) {
            toggleModal('modalTicket', false);
            showStatusModal('Erro de Conexão', 'Não foi possível criar o ticket.', true);
        } finally {
            pastedFileCreate = null;
            const preview = document.getElementById('paste-preview-create');
            if(preview) preview.innerHTML = '';
        }
    });
    
    
    formEditarTicket?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const ticketId = document.getElementById('edit-ticket-id').value;
        const formData = new FormData(formEditarTicket);

        const inicioAtendimentoVal = formData.get('horario_acionamento');
        const fimAlarmeVal = formData.get('alarme_fim');
        if (inicioAtendimentoVal && fimAlarmeVal) {
            const inicioDate = parseBrDate(inicioAtendimentoVal);
            const fimDate = parseBrDate(fimAlarmeVal);
            if (fimDate && inicioDate && fimDate < inicioDate) {
                return showStatusModal('Erro de Validação', 'O "Fim do Alarme" não pode ser anterior ao "Início do Atendimento".', true);
            }
        }

        const newCommentTextValue = document.getElementById('new-comment-text').value.trim();
        if (newCommentTextValue) {
            formData.append('new_comment_text', newCommentTextValue);
        }
        formData.set('alarme_inicio', convertBrDateToIso(formData.get('alarme_inicio')));
        formData.set('horario_acionamento', convertBrDateToIso(formData.get('horario_acionamento')));
        formData.set('alarme_fim', convertBrDateToIso(formData.get('alarme_fim')));

        const fileInput = formEditarTicket.querySelector('input[type="file"][name="anexo"]');
        if (pastedFileEdit && (!fileInput.files || fileInput.files.length === 0)) {
            formData.set('anexo', pastedFileEdit, pastedFileEdit.name);
            formData.set('remove_anexo', '0'); 
        }

        try {
            const response = await fetch(`/api/tickets/${ticketId}`, {
                method: 'PUT',
                body: formData
            });
            const result = await response.json();
            
            if (response.ok) {
                toggleModal('modalEditarTicket', false);
                showStatusModal('Sucesso!', result.message, false, () => {
                    carregarTickets(paginaAtual);
                    carregarInfoCards(); 
                });
            } else {
                showStatusModal('Erro!', result.message, true);
            }
        } catch (error) {
            showStatusModal('Erro de Conexão', 'Não foi possível salvar as alterações.', true);
        } finally {
            pastedFileEdit = null;
            const preview = document.getElementById('paste-preview-edit');
            if(preview) preview.innerHTML = '';
            document.getElementById('new-comment-text').value = '';
        }
    });
    
    tabelaTicketsBody?.addEventListener('click', (event) => {
        const editButton = event.target.closest('.btn-edit-ticket');
        if (editButton) {
            abrirModalEditar(editButton.dataset.id);
        }
    });
    document.getElementById('btn-delete-ticket')?.addEventListener('click', () => {
        ticketIdToDelete = document.getElementById('edit-ticket-id').value;
        toggleModal('modalConfirmarDelete', true);
    });

    document.getElementById('btn-cancel-delete')?.addEventListener('click', () => {
        ticketIdToDelete = null; 
        toggleModal('modalConfirmarDelete', false);
    });
    document.getElementById('btn-confirm-delete')?.addEventListener('click', async () => {
        if (!ticketIdToDelete) return; 

        try {
            const response = await fetch(`/api/tickets/${ticketIdToDelete}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            toggleModal('modalConfirmarDelete', false);
            toggleModal('modalEditarTicket', false);

            if (response.ok) {
                showStatusModal('Sucesso!', result.message, false);
                carregarTickets(); 
                carregarInfoCards();
            } else {
                showStatusModal('Erro!', result.message, true);
            }
        } catch (error) {
            toggleModal('modalConfirmarDelete', false);
            toggleModal('modalEditarTicket', false);
            showStatusModal('Erro de Conexão', 'Não foi possível deletar o ticket.', true);
        } finally {
            ticketIdToDelete = null; 
        }
    });

    document.getElementById('ordenarPor')?.addEventListener('change', () => carregarTickets(1));

    // Listeners para mostrar os botões de deletar
    document.getElementById('ticket-grupo')?.addEventListener('change', (event) => handleGrupoChange(event.target));
    document.getElementById('edit-ticket-grupo')?.addEventListener('change', (event) => handleGrupoChange(event.target));
    document.getElementById('ticket-alerta')?.addEventListener('change', (event) => {
        document.getElementById('btn-delete-alerta-selecionado')?.classList.toggle('hidden', !event.target.value);
    });

    loadColumnConfig();
    criarSeletorItensPorPagina(); 
    carregarDadosUsuario();
    popularDropdownsTicket();
    carregarInfoCards();
    carregarTickets();
    setupPasteFunctionality();

    document.getElementById('ticket-grupo')?.addEventListener('change', (event) => {
    document.getElementById('btn-delete-grupo-selecionado')?.classList.toggle('hidden', !event.target.value);
});

document.getElementById('ticket-alerta')?.addEventListener('change', (event) => {
    document.getElementById('btn-delete-alerta-selecionado')?.classList.toggle('hidden', !event.target.value);
});

// Adicione também para o modal de EDIÇÃO
document.getElementById('edit-ticket-grupo')?.addEventListener('change', (event) => {
    document.getElementById('btn-delete-grupo-selecionado-edit')?.classList.toggle('hidden', !event.target.value);
});
});