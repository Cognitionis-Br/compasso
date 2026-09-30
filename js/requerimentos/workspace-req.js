// =========================================================================
// requerimentos/workspace-req.js
// Fase 3 — D-03 / D-04 / D-08:
//   renderWorkspaceReq(projeto, bodyId)  — SCR-05 dentro do workspace projeto
// =========================================================================

let _reqProjetoAtual = null;
let _reqAbaAtual     = 'req_resumo';

const REQ_ABAS = [
    'req_resumo', 'req_origem_bc',
    'req_discovery', 'req_lista', 'req_detalhe', 'req_ia', 'req_documentos',
    'req_validacoes',
    'req_baseline', 'req_handoff',
    'req_historico',
];

const REQ_ABA_LABELS = {
    req_resumo:     'Resumo',
    req_origem_bc:  'Origem BC',
    req_discovery:  'Discovery',
    req_lista:      'Lista',
    req_detalhe:    'Detalhe',
    req_ia:         'IA Assistente',
    req_documentos: 'Documentos',
    req_validacoes: 'Validações',
    req_baseline:   'Baseline e EST-02',
    req_handoff:    'Handoff',
    req_historico:  'Histórico',
};

// D-04: estados onde o workspace é read-only
const REQ_READONLY_ESTADOS = new Set([
    'INTERNAL_REVIEW', 'READY_FOR_BUSINESS_REVIEW', 'BUSINESS_REVIEW',
    'BUSINESS_APPROVED', 'TECH_REVIEW', 'TECH_APPROVED',
    'BASELINED', 'ESTIMATION', 'BUDGET_REVIEW', 'READY_FOR_SPECIFICATION',
]);

const REQ_ESTADO_META = {
    NOT_STARTED:                { label: 'Não iniciado',           cls: 'bg-gray-100 text-gray-600' },
    DISCOVERY:                  { label: 'Discovery',              cls: 'bg-blue-100 text-blue-800' },
    REQUIREMENTS_DRAFT:         { label: 'Rascunho',               cls: 'bg-blue-100 text-blue-800' },
    INTERNAL_REVIEW:            { label: 'Revisão Interna',        cls: 'bg-purple-100 text-purple-800' },
    INTERNAL_CHANGE_REQUESTED:  { label: 'Ajuste — Revisão Int.',  cls: 'bg-orange-100 text-orange-800' },
    READY_FOR_BUSINESS_REVIEW:  { label: 'Ag. Revisão Negócio',    cls: 'bg-yellow-100 text-yellow-800' },
    BUSINESS_REVIEW:            { label: 'Revisão de Negócio',     cls: 'bg-yellow-100 text-yellow-800' },
    BUSINESS_CHANGE_REQUESTED:  { label: 'Ajuste — Negócio',       cls: 'bg-orange-100 text-orange-800' },
    BUSINESS_APPROVED:          { label: 'Aprovado — Negócio',     cls: 'bg-green-100 text-green-800' },
    TECH_REVIEW:                { label: 'Revisão Técnica',        cls: 'bg-cyan-100 text-cyan-800' },
    TECH_CHANGE_REQUESTED:      { label: 'Ajuste — Técnico',       cls: 'bg-orange-100 text-orange-800' },
    TECH_APPROVED:              { label: 'Aprovado — Técnico',     cls: 'bg-green-100 text-green-800' },
    BASELINED:                  { label: 'Baselineado',            cls: 'bg-indigo-100 text-indigo-800' },
    ESTIMATION:                 { label: 'Estimativa (EST-02)',    cls: 'bg-indigo-100 text-indigo-800' },
    BUDGET_REVIEW:              { label: 'Revisão de Budget',      cls: 'bg-yellow-100 text-yellow-800' },
    READY_FOR_SPECIFICATION:    { label: 'Pronto p/ Especificação',cls: 'bg-green-100 text-green-800' },
};

function _reqIsReadOnly() {
    const estado = ((_reqProjetoAtual || {}).req_estado || 'NOT_STARTED').toUpperCase();
    return REQ_READONLY_ESTADOS.has(estado);
}

function _reqEstadoBadge(estado) {
    const meta = REQ_ESTADO_META[estado] || { label: estado, cls: 'bg-gray-100 text-gray-600' };
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.cls}">${meta.label}</span>`;
}

