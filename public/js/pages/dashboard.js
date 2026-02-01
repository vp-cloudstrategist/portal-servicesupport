let currentUser = null;
let paginaAtual = 1;
let ticketIdToDelete = null;
let pastedFileCreate = null;
let pastedFileEdit = null;
let alertaIdToDelete = null;
let grupoIdToDelete = null;
let areaIdToDelete = null;
let tipoIdToDelete = null;
let prioridadeIdToDelete = null;
let statusIdToDelete = null;
let currentStatusList = [];
let ticketAbertoParaEdicao = null;
let userIdToDelete = null;
let alertaIdToEdit = null;
let engTicketIdToDelete = null;

let currentAlertsList = [];
let currentGruposList = [];
let allUsersCache = [];
let currentFilters = {};
let currentAreasList = [];
let currentTiposList = [];
let currentPrioridadesList = [];
let engineersListCache = [];

function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);

    modal.classList.toggle('hidden', !show);

}
function getFormattedDateTime(dateObj) {
    if (!dateObj || isNaN(new Date(dateObj).getTime())) {
        // Se a data for inválida ou nula, retorna strings vazias
        return { date: '', time: '' };
    }
    const validDate = new Date(dateObj);

    // Formato YYYY-MM-DD
    const date = validDate.toLocaleDateString('sv-SE');

    // Formato HH:mm
    const time = validDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

    return { date, time };
}
function combineDateAndTime(date, timeString, isOptional = false) {
    // Se a data estiver vazia, o campo é nulo
    if (!date) {
        return null;
    }

    // Se a hora estiver vazia ou com placeholder
    if (!timeString || timeString.includes('h') || timeString.length < 5) {
        // Se for um campo opcional (como Fim do Alarme), retorna nulo
        if (isOptional) {
            return null;
        }
        // Se for um campo obrigatório, assume '00:00'
        timeString = '00:00';
    }

    return `${date} ${timeString}:00`;
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

    const { date: dataAtual, time: horaAtual } = getFormattedDateTime(new Date());

    // Define os valores padrão nos campos de data
    document.querySelector('#formAbrirTicket input[name="alarme_inicio_date"]').value = dataAtual;
    document.querySelector('#formAbrirTicket input[name="horario_acionamento_date"]').value = dataAtual;
    document.querySelector('#formAbrirTicket input[name="alarme_fim_date"]').value = '';

    // Define o valor nos campos de hora (a máscara já existe)
    const alarmeInicioTimeInput = document.querySelector('#formAbrirTicket input[name="alarme_inicio_time"]');
    if (alarmeInicioTimeInput.imask) alarmeInicioTimeInput.imask.value = horaAtual;

    const horarioAcionamentoTimeInput = document.querySelector('#formAbrirTicket input[name="horario_acionamento_time"]');
    if (horarioAcionamentoTimeInput.imask) horarioAcionamentoTimeInput.imask.value = horaAtual;

    const alarmeFimTimeInput = document.querySelector('#formAbrirTicket input[name="alarme_fim_time"]');
    if (alarmeFimTimeInput.imask) alarmeFimTimeInput.imask.value = '';

    // Define o status padrão
    const statusSelect = document.getElementById('ticket-status');
    if (statusSelect && currentStatusList.length > 0) {
        const defaultStatus = currentStatusList.find(status => status.nome === 'Em Atendimento');
        if (defaultStatus) {
            statusSelect.value = defaultStatus.id;
        }
    }

    toggleModal('modalTicket', true);
}

