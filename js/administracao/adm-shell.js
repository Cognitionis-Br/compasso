// =============================================================================
// administracao/adm-shell.js
// Motor do módulo ADM (Fase 1A · A1).
//
// Responsabilidades:
//   - ADM_CONFIG: catálogo das 3 superfícies, 16 famílias e 30 VIEWs (D-13)
//   - renderAdmView(tabId): surface home ou VIEW skeleton (chamado por switchTab)
//   - Tab bar CMP-ADM-01: abas horizontais por família
//   - 6 estados por VIEW (QA-ADM-07): Loading, Empty, Content, Error, SemPermissao, NA
//   - Redirects legados: tabs antigos → novos IDs canônicos
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// Configuração (D-13)
// ─────────────────────────────────────────────────────────────────────────────

const ADM_CONFIG = {
    surfaces: [
        {
            id: 'cadastros',
            tabId: 'cadastros_home',
            label: 'Cadastros',
            icon: 'fa-solid fa-database',
            route: '/cadastros',
            families: [
                {
                    id: 'estrutura-organizacional',
                    label: 'Estrutura Organizacional',
                    icon: 'fa-solid fa-sitemap',
                    views: [
                        { tabId: 'cad_org',      label: 'Organização',    viewId: 'VIEW-CAD-ORG',    api: 'cad-org' },
                        { tabId: 'cad_cargos',   label: 'Cargos',         viewId: 'VIEW-CAD-CARGOS', api: 'cad-cargos' },
                    ]
                },
                {
                    id: 'pessoas-e-entidades',
                    label: 'Pessoas e Entidades',
                    icon: 'fa-solid fa-users',
                    views: [
                        { tabId: 'cad_pessoas',      label: 'Pessoas',       viewId: 'VIEW-CAD-PESSOAS',      api: 'cad-pessoas' },
                        { tabId: 'cad_fornecedores', label: 'Fornecedores',  viewId: 'VIEW-CAD-FORNECEDORES', api: 'cad-fornecedores' },
                    ]
                },
                {
                    id: 'portfolio-e-projetos',
                    label: 'Portfólio e Projetos',
                    icon: 'fa-solid fa-diagram-project',
                    views: [
                        { tabId: 'cad_portes',         label: 'Portes',           viewId: 'VIEW-CAD-PORTES',         api: 'cad-portes' },
                        { tabId: 'cad_classificacoes', label: 'Classificações',   viewId: 'VIEW-CAD-CLASSIFICACOES', api: 'cad-classificacoes' },
                    ]
                },
                {
                    id: 'estrategia',
                    label: 'Estratégia',
                    icon: 'fa-solid fa-bullseye',
                    views: [
                        { tabId: 'cad_estrategia', label: 'Pilares e Iniciativas', viewId: 'VIEW-CAD-ESTRATEGIA', api: 'cad-estrategia' },
                    ]
                },
            ]
        },
        {
            id: 'administracao',
            tabId: 'administracao_home',
            label: 'Administração',
            icon: 'fa-solid fa-user-shield',
            route: '/administracao',
            families: [
                {
                    id: 'acesso-e-seguranca',
                    label: 'Acesso e Segurança',
                    icon: 'fa-solid fa-key',
                    views: [
                        { tabId: 'adm_usuarios', label: 'Usuários',  viewId: 'VIEW-ADM-USUARIOS', api: 'adm-usuarios' },
                        { tabId: 'adm_perfis',   label: 'Perfis',    viewId: 'VIEW-ADM-PERFIS',   api: 'adm-perfis' },
                        { tabId: 'adm_sessoes',  label: 'Sessões',   viewId: 'VIEW-ADM-SESSOES',  api: 'adm-sessoes' },
                    ]
                },
                {
                    id: 'organizacao-do-trabalho',
                    label: 'Organização do Trabalho',
                    icon: 'fa-solid fa-people-group',
                    views: [
                        { tabId: 'adm_equipes',  label: 'Equipes',  viewId: 'VIEW-ADM-EQUIPES',  api: 'adm-equipes' },
                        { tabId: 'adm_aptidoes', label: 'Aptidões', viewId: 'VIEW-ADM-APTIDOES', api: 'adm-aptidoes' },
                    ]
                },
                {
                    id: 'governanca-de-autoridade',
                    label: 'Governança de Autoridade',
                    icon: 'fa-solid fa-scale-balanced',
                    views: [
                        { tabId: 'adm_alcadas',    label: 'Alçadas',     viewId: 'VIEW-ADM-ALCADAS',    api: 'adm-alcadas' },
                        { tabId: 'adm_delegacoes', label: 'Delegações',  viewId: 'VIEW-ADM-DELEGACOES', api: 'adm-delegacoes' },
                        { tabId: 'adm_sod',        label: 'Segregação',  viewId: 'VIEW-ADM-SOD',        api: 'adm-sod' },
                    ]
                },
                {
                    id: 'processos-e-sla',
                    label: 'Processos e SLA',
                    icon: 'fa-solid fa-gears',
                    views: [
                        { tabId: 'adm_workflow', label: 'Workflows', viewId: 'VIEW-ADM-WORKFLOW', api: 'adm-workflow' },
                        { tabId: 'adm_sla',      label: 'SLA',       viewId: 'VIEW-ADM-SLA',      api: 'adm-sla' },
                    ]
                },
                {
                    id: 'integracoes-e-operacao',
                    label: 'Integrações e Operação',
                    icon: 'fa-solid fa-plug',
                    views: [
                        { tabId: 'adm_integracoes', label: 'Integrações', viewId: 'VIEW-ADM-INTEGRACOES', api: 'adm-integracoes' },
                    ]
                },
                {
                    id: 'auditoria',
                    label: 'Auditoria',
                    icon: 'fa-solid fa-shield-halved',
                    views: [
                        { tabId: 'adm_auditoria', label: 'Auditoria', viewId: 'VIEW-ADM-AUDITORIA', api: 'adm-auditoria' },
                    ]
                },
            ]
        },
        {
            id: 'configuracoes_scr25',
            tabId: 'configuracoes_home',
            label: 'Configurações',
            icon: 'fa-solid fa-sliders',
            route: '/configuracoes',
            families: [
                {
                    id: 'organizacao-e-licenca',
                    label: 'Organização e Licença',
                    icon: 'fa-solid fa-building',
                    views: [
                        { tabId: 'cfg_organizacao', label: 'Organização', viewId: 'VIEW-CFG-ORGANIZACAO', api: 'cfg-organizacao' },
                        { tabId: 'cfg_licenca',     label: 'Licença',     viewId: 'VIEW-CFG-LICENCA',     api: 'cfg-licenca' },
                    ]
                },
                {
                    id: 'planejamento-e-projetos',
                    label: 'Planejamento e Projetos',
                    icon: 'fa-solid fa-calendar-days',
                    views: [
                        { tabId: 'cfg_fy',          label: 'Ano Fiscal',   viewId: 'VIEW-CFG-FY',          api: 'cfg-fy' },
                        { tabId: 'cfg_estimativas', label: 'Estimativas',  viewId: 'VIEW-CFG-ESTIMATIVAS', api: 'cfg-estimativas' },
                        { tabId: 'cfg_ratecards',   label: 'Rate Cards',   viewId: 'VIEW-CFG-RATECARDS',   api: 'cfg-ratecards' },
                    ]
                },
                {
                    id: 'financeiro',
                    label: 'Financeiro',
                    icon: 'fa-solid fa-coins',
                    views: [
                        { tabId: 'cfg_financeiro', label: 'Políticas Financeiras', viewId: 'VIEW-CFG-FINANCEIRO', api: 'cfg-financeiro' },
                    ]
                },
                {
                    id: 'comunicacao',
                    label: 'Comunicação',
                    icon: 'fa-solid fa-envelope',
                    views: [
                        { tabId: 'cfg_notificacoes', label: 'Notificações', viewId: 'VIEW-CFG-NOTIFICACOES', api: 'cfg-notificacoes' },
                        { tabId: 'cfg_eventos',      label: 'Eventos',      viewId: 'VIEW-CFG-EVENTOS',      api: 'cfg-eventos' },
                        { tabId: 'cfg_templates',    label: 'Templates',    viewId: 'VIEW-CFG-TEMPLATES',    api: 'cfg-templates' },
                    ]
                },
                {
                    id: 'inteligencia-artificial',
                    label: 'Inteligência Artificial',
                    icon: 'fa-solid fa-robot',
                    views: [
                        { tabId: 'cfg_ia', label: 'IA', viewId: 'VIEW-CFG-IA', api: 'cfg-ia' },
                    ]
                },
                {
                    id: 'parametros-do-sistema',
                    label: 'Parâmetros do Sistema',
                    icon: 'fa-solid fa-wrench',
                    views: [
                        { tabId: 'cfg_parametros', label: 'Parâmetros', viewId: 'VIEW-CFG-PARAMETROS', api: 'cfg-parametros' },
                    ]
                },
            ]
        },
    ]
};