// -------------------------------------------------------------------------
// ENTRY POINT
// -------------------------------------------------------------------------
function renderWorkspaceReq(projeto, bodyId) {
    _reqProjetoAtual = projeto;
    _reqAbaAtual     = 'req_resumo';

    const el = document.getElementById(bodyId);
    if (!el) return;

    // Remove outer card padding/bg — we own the full layout from here
    el.className = 'rounded-lg border border-gray-200 shadow-sm overflow-hidden bg-white';

    const p = projeto;
    const estado = (p.req_estado || 'NOT_STARTED').toUpperCase();
    const readOnly = _reqIsReadOnly();

    // Phase stepper (6 fases do projeto)
    const stepperHtml = _reqPhaseStepper();

    // Info strip: código · módulo · estado · modo leitura
    const infoStrip = `
        <div class="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2 text-xs flex-wrap">
            <span class="font-mono font-bold text-gray-500">${escapeHtml(p.codigo || '')}</span>
            <span class="text-gray-300">·</span>
            <span class="font-semibold text-gray-600">Requerimentos · SCR-05</span>
            <span class="text-gray-300">·</span>
            ${_reqEstadoBadge(estado)}
            <span class="flex-1"></span>
            ${readOnly ? `<span class="flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full">
                <i class="fa-solid fa-lock text-[9px]"></i> Leitura — revisão em andamento</span>` : ''}
        </div>`;

    // Tab body panels
    const panelsHtml = REQ_ABAS.map(a =>
        `<div id="reqBody_${a}" class="hidden p-4"></div>`
    ).join('');

    el.innerHTML = stepperHtml + infoStrip +
        `<div id="reqAbaBar" class="flex items-end gap-1 px-3 border-b border-gray-200 bg-white overflow-x-auto no-scrollbar shrink-0"></div>` +
        `<div class="min-h-48">${panelsHtml}</div>`;

    _reqRenderTabBar();
    _reqRenderAba('req_resumo');
}

// -------------------------------------------------------------------------
// PHASE STEPPER (lifecycle das 6 etapas do projeto)
// -------------------------------------------------------------------------
function _reqPhaseStepper() {
    const phases = ['Requerimentos', 'Especificação', 'Execução', 'UAT', 'Go Live', 'Encerramento'];
    let items = '';
    phases.forEach((label, i) => {
        const isActive = i === 0;
        const circleCls = isActive ? 'bg-indigo-700 text-white' : 'bg-gray-200 text-gray-500';
        const labelCls  = isActive ? 'text-indigo-700 font-bold' : 'text-gray-500 font-semibold';
        items += `
            <div class="flex items-center ${i < phases.length - 1 ? 'flex-1' : ''}">
                <div class="flex flex-col items-center gap-1 shrink-0 w-20">
                    <div class="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${circleCls}">${i + 1}</div>
                    <span class="text-[10px] ${labelCls} text-center leading-tight">${label}</span>
                </div>
                ${i < phases.length - 1 ? '<div class="flex-1 h-0.5 bg-gray-200 -mt-4 shrink"></div>' : ''}
            </div>`;
    });
    return `<div class="flex items-center px-4 py-2.5 bg-white border-b border-gray-100">${items}</div>`;
}

