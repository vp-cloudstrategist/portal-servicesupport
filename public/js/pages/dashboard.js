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

    let currentAlertsList = [];
    let currentGruposList = [];
    let allUsersCache = [];
    let currentFilters = {};
    let currentAreasList = [];
    let currentTiposList = [];
    let currentPrioridadesList = [];
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

    // Não precisamos mais da função 'formatIsoToBr' aqui.

    toggleModal('modalEditarTicket', false);

    // 1. Abre o modal de novo ticket (que define os valores padrão para 'agora')
    abrirModalNovoTicket();

    // 2. Aguarda um instante para o modal ser renderizado
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log("Duplicando dados:", ticketAbertoParaEdicao);

    // 3. Sobrescreve os valores padrão com os dados do ticket original

    // --- INÍCIO DA CORREÇÃO ---

    // Pega os dados de data/hora formatados do ticket original
    const { date: alarmeInicioDate, time: alarmeInicioTime } = getFormattedDateTime(ticketAbertoParaEdicao.alarme_inicio);
    const { date: acionamentoDate, time: acionamentoTime } = getFormattedDateTime(ticketAbertoParaEdicao.horario_acionamento);

    // Define a DATA de Início do Alarme
    document.querySelector('#formAbrirTicket input[name="alarme_inicio_date"]').value = alarmeInicioDate;
    
    // Define a HORA de Início do Alarme (usando .imask.value)
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
    
    await popularFiltroCheckboxes('filtro-status-container', '/api/tickets/options/status', 'status');
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
            document.getElementById('password-rules-admin').innerHTML = '';
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

        const canManage = currentUser && (currentUser.perfil === 'admin' || currentUser.perfil === 'support');

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
                    <input type="checkbox" id="month-${index + 1}" name="months" value="${index + 1}" class="form-checkbox h-4 w-4 month-checkbox">
                    <label for="month-${index + 1}" class="ml-2 text-sm">${mes}</label>
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
    const formEditarTicket = document.getElementById('formEditarTicket');
    formEditarTicket.reset();

    try {
        const ticketResponse = await fetch(`/api/tickets/${ticketId}`);
        if (!ticketResponse.ok) throw new Error('Ticket não encontrado');
        const ticket = await ticketResponse.json();
        ticketAbertoParaEdicao = ticket;

        // Formata as datas que vêm do banco (esta parte está correta)
        const alarmeInicio = getFormattedDateTime(ticket.alarme_inicio);
        const horarioAcionamento = getFormattedDateTime(ticket.horario_acionamento);
        const alarmeFim = getFormattedDateTime(ticket.alarme_fim);

        // Preenche os campos de data (esta parte está correta)
        document.getElementById('edit-alarme-inicio-date').value = alarmeInicio.date;
        document.getElementById('edit-horario-acionamento-date').value = horarioAcionamento.date;
        document.getElementById('edit-alarme-fim-date').value = alarmeFim.date;
        
        // ===== CORREÇÃO AQUI =====
        // Não criamos uma nova máscara. Acessamos a máscara .imask que já existe
        // e definimos seu valor.
        
        const alarmeInicioTimeInput = document.getElementById('edit-alarme-inicio-time');
        if (alarmeInicioTimeInput.imask) {
            alarmeInicioTimeInput.imask.value = alarmeInicio.time;
        } else {
            // Fallback caso a máscara não tenha inicializado
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
        // ===== FIM DA CORREÇÃO =====

        // Preenche o resto do formulário...
        document.getElementById('edit-ticket-id').value = ticket.id;
        document.getElementById('edit-ticket-descricao').value = ticket.descricao;
        
        const statusItem = currentStatusList.find(s => s.nome === ticket.status);
        if (statusItem) {
            document.getElementById('edit-ticket-status').value = statusItem.id;
        }

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
        
        await new Promise(resolve => setTimeout(resolve, 150));

        document.getElementById('edit-ticket-tipo').value = ticket.tipo_solicitacao_id;
        document.getElementById('edit-ticket-prioridade').value = ticket.prioridade_id;
        document.getElementById('edit-ticket-grupo').value = ticket.grupo_id;
        document.getElementById('edit-ticket-alerta').value = ticket.alerta_id;
        
        const deleteButton = document.getElementById('btn-delete-ticket');
        if (deleteButton) {
            deleteButton.classList.toggle('hidden', !(currentUser && (currentUser.perfil === 'admin' || currentUser.perfil === 'support')));
        }

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
    if (pastedFileCreate && (!fileInput.files || fileInput.files.length === 0)) {
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
    // ALTERAÇÃO 2: Adicionando um console.log para diagnosticar o botão de deletar
    document.getElementById('btn-delete-ticket')?.addEventListener('click', () => {
        console.log("Botão Deletar Ticket clicado!"); // <-- LINHA DE TESTE
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
        const canManage = currentUser && (currentUser.perfil === 'admin' || currentUser.perfil === 'support');
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
    carregarDadosUsuario();
    popularDropdownsTicket();
    carregarInfoCards();
    carregarTickets();
    setupPasteFunctionality();
});