// Mapa plano: tabId → { view, family, surface }
const _admViewMap = (() => {
    const m = {};
    for (const surface of ADM_CONFIG.surfaces) {
        for (const family of surface.families) {
            for (const view of family.views) {
                m[view.tabId] = { view, family, surface };
            }
        }
        m[surface.tabId] = { surface, isSurfaceHome: true };
    }
    return m;
})();

// Mapa de redirects legados → tabId canônico
const ADM_LEGACY_MAP = {
    areas:                        'cad_org',
    cargos:                       'cad_cargos',
    pessoas_solicitantes:         'cad_pessoas',
    empresas_terceirizadas:       'cad_fornecedores',
    portes:                       'cad_portes',
    tipos_projeto:                'cad_classificacoes',
    produtos:                     'cad_classificacoes',
    return_benefit:               'cad_classificacoes',
    planejamento_estrategico:     'cad_estrategia',
    usuarios:                     'adm_usuarios',
    funcoes_permissoes:           'adm_perfis',
    atribuicao_funcoes:           'adm_usuarios',
    restricao_area_atividades:    'adm_perfis',
    responsaveis:                 'adm_equipes',
    workflow_etapas:              'adm_workflow',
    prazos:                       'adm_sla',
    auditoria:                    'adm_auditoria',
    controle_orcamento:           'cfg_financeiro',
    percentual_bloqueio_orcamento:'cfg_financeiro',
    periodo_ano_fiscal:           'cfg_fy',
    gestao_templates:             'cfg_templates',
    gestao_fluxo_email:           'cfg_eventos',
    fila_email:                   'adm_integracoes',
    ia_templates:                 'cfg_ia',
    ia_config:                    'cfg_ia',
    configuracoes:                'cfg_organizacao',
};

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function _admIsAdmTab(tabId) {
    return tabId in _admViewMap || tabId in ADM_LEGACY_MAP;
}