// -------------------------------------------------------------------------
// TAB BAR (D-03 grouped)
// -------------------------------------------------------------------------
function _reqRenderTabBar() {
    const bar = document.getElementById('reqAbaBar');
    if (!bar) return;

    const btnCls = (a) =>
        `px-2.5 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ` +
        (_reqAbaAtual === a
            ? 'border-indigo-700 text-indigo-700'
            : 'border-transparent text-gray-500 hover:text-gray-700');

    const btn = (a) =>
        `<button onclick="mudarAbaReq('${a}')" class="${btnCls(a)}">${REQ_ABA_LABELS[a]}</button>`;
    const sep = (l) =>
        `<span class="px-1.5 text-[9px] font-black uppercase tracking-widest text-gray-400 border-b-2 border-transparent self-end pb-2 shrink-0">${l}</span>`;
    const divider = () =>
        `<div class="w-px h-7 bg-gray-200 self-end mb-2 shrink-0 mx-1"></div>`;

    bar.innerHTML =
        `<div class="flex flex-col gap-0.5">` +
            `<span class="text-[9px] text-transparent select-none pb-0.5">&nbsp;</span>` +
            `<div class="flex">${btn('req_resumo')}${btn('req_origem_bc')}</div>` +
        `</div>` +
        divider() +
        `<div class="flex flex-col gap-0.5">` +
            `<span class="text-[9px] font-black uppercase tracking-widest text-gray-400 px-1">${'Construção'}</span>` +
            `<div class="flex">${btn('req_discovery')}${btn('req_lista')}${btn('req_detalhe')}${btn('req_ia')}${btn('req_documentos')}</div>` +
        `</div>` +
        divider() +
        `<div class="flex flex-col gap-0.5">` +
            `<span class="text-[9px] font-black uppercase tracking-widest text-gray-400 px-1">${'Validação'}</span>` +
            `<div class="flex">${btn('req_validacoes')}</div>` +
        `</div>` +
        divider() +
        `<div class="flex flex-col gap-0.5">` +
            `<span class="text-[9px] font-black uppercase tracking-widest text-gray-400 px-1">${'Fechamento'}</span>` +
            `<div class="flex">${btn('req_baseline')}${btn('req_handoff')}</div>` +
        `</div>` +
        divider() +
        `<div class="flex flex-col gap-0.5">` +
            `<span class="text-[9px] font-black uppercase tracking-widest text-gray-400 px-1">${'Registro'}</span>` +
            `<div class="flex">${btn('req_historico')}</div>` +
        `</div>`;
}

function mudarAbaReq(aba) {
    _reqAbaAtual = aba;
    _reqRenderTabBar();
    _reqRenderAba(aba);
}

// -------------------------------------------------------------------------
// ABA ROUTING
// -------------------------------------------------------------------------
function _reqRenderAba(aba) {
    REQ_ABAS.forEach(a => {
        const el = document.getElementById('reqBody_' + a);
        if (el) el.classList.add('hidden');
    });

    const el = document.getElementById('reqBody_' + aba);
    if (!el) return;
    el.classList.remove('hidden');

    if (aba === 'req_resumo')  { _reqRenderResumo(); return; }
    if (aba === 'req_origem_bc') { _reqRenderOrigemBC(); return; }

    const stubMap = {
        req_discovery:  ['Discovery',           'fa-magnifying-glass-chart'],
        req_lista:      ['Lista de Requerimentos','fa-list-check'],
        req_detalhe:    ['Detalhe do Requerimento','fa-rectangle-list'],
        req_ia:         ['IA Assistente',        'fa-robot'],
        req_documentos: ['Documentos',           'fa-file-lines'],
        req_validacoes: ['Validações',           'fa-check-double'],
        req_baseline:   ['Baseline e EST-02',    'fa-code-branch'],
        req_handoff:    ['Handoff',              'fa-handshake'],
        req_historico:  ['Histórico',            'fa-clock-rotate-left'],
    };
    const [label, icon] = stubMap[aba] || [aba, 'fa-circle'];
    _reqRenderStub('reqBody_' + aba, label, icon);
}

function _reqRenderStub(bodyId, label, icon) {
    const el = document.getElementById(bodyId);
    if (!el) return;
    el.innerHTML = `
        <div class="flex flex-col items-center justify-center py-16 text-center">
            <i class="fa-solid ${icon} text-4xl text-gray-200 mb-4"></i>
            <h3 class="text-sm font-bold text-gray-400">${label}</h3>
            <p class="text-xs text-gray-300 mt-1 max-w-xs">Em desenvolvimento — disponível nas próximas fases.</p>
        </div>`;
}

