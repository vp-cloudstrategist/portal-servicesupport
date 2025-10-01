// Funções globais que podem ser chamadas pelo HTML
function toggleModal(modalId, show) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.toggle('hidden', !show);
    }
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


document.addEventListener('DOMContentLoaded', () => {

    let paginaAtual = 1;
    let ticketIdToDelete = null;
    let currentUser = null;
    let pastedFileCreate = null;
    let pastedFileEdit = null;
    
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
        { key: 'horario_acionamento', title: 'Acionamento', visible: true }, 
        { key: 'actions', title: 'Ações', visible: true }
    ];

    const ticketsTable = document.getElementById('tickets-table');
    const adminMenu = document.getElementById('admin-menu');
    const formCriarUsuario = document.getElementById('formCriarUsuario');
    const formCriarEmpresa = document.getElementById('formCriarEmpresa');
    const tabelaTicketsBody = ticketsTable?.querySelector('tbody');
    const formAbrirTicket = document.getElementById('formAbrirTicket');
    const formEditarTicket = document.getElementById('formEditarTicket');
    const btnCustomize = document.getElementById('btn-customize-view');
    const visibilityList = document.getElementById('column-visibility-list');
    const orderList = document.getElementById('column-order-list');

    const statusSelect = document.getElementById('edit-ticket-status');
    if (statusSelect) {
        statusSelect.addEventListener('change', (event) => {
            const newStatus = event.target.value;
            const fimAlarmeInput = document.getElementById('edit-alarme-fim');
            if (newStatus === 'Resolvido' || newStatus === 'Encerrado') {
                if (fimAlarmeInput) {
                    const now = new Date();
                    
                    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
                    const localDateTime = now.toISOString().slice(0, 16);
                    
                    fimAlarmeInput.value = localDateTime;
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


    // --- Funções de Customização de Coluna ---
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
                    case 'data_criacao':
                        cellValue = new Date(ticket.data_criacao).toLocaleDateString('pt-BR');
                        break;
                    case 'alarme_inicio':
                        cellValue = formatDateTime(ticket.alarme_inicio);
                        break;
                    case 'alarme_fim':
                        cellValue = formatDateTime(ticket.alarme_fim);
                        break;
                    case 'horario_acionamento':
                        cellValue = formatDateTime(ticket.horario_acionamento);
                        break;
                    case 'actions':
                        cellValue = `<button class="p-1 btn-edit-ticket" data-id="${ticket.id}"><img src="/images/editar.png" alt="Editar" class="w-5 h-5" /></button>`;
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
        const selectsDeEmpresa = document.querySelectorAll('.company-select-dropdown');
        if (selectsDeEmpresa.length === 0) return;

        try {
            const response = await fetch('/api/companies');
            if (!response.ok) throw new Error('Falha ao buscar empresas.');
            const companies = await response.json();

            selectsDeEmpresa.forEach(select => {
                select.innerHTML = '<option value="">-- Selecione uma empresa --</option>';
                companies.forEach(company => {
                    const option = document.createElement('option');
                    option.value = company.id;
                    option.textContent = company.name;
                    select.appendChild(option);
                });
                if (companies.length === 1) {
                    select.value = companies[0].id;
                }
            });
        } catch (error) {
            console.error(error);
            selectsDeEmpresa.forEach(select => {
                select.innerHTML = '<option value="">Erro ao carregar empresas</option>';
            });
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
    
        // Mapeia os selects e seus placeholders
        const selects = [
            { element: tipoSelect, placeholder: 'Selecione uma Área' },
            { element: prioridadeSelect, placeholder: 'Selecione uma Área' },
            { element: grupoSelect, placeholder: 'Selecione uma Área' },
            { element: alertaSelect, placeholder: 'Selecione uma Área' },
        ];
    
        // Reseta e desabilita todos os selects filhos
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
                const [tiposRes, prioridadesRes, gruposRes, alertasRes] = await Promise.all([
                    fetch(`/api/tickets/options/areas/${areaId}/tipos`),
                    fetch(`/api/tickets/options/areas/${areaId}/prioridades`),
                    fetch(`/api/tickets/options/areas/${areaId}/grupos`),
                    fetch(`/api/tickets/options/areas/${areaId}/alertas`)
                ]);
    
                if (!tiposRes.ok || !prioridadesRes.ok || !gruposRes.ok || !alertasRes.ok) {
                    throw new Error('Falha ao buscar dados dependentes da área.');
                }
                
                const [tipos, prioridades, grupos, alertas] = await Promise.all([
                    tiposRes.json(),
                    prioridadesRes.json(),
                    gruposRes.json(),
                    alertasRes.json()
                ]);
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
        try {
            const response = await fetch(`/api/tickets?pagina=${paginaAtual}&limite=${porPagina}&ordenar=${criterio}`);
            if (!response.ok) throw new Error('Falha ao carregar tickets');
            const dados = await response.json();
            renderTable(dados.tickets);
            atualizarPaginacao(dados.total, dados.pagina, porPagina);
        } catch (error) {
            console.error("Erro em carregarTickets:", error);
            const tbody = ticketsTable?.querySelector('tbody');
            if (tbody) tbody.innerHTML = `<tr><td colspan="7" class="text-center text-red-500 p-4">Erro ao carregar dados. Verifique o console.</td></tr>`;
        }
    }

    function atualizarPaginacao(total, pagina, porPagina) {
        const container = document.getElementById('paginacao');
        if (!container) return;
        container.innerHTML = '';
        const totalPaginas = Math.ceil(total / porPagina);

        if (totalPaginas <= 1) return; 

        for (let i = 1; i <= totalPaginas; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.className = 'border px-3 py-1 rounded-md mx-1 text-sm ' + (i === pagina ? 'bg-blue-600 text-white font-bold' : 'bg-white hover:bg-gray-100');
            btn.onclick = () => carregarTickets(i);
            container.appendChild(btn);
        }
    }

  async function abrirModalEditar(ticketId) {
    pastedFileEdit = null;
    const preview = document.getElementById('paste-preview-edit');
    if(preview) preview.innerHTML = '';

    try {
        const response = await fetch(`/api/tickets/${ticketId}`);
        if (!response.ok) throw new Error('Ticket não encontrado');
        const ticket = await response.json();

        const formatForInput = (dateString) => {
            if (!dateString) return '';
            const date = new Date(dateString);
            date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
            return date.toISOString().slice(0, 16);
        };
        
        // Preenche os campos simples
        document.getElementById('edit-ticket-id').value = ticket.id;
        document.getElementById('edit-ticket-status').value = ticket.status;
        document.getElementById('edit-ticket-descricao').value = ticket.descricao;
        document.getElementById('edit-alarme-inicio').value = formatForInput(ticket.alarme_inicio);
        document.getElementById('edit-alarme-fim').value = formatForInput(ticket.alarme_fim);
        document.getElementById('edit-horario-acionamento').value = formatForInput(ticket.horario_acionamento);
        
        const linkContainer = document.getElementById('current-attachment-container');
        const linkSpan = document.getElementById('current-attachment-link');
        const removeAnexoInput = document.getElementById('edit-remove-anexo');
        removeAnexoInput.value = '0';
        linkContainer.classList.add('hidden');
        if (ticket.anexo_path) {
            const webPath = ticket.anexo_path.replace('public\\', '').replace(/\\/g, '/');
            linkSpan.innerHTML = `Anexo atual: <a href="/${webPath}" target="_blank" class="text-blue-600 hover:underline">Ver Arquivo</a>`;
            linkContainer.classList.remove('hidden');
        }

        // Define a Área primeiro
        const areaSelect = document.getElementById('edit-ticket-area');
        areaSelect.value = ticket.area_id;

        // CHAMA a função handleAreaChange com TODOS os campos dependentes e ESPERA a conclusão
        await handleAreaChange(areaSelect, 'edit-ticket-tipo', 'edit-ticket-prioridade', 'edit-ticket-grupo', 'edit-ticket-alerta');
    
        // SÓ DEPOIS que os campos foram populados, seleciona os valores corretos
        document.getElementById('edit-ticket-tipo').value = ticket.tipo_solicitacao_id;
        document.getElementById('edit-ticket-prioridade').value = ticket.prioridade_id; // Corrigido para prioridade_id
        document.getElementById('edit-ticket-grupo').value = ticket.grupo_id;
        document.getElementById('edit-ticket-alerta').value = ticket.alerta_id;

        // Lógica do botão de deletar
        const deleteButton = document.getElementById('btn-delete-ticket');
        if (deleteButton) {
            if (currentUser && currentUser.perfil === 'admin') {
                deleteButton.classList.remove('hidden');
            } else {
                deleteButton.classList.add('hidden');
            }
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
    document.getElementById('logout-button')?.addEventListener('click', () => toggleModal('modalConfirmarLogout', true));
    document.getElementById('logout-menu-button')?.addEventListener('click', () => toggleModal('modalConfirmarLogout', true));
    document.getElementById('confirm-logout-button')?.addEventListener('click', logout);
    document.getElementById('cancel-logout-button')?.addEventListener('click', () => toggleModal('modalConfirmarLogout', false));

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

    // Formulários de Criação
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
                    carregarEmpresas();
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
        selectPerfil?.addEventListener('change', () => {
            const perfil = selectPerfil.value;
            document.getElementById('campos-user').classList.toggle('hidden', perfil !== 'user');
            document.getElementById('campos-support').classList.toggle('hidden', perfil !== 'support' && perfil !== 'admin');
            document.getElementById('botao-salvar-container').classList.toggle('hidden', !perfil);
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

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailInput || !emailRegex.test(emailInput)) {
                return showStatusModal('Erro de Validação', 'Por favor, insira um formato de e-mail válido.', true);
            }
            if (perfil === 'user' && !data.company_id) {
                return showStatusModal('Erro de Validação', 'Por favor, selecione uma empresa.', true);
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

    // Eventos de Tickets e Customização
    btnCustomize?.addEventListener('click', () => {
        populateCustomizerModal();
        toggleModal('modalColumnCustomizer', true);
    });

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
    
    formAbrirTicket?.addEventListener('submit', async (event) => {
        event.preventDefault();
        const formData = new FormData(formAbrirTicket);

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
            toggleModal('modalEditarTicket', false);
            if (response.ok) {
                showStatusModal('Sucesso!', result.message, false);
                carregarTickets(paginaAtual);
                carregarInfoCards(); 
            } else {
                showStatusModal('Erro!', result.message, true);
            }
        } catch (error) {
            toggleModal('modalEditarTicket', false);
            showStatusModal('Erro de Conexão', 'Não foi possível salvar as alterações.', true);
        } finally {
            pastedFileEdit = null;
            const preview = document.getElementById('paste-preview-edit');
            if(preview) preview.innerHTML = '';
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
    document.getElementById('qtdPorPagina')?.addEventListener('change', () => carregarTickets(1));

    // =======================================================
    // CHAMADAS INICIAIS
    // =======================================================
    loadColumnConfig();
    carregarDadosUsuario();
    carregarEmpresas();
    popularDropdownsTicket();
    carregarInfoCards();
    carregarTickets();
    setupPasteFunctionality(); // NOVO: Ativa a funcionalidade de colar
});