function _admResolveTab(tabId) {
    if (tabId in ADM_LEGACY_MAP) return ADM_LEGACY_MAP[tabId];
    return tabId;
}

// ─────────────────────────────────────────────────────────────────────────────
// Renderização da Surface Home (ADM-Home)
// ─────────────────────────────────────────────────────────────────────────────

function _renderSurfaceHome(surface) {
    const familyCards = surface.families.map(family => {
        const firstView = family.views[0];
        const viewCount = family.views.length;
        const badge = viewCount > 1
            ? `<span class="text-[10px] text-gray-400">${viewCount} telas</span>`
            : '';
        return `
        <button onclick="switchTab('${firstView.tabId}')"
                class="group flex flex-col gap-2 p-4 bg-white border border-gray-200 rounded-lg
                       hover:border-indigo-300 hover:shadow-sm text-left transition-all">
            <div class="flex items-center justify-between">
                <div class="w-8 h-8 rounded-md bg-indigo-50 group-hover:bg-indigo-100 flex items-center justify-center transition-colors">
                    <i class="${family.icon} text-indigo-500 text-sm"></i>
                </div>
                ${badge}
            </div>
            <div>
                <div class="text-sm font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors">
                    ${family.label}
                </div>
                <div class="text-xs text-gray-400 mt-0.5">
                    ${family.views.map(v => v.label).join(' · ')}
                </div>
            </div>
            <i class="fa-solid fa-arrow-right text-[10px] text-gray-300 group-hover:text-indigo-400 self-end transition-colors"></i>
        </button>`;
    }).join('');

    return `
    <div class="max-w-4xl mx-auto space-y-6 py-6">
        <div class="flex items-center gap-3 pb-2 border-b border-gray-100">
            <div class="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
                <i class="${surface.icon} text-white text-base"></i>
            </div>
            <div>
                <h1 class="text-lg font-bold text-gray-900">${surface.label}</h1>
                <p class="text-xs text-gray-400">${surface.families.length} famílias · ${surface.families.reduce((a, f) => a + f.views.length, 0)} telas</p>
            </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            ${familyCards}
        </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// CMP-ADM-01: Tab bar da família
// ─────────────────────────────────────────────────────────────────────────────

function _renderAdmTabBar(family, activeTabId) {
    if (family.views.length <= 1) return '';
    const tabs = family.views.map(v => {
        const isActive = v.tabId === activeTabId;
        const cls = isActive
            ? 'border-b-2 border-indigo-600 text-indigo-700 font-semibold bg-transparent'
            : 'border-b-2 border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300';
        return `<button onclick="switchTab('${v.tabId}')"
                        class="px-4 py-2.5 text-xs whitespace-nowrap transition-colors ${cls}">
                    ${v.label}
                </button>`;
    }).join('');

    return `
    <div class="flex gap-0 border-b border-gray-200 mb-0 -mx-0 overflow-x-auto">
        ${tabs}
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton de VIEW (QA-ADM-07 — 6 estados)
// ─────────────────────────────────────────────────────────────────────────────

function _renderViewShell(entry, activeTabId) {
    const { view, family, surface } = entry;

    const tabBar = _renderAdmTabBar(family, activeTabId);

    const breadcrumb = `
    <nav class="flex items-center gap-1 text-[11px] text-gray-400 mb-3">
        <button onclick="switchTab('${surface.tabId}')" class="hover:text-indigo-600 transition-colors">${surface.label}</button>
        <i class="fa-solid fa-chevron-right text-[9px]"></i>
        <button onclick="switchTab('${family.views[0].tabId}')" class="hover:text-indigo-600 transition-colors">${family.label}</button>
        <i class="fa-solid fa-chevron-right text-[9px]"></i>
        <span class="text-gray-600">${view.label}</span>
    </nav>`;

    const header = `
    <div class="flex items-start justify-between mb-4">
        <div>
            ${breadcrumb}
            <h1 class="text-xl font-bold text-gray-900">${view.label}</h1>
            <p class="text-xs text-gray-400 mt-0.5">${view.viewId}</p>
        </div>
        <div class="flex gap-2" id="adm-header-actions-${view.tabId}"></div>
    </div>`;

    return `
    <div class="adm-view-shell max-w-6xl mx-auto" data-tab="${view.tabId}" data-view="${view.viewId}">
        ${tabBar ? `<div class="sticky top-0 bg-white z-10 pt-4 px-0">${tabBar}</div>` : ''}
        <div class="pt-4">
            ${header}

            <!-- Estado: Loading -->
            <div class="adm-state adm-loading" id="adm-loading-${view.tabId}">
                <div class="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                    <i class="fa-solid fa-circle-notch fa-spin text-2xl text-indigo-400"></i>
                    <span class="text-sm">Carregando…</span>
                </div>
            </div>

            <!-- Estado: Sem Permissão -->
            <div class="adm-state adm-sem-permissao hidden" id="adm-perm-${view.tabId}">
                <div class="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                    <i class="fa-solid fa-lock text-2xl text-amber-400"></i>
                    <span class="text-sm font-medium text-gray-600">Sem permissão</span>
                    <span class="text-xs text-center max-w-xs">Você não tem acesso a esta área. Solicite ao administrador do sistema.</span>
                </div>
            </div>

            <!-- Estado: Empty -->
            <div class="adm-state adm-empty hidden" id="adm-empty-${view.tabId}">
                <div class="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                    <i class="fa-solid fa-inbox text-2xl"></i>
                    <span class="text-sm">Nenhum registro encontrado</span>
                </div>
            </div>

            <!-- Estado: Error -->
            <div class="adm-state adm-error hidden" id="adm-error-${view.tabId}">
                <div class="flex flex-col items-center justify-center py-16 gap-3">
                    <i class="fa-solid fa-triangle-exclamation text-2xl text-red-400"></i>
                    <span class="text-sm font-medium text-gray-700">Erro ao carregar</span>
                    <button onclick="admLoadView('${view.tabId}')"
                            class="text-xs text-indigo-600 hover:underline">Tentar novamente</button>
                </div>
            </div>

            <!-- Estado: N/A (funcionalidade não contratada) -->
            <div class="adm-state adm-na hidden" id="adm-na-${view.tabId}">
                <div class="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
                    <i class="fa-solid fa-ban text-2xl text-gray-300"></i>
                    <span class="text-sm">Funcionalidade não habilitada</span>
                    <span class="text-xs">Esta capability não está contratada ou ativa para a sua organização.</span>
                </div>
            </div>

            <!-- Estado: Content (preenchido em A2–A6) -->
            <div class="adm-state adm-content hidden" id="adm-content-${view.tabId}"></div>
        </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// API pública para os módulos A2–A6
// ─────────────────────────────────────────────────────────────────────────────

function admSetState(tabId, state) {
    const states = ['loading', 'empty', 'content', 'error', 'sem-permissao', 'na'];
    for (const s of states) {
        const el = document.getElementById(`adm-${s}-${tabId}`);
        if (el) el.classList.toggle('hidden', s !== state);
    }
}

function admGetContentEl(tabId) {
    return document.getElementById(`adm-content-${tabId}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Ponto de entrada: chamado por switchTab para qualquer tabId ADM
// ─────────────────────────────────────────────────────────────────────────────

function renderAdmView(tabId) {
    const resolved = _admResolveTab(tabId);
    if (resolved !== tabId) {
        // Legacy redirect: o switchTab original já vai encontrar view-{tabId} vazio;
        // escrevemos o conteúdo nele e ele redireciona internamente.
        const legacyEl = document.getElementById(`view-${tabId}`);
        if (legacyEl && legacyEl.innerHTML.trim() === '') {
            legacyEl.innerHTML = `<div class="py-8 text-center text-xs text-gray-400">
                <i class="fa-solid fa-arrow-right mr-1"></i>
                Redirecionando para ${resolved}…
            </div>`;
            setTimeout(() => switchTab(resolved), 80);
        }
        return;
    }

    const entry = _admViewMap[tabId];
    if (!entry) return;

    const el = document.getElementById(`view-${tabId}`);
    if (!el) return;

    if (entry.isSurfaceHome) {
        if (el.innerHTML.trim() === '') {
            el.innerHTML = _renderSurfaceHome(entry.surface);
        }
        return;
    }

    if (el.innerHTML.trim() === '') {
        el.innerHTML = _renderViewShell(entry, tabId);
    }

    // Notifica o módulo da VIEW que ela foi ativada (A2–A6 registram handlers aqui)
    const event = new CustomEvent('adm:view-activated', { detail: { tabId, entry } });
    document.dispatchEvent(event);
}