document.addEventListener('DOMContentLoaded', () => {

    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebar-toggle');
    const sidebarToggleIcon = document.getElementById('sidebar-toggle-icon');

    sidebarToggle?.addEventListener('click', () => {
        sidebar.classList.toggle('sidebar-collapsed');
        sidebar.classList.toggle('w-64');
        sidebar.classList.toggle('w-20');


        sidebarToggleIcon.classList.toggle('fa-chevron-left');
        sidebarToggleIcon.classList.toggle('fa-chevron-right');
    });
    const timeMaskOptions = {
        mask: 'HH:mm',
        blocks: {
            HH: { mask: IMask.MaskedRange, from: 0, to: 23, maxLength: 2 },
            mm: { mask: IMask.MaskedRange, from: 0, to: 59, maxLength: 2 }
        },
        lazy: false
    };
    const timeInputs = [
        '#formAbrirTicket input[name="alarme_inicio_time"]',
        '#formAbrirTicket input[name="horario_acionamento_time"]',
        '#formAbrirTicket input[name="alarme_fim_time"]',
        '#edit-alarme-inicio-time',
        '#edit-horario-acionamento-time',
        '#edit-alarme-fim-time'
    ];

    timeInputs.forEach(selector => {
        const el = document.querySelector(selector) || document.getElementById(selector);
        if (el) {
            IMask(el, timeMaskOptions);
        }
    });

    let columnConfig = [
        { key: 'id', title: 'Ticket#', visible: true },
        { key: 'area_nome', title: 'Área', visible: true },
        { key: 'data_criacao', title: 'Criação', visible: false },
        { key: 'user_nome', title: 'Usuário', visible: true },
        { key: 'prioridade_nome', title: 'Prioridade', visible: true },
        { key: 'status', title: 'Status', visible: true },
        { key: 'descricao', title: 'Descrição', visible: false },
        { key: 'ultimo_comentario', title: 'Último Comentário', visible: false },
        { key: 'alerta_nome', title: 'Alerta', visible: false },
        { key: 'grupo_nome', title: 'Grupo Resp.', visible: false },
        { key: 'alarme_inicio', title: 'Início Alarme', visible: false },
        { key: 'alarme_fim', title: 'Fim Alarme', visible: false },
        { key: 'horario_acionamento', title: 'Atendimento', visible: true }
    ];

    async function popularFiltroCheckboxes(containerId, url, name, keyField = 'id', valueField = 'nome') {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = 'Carregando...';
        try {
            const response = await fetch(url, { cache: 'no-cache' });

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
            <label class="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" id="filter-${name}-${item[keyField]}" name="${name}" value="${item[keyField]}" class="form-checkbox h-4 w-4">
                <span>${item[valueField]}</span>
            </label>
        `).join('');
    }

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
    const btnShowAddStatus = document.getElementById('btn-show-add-status');
    const btnDeleteStatus = document.getElementById('btn-delete-status-selecionado');
    const addStatusContainer = document.getElementById('add-status-container');
    const inputNewStatus = document.getElementById('input-new-status');
    const btnCancelAddStatus = document.getElementById('btn-cancel-add-status');
    const btnSaveNewStatus = document.getElementById('btn-save-new-status');


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

    const btnShowAddArea = document.getElementById('btn-show-add-area');
    const btnDeleteArea = document.getElementById('btn-delete-area-selecionada');
    const addAreaContainer = document.getElementById('add-area-container');
    const inputNewArea = document.getElementById('input-new-area');
    const btnCancelAddArea = document.getElementById('btn-cancel-add-area');
    const btnSaveNewArea = document.getElementById('btn-save-new-area');
    const areaSuggestionsList = document.getElementById('area-suggestions-list');

    const btnShowAddTipo = document.getElementById('btn-show-add-tipo');
    const btnDeleteTipo = document.getElementById('btn-delete-tipo-selecionado');
    const addTipoContainer = document.getElementById('add-tipo-container');
    const inputNewTipo = document.getElementById('input-new-tipo');
    const btnCancelAddTipo = document.getElementById('btn-cancel-add-tipo');
    const btnSaveNewTipo = document.getElementById('btn-save-new-tipo');
    const tipoSuggestionsList = document.getElementById('tipo-suggestions-list');

    const btnShowAddPrioridade = document.getElementById('btn-show-add-prioridade');
    const btnDeletePrioridade = document.getElementById('btn-delete-prioridade-selecionada');
    const addPrioridadeContainer = document.getElementById('add-prioridade-container');
    const inputNewPrioridade = document.getElementById('input-new-prioridade');
    const btnCancelAddPrioridade = document.getElementById('btn-cancel-add-prioridade');
    const btnSaveNewPrioridade = document.getElementById('btn-save-new-prioridade');
    const prioridadeSuggestionsList = document.getElementById('prioridade-suggestions-list');

    function handleDeleteOption(itemType, selectId, idVariableSetter, modalId) {
        const selectElement = document.getElementById(selectId);
        const areaSelectElement = document.getElementById('ticket-area');
        const selectedId = selectElement ? selectElement.value : null;

        if (!selectedId) {
            showStatusModal('Atenção!', `Por favor, selecione um(a) ${itemType} da lista para excluir.`, true);
            return;
        }


        idVariableSetter({ id: selectedId, areaSelect: areaSelectElement });
        toggleModal(modalId, true);
    }

    async function preencherFormularioNovoTicket(dadosParaPreencher = {}) {
        const form = document.getElementById('formAbrirTicket');
        if (form) form.reset();

        const now = new Date();
        // Se for duplicação, usa a data do ticket. Se for novo, usa a data de agora.
        const alarmeInicio = getFormattedDateTime(dadosParaPreencher.alarme_inicio ? new Date(dadosParaPreencher.alarme_inicio) : now);
        const horarioAcionamento = getFormattedDateTime(dadosParaPreencher.horario_acionamento ? new Date(dadosParaPreencher.horario_acionamento) : now);

        const defaultStatus = currentStatusList.find(s => s.nome === 'Em Atendimento');
        const statusIdValue = dadosParaPreencher.status_id ? dadosParaPreencher.status_id : (defaultStatus ? defaultStatus.id : '');

        // Preenche as datas
        document.querySelector('#formAbrirTicket input[name="alarme_inicio_date"]').value = alarmeInicio.date;
        document.querySelector('#formAbrirTicket input[name="horario_acionamento_date"]').value = horarioAcionamento.date;
        document.querySelector('#formAbrirTicket input[name="alarme_fim_date"]').value = '';

        // Preenche as horas e aplica a máscara
        const alarmeInicioTimeInput = document.querySelector('#formAbrirTicket input[name="alarme_inicio_time"]');
        alarmeInicioTimeInput.value = alarmeInicio.time;
        IMask(alarmeInicioTimeInput, timeMaskOptions);

        const horarioAcionamentoTimeInput = document.querySelector('#formAbrirTicket input[name="horario_acionamento_time"]');
        horarioAcionamentoTimeInput.value = horarioAcionamento.time;
        IMask(horarioAcionamentoTimeInput, timeMaskOptions);

        IMask(document.querySelector('#formAbrirTicket input[name="alarme_fim_time"]'), timeMaskOptions);

        // Preenche os outros campos
        document.getElementById('ticket-status').value = statusIdValue;
        document.getElementById('ticket-descricao').value = dadosParaPreencher.descricao || '';
        const areaSelect = document.getElementById('ticket-area');
        areaSelect.value = dadosParaPreencher.area_id || '';

        await handleAreaChange(areaSelect, 'ticket-tipo', 'ticket-prioridade', 'ticket-grupo', 'ticket-alerta');

        if (dadosParaPreencher.area_id) {
            await new Promise(resolve => setTimeout(resolve, 50));
            document.getElementById('ticket-grupo').value = dadosParaPreencher.grupo_id || '';
            document.getElementById('ticket-tipo').value = dadosParaPreencher.tipo_solicitacao_id || '';
            document.getElementById('ticket-prioridade').value = dadosParaPreencher.prioridade_id || '';
            document.getElementById('ticket-alerta').value = dadosParaPreencher.alerta_id || '';
        }

        toggleModal('modalTicket', true);
    }
    async function handleConfirmDeleteOption(itemType, idHolder, endpoint, modalId, idResetter) {
        if (!idHolder || !idHolder.id) return;

        try {
            const response = await fetch(`${endpoint}/${idHolder.id}`, {
                method: 'DELETE'
            });
            const result = await response.json();
            toggleModal(modalId, false);

            if (response.ok) {
                showStatusModal('Sucesso!', result.message, false, async () => {
                    if (itemType === 'area') {
                        await popularDropdownsTicket();
                    } else if (itemType === 'status') {
                        const statusResponse = await fetch('/api/tickets/options/status');
                        const statusItems = await statusResponse.json();
                        currentStatusList = statusItems;
                        const defaultStatus = statusItems.find(s => s.nome === 'Em Atendimento');
                        const defaultStatusId = defaultStatus ? defaultStatus.id : null;
                        popularDropdown('ticket-status', statusItems, 'Selecione o Status', defaultStatusId);
                        popularDropdown('edit-ticket-status', statusItems, 'Selecione o Status');
                        await carregarInfoCards();

                    } else {
                        if (idHolder.areaSelect) {
                            idHolder.areaSelect.dispatchEvent(new Event('change'));
                        }
                    }
                });
            } else {
                showStatusModal('Erro!', result.message, true);
            }
        } catch (error) {
            toggleModal(modalId, false);
            showStatusModal('Erro de Conexão', `Não foi possível deletar o(a) ${itemType}.`, true);
        } finally {
            idResetter();
        }
    }
    const btnDeleteAlerta = document.getElementById('btn-delete-alerta-selecionado');

    btnDeleteArea?.addEventListener('click', () => {
        handleDeleteOption('área', 'ticket-area', (val) => areaIdToDelete = val, 'modalConfirmarDeleteArea');
    });

    btnDeleteGrupo?.addEventListener('click', () => {
        handleDeleteOption('grupo', 'ticket-grupo', (val) => grupoIdToDelete = val, 'modalConfirmarDeleteGrupo');
    });

    btnDeleteTipo?.addEventListener('click', () => {
        handleDeleteOption('tipo', 'ticket-tipo', (val) => tipoIdToDelete = val, 'modalConfirmarDeleteTipo');
    });

    btnDeletePrioridade?.addEventListener('click', () => {
        handleDeleteOption('prioridade', 'ticket-prioridade', (val) => prioridadeIdToDelete = val, 'modalConfirmarDeletePrioridade');
    });

    btnDeleteAlerta?.addEventListener('click', () => {
        handleDeleteOption('alerta', 'ticket-alerta', (val) => alertaIdToDelete = val, 'modalConfirmarDeleteAlerta');
    });


    document.getElementById('btn-confirm-delete-area')?.addEventListener('click', () => {
        handleConfirmDeleteOption('area', areaIdToDelete, '/api/tickets/options/areas', 'modalConfirmarDeleteArea', () => areaIdToDelete = null);
    });

    document.getElementById('btn-confirm-delete-grupo')?.addEventListener('click', () => {
        handleConfirmDeleteOption('grupo', grupoIdToDelete, '/api/tickets/options/grupos', 'modalConfirmarDeleteGrupo', () => grupoIdToDelete = null);
    });

    document.getElementById('btn-confirm-delete-tipo')?.addEventListener('click', () => {
        handleConfirmDeleteOption('tipo', tipoIdToDelete, '/api/tickets/options/tipos', 'modalConfirmarDeleteTipo', () => tipoIdToDelete = null);
    });

    document.getElementById('btn-confirm-delete-prioridade')?.addEventListener('click', () => {
        handleConfirmDeleteOption('prioridade', prioridadeIdToDelete, '/api/tickets/options/prioridades', 'modalConfirmarDeletePrioridade', () => prioridadeIdToDelete = null);
    });

    document.getElementById('btn-confirm-delete-alerta')?.addEventListener('click', () => {
        handleConfirmDeleteOption('alerta', alertaIdToDelete, '/api/tickets/options/alertas', 'modalConfirmarDeleteAlerta', () => alertaIdToDelete = null);
    });

    document.getElementById('btn-confirm-delete-status')?.addEventListener('click', () => {
        handleConfirmDeleteOption('status', statusIdToDelete, '/api/tickets/options/status', 'modalConfirmarDeleteStatus', () => statusIdToDelete = null);
    });

    document.getElementById('btn-cancel-delete-area')?.addEventListener('click', () => {
        areaIdToDelete = null;
        toggleModal('modalConfirmarDeleteArea', false);
    });

    document.getElementById('btn-cancel-delete-grupo')?.addEventListener('click', () => {
        grupoIdToDelete = null;
        toggleModal('modalConfirmarDeleteGrupo', false);
    });

    document.getElementById('btn-cancel-delete-tipo')?.addEventListener('click', () => {
        tipoIdToDelete = null;
        toggleModal('modalConfirmarDeleteTipo', false);
    });

    document.getElementById('btn-cancel-delete-prioridade')?.addEventListener('click', () => {
        prioridadeIdToDelete = null;
        toggleModal('modalConfirmarDeletePrioridade', false);
    });
    document.getElementById('btn-cancel-delete-status')?.addEventListener('click', () => {
        statusIdToDelete = null;
        toggleModal('modalConfirmarDeleteStatus', false);
    });
    document.getElementById('btn-cancel-delete-alerta')?.addEventListener('click', () => {
        alertaIdToDelete = null;
        toggleModal('modalConfirmarDeleteAlerta', false);
    });

    document.getElementById('btn-deletar-usuario')?.addEventListener('click', () => {
        const userId = document.querySelector('#formEditarUsuarioAdmin input[name="id"]')?.value;
        if (userId) {
            userIdToDelete = userId;
            toggleModal('modalConfirmarDeleteUsuario', true);
        } else {
            showStatusModal('Erro!', 'Não foi possível identificar o usuário a ser deletado.', true);
        }
    });

    document.getElementById('btn-cancel-delete-user')?.addEventListener('click', () => {
        userIdToDelete = null;
        toggleModal('modalConfirmarDeleteUsuario', false);
    });

    document.getElementById('btn-confirm-delete-user')?.addEventListener('click', async () => {
        if (!userIdToDelete) return;

        try {
            const response = await fetch(`/api/users/${userIdToDelete}`, {
                method: 'DELETE'
            });
            const result = await response.json();

            toggleModal('modalConfirmarDeleteUsuario', false);

            if (response.ok) {
                showStatusModal('Sucesso!', result.message, false, () => {
                    // Fecha os modais e atualiza a lista de usuários
                    toggleModal('modalEditarUsuarioAdmin', false);
                    btnAbrirModalListaUsuarios.click();
                });
            } else {
                showStatusModal('Erro!', result.message, true);
            }
        } catch (error) {
            toggleModal('modalConfirmarDeleteUsuario', false);
            showStatusModal('Erro de Conexão', 'Não foi possível deletar o usuário.', true);
        } finally {
            userIdToDelete = null;
        }
    });
    const btnEditAlerta = document.getElementById('btn-edit-alerta-selecionado');
    const formEditarAlerta = document.getElementById('formEditarAlerta');
    const inputEditAlerta = document.getElementById('input-edit-alerta');
    const labelEditAlerta = document.getElementById('edit-alerta-label');

    // Listener para o botão "Editar alerta"
    btnEditAlerta?.addEventListener('click', () => {
        const alertaSelect = document.getElementById('ticket-alerta');
        const selectedId = alertaSelect.value;

        if (!selectedId) {
            showStatusModal('Atenção!', 'Por favor, selecione um alerta da lista para editar.', true);
            return;
        }

        const selectedText = alertaSelect.options[alertaSelect.selectedIndex].text;

        alertaIdToEdit = selectedId;
        inputEditAlerta.value = selectedText;
        labelEditAlerta.textContent = `Editando Alerta: "${selectedText}"`;
        toggleModal('modalEditarAlerta', true);
    });

    // Listener para o formulário do modal de edição
    formEditarAlerta?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!alertaIdToEdit) return;

        const novoNome = capitalize(inputEditAlerta.value.trim());
        if (!novoNome) {
            return showStatusModal('Erro!', 'O nome do alerta não pode ficar vazio.', true);
        }

        try {
            const response = await fetch(`/api/tickets/options/alertas/${alertaIdToEdit}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome: novoNome })
            });
            const result = await response.json();

            if (!response.ok) throw new Error(result.message);

            toggleModal('modalEditarAlerta', false);


            const areaSelect = document.getElementById('ticket-area');
            const areaSelectEdit = document.getElementById('edit-ticket-area');

            await Promise.all([
                handleAreaChange(areaSelect, 'ticket-tipo', 'ticket-prioridade', 'ticket-grupo', 'ticket-alerta'),
                handleAreaChange(areaSelectEdit, 'edit-ticket-tipo', 'edit-ticket-prioridade', 'edit-ticket-grupo', 'edit-ticket-alerta')
            ]);

            showStatusModal('Sucesso!', result.message, false, () => {
                document.getElementById('ticket-alerta').value = alertaIdToEdit;
            });

        } catch (error) {
            showStatusModal('Erro!', error.message, true);
        } finally {
            alertaIdToEdit = null;
        }
    });

    const resetAddStatusForm = () => {
        if (addStatusContainer) addStatusContainer.classList.add('hidden');
        if (btnShowAddStatus) btnShowAddStatus.classList.remove('hidden');
        const statusSelect = document.getElementById('ticket-status');
        // Mostra o botão de deletar se um status estiver selecionado
        if (btnDeleteStatus && statusSelect?.value) {
            btnDeleteStatus.classList.remove('hidden');
        }
        if (inputNewStatus) inputNewStatus.value = '';
        if (btnSaveNewStatus) btnSaveNewStatus.disabled = false;
    };

    btnShowAddStatus?.addEventListener('click', () => {
        addStatusContainer.classList.remove('hidden');
        btnShowAddStatus.classList.add('hidden');
        if (btnDeleteStatus) btnDeleteStatus.classList.add('hidden');
        inputNewStatus.focus();
        setupAutocomplete('input-new-status', 'status-suggestions-list', currentStatusList);
    });

    btnCancelAddStatus?.addEventListener('click', resetAddStatusForm);

    btnSaveNewStatus?.addEventListener('click', async () => {
        const nomeNovoStatus = capitalize(inputNewStatus.value.trim());
        if (!nomeNovoStatus) {
            return showStatusModal('Erro!', 'O nome do novo status é obrigatório.', true);
        }

        btnSaveNewStatus.disabled = true;
        btnSaveNewStatus.textContent = 'Salvando...';
        try {
            const response = await fetch('/api/tickets/options/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome: nomeNovoStatus })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);

            const { novoItem } = result;
            const statusSelect = document.getElementById('ticket-status');
            const newOption = new Option(novoItem.nome, novoItem.id, true, true);
            statusSelect.add(newOption);
            currentStatusList.push(novoItem);

            resetAddStatusForm();
            statusSelect.dispatchEvent(new Event('change'));
            await carregarInfoCards();


        } catch (error) {
            showStatusModal('Erro!', error.message, true);
        } finally {
            btnSaveNewStatus.disabled = false;
            btnSaveNewStatus.textContent = 'Salvar';
        }
    });

    const resetAddPrioridadeForm = () => {
        if (addPrioridadeContainer) addPrioridadeContainer.classList.add('hidden');
        if (btnShowAddPrioridade) btnShowAddPrioridade.classList.remove('hidden');
        const prioridadeSelect = document.getElementById('ticket-prioridade');
        if (btnDeletePrioridade && prioridadeSelect?.value) {
            btnDeletePrioridade.classList.remove('hidden');
        }
        if (inputNewPrioridade) inputNewPrioridade.value = '';
        if (prioridadeSuggestionsList) prioridadeSuggestionsList.innerHTML = '';
        if (btnSaveNewPrioridade) btnSaveNewPrioridade.disabled = false;
    };

    btnShowAddPrioridade?.addEventListener('click', () => {
        const areaSelect = document.getElementById('ticket-area');
        if (!areaSelect || !areaSelect.value) return showStatusModal('Atenção!', 'Por favor, selecione uma Área primeiro.', true);

        addPrioridadeContainer.classList.remove('hidden');
        btnShowAddPrioridade.classList.add('hidden');
        if (btnDeletePrioridade) btnDeletePrioridade.classList.add('hidden');
        inputNewPrioridade.focus();
        setupAutocomplete('input-new-prioridade', 'prioridade-suggestions-list', currentPrioridadesList);
    });

    btnCancelAddPrioridade?.addEventListener('click', resetAddPrioridadeForm);

    btnSaveNewPrioridade?.addEventListener('click', async () => {
        const nomeNovaPrioridade = capitalize(inputNewPrioridade.value.trim());
        const areaId = document.getElementById('ticket-area').value;
        if (!nomeNovaPrioridade || !areaId) return showStatusModal('Erro!', 'O nome da nova prioridade e a área são obrigatórios.', true);

        btnSaveNewPrioridade.disabled = true;
        btnSaveNewPrioridade.textContent = 'Salvando...';
        try {
            const response = await fetch(`/api/tickets/options/areas/${areaId}/prioridades`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome: nomeNovaPrioridade })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            const { novoItem } = result;
            const prioridadeSelect = document.getElementById('ticket-prioridade');
            const newOption = new Option(novoItem.nome, novoItem.id, true, true);
            prioridadeSelect.add(newOption);
            currentPrioridadesList.push(novoItem);

            resetAddPrioridadeForm();
            prioridadeSelect.dispatchEvent(new Event('change'));
        } catch (error) {
            showStatusModal('Erro!', error.message, true);
        } finally {
            btnSaveNewPrioridade.disabled = false;
            btnSaveNewPrioridade.textContent = 'Salvar';
        }
    });

    const resetAddTipoForm = () => {
        if (addTipoContainer) addTipoContainer.classList.add('hidden');
        if (btnShowAddTipo) btnShowAddTipo.classList.remove('hidden');
        const tipoSelect = document.getElementById('ticket-tipo');
        if (btnDeleteTipo && tipoSelect?.value) {
            btnDeleteTipo.classList.remove('hidden');
        }
        if (inputNewTipo) inputNewTipo.value = '';
        if (tipoSuggestionsList) tipoSuggestionsList.innerHTML = '';
        if (btnSaveNewTipo) btnSaveNewTipo.disabled = false;
    };

    btnShowAddTipo?.addEventListener('click', () => {
        const areaSelect = document.getElementById('ticket-area');
        if (!areaSelect || !areaSelect.value) return showStatusModal('Atenção!', 'Por favor, selecione uma Área primeiro.', true);

        addTipoContainer.classList.remove('hidden');
        btnShowAddTipo.classList.add('hidden');
        if (btnDeleteTipo) btnDeleteTipo.classList.add('hidden');
        inputNewTipo.focus();
        setupAutocomplete('input-new-tipo', 'tipo-suggestions-list', currentTiposList);
    });

    btnCancelAddTipo?.addEventListener('click', resetAddTipoForm);

    btnSaveNewTipo?.addEventListener('click', async () => {
        const nomeNovoTipo = capitalize(inputNewTipo.value.trim());
        const areaId = document.getElementById('ticket-area').value;
        if (!nomeNovoTipo || !areaId) return showStatusModal('Erro!', 'O nome do novo tipo e a área são obrigatórios.', true);

        btnSaveNewTipo.disabled = true;
        btnSaveNewTipo.textContent = 'Salvando...';
        try {
            const response = await fetch(`/api/tickets/options/areas/${areaId}/tipos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome: nomeNovoTipo })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            const { novoItem } = result;
            const tipoSelect = document.getElementById('ticket-tipo');
            const newOption = new Option(novoItem.nome, novoItem.id, true, true);
            tipoSelect.add(newOption);
            currentTiposList.push(novoItem);
            resetAddTipoForm();
            tipoSelect.dispatchEvent(new Event('change'));
        } catch (error) {
            showStatusModal('Erro!', error.message, true);
        } finally {
            btnSaveNewTipo.disabled = false;
            btnSaveNewTipo.textContent = 'Salvar';
        }
    });
    document.getElementById('btn-duplicar-ticket')?.addEventListener('click', async () => {
        if (!ticketAbertoParaEdicao) {
            showStatusModal('Erro!', 'Não foi possível encontrar os dados do ticket para duplicar.', true);
            return;
        }


        toggleModal('modalEditarTicket', false);


        abrirModalNovoTicket();


        await new Promise(resolve => setTimeout(resolve, 100));

        const { date: alarmeInicioDate, time: alarmeInicioTime } = getFormattedDateTime(ticketAbertoParaEdicao.alarme_inicio);
        const { date: acionamentoDate, time: acionamentoTime } = getFormattedDateTime(ticketAbertoParaEdicao.horario_acionamento);


        document.querySelector('#formAbrirTicket input[name="alarme_inicio_date"]').value = alarmeInicioDate;


        const alarmeInicioTimeInput = document.querySelector('#formAbrirTicket input[name="alarme_inicio_time"]');
        if (alarmeInicioTimeInput && alarmeInicioTimeInput.imask) {
            alarmeInicioTimeInput.imask.value = alarmeInicioTime;
        } else if (alarmeInicioTimeInput) {
            alarmeInicioTimeInput.value = alarmeInicioTime;
        }

        document.querySelector('#formAbrirTicket input[name="horario_acionamento_date"]').value = acionamentoDate;

        const horarioAcionamentoTimeInput = document.querySelector('#formAbrirTicket input[name="horario_acionamento_time"]');
        if (horarioAcionamentoTimeInput && horarioAcionamentoTimeInput.imask) {
            horarioAcionamentoTimeInput.imask.value = acionamentoTime;
        } else if (horarioAcionamentoTimeInput) {
            horarioAcionamentoTimeInput.value = acionamentoTime;
        }

        const statusSelect = document.getElementById('ticket-status');
        if (statusSelect) {
            statusSelect.value = ticketAbertoParaEdicao.status_id;
        }
        document.getElementById('ticket-descricao').value = ticketAbertoParaEdicao.descricao;

        const areaSelect = document.getElementById('ticket-area');
        areaSelect.value = ticketAbertoParaEdicao.area_id;
        await handleAreaChange(areaSelect, 'ticket-tipo', 'ticket-prioridade', 'ticket-grupo', 'ticket-alerta');

        document.getElementById('ticket-grupo').value = ticketAbertoParaEdicao.grupo_id;
        document.getElementById('ticket-tipo').value = ticketAbertoParaEdicao.tipo_solicitacao_id;
        document.getElementById('ticket-prioridade').value = ticketAbertoParaEdicao.prioridade_id;
        document.getElementById('ticket-alerta').value = ticketAbertoParaEdicao.alerta_id;
    });


    const resetAddAreaForm = () => {
        if (addAreaContainer) addAreaContainer.classList.add('hidden');
        if (btnShowAddArea) btnShowAddArea.classList.remove('hidden');
        const areaSelect = document.getElementById('ticket-area');
        if (btnDeleteArea && areaSelect?.value) {
            btnDeleteArea.classList.remove('hidden');
        }
        if (inputNewArea) inputNewArea.value = '';
        if (areaSuggestionsList) areaSuggestionsList.innerHTML = '';
        if (btnSaveNewArea) btnSaveNewArea.disabled = false;
    };

    btnShowAddArea?.addEventListener('click', () => {
        addAreaContainer.classList.remove('hidden');
        btnShowAddArea.classList.add('hidden');
        if (btnDeleteArea) btnDeleteArea.classList.add('hidden');
        inputNewArea.focus();
        setupAutocomplete('input-new-area', 'area-suggestions-list', currentAreasList);
    });

    btnCancelAddArea?.addEventListener('click', resetAddAreaForm);

    btnSaveNewArea?.addEventListener('click', async () => {
        const nomeNovaArea = capitalize(inputNewArea.value.trim());
        if (!nomeNovaArea) return showStatusModal('Erro!', 'O nome da nova área é obrigatório.', true);

        btnSaveNewArea.disabled = true;
        btnSaveNewArea.textContent = 'Salvando...';
        try {
            const response = await fetch('/api/tickets/options/areas', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nome: nomeNovaArea })
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message);
            await popularDropdownsTicket();

            const areaSelect = document.getElementById('ticket-area');
            if (areaSelect) {
                areaSelect.value = result.novaArea.id;
                areaSelect.dispatchEvent(new Event('change'));
            }

            resetAddAreaForm();
        } catch (error) {
            showStatusModal('Erro!', error.message, true);
        } finally {
            btnSaveNewArea.disabled = false;
            btnSaveNewArea.textContent = 'Salvar';
        }
    });

    btnShowAddGrupo?.addEventListener('click', () => {
        const areaSelect = document.getElementById('ticket-area');
        if (!areaSelect || !areaSelect.value) {
            return showStatusModal('Atenção!', 'Por favor, selecione uma Área primeiro.', true);
        }
        addGrupoContainer.classList.remove('hidden');
        btnShowAddGrupo.classList.add('hidden');
        if (btnDeleteGrupo) btnDeleteGrupo.classList.add('hidden');
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


    ['edit-alarme-inicio', 'edit-horario-acionamento', 'edit-alarme-fim'].forEach(id => {
        const editInput = document.getElementById(id);
        if (editInput) IMask(editInput, maskOptions);
    });
    function convertBrDateToIso(brDate) {
        if (!brDate || brDate.includes('d') || brDate.includes('m') || brDate.includes('a')) return null;

        const parts = brDate.split(' ');
        if (parts.length < 2) return null;

        const dateParts = parts[0].split('/');
        const timeParts = parts[1].split(':');
        if (dateParts.length < 3 || timeParts.length < 2) return null;

        const year = dateParts[2];
        const month = dateParts[1];
        const day = dateParts[0];
        const hours = timeParts[0];
        const minutes = timeParts[1];

        // Monta a string no formato YYYY-MM-DD HH:MM:SS sem conversão de fuso horário
        return `${year}-${month}-${day} ${hours}:${minutes}:00`;
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
    });

    // ALTERAÇÃO: Melhoria na função renderCheckboxes para corrigir layout
    function renderCheckboxes(containerId, items, name, keyField = 'id', valueField = 'nome') {
        const container = document.getElementById(containerId);
        if (!container || !items) {
            container.innerHTML = 'Nenhuma opção disponível.';
            return;
        }
        container.innerHTML = items.map(item => `
            <label class="flex items-center space-x-2 cursor-pointer">
                <input type="checkbox" id="filter-${name}-${item[keyField]}" name="${name}" value="${item[keyField]}" class="form-checkbox h-4 w-4">
                <span>${item[valueField]}</span>
            </label>
        `).join('');
    }


    formFiltros?.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(formFiltros);
        currentFilters = {};

        currentFilters.areas = formData.getAll('areas').join(',');
        currentFilters.status = formData.getAll('status').join(',');
        currentFilters.prioridades_nomes = formData.getAll('prioridades_nomes').join(',');
        currentFilters.usuarios = formData.getAll('usuarios').join(',');

        const dateRange = formData.get('date_range');
        if (dateRange === '7days') {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 7);
            currentFilters.startDate = startDate.toISOString().split('T')[0];
            currentFilters.endDate = endDate.toISOString().split('T')[0];
        } else if (dateRange === 'custom') {
            currentFilters.startDate = formData.get('startDate');
            currentFilters.endDate = formData.get('endDate');
        }

        Object.keys(currentFilters).forEach(key => {
            if (!currentFilters[key]) delete currentFilters[key];
        });

        carregarTickets(1);
        carregarInfoCards();

        toggleModal('modalFiltros', false);
    });

    btnLimparFiltros?.addEventListener('click', () => {
        formFiltros.reset();
        customDateInputs.classList.add('hidden');
        currentFilters = {};


        carregarTickets(1);
        carregarInfoCards();

        toggleModal('modalFiltros', false);
    });


    function createAreaCheckboxes(container, areaList, selectedAreaIds = []) {
        container.innerHTML = '';

        const allCheckboxDiv = document.createElement('div');
        allCheckboxDiv.className = 'flex items-center mb-2';
        const allChecked = selectedAreaIds.length > 0 && selectedAreaIds.length === areaList.length;
        allCheckboxDiv.innerHTML = `
            <label class="flex items-center space-x-2 font-bold cursor-pointer">
                <input type="checkbox" id="${container.id}-check-all" class="form-checkbox h-4 w-4" ${allChecked ? 'checked' : ''}>
                <span>Todos</span>
            </label>
        `;
        container.appendChild(allCheckboxDiv);

        const allCheckbox = allCheckboxDiv.querySelector('input');

        areaList.forEach(area => {
            const isChecked = selectedAreaIds.includes(area.id);
            const div = document.createElement('div');
            div.className = 'flex items-center';
            div.innerHTML = `
                <label class="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" id="area-${area.id}-${container.id}" name="area_ids" value="${area.id}" class="form-checkbox h-4 w-4 area-checkbox" ${isChecked ? 'checked' : ''}>
                    <span>${area.nome}</span>
                </label>
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

    // ALTERAÇÃO: Melhoria na função renderComments para corrigir layout
    function renderComments(comments) {
        const container = document.getElementById('comments-list-container');
        if (!container) return;

        if (!comments || comments.length === 0) {
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
                    <div class="flex justify-between items-baseline">
                        <p class="font-semibold text-sm">${comment.user_nome} ${comment.user_sobrenome || ''}</p>
                        <p class="text-xs text-gray-500">${new Date(comment.created_at).toLocaleString('pt-BR')}</p>
                    </div>
                    <p class="text-sm mt-1">${comment.comment_text.replace(/\n/g, '<br>')}</p>
                </div>
            </div>
        `).join('');
    }

    // ALTERAÇÃO: Melhoria na função appendComment para corrigir layout
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
                    <div class="flex justify-between items-baseline">
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
            const rulesContainer = document.getElementById('password-rules-admin');
        if(rulesContainer) rulesContainer.innerHTML = '';
        } catch (error) {
            console.error(error);
            showStatusModal('Erro', 'Não foi possível carregar os dados deste usuário.', true, () => toggleModal('modalEditarUsuarioAdmin', false));
        }
    });

    // CORREÇÃO: Lógica de automação de status corrigida
    const fimAlarmeInputEdit = document.getElementById('edit-alarme-fim');
    const statusSelectEdit = document.getElementById('edit-ticket-status');

    if (fimAlarmeInputEdit && statusSelectEdit) {
        fimAlarmeInputEdit.addEventListener('input', () => {
            // Verifica se o campo está totalmente preenchido
            if (fimAlarmeInputEdit.value && !fimAlarmeInputEdit.value.includes('d') && !fimAlarmeInputEdit.value.includes('m') && !fimAlarmeInputEdit.value.includes('a')) {
                const resolvidoStatus = currentStatusList.find(s => s.nome === 'Resolvido');
                if (resolvidoStatus) {
                    statusSelectEdit.value = resolvidoStatus.id;
                }
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
        
        if (data.novaSenha && data.novaSenha.trim() !== "") {
            if (data.novaSenha !== data.confirmarSenha) {
                return showStatusModal('Erro de Validação', 'As senhas não coincidem.', true);
            }
            if (data.novaSenha.length < 6) {
                return showStatusModal('Erro de Validação', 'A senha deve ter no mínimo 6 caracteres.', true);
            }
        } else {
            delete data.novaSenha;
            delete data.confirmarSenha;
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
                const btnLista = document.getElementById('btn-abrir-modal-lista-usuarios');
                if(btnLista) btnLista.click(); 
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
                areaContainer.innerHTML = `<label class="block text-sm font-semibold text-gray-700 mb-2">Áreas</label><div class="p-2 border rounded-md max-h-32 overflow-y-auto bg-gray-50"></div>`;
                const allAreas = await getAreasList();
                createAreaCheckboxes(areaContainer.querySelector('.p-2'), allAreas, user.area_ids);
            } else {
                areaContainer.innerHTML = `<label class="block text-sm font-semibold text-gray-700">Áreas</label><input type="text" value="${user.areas_nome || 'Nenhuma'}" readonly class="w-full mt-1 border rounded p-2 bg-gray-200 cursor-not-allowed">`;
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


    if (statusSelectEdit) {
        statusSelectEdit.addEventListener('change', (event) => {
            const selectedStatusId = event.target.value;
            const fimAlarmeInput = document.getElementById('edit-alarme-fim');

            const selectedStatus = currentStatusList.find(s => s.id == selectedStatusId);

            if (selectedStatus && (selectedStatus.nome === 'Resolvido' || selectedStatus.nome === 'Normalizado')) {
                if (fimAlarmeInput && (!fimAlarmeInput.value || fimAlarmeInput.value.includes('d'))) {
                    const now = new Date();
                    const formattedDateTime = now.toLocaleString('pt-BR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(',', '');


                    const iMask = fimAlarmeInput.imask;

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
                columnConfig = parsedConfig;
            } catch (e) {
                console.error("Erro ao carregar configuração de colunas, usando padrão.", e);
                localStorage.removeItem('ticketColumnConfig');
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
            thead.innerHTML += `<th class="py-2 px-2 border">${col.title}</th>`;
        });

        if (!tickets || tickets.length === 0) {
            tbody.innerHTML = `<tr><td colspan="${visibleColumns.length}" class="text-center p-4">Nenhum ticket encontrado.</td></tr>`;
        } else {
            let tableContent = '';
            tickets.forEach(ticket => {
                let rowHtml = `<tr class="border-t text-center hover:bg-gray-50 cursor-pointer" data-ticket-id="${ticket.id}">`;

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
                            cellValue = formatDateTime(ticket.data_criacao);
                            break;

                        case 'alarme_inicio':
                        case 'alarme_fim':
                        case 'horario_acionamento':
                            cellValue = formatDateTime(ticket[col.key]);
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


    function popularDropdown(selectId, data, placeholder, defaultValueId = null) {
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

        // Define o valor padrão SE ele foi fornecido
        if (defaultValueId) {
            select.value = defaultValueId;
        }
        // Se não houver valor padrão, seleciona a única opção se houver apenas uma
        else if (Array.isArray(data) && data.length === 1) {
            select.value = data[0].id;
            select.dispatchEvent(new Event('change'));
        }
    }
    async function handleAreaChange(areaSelectElement, tipoSelectId, prioridadeSelectId, grupoSelectId, alertaSelectId) {
        const areaId = areaSelectElement.value;

        const tipoSelect = document.getElementById(tipoSelectId);
        const prioridadeSelect = document.getElementById(prioridadeSelectId);
        const grupoSelect = document.getElementById(grupoSelectId);
        const alertaSelect = document.getElementById(alertaSelectId);

        const canManage = currentUser && (currentUser.perfil === 'admin');

        [btnShowAddArea, btnShowAddGrupo, btnShowAddTipo, btnShowAddPrioridade, btnShowAddAlerta].forEach(btn => btn?.classList.add('hidden'));
        [addAreaContainer, addGrupoContainer, addTipoContainer, addPrioridadeContainer, addAlertaContainer].forEach(cont => cont?.classList.add('hidden'));

        [btnDeleteArea, btnDeleteGrupo, btnDeleteTipo, btnDeletePrioridade, btnDeleteAlerta].forEach(btn => btn?.classList.add('hidden'));

        if (canManage) {

            btnShowAddArea?.classList.remove('hidden');
            btnShowAddStatus?.classList.remove('hidden');


            if (areaId) {
                [btnShowAddGrupo, btnShowAddTipo, btnShowAddPrioridade, btnShowAddAlerta].forEach(btn => btn?.classList.remove('hidden'));
            }
        }

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

        if (areaId) {
            selects.forEach(s => {
                if (s.element) s.element.innerHTML = '<option value="">Carregando...</option>';
            });

            try {
                const [tiposRes, prioridadesRes, gruposRes, alertasRes, areasRes] = await Promise.all([
                    fetch(`/api/tickets/options/areas/${areaId}/tipos`),
                    fetch(`/api/tickets/options/areas/${areaId}/prioridades`),
                    fetch(`/api/tickets/options/areas/${areaId}/grupos`),
                    fetch(`/api/tickets/options/areas/${areaId}/alertas`),
                    fetch('/api/tickets/options/areas')
                ]);

                if (!tiposRes.ok || !prioridadesRes.ok || !gruposRes.ok || !alertasRes.ok || !areasRes.ok) {
                    throw new Error('Falha ao buscar dados da área.');
                }

                const [tipos, prioridades, grupos, alertas, areas] = await Promise.all([
                    tiposRes.json(), prioridadesRes.json(), gruposRes.json(), alertasRes.json(), areasRes.json()
                ]);

                currentTiposList = tipos;
                currentPrioridadesList = prioridades;
                currentGruposList = grupos;
                currentAlertsList = alertas;
                currentAreasList = areas;

                popularDropdown(tipoSelectId, tipos, 'Selecione o Tipo');
                popularDropdown(prioridadeSelectId, prioridades, 'Selecione a Prioridade');
                popularDropdown(grupoSelectId, grupos, 'Selecione o Grupo');
                popularDropdown(alertaSelectId, alertas, 'Selecione o Alerta');

                selects.forEach(s => {
                    if (s.element) s.element.disabled = false;
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

        try {
            const response = await fetch('/api/tickets/options/status');
            if (!response.ok) throw new Error('Falha ao carregar status');
            const statusItems = await response.json();

            currentStatusList = statusItems;

            const defaultStatus = statusItems.find(s => s.nome === 'Em Atendimento');
            const defaultStatusId = defaultStatus ? defaultStatus.id : null;

            popularDropdown('ticket-status', statusItems, 'Selecione o Status', defaultStatusId);

            popularDropdown('edit-ticket-status', statusItems, 'Selecione o Status');
        } catch (error) {
            console.error('Erro ao popular os seletores de Status:', error);
            popularDropdown('ticket-status', [], 'Erro ao carregar');
            popularDropdown('edit-ticket-status', [], 'Erro ao carregar');
        }
    }
    async function carregarInfoCards() {
        try {
            const params = new URLSearchParams(currentFilters);
            const queryString = params.toString();

            const response = await fetch(`/api/tickets/cards-info?${queryString}`);
            if (!response.ok) throw new Error('Falha ao carregar cards');
            const data = await response.json();

            const cardContainer = document.getElementById('card-container');
            if (!cardContainer) return;

            cardContainer.innerHTML = '';

            const activeStatus = currentFilters.status || 'all';

            // 1. Cria o card "Todos Tickets"
            const totalSelected = (activeStatus === 'all') ? 'ring-4 ring-blue-500' : '';
            let todosCardHtml = `
            <div class="status-card bg-[#D4EAFF] rounded-xl p-4 flex flex-col justify-between h-36 w-full cursor-pointer hover:scale-105 transition-transform ${totalSelected}" data-status-name="all">
                <div class="flex justify-between items-start">
                    <img src="/images/total.png" alt="Ícone Todos Tickets" class="w-15 h-12" />
                    <p class="text-3xl font-black text-black">${data.total || 0}</p>
                </div>
                <div>
                    <p class="text-lg font-bold text-[#0A0E2B] leading-tight">Todos<br>Tickets</p>
                </div>
            </div>
        `;
            cardContainer.innerHTML += todosCardHtml;

            // 2. Cria um card para cada status vindo da API
            data.counts.forEach(item => {
                const iconSrc = '/images/aberto.png';
                const itemSelected = (activeStatus === item.nome) ? 'ring-4 ring-blue-500' : '';

                const cardHtml = `
                <div class="status-card bg-[#D4EAFF] rounded-xl p-4 flex flex-col justify-between h-36 w-full cursor-pointer hover:scale-105 transition-transform ${itemSelected}" data-status-name="${item.nome}">
                    <div class="flex justify-between items-start">
                        <img src="${iconSrc}" alt="Ícone ${item.nome}" class="w-15 h-12" />
                        <p class="text-3xl font-black text-black">${item.count || 0}</p>
                    </div>
                    <div>
                        <p class="text-lg font-bold text-[#0A0E2B] leading-tight">${item.nome}</p>
                    </div>
                </div>
            `;
                cardContainer.innerHTML += cardHtml;
            });

            // 3. Adiciona a lógica de clique
            const allCards = document.querySelectorAll('.status-card');
            allCards.forEach(card => {
                card.addEventListener('click', () => {

                    // ===== CORREÇÃO AQUI =====
                    // Remove as classes de anel uma por uma
                    allCards.forEach(c => c.classList.remove('ring-4', 'ring-blue-500'));

                    // Adiciona as classes de anel uma por uma
                    card.classList.add('ring-4', 'ring-blue-500');
                    // ===== FIM DA CORREÇÃO =====

                    const statusName = card.dataset.statusName;

                    if (statusName === 'all') {
                        delete currentFilters.status;
                    } else {
                        currentFilters.status = statusName;
                    }

                    // Recarrega AMBOS
                    carregarTickets(1);
                    carregarInfoCards();
                });
            });

        } catch (error) {
            console.error("Erro ao carregar info dos cards:", error);
            const cardContainer = document.getElementById('card-container'); // Declaração movida para o catch
            if (cardContainer) cardContainer.innerHTML = '<p class="text-sm text-red-500">Erro ao carregar status.</p>';
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
    const yearSelect = document.getElementById('export-year-select');
    const areasContainer = document.getElementById('export-areas-container');

    // Lógica de Checkbox "Todos" (Agora fora do listener, pois o HTML é estático)
    const allMonthsCheckbox = document.getElementById('check-all-months');
    const individualMonthCheckboxes = document.querySelectorAll('.month-checkbox');

    if (allMonthsCheckbox) {
        allMonthsCheckbox.addEventListener('change', () => {
            individualMonthCheckboxes.forEach(cb => cb.checked = allMonthsCheckbox.checked);
        });
        // Opcional: Desmarcar "Todos" se um individual for desmarcado
        individualMonthCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                allMonthsCheckbox.checked = [...individualMonthCheckboxes].every(c => c.checked);
            });
        });
    }

    btnAbrirModalExportar?.addEventListener('click', async () => {
        // 1. Gera apenas os Anos (isso continua dinâmico)
        const currentYear = new Date().getFullYear();
        yearSelect.innerHTML = '';
        for (let i = 0; i < 5; i++) {
            const year = currentYear - i;
            yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
        }

        // 2. Carrega as Áreas (continua dinâmico pois vem do banco)
        areasContainer.innerHTML = '<div class="p-4 text-center text-gray-500 text-sm">Carregando áreas...</div>';

        try {
            const response = await fetch('/api/tickets/options/areas');
            const areas = await response.json();

            if (areas && areas.length > 0) {
                areasContainer.className = "mt-4"; // Margem superior para separar dos meses
                areasContainer.innerHTML = `
                    <label class="block text-sm font-semibold text-gray-700 mb-2">Filtrar por Área</label>
                    <div class="p-4 border rounded-md bg-gray-50 max-h-60 overflow-y-auto">
                        <div class="flex items-center mb-3 pb-2 border-b border-gray-200">
                            <input type="checkbox" id="check-all-areas" class="form-checkbox h-4 w-4 rounded text-blue-600 focus:ring-blue-500" checked>
                            <label for="check-all-areas" class="ml-2 font-bold text-sm text-gray-700 cursor-pointer select-none">Todas as Áreas</label>
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                            ${areas.map(area => `
                                <div class="flex items-center truncate" title="${area.nome}">
                                    <input type="checkbox" name="export_areas" value="${area.id}" class="form-checkbox h-4 w-4 rounded text-blue-600 focus:ring-blue-500 area-export-checkbox cursor-pointer" checked>
                                    <label class="ml-2 text-sm text-gray-700 cursor-pointer select-none truncate">${area.nome}</label>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;

                // Lógica "Todos" para Áreas
                const allAreasCheckbox = document.getElementById('check-all-areas');
                const individualAreaCheckboxes = areasContainer.querySelectorAll('.area-export-checkbox');

                allAreasCheckbox.addEventListener('change', () => {
                    individualAreaCheckboxes.forEach(cb => cb.checked = allAreasCheckbox.checked);
                });

                individualAreaCheckboxes.forEach(cb => {
                    cb.addEventListener('change', () => {
                        allAreasCheckbox.checked = [...individualAreaCheckboxes].every(c => c.checked);
                    });
                });
            } else {
                areasContainer.innerHTML = '<p class="text-sm text-gray-500 mt-2">Nenhuma área encontrada.</p>';
            }
        } catch (error) {
            console.error(error);
            areasContainer.innerHTML = '<p class="text-sm text-red-500 mt-2">Erro ao carregar áreas.</p>';
        }

        toggleModal('modalExportarRelatorio', true);
    });

    formExportar?.addEventListener('submit', (e) => {
        e.preventDefault();
        const formData = new FormData(formExportar);
        const format = formData.get('format');
        const year = formData.get('year');
        const months = formData.getAll('months');
        const areas = formData.getAll('export_areas');

        if (!year) {
            return showStatusModal('Erro', 'Por favor, selecione um ano.', true);
        }


        let queryString = `?format=${format}&year=${year}`;

        if (months.length > 0) {
            queryString += '&months=' + months.join(',');
        }


        if (areas.length > 0) {
            queryString += '&areas=' + areas.join(',');
        }

        window.location.href = `/api/tickets/export${queryString}`;

        toggleModal('modalExportarRelatorio', false);
    });

    async function abrirModalEditar(ticketId) {
        pastedFileEdit = null;
        const preview = document.getElementById('paste-preview-edit');
        if (preview) preview.innerHTML = '';
        const formEditarTicket = document.getElementById('formEditarTicket');
        formEditarTicket.reset();

        try {
            const ticketResponse = await fetch(`/api/tickets/${ticketId}`);
            if (!ticketResponse.ok) throw new Error('Ticket não encontrado');
            const ticket = await ticketResponse.json();
            ticketAbertoParaEdicao = ticket;

            // Formata as datas que vêm do banco
            const alarmeInicio = getFormattedDateTime(ticket.alarme_inicio);
            const horarioAcionamento = getFormattedDateTime(ticket.horario_acionamento);
            const alarmeFim = getFormattedDateTime(ticket.alarme_fim);

            // Preenche os campos de data
            document.getElementById('edit-alarme-inicio-date').value = alarmeInicio.date;
            document.getElementById('edit-horario-acionamento-date').value = horarioAcionamento.date;
            document.getElementById('edit-alarme-fim-date').value = alarmeFim.date;

            // Preenche os campos de hora (gerenciando o IMask)
            const alarmeInicioTimeInput = document.getElementById('edit-alarme-inicio-time');
            if (alarmeInicioTimeInput.imask) {
                alarmeInicioTimeInput.imask.value = alarmeInicio.time;
            } else {
                alarmeInicioTimeInput.value = alarmeInicio.time;
            }

            const horarioAcionamentoTimeInput = document.getElementById('edit-horario-acionamento-time');
            if (horarioAcionamentoTimeInput.imask) {
                horarioAcionamentoTimeInput.imask.value = horarioAcionamento.time;
            } else {
                horarioAcionamentoTimeInput.value = horarioAcionamento.time;
            }

            const alarmeFimTimeInput = document.getElementById('edit-alarme-fim-time');
            if (alarmeFimTimeInput.imask) {
                alarmeFimTimeInput.imask.value = alarmeFim.time;
            } else {
                alarmeFimTimeInput.value = alarmeFim.time;
            }

            // Preenche dados básicos
            document.getElementById('edit-ticket-id').value = ticket.id;
            document.getElementById('edit-ticket-descricao').value = ticket.descricao;

            const statusItem = currentStatusList.find(s => s.nome === ticket.status);
            if (statusItem) {
                document.getElementById('edit-ticket-status').value = statusItem.id;
            }

            // --- LÓGICA DE ANEXO CORRIGIDA PARA LINUX/VM ---
            const linkContainer = document.getElementById('current-attachment-container');
            const linkSpan = document.getElementById('current-attachment-link');
            const removeAnexoInput = document.getElementById('edit-remove-anexo');

            if (linkContainer && linkSpan && removeAnexoInput) {
                removeAnexoInput.value = '0';
                linkContainer.classList.add('hidden');

                if (ticket.anexo_path) {
                    // 1. Normaliza barras (converte \ do Windows para /)
                    let webPath = ticket.anexo_path.replace(/\\/g, '/');

                    // 2. Remove barra inicial se existir, para padronizar a verificação
                    if (webPath.startsWith('/')) {
                        webPath = webPath.substring(1);
                    }

                    // 3. Garante que começa com 'public/' (necessário pois configuramos app.use('/public'))
                    if (!webPath.startsWith('public/')) {
                        webPath = 'public/' + webPath;
                    }

                    // 4. Adiciona a barra absoluta no início
                    webPath = '/' + webPath;

                    linkSpan.innerHTML = `Anexo atual: <a href="${webPath}" target="_blank" class="text-blue-600 hover:underline">Ver Arquivo</a>`;
                    linkContainer.classList.remove('hidden');
                }
            }
            // ------------------------------------------------

            // Lógica de Área e Dropdowns em Cascata
            const areaSelect = document.getElementById('edit-ticket-area');
            areaSelect.value = ticket.area_id;

            await handleAreaChange(areaSelect, 'edit-ticket-tipo', 'edit-ticket-prioridade', 'edit-ticket-grupo', 'edit-ticket-alerta');

            // Pequeno delay para garantir que o DOM atualizou
            await new Promise(resolve => setTimeout(resolve, 150));

            document.getElementById('edit-ticket-tipo').value = ticket.tipo_solicitacao_id;
            document.getElementById('edit-ticket-prioridade').value = ticket.prioridade_id;
            document.getElementById('edit-ticket-grupo').value = ticket.grupo_id;
            document.getElementById('edit-ticket-alerta').value = ticket.alerta_id;

            // Permissões do botão deletar
            const deleteButton = document.getElementById('btn-delete-ticket');
            if (deleteButton) {
                deleteButton.classList.toggle('hidden', !(currentUser && (currentUser.perfil === 'admin' || currentUser.perfil === 'support')));
            }

            // Carregar Comentários
            const commentsResponse = await fetch(`/api/tickets/${ticketId}/comments`);
            if (commentsResponse.ok) {
                const comments = await commentsResponse.json();
                renderComments(comments);
            }

            toggleModal('modalEditarTicket', true);

        } catch (error) {
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
            if (select) {
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

    btnShowAddAlerta?.addEventListener('click', () => {
        const areaSelect = document.getElementById('ticket-area');
        if (!areaSelect || !areaSelect.value) {
            return showStatusModal('Atenção!', 'Por favor, selecione uma Área primeiro.', true);
        }
        addAlertaContainer.classList.remove('hidden');
        btnShowAddAlerta.classList.add('hidden');
        if (btnDeleteAlerta) btnDeleteAlerta.classList.add('hidden');
        inputNewAlerta.focus();
        setupAutocomplete('input-new-alerta', 'alerta-suggestions-list', currentAlertsList);
    });

    const resetAddAlertaForm = () => {
        if (addAlertaContainer) addAlertaContainer.classList.add('hidden');
        if (btnShowAddAlerta) btnShowAddAlerta.classList.remove('hidden');
        const alertaSelect = document.getElementById('ticket-alerta');
        if (btnDeleteAlerta && alertaSelect?.value) btnDeleteAlerta.classList.remove('hidden');
        if (inputNewAlerta) inputNewAlerta.value = '';
        if (suggestionsList) suggestionsList.innerHTML = '';
        if (btnSaveNewAlerta) btnSaveNewAlerta.disabled = false;
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
    const isInternal = (perfil === 'support' || perfil === 'admin' || perfil === 'gerente' || perfil === 'engenharia');
    document.getElementById('campos-support').classList.toggle('hidden', !isInternal);

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

            const submitButton = document.querySelector('button[form="formCriarUsuario"]');

            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Salvando...';
            }

            try {
                const formData = new FormData(formCriarUsuario);
                const data = Object.fromEntries(formData.entries());
                data.area_ids = formData.getAll('area_ids').map(Number);

                const email = data.login_user || data.login_support;

                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!email || !emailRegex.test(email)) {
                    showStatusModal('Erro de Validação', 'Por favor, insira um formato de e-mail válido.', true);
                    if (submitButton) {
                        submitButton.disabled = false;
                        submitButton.textContent = 'Salvar Usuário';
                    }
                    return;
                }

                delete data.login_user;
                delete data.login_support;
                data.login = email;

                data.nome = data.nome_user || data.nome_support;
                data.sobrenome = data.sobrenome_user || data.sobrenome_support;
                delete data.nome_user;
                delete data.nome_support;
                delete data.sobrenome_user;
                delete data.sobrenome_support;

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

                    const selectPerfil = document.getElementById('selectPerfil');
                    if (selectPerfil) {
                        selectPerfil.value = '';
                        selectPerfil.dispatchEvent(new Event('change'));
                    }
                } else {
                    showStatusModal('Erro!', result.message, true);
                }
            } catch (error) {
                showStatusModal('Erro de Conexão', 'Não foi possível se comunicar com o servidor.', true);
            } finally {
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Salvar Usuário';
                }
            }
        });
    }
    const btnCancelCreateUser = document.getElementById('btn-cancel-create-user');
    if (btnCancelCreateUser) {
        btnCancelCreateUser.addEventListener('click', () => {
            const selectPerfil = document.getElementById('selectPerfil');
            formCriarUsuario.reset();
            if (selectPerfil) {
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

        const alarmeInicioDate = formData.get('alarme_inicio_date');
        const alarmeInicioTime = formData.get('alarme_inicio_time');
        const horarioAcionamentoDate = formData.get('horario_acionamento_date');
        const horarioAcionamentoTime = formData.get('horario_acionamento_time');

        // Validação de campos obrigatórios
        if (!alarmeInicioDate || !alarmeInicioTime || alarmeInicioTime.includes('h') ||
            !horarioAcionamentoDate || !horarioAcionamentoTime || horarioAcionamentoTime.includes('h')) {
            return showStatusModal('Campos Obrigatórios', 'As datas e horas para "Início do Alarme" e "Início do Atendimento" são obrigatórias.', true);
        }

        // Combina os campos
        const alarmeInicio = combineDateAndTime(alarmeInicioDate, alarmeInicioTime, false);
        const horarioAcionamento = combineDateAndTime(horarioAcionamentoDate, horarioAcionamentoTime, false);
        // CORREÇÃO: Passa 'true' para o Fim do Alarme, indicando que ele é opcional
        const alarmeFim = combineDateAndTime(formData.get('alarme_fim_date'), formData.get('alarme_fim_time'), true);

        // Validação de lógica de datas
        if (horarioAcionamento && alarmeFim) {
            const inicioDate = new Date(horarioAcionamento.replace(' ', 'T'));
            const fimDate = new Date(alarmeFim.replace(' ', 'T'));
            if (fimDate && inicioDate && fimDate < inicioDate) {
                return showStatusModal('Erro de Validação', 'O "Fim do Alarme" não pode ser anterior ao "Início do Atendimento".', true);
            }
        }

        formData.set('alarme_inicio', alarmeInicio);
        formData.set('horario_acionamento', horarioAcionamento);
        formData.set('alarme_fim', alarmeFim);

        // Limpa os campos extras
        ['alarme_inicio_date', 'alarme_inicio_time', 'horario_acionamento_date', 'horario_acionamento_time', 'alarme_fim_date', 'alarme_fim_time']
            .forEach(key => formData.delete(key));

        const fileInput = formAbrirTicket.querySelector('input[type="file"][name="anexo"]');
        if (pastedFileCreate && (!fileInput || !fileInput.files || fileInput.files.length === 0)) {
            formData.set('anexo', pastedFileCreate, pastedFileCreate.name);
        }
        try {
            const response = await fetch('/api/tickets', { method: 'POST', body: formData });
            const result = await response.json();

            if (response.ok) {
                toggleModal('modalTicket', false);
                showStatusModal('Sucesso!', result.message, false, () => {
                    carregarTickets(paginaAtual);
                    carregarInfoCards();
                });
                formAbrirTicket.reset();
            } else {
                showStatusModal('Erro!', result.message, true);
            }
        } catch (error) {
            showStatusModal('Erro de Conexão', 'Não foi possível criar o ticket.', true);
        } finally {
            pastedFileCreate = null;
            const preview = document.getElementById('paste-preview-create');
            if (preview) preview.innerHTML = '';
        }
    });
    formEditarTicket?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const ticketId = document.getElementById('edit-ticket-id').value;
        const formData = new FormData(formEditarTicket);

        const alarmeInicioDate = formData.get('alarme_inicio_date');
        const alarmeInicioTime = formData.get('alarme_inicio_time');
        const horarioAcionamentoDate = formData.get('horario_acionamento_date');
        const horarioAcionamentoTime = formData.get('horario_acionamento_time');

        if (!alarmeInicioDate || !alarmeInicioTime || alarmeInicioTime.includes('h') ||
            !horarioAcionamentoDate || !horarioAcionamentoTime || horarioAcionamentoTime.includes('h')) {
            return showStatusModal('Campos Obrigatórios', 'As datas e horas para "Início do Alarme" e "Início do Atendimento" são obrigatórias.', true);
        }

        const alarmeInicio = combineDateAndTime(alarmeInicioDate, alarmeInicioTime, false);
        const horarioAcionamento = combineDateAndTime(horarioAcionamentoDate, horarioAcionamentoTime, false);
        // CORREÇÃO: Passa 'true' para o Fim do Alarme, indicando que ele é opcional
        const alarmeFim = combineDateAndTime(formData.get('alarme_fim_date'), formData.get('alarme_fim_time'), true);

        if (horarioAcionamento && alarmeFim) {
            const inicioDate = new Date(horarioAcionamento.replace(' ', 'T'));
            const fimDate = new Date(alarmeFim.replace(' ', 'T'));
            if (fimDate && inicioDate && fimDate < inicioDate) {
                return showStatusModal('Erro de Validação', 'O "Fim do Alarme" não pode ser anterior ao "Início do Atendimento".', true);
            }
        }

        formData.set('alarme_inicio', alarmeInicio);
        formData.set('horario_acionamento', horarioAcionamento);
        formData.set('alarme_fim', alarmeFim);

        ['alarme_inicio_date', 'alarme_inicio_time', 'horario_acionamento_date', 'horario_acionamento_time', 'alarme_fim_date', 'alarme_fim_time']
            .forEach(key => formData.delete(key));

        const newCommentTextValue = document.getElementById('new-comment-text').value.trim();
        if (newCommentTextValue) {
            formData.append('new_comment_text', newCommentTextValue);
        }
        const fileInput = formEditarTicket.querySelector('input[type="file"][name="anexo"]');
        if (pastedFileEdit && (!fileInput.files || fileInput.files.length === 0)) {
            formData.set('anexo', pastedFileEdit, pastedFileEdit.name);
            formData.set('remove_anexo', '0');
        }

        try {
            const response = await fetch(`/api/tickets/${ticketId}`, { method: 'PUT', body: formData });
            const result = await response.json();
            if (response.ok) {
                toggleModal('modalEditarTicket', false);
                showStatusModal('Sucesso!', result.message, false, () => {
                    carregarTickets(paginaAtual);
                    carregarInfoCards();
                });
            } else {
                showStatusModal('Erro!', `Ocorreu um erro ao salvar: ${result.message}`, true);
            }
        } catch (error) {
            showStatusModal('Erro de Conexão', 'Não foi possível salvar as alterações.', true);
        } finally {
            pastedFileEdit = null;
            const preview = document.getElementById('paste-preview-edit');
            if (preview) preview.innerHTML = '';
            document.getElementById('new-comment-text').value = '';
        }
    });
    tabelaTicketsBody?.addEventListener('click', (event) => {

        if (event.target.classList.contains('JCLRgrip')) {
            return;
        }
        const clickedRow = event.target.closest('tr[data-ticket-id]');

        if (clickedRow) {
            abrirModalEditar(clickedRow.dataset.ticketId);
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
    function addOptionButtonListeners(selectId, btnDeleteId, btnEditId = null) {
        const selectElement = document.getElementById(selectId);
        if (!selectElement) {
            console.error(`[ERRO de Configuração] O dropdown #${selectId} não foi encontrado.`);
            return;
        }

        selectElement.addEventListener('change', (event) => {
            const canManage = currentUser && (currentUser.perfil === 'admin');
            const valorSelecionado = event.target.value;

            // Lógica do botão Deletar
            const btnDelete = document.getElementById(btnDeleteId);
            if (btnDelete) {
                btnDelete.classList.toggle('hidden', !valorSelecionado || !canManage);
            } else {
                console.error(`[ERRO] O botão de exclusão #${btnDeleteId} não foi encontrado!`);
            }

            // Lógica do botão Editar
            if (btnEditId) {
                const btnEdit = document.getElementById(btnEditId);
                if (btnEdit) {
                    btnEdit.classList.toggle('hidden', !valorSelecionado || !canManage);
                } else {
                    console.error(`[ERRO] O botão de edição #${btnEditId} não foi encontrado!`);
                }
            }
        });
    }
    document.getElementById('btn-remove-anexo')?.addEventListener('click', () => {
        // Esconde o link do anexo atual
        document.getElementById('current-attachment-container')?.classList.add('hidden');
        // Marca o anexo para remoção no backend
        document.getElementById('edit-remove-anexo').value = '1';
        // Limpa o campo de seleção de novo arquivo, se houver
        const fileInput = document.querySelector('#formEditarTicket input[type="file"][name="anexo"]');
        if (fileInput) {
            fileInput.value = '';
        }
    });
   async function initEngineeringDashboard(user) {

    // 1. FORÇA A OCULTAÇÃO DO SUPORTE E MOSTRA A ENGENHARIA
    const painelSuporte = document.getElementById('dashboard-suporte');
    const painelEng = document.getElementById('dashboard-engenharia');

    if (painelSuporte) {
        painelSuporte.style.display = 'none'; 
        painelSuporte.classList.add('hidden');
    }
    if (painelEng) {
        painelEng.style.display = 'block';
        painelEng.classList.remove('hidden');
    }

    // 2. Lógica do Botão da Sidebar (Agora robusta usando ID)
    const sidebarBtn = document.getElementById('btn-sidebar-open-ticket');
    if (sidebarBtn) {
        // Remove listeners antigos clonando o botão
        const newBtn = sidebarBtn.cloneNode(true);
        sidebarBtn.parentNode.replaceChild(newBtn, sidebarBtn);
        
        // Define o comportamento baseado no perfil
        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            if (user.perfil === 'cliente' || user.perfil === 'user'|| user.perfil === 'engenharia') {
                // Cliente: Abre modal de engenharia
                abrirModalEngenharia();
            } else {
                // Outros (Fallback): Abre modal padrão antigo
                toggleModal('modalTicket', true);
            }
        });
    }

    if (user.perfil === 'cliente' || user.perfil === 'user') {
        const btnNew = document.getElementById('btn-novo-ticket-eng');
        if (btnNew) {
            btnNew.classList.remove('hidden');
            btnNew.onclick = abrirModalEngenharia;
        }
    }
    try {
        const resp = await fetch('/api/engineering/users/engineers');
        if (resp.ok) engineersListCache = await resp.json();
    } catch (e) { console.error("Erro ao carregar engenheiros", e); }
atualizarDropdownStatusEngenharia();
  await carregarTicketsEngenharia(); 
    setupEngineeringForms();        
    setupCascadingDropdowns();         
    setupCascadingDropdownsEdit();     
    setupEngineeringFilters();
    setupEngineeringDeleteListeners();   
    
    const tooltip = document.getElementById('custom-tooltip');
    const tbody = document.getElementById('lista-tickets-eng');

    if (tooltip && tbody) {
        tbody.addEventListener('mouseover', (e) => {
            const row = e.target.closest('tr[data-servico]');
            if (row) {
                const servico = row.getAttribute('data-servico');
                tooltip.innerHTML = `<span class="text-blue-600 font-bold">Serviço:</span> ${servico}`;
                tooltip.classList.remove('hidden');
                // Pequeno delay para animação suave
                setTimeout(() => tooltip.classList.remove('opacity-0'), 10);
            }
        });

        tbody.addEventListener('mousemove', (e) => {
            tooltip.style.left = (e.clientX + 15) + 'px';
            tooltip.style.top = (e.clientY + 15) + 'px';
        });

        tbody.addEventListener('mouseout', (e) => {
            const row = e.target.closest('tr[data-servico]');
            if (row) {
                tooltip.classList.add('opacity-0');
                tooltip.classList.add('hidden');
            }
        });
    }
}

function abrirModalEngenharia() {
    const form = document.getElementById('formCreateEngTicket');
    if (form) form.reset();
    resetDropdownsToInitialState();
    toggleModal('modalCreateEngTicket', true);
}

function setupCascadingDropdownsEdit() {
    const cloudSel = document.getElementById('edit-eng-cloud');
    const catSel = document.getElementById('edit-eng-categoria');
    const subSel = document.getElementById('edit-eng-subcategoria');
    const servSel = document.getElementById('edit-eng-servico');
    const slaInput = document.getElementById('edit-eng-sla');

    if (!cloudSel) return;

    // (Lógica idêntica à de criação, mas apontando para os IDs de edição)
    cloudSel.addEventListener('change', async () => {
        const cloud = cloudSel.value;
        resetSelect(catSel, 'Selecione'); resetSelect(subSel, 'Selecione'); resetSelect(servSel, 'Selecione');
        if(cloud) {
            const data = await fetch(`/api/engineering/catalog-options?cloud=${encodeURIComponent(cloud)}`).then(r=>r.json());
            populateSelect(catSel, data, 'categoria', 'categoria', 'Selecione');
            catSel.disabled = false;
        }
    });

    catSel.addEventListener('change', async () => {
        const cloud = cloudSel.value;
        const cat = catSel.value;
        resetSelect(subSel, 'Selecione'); resetSelect(servSel, 'Selecione');
        if(cat) {
            const data = await fetch(`/api/engineering/catalog-options?cloud=${encodeURIComponent(cloud)}&categoria=${encodeURIComponent(cat)}`).then(r=>r.json());
            populateSelect(subSel, data, 'sub_categoria', 'sub_categoria', 'Selecione');
            subSel.disabled = false;
        }
    });

    subSel.addEventListener('change', async () => {
        const cloud = cloudSel.value;
        const cat = catSel.value;
        const sub = subSel.value;
        resetSelect(servSel, 'Selecione');
        if(sub) {
            const data = await fetch(`/api/engineering/catalog-options?cloud=${encodeURIComponent(cloud)}&categoria=${encodeURIComponent(cat)}&sub_categoria=${encodeURIComponent(sub)}`).then(r=>r.json());
            populateSelect(servSel, data, 'id', 'servico', 'Selecione', 'sla');
            servSel.disabled = false;
        }
    });

    servSel.addEventListener('change', () => {
        const opt = servSel.options[servSel.selectedIndex];
        slaInput.value = opt.getAttribute('data-extra') || '';
    });
}

function setupCascadingDropdowns() {
    const cloudSel = document.getElementById('eng-cloud');
    const catSel = document.getElementById('eng-categoria');
    const subSel = document.getElementById('eng-subcategoria');
    const servSel = document.getElementById('eng-servico');
    const slaInput = document.getElementById('eng-sla');

    if (!cloudSel) return;

    cloudSel.addEventListener('change', async () => {
        const cloud = cloudSel.value;
        resetSelect(catSel, 'Selecione a Categoria');
        resetSelect(subSel, 'Selecione a Categoria primeiro');
        resetSelect(servSel, 'Selecione a Sub Categoria primeiro');
        if(slaInput) slaInput.value = '';
        
        if (cloud) {
            try {
                const response = await fetch(`/api/engineering/catalog-options?cloud=${encodeURIComponent(cloud)}`);
                const data = await response.json();
                populateSelect(catSel, data, 'categoria', 'categoria', 'Selecione a Categoria');
                catSel.disabled = false;
                catSel.classList.remove('bg-gray-100');
            } catch (e) { console.error(e); }
        }
    });

    catSel.addEventListener('change', async () => {
        const cloud = cloudSel.value;
        const cat = catSel.value;
        resetSelect(subSel, 'Selecione a Sub Categoria');
        resetSelect(servSel, 'Selecione a Sub Categoria primeiro');
        if(slaInput) slaInput.value = '';

        if (cat) {
            try {
                const response = await fetch(`/api/engineering/catalog-options?cloud=${encodeURIComponent(cloud)}&categoria=${encodeURIComponent(cat)}`);
                const data = await response.json();
                populateSelect(subSel, data, 'sub_categoria', 'sub_categoria', 'Selecione a Sub Categoria');
                subSel.disabled = false;
                subSel.classList.remove('bg-gray-100');
            } catch (e) { console.error(e); }
        }
    });

    subSel.addEventListener('change', async () => {
        const cloud = cloudSel.value;
        const cat = catSel.value;
        const sub = subSel.value;
        resetSelect(servSel, 'Selecione o Serviço');
        if(slaInput) slaInput.value = '';

        if (sub) {
            try {
                const response = await fetch(`/api/engineering/catalog-options?cloud=${encodeURIComponent(cloud)}&categoria=${encodeURIComponent(cat)}&sub_categoria=${encodeURIComponent(sub)}`);
                const data = await response.json();
                populateSelect(servSel, data, 'id', 'servico', 'Selecione o Serviço', 'sla'); 
                servSel.disabled = false;
                servSel.classList.remove('bg-gray-100');
            } catch (e) { console.error(e); }
        }
    });

    servSel.addEventListener('change', () => {
        const selectedOption = servSel.options[servSel.selectedIndex];
        const sla = selectedOption.getAttribute('data-extra');
        if(slaInput) slaInput.value = sla || 'N/A';
    });
}



function resetSelect(sel, placeholder) {
    if(sel) {
        sel.innerHTML = `<option value="">${placeholder}</option>`;
        sel.disabled = true;
        sel.classList.add('bg-gray-100');
    }
}

function populateSelect(sel, data, valKey, textKey, placeholder, extraKey = null) {
    if(sel) {
        sel.innerHTML = `<option value="">${placeholder}</option>`;
        data.forEach(item => {
            const opt = document.createElement('option');
            opt.value = item[valKey];
            opt.textContent = item[textKey];
            if(extraKey) opt.setAttribute('data-extra', item[extraKey]);
            sel.appendChild(opt);
        });
    }
}

function resetDropdownsToInitialState() {
    const catSel = document.getElementById('eng-categoria');
    const subSel = document.getElementById('eng-subcategoria');
    const servSel = document.getElementById('eng-servico');
    const slaInput = document.getElementById('eng-sla');
    const cloudSel = document.getElementById('eng-cloud');

    if(cloudSel) cloudSel.value = "";
    resetSelect(catSel, 'Selecione a Cloud primeiro');
    resetSelect(subSel, 'Selecione a Categoria primeiro');
    resetSelect(servSel, 'Selecione a Sub Categoria primeiro');
    if(slaInput) slaInput.value = "";
}
window.filtrarEngCard = function(statusFiltro) {
    const rows = document.querySelectorAll('#lista-tickets-eng tr');

    rows.forEach(row => {
        // Pega o status que está escrito na coluna da tabela
        const statusBadge = row.querySelector('span.rounded-full'); 
        const statusTexto = statusBadge ? statusBadge.innerText.trim() : '';

        // Lógica de compatibilidade (Para filtrar corretamente os antigos e novos)
        let match = false;

        if (statusFiltro === 'Todos' || statusFiltro === 'all') {
            match = true;
        } 
        else if (statusFiltro === 'Em Atendimento') {
            // Mostra se for "Em Atendimento" OU "Em Análise"
            match = (statusTexto === 'Em Atendimento' || statusTexto === 'Em Análise' || statusTexto === 'Em Analise');
        }
        else if (statusFiltro === 'Reaberto') {
            // Mostra se for "Reaberto" OU "Desenvolvimento"
            match = (statusTexto === 'Reaberto' || statusTexto === 'Desenvolvimento');
        }
        else {
            // Para "Aberto", "Resolvido", a comparação é direta
            match = (statusTexto === statusFiltro);
        }

        // Mostra ou esconde a linha
        if (match) {
            row.classList.remove('hidden');
        } else {
            row.classList.add('hidden');
        }
    });
};
function atualizarDropdownStatusEngenharia() {
    const select = document.getElementById('edit-eng-status');
    if (!select) return;

    // Recria as opções com os nomes novos
    select.innerHTML = `
        <option value="Aberto">Aberto</option>
        <option value="Em Atendimento">Em Atendimento</option>
        <option value="Reaberto">Reaberto</option>
        <option value="Resolvido">Resolvido</option>
    `;
}

async function carregarTicketsEngenharia() {
    const tbody = document.getElementById('lista-tickets-eng');
    if(!tbody) return;
    
    // Define colspan 14 para cobrir todas as colunas enquanto carrega
    tbody.innerHTML = '<tr><td colspan="14" class="text-center p-4">Carregando...</td></tr>';

    // Captura os filtros do DOM
    const tipoFilter = document.getElementById('filter-eng-tipo')?.value || '';
    const statusFilter = document.getElementById('filter-eng-status')?.value || '';
    const prioFilter = document.getElementById('filter-eng-prioridade')?.value || '';
    const sortOrder = document.getElementById('eng-ordenar')?.value || 'id_desc';

    try {
        const res = await fetch('/api/engineering/tickets');
        if (!res.ok) throw new Error('Erro ao buscar tickets');
        
        let tickets = await res.json();
        currentTicketsCache = tickets; // Atualiza o cache global para o modal de edição

        // 1. Atualiza os Cards de Contagem (antes de filtrar)
        atualizarCardsEngenharia(tickets);

        // 2. Aplica Filtros
        if (tipoFilter) tickets = tickets.filter(t => t.tipo_solicitacao === tipoFilter);
        if (statusFilter) tickets = tickets.filter(t => t.status === statusFilter);
        if (prioFilter) tickets = tickets.filter(t => t.prioridade === prioFilter);

        // 3. Aplica Ordenação
        if (sortOrder === 'id_desc') {
            tickets.sort((a,b) => b.id - a.id);
        } else if (sortOrder === 'prio_desc') {
            const prioMap = {'Critica': 4, 'Alta': 3, 'Media': 2, 'Baixa': 1};
            tickets.sort((a,b) => (prioMap[b.prioridade]||0) - (prioMap[a.prioridade]||0));
        } else if (sortOrder === 'status_asc') {
            tickets.sort((a,b) => a.status.localeCompare(b.status));
        }

        // Atualiza o contador de registros visíveis
        if(document.getElementById('eng-total-count')) 
            document.getElementById('eng-total-count').innerText = tickets.length;

        // Se não houver tickets após o filtro
        if (tickets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="14" class="text-center p-4 text-gray-500">Nenhum ticket encontrado.</td></tr>';
            return;
        }

        // 4. Renderiza as Linhas
        tbody.innerHTML = tickets.map(t => {
            // --- Estilização de Badges e Cores (ATUALIZADO) ---
            let statusBadge = 'bg-gray-100 text-gray-800';
            
            if (t.status === 'Aberto') {
                statusBadge = 'bg-yellow-100 text-yellow-800';
            } 
            else if (t.status === 'Em Analise' || t.status === 'Em Atendimento') {
                statusBadge = 'bg-blue-100 text-blue-800';
            } 
            else if (t.status === 'Desenvolvimento' || t.status === 'Reaberto') {
                statusBadge = 'bg-purple-100 text-purple-800';
            } 
            else if (t.status === 'Resolvido') {
                statusBadge = 'bg-green-100 text-green-800';
            }

            let prioColor = 'text-gray-600';
            if (t.prioridade === 'Alta') prioColor = 'text-orange-600 font-bold';
            if (t.prioridade === 'Critica') prioColor = 'text-red-600 font-bold';

            // --- Lógica do Botão de Ação ---
            let btnAction = '';
            if (currentUser.perfil === 'engenharia' || currentUser.perfil === 'admin' || currentUser.perfil === 'gerente') {
                btnAction = `<button onclick="abrirModalEdicaoEngenharia(${t.id})" 
                                class="text-blue-600 hover:text-blue-800 font-bold border border-blue-600 px-2 py-1 rounded text-xs transition hover:bg-blue-50">
                                <i class="fa-solid fa-pen-to-square"></i>
                             </button>`;
            } else {
                btnAction = `<span class="text-gray-400 text-xs px-2"><i class="fa-solid fa-lock"></i></span>`;
            }

            // --- Tratamento de Dados para Exibição ---
            const cloudDisplay = t.cloud || '-';
            const subCatDisplay = t.sub_categoria || '-';
            const servicoDisplay = t.servico_nome || '<span class="text-gray-400 italic">Não categorizado</span>';
            
            // Trunca textos longos
            const descricaoFull = t.descricao || '';
            const descricaoCurta = descricaoFull.length > 30 ? descricaoFull.substring(0, 30) + '...' : (descricaoFull || '-');
            
            const analista = t.engenheiro_nome ? `<span class="font-semibold text-gray-700">${t.engenheiro_nome}</span>` : '<span class="text-gray-400 italic">Pendente</span>';
            
            const comentarioFull = t.comentario_tecnico || '';
            const comentarioCurta = comentarioFull.length > 25 ? `<span title="${comentarioFull.replace(/"/g, '&quot;')}">${comentarioFull.substring(0,25)}...</span>` : (comentarioFull || '-');

            // Formatação de Datas
            const dataAbertura = new Date(t.data_abertura || t.data_criacao).toLocaleString('pt-BR', { 
                day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' 
            });
            const dataConclusao = t.data_resolucao ? new Date(t.data_resolucao).toLocaleString('pt-BR', { 
                day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' 
            }) : '-';

            return `
                <tr class="border-b hover:bg-gray-50 transition group relative" data-servico="${t.servico_nome || 'Não informado'}">
                    <td class="px-4 py-3 font-bold text-gray-900">#${t.id}</td>

                    <td class="px-4 py-3 text-xs">
                        <div class="font-bold text-gray-800">
                            ${t.cliente_nome || ''} ${t.cliente_sobrenome || ''}
                        </div>
                    </td>
                    
                    <td class="px-4 py-3 text-xs font-semibold text-blue-800">${cloudDisplay}</td>
                    
                    <td class="px-4 py-3 text-xs">${t.tipo_solicitacao}</td>
                    <td class="px-4 py-3 text-xs uppercase text-gray-500">${t.ambiente}</td>
                    
                    <td class="px-4 py-3 text-xs text-gray-700">${subCatDisplay}</td>
                    
                    <td class="px-4 py-3 text-xs text-gray-600" title="${descricaoFull.replace(/"/g, '&quot;')}">${descricaoCurta}</td>
                    
                    <td class="px-4 py-3 text-xs">${analista}</td>
                    <td class="px-4 py-3 text-xs text-gray-500">${comentarioCurta}</td>
                    
                    <td class="px-4 py-3 text-xs ${prioColor}">${t.prioridade}</td>
                    <td class="px-4 py-3"><span class="px-2 py-1 rounded-full text-xs font-semibold ${statusBadge}">${t.status}</span></td>
                    
                    <td class="px-4 py-3 text-xs text-gray-500">${dataAbertura}</td>
                    <td class="px-4 py-3 text-xs text-gray-500">${dataConclusao}</td>
                    
                    <td class="px-4 py-3 text-center">${btnAction}</td>
                </tr>
            `;
        }).join('');

    } catch (e) { 
        console.error("Erro ao carregar tabela:", e);
        tbody.innerHTML = '<tr><td colspan="14" class="text-center p-4 text-red-500">Erro ao carregar dados.</td></tr>';
    }
}
window.abrirModalEdicaoEngenharia = async (ticketId) => {
    // 1. Encontra ticket
    const ticket = currentTicketsCache.find(t => t.id === ticketId);
    if (!ticket) return alert("Erro ao carregar dados do ticket.");

    // Helper para setar valor
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) {
            if (el.tagName === 'SPAN' || el.tagName === 'DIV') el.innerText = val;
            else el.value = val;
        }
    };

    // 2. Preenche campos básicos
    setVal('edit-eng-id', ticket.id);
    setVal('edit-eng-id-display', ticket.id);
    
    const nomeCompleto = `${ticket.cliente_nome || ''} ${ticket.cliente_sobrenome || ''}`.trim();
    setVal('edit-eng-email-display', nomeCompleto || 'Cliente Desconhecido');
    
    const dataCriacao = ticket.data_abertura || ticket.data_criacao;
    setVal('edit-eng-data-display', dataCriacao ? new Date(dataCriacao).toLocaleString('pt-BR') : '-');
    
    setVal('edit-eng-tipo', ticket.tipo_solicitacao);
    setVal('edit-eng-ambiente', ticket.ambiente);
    setVal('edit-eng-prioridade', ticket.prioridade);
    setVal('edit-eng-descricao', ticket.descricao);
    setVal('edit-eng-comentario', ticket.comentario_tecnico || '');
    setVal('edit-eng-sla', ticket.sla_estimado || '');

    // --- STATUS (COM TRADUÇÃO DE LEGADO) ---
    const statusSelect = document.getElementById('edit-eng-status');
    if (statusSelect) {
        let statusParaExibir = ticket.status;

        // Mapeia nomes antigos para os novos visualmente
        if (statusParaExibir === 'Em Analise' || statusParaExibir === 'Em Análise') {
            statusParaExibir = 'Em Atendimento';
        } else if (statusParaExibir === 'Desenvolvimento' || statusParaExibir === 'Em Desenvolvimento') {
            statusParaExibir = 'Reaberto';
        }

        statusSelect.value = statusParaExibir;
    }

    // --- Lógica de Anexo ---
    const linkContainer = document.getElementById('edit-eng-current-attachment-container');
    const linkSpan = document.getElementById('edit-eng-current-attachment-link');
    const removeInput = document.getElementById('edit-eng-remove-anexo');
    const fileInput = document.getElementById('edit-eng-anexo');
    const btnRemoveAnexo = document.getElementById('btn-remove-anexo-eng');

    // Reseta estado do anexo
    if(fileInput) fileInput.value = ''; 
    if(removeInput) removeInput.value = '0';
    if(linkContainer) linkContainer.classList.add('hidden');

    if (ticket.anexo_path && linkContainer && linkSpan) {
        let webPath = ticket.anexo_path.replace(/\\/g, '/');
        if (webPath.startsWith('/')) webPath = webPath.substring(1);
        if (!webPath.startsWith('public/')) webPath = 'public/' + webPath;
        webPath = '/' + webPath;

        linkSpan.innerHTML = `<a href="${webPath}" target="_blank" class="text-blue-600 hover:underline flex items-center gap-2"><i class="fa-solid fa-paperclip"></i> Ver Anexo Atual</a>`;
        linkContainer.classList.remove('hidden');
    }

    if(btnRemoveAnexo) {
        btnRemoveAnexo.onclick = () => {
            linkContainer.classList.add('hidden');
            removeInput.value = '1';
        };
    }

    // 3. CASCATA (Popula os Selects)
    const cloudSel = document.getElementById('edit-eng-cloud');
    const catSel = document.getElementById('edit-eng-categoria');
    const subSel = document.getElementById('edit-eng-subcategoria');
    const servSel = document.getElementById('edit-eng-servico');

    if (cloudSel) {
        cloudSel.value = ticket.cloud || 'Oracle';
        
        // Carrega Categorias
        if(ticket.cloud) {
            try {
                const cats = await fetch(`/api/engineering/catalog-options?cloud=${encodeURIComponent(ticket.cloud)}`).then(r=>r.json());
                populateSelect(catSel, cats, 'categoria', 'categoria', 'Selecione');
                if(catSel) catSel.value = ticket.categoria;
            } catch(e) { console.error(e); }
        }

        // Carrega Subcategorias
        if(ticket.cloud && ticket.categoria) {
            try {
                const subs = await fetch(`/api/engineering/catalog-options?cloud=${encodeURIComponent(ticket.cloud)}&categoria=${encodeURIComponent(ticket.categoria)}`).then(r=>r.json());
                populateSelect(subSel, subs, 'sub_categoria', 'sub_categoria', 'Selecione');
                if(subSel) subSel.value = ticket.sub_categoria;
            } catch(e) { console.error(e); }
        }

        // Carrega Serviços
        if(ticket.cloud && ticket.categoria && ticket.sub_categoria) {
            try {
                const servs = await fetch(`/api/engineering/catalog-options?cloud=${encodeURIComponent(ticket.cloud)}&categoria=${encodeURIComponent(ticket.categoria)}&sub_categoria=${encodeURIComponent(ticket.sub_categoria)}`).then(r=>r.json());
                populateSelect(servSel, servs, 'id', 'servico', 'Selecione', 'sla');
                if(servSel) servSel.value = ticket.catalog_item_id;
            } catch(e) { console.error(e); }
        }
    }

    // 4. Analistas
    const analistaSelect = document.getElementById('edit-eng-analista');
    if (analistaSelect) {
        analistaSelect.innerHTML = '<option value="">-- Selecione --</option>';
        if (engineersListCache && engineersListCache.length > 0) {
            engineersListCache.forEach(eng => {
                const opt = document.createElement('option');
                opt.value = eng.id;
                opt.textContent = `${eng.nome} ${eng.sobre || ''}`;
                analistaSelect.appendChild(opt);
            });
        }
        analistaSelect.value = ticket.engenheiro_id || "";
    }

    // Botão de Deletar
    const btnDeleteEng = document.getElementById('btn-delete-eng-ticket');
    if (btnDeleteEng) {
        const canDelete = currentUser && (['admin', 'gerente', 'engenharia'].includes(currentUser.perfil));
        btnDeleteEng.classList.toggle('hidden', !canDelete);
    }

    // ============================================================
    // 5. LÓGICA DE TRAVA E REABERTURA (INTEGRADA)
    // ============================================================
    
    const modalContainer = document.getElementById('modalEditEngTicket');
    const btnSalvar = document.getElementById('btn-save-eng-ticket');
    const inputs = modalContainer.querySelectorAll('input, select, textarea');

    const toggleLock = (isLocked) => {
        inputs.forEach(el => {
            if (el.id === 'edit-eng-status') return; // Status nunca bloqueia
            el.disabled = isLocked;
            if (isLocked) el.classList.add('bg-gray-100', 'cursor-not-allowed');
            else el.classList.remove('bg-gray-100', 'cursor-not-allowed');
        });

        if (isLocked) {
            if (btnSalvar) btnSalvar.classList.add('hidden');
            if (btnRemoveAnexo) btnRemoveAnexo.classList.add('hidden');
        } else {
            if (btnSalvar) btnSalvar.classList.remove('hidden');
            if (btnRemoveAnexo) btnRemoveAnexo.classList.remove('hidden');
        }

        const msgId = 'aviso-ticket-resolvido';
        const existingMsg = document.getElementById(msgId);
        if (existingMsg) existingMsg.remove();

        if (isLocked) {
            const msg = document.createElement('div');
            msg.id = msgId;
            msg.className = 'bg-blue-50 border-l-4 border-blue-500 text-blue-700 p-4 mb-6 rounded shadow-sm mx-6 mt-6';
            msg.innerHTML = `
                <div class="flex items-center">
                    <i class="fa-solid fa-lock mr-2 text-xl"></i>
                    <div>
                        <p class="font-bold">Ticket Finalizado</p>
                        <p class="text-sm">Para editar este ticket, altere o status para <b>Reaberto</b>.</p>
                    </div>
                </div>
            `;
            const targetInsert = modalContainer.querySelector('.p-6') || modalContainer.querySelector('form') || modalContainer;
            targetInsert.prepend(msg);
        }
    };

    // Estado Inicial: Verifica status original
    if (ticket.status === 'Resolvido') {
        toggleLock(true);
    } else {
        toggleLock(false);
    }

    // Listener de Mudança de Status
    if (statusSelect) {
        // Remove listeners antigos para evitar duplicação
        const newSelect = statusSelect.cloneNode(true);
        statusSelect.parentNode.replaceChild(newSelect, statusSelect);
        
        newSelect.onchange = (e) => {
            const novoStatus = e.target.value;
            // Verifica status original
            if (ticket.status === 'Resolvido') {
                if (novoStatus === 'Reaberto') {
                    toggleLock(false); // Libera
                } else {
                    toggleLock(true); // Bloqueia
                }
            }
        };
    }

    toggleModal('modalEditEngTicket', true);
};
function atualizarCardsEngenharia(tickets) {
    // Conta cada status separadamente (Somando Novos e Antigos para compatibilidade)
    const total = tickets.length;
    const abertos = tickets.filter(t => t.status === 'Aberto').length;
    
    // Azul: Em Atendimento + Em Análise (Antigo)
    const atendimento = tickets.filter(t => t.status === 'Em Atendimento' || t.status === 'Em Analise' || t.status === 'Em Análise').length;
    
    // Roxo: Reaberto + Desenvolvimento (Antigo)
    const reaberto = tickets.filter(t => t.status === 'Reaberto' || t.status === 'Desenvolvimento').length;
    
    const resolvidos = tickets.filter(t => t.status === 'Resolvido').length;

    // Atualiza o HTML
    if(document.getElementById('card-eng-total')) document.getElementById('card-eng-total').innerText = total;
    if(document.getElementById('card-eng-aberto')) document.getElementById('card-eng-aberto').innerText = abertos;
    
    // Atualiza o card Azul
    if(document.getElementById('card-eng-analise')) document.getElementById('card-eng-analise').innerText = atendimento;
    
    // Atualiza o card Roxo
    if(document.getElementById('card-eng-dev')) document.getElementById('card-eng-dev').innerText = reaberto;
    
    if(document.getElementById('card-eng-resolvido')) document.getElementById('card-eng-resolvido').innerText = resolvidos;
}

// Global para o HTML acessar
window.abrirModalResolucao = (id, titulo, desc, status) => {
    document.getElementById('res-eng-id').innerText = id;
    document.getElementById('res-eng-id-input').value = id;
    document.getElementById('res-eng-desc-orig').innerText = desc;
    document.getElementById('res-eng-status').value = status;
    toggleModal('modalResolveEngTicket', true);
};
function setupEngineeringForms() {
    // ==========================================
    // 1. FORMULÁRIO DE CRIAÇÃO (CLIENTE) - COM ANEXO
    // ==========================================
    const formCreate = document.getElementById('formCreateEngTicket');
    if (formCreate) {
        formCreate.onsubmit = async (e) => {
            e.preventDefault();
            
            const btn = formCreate.querySelector('button[type="submit"]');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Enviando...';

            try {

                const formData = new FormData();
                
   
                formData.append('tipo_solicitacao', document.getElementById('eng-tipo').value);
                formData.append('ambiente', document.getElementById('eng-ambiente').value);
                formData.append('catalog_item_id', document.getElementById('eng-servico').value);
                formData.append('prioridade', document.getElementById('eng-prioridade').value);
                formData.append('descricao', document.getElementById('eng-descricao').value);

                const fileInput = document.getElementById('eng-anexo-create');
                if (fileInput && fileInput.files.length > 0) {
                    formData.append('anexo', fileInput.files[0]);
                }

                const res = await fetch('/api/engineering/create', {
                    method: 'POST',
                    body: formData 
                });
                
                const result = await res.json();

                if (res.ok) {
                    toggleModal('modalCreateEngTicket', false);
                    formCreate.reset();
                    if(fileInput) fileInput.value = '';
                    
                    if(typeof resetDropdownsToInitialState === 'function') resetDropdownsToInitialState();
                    
                    showStatusModal('Sucesso', 'Solicitação aberta com sucesso!', false);
                    carregarTicketsEngenharia();
                } else {
                    showStatusModal('Erro', result.message || 'Erro ao criar solicitação.', true);
                }
            } catch (err) {
                console.error(err);
                showStatusModal('Erro', 'Erro de conexão.', true);
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        };
    }

    const formEdit = document.getElementById('formEditEngTicket');
    if (formEdit) {
        formEdit.onsubmit = async (e) => {
            e.preventDefault();
            
            const id = document.getElementById('edit-eng-id').value;
            const btn = formEdit.querySelector('button[type="submit"]');
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Salvando...';
            
            const formData = new FormData();

            formData.append('status', document.getElementById('edit-eng-status').value);
            formData.append('engenheiro_id', document.getElementById('edit-eng-analista').value);
            formData.append('comentario_tecnico', document.getElementById('edit-eng-comentario').value);
            formData.append('tipo_solicitacao', document.getElementById('edit-eng-tipo').value);
            formData.append('ambiente', document.getElementById('edit-eng-ambiente').value);
            formData.append('prioridade', document.getElementById('edit-eng-prioridade').value);
            formData.append('descricao', document.getElementById('edit-eng-descricao').value);
            formData.append('catalog_item_id', document.getElementById('edit-eng-servico').value);
            
            const removeAnexoVal = document.getElementById('edit-eng-remove-anexo')?.value || "0";
            formData.append('remove_anexo', removeAnexoVal);

            const fileInput = document.getElementById('edit-eng-anexo');
            if (fileInput && fileInput.files.length > 0) {
                formData.append('anexo', fileInput.files[0]);
            }

            try {
                const res = await fetch(`/api/engineering/ticket/${id}`, {
                    method: 'PUT',
                    body: formData 
                });
                
                let result;
                try { result = await res.json(); } catch(e) { result = {}; }

                if (res.ok) {
                    toggleModal('modalEditEngTicket', false);
                    showStatusModal('Sucesso', 'Ticket atualizado com sucesso!', false);
                    carregarTicketsEngenharia();
                } else {
                    showStatusModal('Erro', result.message || 'Erro ao atualizar.', true);
                }
            } catch (err) { 
                console.error(err); 
                showStatusModal('Erro', 'Erro de conexão.', true);
            } finally {
                btn.disabled = false;
                btn.textContent = originalText;
            }
        };
    }
}
function setupEngineeringFilters() {
    // Lista de IDs dos filtros e ordenação
    const ids = [
        'filter-eng-tipo', 
        'filter-eng-status', 
        'filter-eng-prioridade', 
        'eng-ordenar'
    ];

    ids.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
          
            element.addEventListener('change', () => {
                carregarTicketsEngenharia();
            });
        }
    });
}