// -------------------------------------------------------------------------
// ABA: RESUMO
// -------------------------------------------------------------------------
function _reqRenderResumo() {
    const el = document.getElementById('reqBody_req_resumo');
    if (!el || !_reqProjetoAtual) return;

    const p = _reqProjetoAtual;
    const estado = (p.req_estado || 'NOT_STARTED').toUpperCase();
    const readOnly = _reqIsReadOnly();

    // Banner de leitura
    const bannerReadOnly = readOnly ? `
        <div class="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-900">
            <i class="fa-solid fa-lock mt-0.5 text-amber-600"></i>
            <div>
                <b>Workspace em modo leitura.</b>
                <span class="ml-1">Nenhuma edição é possível enquanto o artefato estiver em revisão (D-04). Solicite ajustes ao revisor responsável para habilitar edição.</span>
            </div>
        </div>` : '';

    // Banner de ajuste solicitado
    const ajusteEstados = new Set(['INTERNAL_CHANGE_REQUESTED', 'BUSINESS_CHANGE_REQUESTED', 'TECH_CHANGE_REQUESTED']);
    const bannerAjuste = ajusteEstados.has(estado) ? `
        <div class="flex items-start gap-3 bg-orange-50 border border-orange-300 rounded-lg p-3 text-xs text-orange-900">
            <i class="fa-solid fa-rotate-left mt-0.5 text-orange-600"></i>
            <div><b>Ajustes solicitados.</b> <span class="ml-1">O revisor devolveu com comentários. Corrija os itens sinalizados e reenvie para revisão.</span></div>
        </div>` : '';

    // M06 state mini-stepper (5 marcos)
    const marcos = [
        { key: 'NOT_STARTED',        label: 'Não iniciado' },
        { key: 'REQUIREMENTS_DRAFT', label: 'Rascunho' },
        { key: 'BUSINESS_APPROVED',  label: 'Aprovado Negócio' },
        { key: 'TECH_APPROVED',      label: 'Aprovado Técnico' },
        { key: 'BASELINED',          label: 'Baselineado' },
        { key: 'READY_FOR_SPECIFICATION', label: 'Pronto p/ Spec' },
    ];
    const estadoOrder = [
        'NOT_STARTED','DISCOVERY','REQUIREMENTS_DRAFT',
        'INTERNAL_REVIEW','INTERNAL_CHANGE_REQUESTED',
        'READY_FOR_BUSINESS_REVIEW','BUSINESS_REVIEW','BUSINESS_CHANGE_REQUESTED',
        'BUSINESS_APPROVED',
        'TECH_REVIEW','TECH_CHANGE_REQUESTED','TECH_APPROVED',
        'BASELINED','ESTIMATION','BUDGET_REVIEW','READY_FOR_SPECIFICATION',
    ];
    const curIdx = estadoOrder.indexOf(estado);

    const stepItems = marcos.map((m, i) => {
        const marcoIdx = estadoOrder.indexOf(m.key);
        const isDone   = marcoIdx < curIdx;
        const isActive = marcoIdx === curIdx || (curIdx > marcoIdx && i === marcos.findIndex(x => estadoOrder.indexOf(x.key) >= curIdx) - 1);
        const circleCls = isDone ? 'bg-green-600 text-white' : (estado === m.key ? 'bg-indigo-700 text-white' : 'bg-gray-200 text-gray-500');
        const labelCls  = isDone ? 'text-green-700' : (estado === m.key ? 'text-indigo-700' : 'text-gray-400');
        const inner = isDone ? '✓' : (i + 1);
        const line = i < marcos.length - 1 ? `<div class="flex-1 h-0.5 ${isDone ? 'bg-green-400' : 'bg-gray-200'} -mt-4 shrink"></div>` : '';
        return `
            <div class="flex items-center ${i < marcos.length - 1 ? 'flex-1' : ''}">
                <div class="flex flex-col items-center gap-1 shrink-0 w-20">
                    <div class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${circleCls}">${inner}</div>
                    <span class="text-[10px] ${labelCls} font-semibold text-center leading-tight">${m.label}</span>
                </div>
                ${line}
            </div>`;
    }).join('');

    const stepperHtml = `
        <div class="bg-white border border-gray-200 rounded-lg p-3">
            <div class="flex items-center">${stepItems}</div>
        </div>`;

    // KPI cards
    const valAprovado = Number(p.val_aprovado_fy || p.val_bc || 0);
    const cards = [
        { lbl: 'Budget aprovado (V1)', val: formatCurrency(valAprovado), sub: 'Referência do BC aceito' },
        { lbl: 'Estado atual',         val: (REQ_ESTADO_META[estado] || { label: estado }).label, sub: 'M06' },
        { lbl: 'Requerimentos',        val: '—', sub: 'Nenhum criado ainda' },
        { lbl: 'Validações abertas',   val: '—', sub: 'Sem pendências' },
    ];
    const cardsHtml = `
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            ${cards.map(c => `
                <div class="bg-white border border-gray-200 rounded-lg p-3">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500">${c.lbl}</span>
                    <p class="text-base font-black text-gray-800 mt-1">${c.val}</p>
                    <p class="text-[11px] text-gray-400 mt-0.5">${c.sub}</p>
                </div>`).join('')}
        </div>`;

    // Fila INT-REQ (stub)
    const filHtml = `
        <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div class="px-3 py-2 border-b border-gray-100 flex justify-between items-center">
                <span class="text-sm font-bold text-gray-800">Fila INT-REQ — Ajustes pendentes</span>
                <span class="text-xs text-gray-400">Nenhum item</span>
            </div>
            <div class="px-4 py-8 text-center text-xs text-gray-400">
                Solicitações de ajuste durante revisão aparecerão aqui.
            </div>
        </div>`;

    // Ação principal conforme estado
    const acaoPrincipal = _reqAcaoPrincipal(estado, readOnly);

    el.innerHTML = `
        <div class="space-y-3">
            ${bannerReadOnly}
            ${bannerAjuste}
            ${stepperHtml}
            ${cardsHtml}
            ${filHtml}
            ${acaoPrincipal ? `<div class="flex justify-end gap-2">${acaoPrincipal}</div>` : ''}
        </div>`;
}