// Torna a função acessível globalmente para o onclick do HTML
window.abrirModalResolucao = (id, desc, status) => {
    document.getElementById('res-eng-id').innerText = id;
    document.getElementById('res-eng-id-input').value = id;
    document.getElementById('res-eng-desc-orig').innerText = desc;
    document.getElementById('res-eng-status').value = status;
    toggleModal('modalResolveEngTicket', true);
};



    addOptionButtonListeners('ticket-area', 'btn-delete-area-selecionada');
    addOptionButtonListeners('ticket-grupo', 'btn-delete-grupo-selecionado');
    addOptionButtonListeners('ticket-tipo', 'btn-delete-tipo-selecionado');
    addOptionButtonListeners('ticket-prioridade', 'btn-delete-prioridade-selecionada');
    addOptionButtonListeners('ticket-alerta', 'btn-delete-alerta-selecionado', 'btn-edit-alerta-selecionado');


    addOptionButtonListeners('edit-ticket-area', 'btn-delete-area-selecionada-edit');
    addOptionButtonListeners('edit-ticket-grupo', 'btn-delete-grupo-selecionado-edit');
    addOptionButtonListeners('edit-ticket-tipo', 'btn-delete-tipo-selecionado-edit');
    addOptionButtonListeners('edit-ticket-prioridade', 'btn-delete-prioridade-selecionado-edit');
    addOptionButtonListeners('edit-ticket-alerta', 'btn-delete-alerta-selecionado-edit');
    addOptionButtonListeners('ticket-status', 'btn-delete-status-selecionado');
    btnDeleteStatus?.addEventListener('click', () => {
        handleDeleteOption('status', 'ticket-status', (val) => statusIdToDelete = val, 'modalConfirmarDeleteStatus');
    });

    document.getElementById('ordenarPor')?.addEventListener('change', () => carregarTickets(1));


    loadColumnConfig();
criarSeletorItensPorPagina();
(async function initSystem() {
    loadColumnConfig();
    if(typeof criarSeletorItensPorPagina === 'function') criarSeletorItensPorPagina();

    try {
        const response = await fetch('/api/auth/session');
        if (!response.ok) {
            window.location.href = '/login';
            return;
        }
        currentUser = await response.json();
        
        // Atualiza UI do usuário
        const nomeUsuarioEl = document.getElementById('nome-usuario');
        if (nomeUsuarioEl) nomeUsuarioEl.textContent = `${currentUser.nome || ''} ${currentUser.sobrenome || ''}`.trim();
        
        if (document.getElementById('admin-menu') && currentUser.perfil === 'admin') {
            document.getElementById('admin-menu').classList.remove('hidden');
        }

        // === DECISÃO DE FLUXO ===
        // Se for Engenharia, Cliente ou 'user', vai para o novo painel
        if (currentUser.perfil === 'engenharia' || currentUser.perfil === 'cliente' || currentUser.perfil === 'user') {
            initEngineeringDashboard(currentUser);
        } else {
            // Fluxo Suporte/Admin/Gerente (Padrão Antigo)
            const painelSuporte = document.getElementById('dashboard-suporte');
            const painelEng = document.getElementById('dashboard-engenharia');
            
            if (painelSuporte) {
                painelSuporte.style.display = 'block';
                painelSuporte.classList.remove('hidden');
            }
            if (painelEng) {
                painelEng.style.display = 'none';
                painelEng.classList.add('hidden');
            }

            // Lógica do botão Sidebar para o fluxo antigo
            const sidebarBtn = document.getElementById('btn-sidebar-open-ticket');
            if(sidebarBtn) {
                // Garante o comportamento padrão
                const newBtn = sidebarBtn.cloneNode(true);
                sidebarBtn.parentNode.replaceChild(newBtn, sidebarBtn);
                newBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    toggleModal('modalTicket', true);
                });
            }
            
            // Carrega dados do suporte
            if (typeof popularDropdownsTicket === 'function') popularDropdownsTicket();
            if (typeof carregarInfoCards === 'function') carregarInfoCards();
            if (typeof carregarTickets === 'function') carregarTickets();
        }

    } catch (error) {
        console.error("Erro fatal na inicialização:", error);
    }
})();
function setupEngineeringDeleteListeners() {
    // 1. Clique no botão "Excluir" dentro do Modal de Edição
    const btnDelete = document.getElementById('btn-delete-eng-ticket');
    if (btnDelete) {
        btnDelete.addEventListener('click', (e) => {
            e.preventDefault();
            // Pega o ID do input hidden do formulário de edição
            const id = document.getElementById('edit-eng-id').value;
            if (id) {
                engTicketIdToDelete = id;
                toggleModal('modalEditEngTicket', false); // Fecha edição
                toggleModal('modalConfirmarDeleteEng', true); // Abre confirmação
            }
        });
    }

    // 2. Clique em "Cancelar" no Modal de Confirmação
    const btnCancel = document.getElementById('btn-cancel-delete-eng');
    if (btnCancel) {
        btnCancel.addEventListener('click', (e) => {
            e.preventDefault();
            engTicketIdToDelete = null;
            toggleModal('modalConfirmarDeleteEng', false);
            toggleModal('modalEditEngTicket', true); // Reabre a edição (opcional, boa UX)
        });
    }

    // 3. Clique em "Sim, Excluir" no Modal de Confirmação
    const btnConfirm = document.getElementById('btn-confirm-delete-eng');
    if (btnConfirm) {
        btnConfirm.addEventListener('click', async (e) => {
            e.preventDefault();
            if (!engTicketIdToDelete) return;

            // Feedback visual no botão
            const originalText = btnConfirm.innerHTML;
            btnConfirm.disabled = true;
            btnConfirm.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Excluindo...';

            try {
                const response = await fetch(`/api/engineering/ticket/${engTicketIdToDelete}`, {
                    method: 'DELETE'
                });
                const result = await response.json();

                if (response.ok) {
                    toggleModal('modalConfirmarDeleteEng', false);
                    showStatusModal('Sucesso', 'Ticket excluído com sucesso!', false);
                    await carregarTicketsEngenharia(); // Recarrega a tabela
                } else {
                    showStatusModal('Erro', result.message || 'Erro ao excluir ticket.', true);
                }
            } catch (error) {
                console.error(error);
                showStatusModal('Erro de Conexão', 'Não foi possível comunicar com o servidor.', true);
            } finally {
                btnConfirm.disabled = false;
                btnConfirm.innerHTML = originalText;
                engTicketIdToDelete = null;
            }
        });
    }
}

setupPasteFunctionality();

setupPasteFunctionality();
});