function _reqAcaoPrincipal(estado, readOnly) {
    if (readOnly) return '';
    const acoes = {
        NOT_STARTED:              `<button class="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-700 text-white hover:bg-indigo-800" onclick="alert('Iniciar Discovery — em desenvolvimento')">Iniciar Discovery</button>`,
        DISCOVERY:                `<button class="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-700 text-white hover:bg-indigo-800" onclick="alert('Registrar conclusão do Discovery — em desenvolvimento')">Concluir Discovery</button>`,
        REQUIREMENTS_DRAFT:       `<button class="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-700 text-white hover:bg-indigo-800" onclick="alert('Enviar para Revisão Interna — em desenvolvimento')">Enviar para Revisão Interna</button>`,
        INTERNAL_CHANGE_REQUESTED:`<button class="px-4 py-2 rounded-lg text-xs font-bold bg-orange-700 text-white hover:bg-orange-800" onclick="alert('Reenviar após ajustes — em desenvolvimento')">Reenviar após ajustes</button>`,
        BUSINESS_CHANGE_REQUESTED:`<button class="px-4 py-2 rounded-lg text-xs font-bold bg-orange-700 text-white hover:bg-orange-800" onclick="alert('Reenviar após ajustes — em desenvolvimento')">Reenviar após ajustes</button>`,
        TECH_CHANGE_REQUESTED:    `<button class="px-4 py-2 rounded-lg text-xs font-bold bg-orange-700 text-white hover:bg-orange-800" onclick="alert('Reenviar após ajustes — em desenvolvimento')">Reenviar após ajustes</button>`,
    };
    return acoes[estado] || '';
}

// -------------------------------------------------------------------------
// ABA: ORIGEM BC
// -------------------------------------------------------------------------
function _reqRenderOrigemBC() {
    const el = document.getElementById('reqBody_req_origem_bc');
    if (!el || !_reqProjetoAtual) return;

    const p = _reqProjetoAtual;
    const bcCodigo = p.business_case_codigo || p.codigo;
    const bcOrig = (typeof projectsData !== 'undefined' ? projectsData : [])
        .find(x => x.codigo === bcCodigo) || p;

    el.innerHTML = `
        <div class="space-y-3">
            <div class="bg-white border border-gray-200 rounded-lg p-4">
                <div class="flex items-center gap-2 mb-3">
                    <i class="fa-solid fa-briefcase text-indigo-600"></i>
                    <span class="text-sm font-bold text-gray-800">Business Case de Origem</span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">${escapeHtml(bcCodigo || '—')}</span>
                </div>
                <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    ${[
                        ['Nome', bcOrig.nome || '—'],
                        ['Budget aceito (V1)', formatCurrency(Number(bcOrig.val_aprovado_fy || bcOrig.val_bc || 0))],
                        ['FY aprovado', bcOrig.ano_fiscal || '—'],
                        ['Área solicitante', bcOrig.area_solicitante || bcOrig.area || '—'],
                    ].map(([lbl, val]) => `
                        <div class="flex flex-col gap-1">
                            <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400">${lbl}</span>
                            <span class="text-xs font-semibold text-gray-800">${escapeHtml(String(val))}</span>
                        </div>`).join('')}
                </div>
            </div>
            <div class="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-4 text-xs text-gray-400 text-center">
                Detalhes completos do BC (estratégia, escopo, estimativa original) disponíveis no workspace de Business Cases.
            </div>
        </div>`;
}
