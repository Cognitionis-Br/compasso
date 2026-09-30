// =========================================================================
// especificacao/workspace-spec.js
// Fase 3 — D-03 / D-04 / D-06 / D-08:
//   renderWorkspaceSpec(projeto, bodyId)  — SCR-06 dentro do workspace projeto
//   D-06: Seleção de modo COMPASSO_SPEC vs EXTERNAL_SPEC
// =========================================================================

let _specProjetoAtual = null;
let _specAbaAtual     = 'spec_resumo';

const SPEC_ABAS = [
    'spec_resumo', 'spec_origem',
    'spec_discovery', 'spec_ia', 'spec_documento', 'spec_versoes', 'spec_externo',
    'spec_validacoes',
    'spec_baseline', 'spec_handoff',
    'spec_historico',
];

const SPEC_ABA_LABELS = {
    spec_resumo:    'Resumo',
    spec_origem:    'Origem',
    spec_discovery: 'Discovery',
    spec_ia:        'IA Assistente',
    spec_documento: 'Documento',
    spec_versoes:   'Versões',
    spec_externo:   'Controle Externo',
    spec_validacoes:'Validações',
    spec_baseline:  'Baseline e EST-03',
    spec_handoff:   'Handoff',
    spec_historico: 'Histórico',
};

// D-04: estados onde o workspace é read-only
const SPEC_READONLY_ESTADOS = new Set([
    'INTERNAL_REVIEW', 'READY_FOR_BUSINESS_REVIEW', 'BUSINESS_REVIEW',
    'BUSINESS_APPROVED', 'BASELINED', 'ESTIMATION', 'BUDGET_REVIEW',
    'READY_FOR_EXECUTION',
]);

const SPEC_ESTADO_META = {
    NOT_STARTED:               { label: 'Não iniciado',          cls: 'bg-gray-100 text-gray-600' },
    MODE_SELECTION:            { label: 'Seleção de Modo',       cls: 'bg-blue-100 text-blue-800' },
    SPEC_DISCOVERY:            { label: 'Discovery',             cls: 'bg-blue-100 text-blue-800' },
    SPEC_DRAFT:                { label: 'Rascunho',              cls: 'bg-blue-100 text-blue-800' },
    INTERNAL_REVIEW:           { label: 'Revisão Interna',       cls: 'bg-purple-100 text-purple-800' },
    READY_FOR_BUSINESS_REVIEW: { label: 'Ag. Revisão Negócio',   cls: 'bg-yellow-100 text-yellow-800' },
    BUSINESS_REVIEW:           { label: 'Revisão de Negócio',    cls: 'bg-yellow-100 text-yellow-800' },
    BUSINESS_APPROVED:         { label: 'Aprovado — Negócio',    cls: 'bg-green-100 text-green-800' },
    BASELINED:                 { label: 'Baselineado',           cls: 'bg-indigo-100 text-indigo-800' },
    ESTIMATION:                { label: 'Estimativa (EST-03)',   cls: 'bg-indigo-100 text-indigo-800' },
    BUDGET_REVIEW:             { label: 'Revisão de Budget',     cls: 'bg-yellow-100 text-yellow-800' },
    READY_FOR_EXECUTION:       { label: 'Pronto para Execução',  cls: 'bg-green-100 text-green-800' },
};

function _specIsReadOnly() {
    const estado = ((_specProjetoAtual || {}).spec_estado || 'NOT_STARTED').toUpperCase();
    return SPEC_READONLY_ESTADOS.has(estado);
}

function _specEstadoBadge(estado) {
    const meta = SPEC_ESTADO_META[estado] || { label: estado, cls: 'bg-gray-100 text-gray-600' };
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold ${meta.cls}">${meta.label}</span>`;
}

function _specModoBadge(modo) {
    if (!modo) return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">Modo a definir</span>`;
    if (modo === 'COMPASSO_SPEC') return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">Compasso Spec</span>`;
    return `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-100 text-cyan-800">Controle Externo</span>`;
}

// -------------------------------------------------------------------------
// ENTRY POINT
// -------------------------------------------------------------------------
function renderWorkspaceSpec(projeto, bodyId) {
    _specProjetoAtual = projeto;
    _specAbaAtual     = 'spec_resumo';

    const el = document.getElementById(bodyId);
    if (!el) return;

    el.className = 'rounded-lg border border-gray-200 shadow-sm overflow-hidden bg-white';

    const p = projeto;
    const estado = (p.spec_estado || 'NOT_STARTED').toUpperCase();
    const modo   = p.spec_modo || null;
    const readOnly = _specIsReadOnly();

    const stepperHtml = _specPhaseStepper();

    const infoStrip = `
        <div class="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center gap-2 text-xs flex-wrap">
            <span class="font-mono font-bold text-gray-500">${escapeHtml(p.codigo || '')}</span>
            <span class="text-gray-300">·</span>
            <span class="font-semibold text-gray-600">Especificação · SCR-06</span>
            <span class="text-gray-300">·</span>
            ${_specEstadoBadge(estado)}
            <span class="text-gray-300">·</span>
            ${_specModoBadge(modo)}
            <span class="flex-1"></span>
            ${readOnly ? `<span class="flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full">
                <i class="fa-solid fa-lock text-[9px]"></i> Leitura — revisão em andamento</span>` : ''}
        </div>`;

    const panelsHtml = SPEC_ABAS.map(a =>
        `<div id="specBody_${a}" class="hidden p-4"></div>`
    ).join('');

    el.innerHTML = stepperHtml + infoStrip +
        `<div id="specAbaBar" class="flex items-end gap-1 px-3 border-b border-gray-200 bg-white overflow-x-auto no-scrollbar shrink-0"></div>` +
        `<div class="min-h-48">${panelsHtml}</div>`;

    _specRenderTabBar();
    _specRenderAba('spec_resumo');
}

// -------------------------------------------------------------------------
// PHASE STEPPER (lifecycle: Requerimentos ✓ → Especificação ativa)
// -------------------------------------------------------------------------
function _specPhaseStepper() {
    const phases = ['Requerimentos', 'Especificação', 'Execução', 'UAT', 'Go Live', 'Encerramento'];
    let items = '';
    phases.forEach((label, i) => {
        const isDone   = i === 0;
        const isActive = i === 1;
        const circleCls = isDone ? 'bg-green-600 text-white' : (isActive ? 'bg-indigo-700 text-white' : 'bg-gray-200 text-gray-500');
        const labelCls  = isDone ? 'text-green-700' : (isActive ? 'text-indigo-700 font-bold' : 'text-gray-500 font-semibold');
        const inner = isDone ? '✓' : (i + 1);
        const line = i < phases.length - 1 ? `<div class="flex-1 h-0.5 ${isDone ? 'bg-green-400' : 'bg-gray-200'} -mt-4 shrink"></div>` : '';
        items += `
            <div class="flex items-center ${i < phases.length - 1 ? 'flex-1' : ''}">
                <div class="flex flex-col items-center gap-1 shrink-0 w-20">
                    <div class="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${circleCls}">${inner}</div>
                    <span class="text-[10px] ${labelCls} text-center leading-tight">${label}</span>
                </div>
                ${line}
            </div>`;
    });
    return `<div class="flex items-center px-4 py-2.5 bg-white border-b border-gray-100">${items}</div>`;
}

// -------------------------------------------------------------------------
// TAB BAR (D-03 grouped, D-06: Controle Externo disabled para COMPASSO_SPEC)
// -------------------------------------------------------------------------
function _specRenderTabBar() {
    const bar = document.getElementById('specAbaBar');
    if (!bar) return;

    const modo = (_specProjetoAtual || {}).spec_modo || null;
    // D-06: Controle Externo desabilitado quando modo é COMPASSO_SPEC
    const externoDesabilitado = modo === 'COMPASSO_SPEC';

    const btnCls = (a, disabled = false) => {
        if (disabled) return `px-2.5 py-2 text-xs font-bold border-b-2 border-transparent whitespace-nowrap text-gray-300 cursor-not-allowed`;
        return `px-2.5 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ` +
            (_specAbaAtual === a
                ? 'border-indigo-700 text-indigo-700'
                : 'border-transparent text-gray-500 hover:text-gray-700');
    };

    const btn = (a, disabled = false) => {
        if (disabled) return `<button class="${btnCls(a, true)}" disabled title="Disponível apenas no modo Controle Externo">${SPEC_ABA_LABELS[a]}</button>`;
        return `<button onclick="mudarAbaSpec('${a}')" class="${btnCls(a)}">${SPEC_ABA_LABELS[a]}</button>`;
    };
    const divider = () => `<div class="w-px h-7 bg-gray-200 self-end mb-2 shrink-0 mx-1"></div>`;

    bar.innerHTML =
        `<div class="flex flex-col gap-0.5">` +
            `<span class="text-[9px] text-transparent select-none pb-0.5">&nbsp;</span>` +
            `<div class="flex">${btn('spec_resumo')}${btn('spec_origem')}</div>` +
        `</div>` +
        divider() +
        `<div class="flex flex-col gap-0.5">` +
            `<span class="text-[9px] font-black uppercase tracking-widest text-gray-400 px-1">Construção</span>` +
            `<div class="flex">${btn('spec_discovery')}${btn('spec_ia')}${btn('spec_documento')}${btn('spec_versoes')}${btn('spec_externo', externoDesabilitado)}</div>` +
        `</div>` +
        divider() +
        `<div class="flex flex-col gap-0.5">` +
            `<span class="text-[9px] font-black uppercase tracking-widest text-gray-400 px-1">Validação</span>` +
            `<div class="flex">${btn('spec_validacoes')}</div>` +
        `</div>` +
        divider() +
        `<div class="flex flex-col gap-0.5">` +
            `<span class="text-[9px] font-black uppercase tracking-widest text-gray-400 px-1">Fechamento</span>` +
            `<div class="flex">${btn('spec_baseline')}${btn('spec_handoff')}</div>` +
        `</div>` +
        divider() +
        `<div class="flex flex-col gap-0.5">` +
            `<span class="text-[9px] font-black uppercase tracking-widest text-gray-400 px-1">Registro</span>` +
            `<div class="flex">${btn('spec_historico')}</div>` +
        `</div>`;
}

function mudarAbaSpec(aba) {
    _specAbaAtual = aba;
    _specRenderTabBar();
    _specRenderAba(aba);
}

// -------------------------------------------------------------------------
// ABA ROUTING
// -------------------------------------------------------------------------
function _specRenderAba(aba) {
    SPEC_ABAS.forEach(a => {
        const el = document.getElementById('specBody_' + a);
        if (el) el.classList.add('hidden');
    });

    const el = document.getElementById('specBody_' + aba);
    if (!el) return;
    el.classList.remove('hidden');

    if (aba === 'spec_resumo')  { _specRenderResumo(); return; }
    if (aba === 'spec_origem')  { _specRenderOrigem(); return; }

    const stubMap = {
        spec_discovery: ['Discovery',           'fa-magnifying-glass-chart'],
        spec_ia:        ['IA Assistente',        'fa-robot'],
        spec_documento: ['Documento de Spec',    'fa-file-lines'],
        spec_versoes:   ['Versões',              'fa-code-branch'],
        spec_externo:   ['Controle Externo',     'fa-globe'],
        spec_validacoes:['Validações',           'fa-check-double'],
        spec_baseline:  ['Baseline e EST-03',    'fa-code-branch'],
        spec_handoff:   ['Handoff',              'fa-handshake'],
        spec_historico: ['Histórico',            'fa-clock-rotate-left'],
    };
    const [label, icon] = stubMap[aba] || [aba, 'fa-circle'];
    _specRenderStub('specBody_' + aba, label, icon);
}

function _specRenderStub(bodyId, label, icon) {
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
// ABA: RESUMO  (inclui seleção de modo D-06 quando spec_modo é null)
// -------------------------------------------------------------------------
function _specRenderResumo() {
    const el = document.getElementById('specBody_spec_resumo');
    if (!el || !_specProjetoAtual) return;

    const p = _specProjetoAtual;
    const estado  = (p.spec_estado || 'NOT_STARTED').toUpperCase();
    const modo    = p.spec_modo || null;
    const readOnly = _specIsReadOnly();

    // Se modo ainda não foi escolhido, mostrar seleção D-06
    if (!modo) {
        el.innerHTML = _specRenderModoSelecao();
        return;
    }

    // Banner leitura
    const bannerReadOnly = readOnly ? `
        <div class="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-900">
            <i class="fa-solid fa-lock mt-0.5 text-amber-600"></i>
            <div>
                <b>Workspace em modo leitura.</b>
                <span class="ml-1">Nenhuma edição é possível enquanto o artefato estiver em revisão (D-04).</span>
            </div>
        </div>` : '';

    // Mini-stepper M07
    const marcos = [
        { key: 'NOT_STARTED', label: 'Não iniciado' },
        { key: 'SPEC_DRAFT',  label: 'Rascunho' },
        { key: 'BUSINESS_APPROVED', label: 'Aprovado Negócio' },
        { key: 'BASELINED',   label: 'Baselineado' },
        { key: 'READY_FOR_EXECUTION', label: 'Pronto p/ Exec.' },
    ];
    const estadoOrder = [
        'NOT_STARTED','MODE_SELECTION','SPEC_DISCOVERY','SPEC_DRAFT',
        'INTERNAL_REVIEW','READY_FOR_BUSINESS_REVIEW','BUSINESS_REVIEW',
        'BUSINESS_APPROVED','BASELINED','ESTIMATION','BUDGET_REVIEW','READY_FOR_EXECUTION',
    ];
    const curIdx = estadoOrder.indexOf(estado);

    const stepItems = marcos.map((m, i) => {
        const marcoIdx = estadoOrder.indexOf(m.key);
        const isDone   = marcoIdx < curIdx;
        const isActive = estado === m.key;
        const circleCls = isDone ? 'bg-green-600 text-white' : (isActive ? 'bg-indigo-700 text-white' : 'bg-gray-200 text-gray-500');
        const labelCls  = isDone ? 'text-green-700' : (isActive ? 'text-indigo-700' : 'text-gray-400');
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

    // Contexto herdado de Requerimentos
    const valAprovado = Number(p.val_aprovado_fy || p.val_bc || 0);
    const contextoHtml = `
        <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <div class="flex items-center gap-2 mb-2">
                <i class="fa-solid fa-circle-check text-indigo-600 text-xs"></i>
                <span class="text-xs font-bold text-indigo-800">Contexto herdado de Requerimentos</span>
            </div>
            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                ${[
                    ['REQ Baseline', 'REQ-BL v1'],
                    ['Budget aprovado', formatCurrency(valAprovado)],
                    ['EST-02', '— a calcular'],
                    ['Modo', modo === 'COMPASSO_SPEC' ? 'Compasso Spec' : 'Controle Externo'],
                ].map(([lbl, val]) => `
                    <div class="flex flex-col gap-0.5">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-indigo-600">${lbl}</span>
                        <span class="text-xs font-semibold text-indigo-900">${val}</span>
                    </div>`).join('')}
            </div>
        </div>`;

    // KPI cards
    const cards = [
        { lbl: 'Estado atual',   val: (SPEC_ESTADO_META[estado] || { label: estado }).label, sub: 'M07' },
        { lbl: 'Modo',           val: modo === 'COMPASSO_SPEC' ? 'Compasso Spec' : 'Controle Externo', sub: 'D-06' },
        { lbl: 'Seções criadas', val: '—', sub: 'Nenhuma' },
        { lbl: 'Validações',     val: '—', sub: 'Sem pendências' },
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

    const acaoPrincipal = _specAcaoPrincipal(estado, readOnly);

    // D-09 — Prazo da revisão: mostrado quando o estado é de revisão e temos
    // a data de entrada no estado (spec_estado_desde).
    const SPEC_REVIEW_ESTADOS = new Set(['INTERNAL_REVIEW','READY_FOR_BUSINESS_REVIEW','BUSINESS_REVIEW']);
    const dtEnvio = p.spec_estado_desde ? p.spec_estado_desde.split('T')[0] : null;
    const slaSpec = (typeof slaParaEtapa === 'function') ? slaParaEtapa('TECHNICAL') : null;
    const timelineHtml = (SPEC_REVIEW_ESTADOS.has(estado) && dtEnvio && typeof timelinePrazoHtml === 'function')
        ? timelinePrazoHtml(dtEnvio, slaSpec)
        : '';

    const corpoHtml = timelineHtml
        ? `<div style="display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap;">
               <div style="flex:1;min-width:0;" class="space-y-3">
                   ${stepperHtml}${contextoHtml}${cardsHtml}
                   ${acaoPrincipal ? `<div class="flex justify-end gap-2">${acaoPrincipal}</div>` : ''}
               </div>
               ${timelineHtml}
           </div>`
        : `<div class="space-y-3">
               ${stepperHtml}
               ${contextoHtml}
               ${cardsHtml}
               ${acaoPrincipal ? `<div class="flex justify-end gap-2">${acaoPrincipal}</div>` : ''}
           </div>`;

    el.innerHTML = `
        <div class="space-y-3">
            ${bannerReadOnly}
            ${corpoHtml}
        </div>`;
}

// -------------------------------------------------------------------------
// SELEÇÃO DE MODO (D-06) — mostrada quando spec_modo ainda é null
// -------------------------------------------------------------------------
function _specRenderModoSelecao() {
    return `
        <div class="space-y-4">
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 flex gap-2">
                <i class="fa-solid fa-circle-info mt-0.5 text-blue-600"></i>
                <span><b>Escolha o modo de especificação (D-06).</b> Esta decisão define o fluxo de trabalho e não pode ser alterada após a confirmação.</span>
            </div>
            <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div class="bg-white border-2 border-indigo-600 rounded-xl p-5 flex flex-col gap-3 cursor-pointer hover:shadow-md transition-shadow"
                     onclick="specSelecionarModo('COMPASSO_SPEC')">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                            <i class="fa-solid fa-compass-drafting text-indigo-600 text-lg"></i>
                        </div>
                        <div>
                            <p class="text-sm font-bold text-gray-800">Compasso Spec</p>
                            <p class="text-[11px] text-gray-500">COMPASSO_SPEC</p>
                        </div>
                        <div class="ml-auto w-5 h-5 rounded-full border-2 border-indigo-600 flex items-center justify-center">
                            <div class="w-3 h-3 rounded-full bg-indigo-600"></div>
                        </div>
                    </div>
                    <ul class="text-xs text-gray-600 space-y-1.5">
                        <li class="flex gap-2"><i class="fa-solid fa-check text-indigo-500 mt-0.5 shrink-0"></i>Documento gerado e versionado dentro do Compasso</li>
                        <li class="flex gap-2"><i class="fa-solid fa-check text-indigo-500 mt-0.5 shrink-0"></i>IA Assistente disponível para geração e sugestões</li>
                        <li class="flex gap-2"><i class="fa-solid fa-check text-indigo-500 mt-0.5 shrink-0"></i>Fluxo de revisão integrado (negócio + técnico)</li>
                        <li class="flex gap-2"><i class="fa-solid fa-minus text-gray-300 mt-0.5 shrink-0"></i>Controle Externo não disponível</li>
                    </ul>
                    <button class="w-full py-2 rounded-lg text-xs font-bold bg-indigo-700 text-white hover:bg-indigo-800"
                            onclick="event.stopPropagation(); specSelecionarModo('COMPASSO_SPEC')">
                        Selecionar Compasso Spec
                    </button>
                </div>
                <div class="bg-white border-2 border-gray-200 rounded-xl p-5 flex flex-col gap-3 cursor-pointer hover:border-cyan-400 hover:shadow-md transition-all"
                     onclick="specSelecionarModo('EXTERNAL_SPEC')">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-lg bg-cyan-100 flex items-center justify-center">
                            <i class="fa-solid fa-globe text-cyan-600 text-lg"></i>
                        </div>
                        <div>
                            <p class="text-sm font-bold text-gray-800">Controle Externo</p>
                            <p class="text-[11px] text-gray-500">EXTERNAL_SPEC</p>
                        </div>
                        <div class="ml-auto w-5 h-5 rounded-full border-2 border-gray-300"></div>
                    </div>
                    <ul class="text-xs text-gray-600 space-y-1.5">
                        <li class="flex gap-2"><i class="fa-solid fa-check text-cyan-500 mt-0.5 shrink-0"></i>Documento gerenciado externamente (Confluence, Jira, etc.)</li>
                        <li class="flex gap-2"><i class="fa-solid fa-check text-cyan-500 mt-0.5 shrink-0"></i>Compasso registra link e versão do documento externo</li>
                        <li class="flex gap-2"><i class="fa-solid fa-check text-cyan-500 mt-0.5 shrink-0"></i>Aba Controle Externo disponível para rastreabilidade</li>
                        <li class="flex gap-2"><i class="fa-solid fa-minus text-gray-300 mt-0.5 shrink-0"></i>IA Assistente limitada (sem acesso ao conteúdo externo)</li>
                    </ul>
                    <button class="w-full py-2 rounded-lg text-xs font-bold border border-gray-300 text-gray-700 hover:bg-gray-50"
                            onclick="event.stopPropagation(); specSelecionarModo('EXTERNAL_SPEC')">
                        Selecionar Controle Externo
                    </button>
                </div>
            </div>
        </div>`;
}

async function specSelecionarModo(modo) {
    if (!_specProjetoAtual) return;
    if (!confirm(`Confirma a seleção do modo "${modo === 'COMPASSO_SPEC' ? 'Compasso Spec' : 'Controle Externo'}"? Esta decisão não poderá ser alterada.`)) return;

    try {
        const { error } = await supabase
            .from('projetos')
            .update({ spec_modo: modo, spec_estado: 'SPEC_DISCOVERY' })
            .eq('codigo', _specProjetoAtual.codigo);
        if (error) throw error;

        // Atualiza cache em memória
        if (typeof projectsData !== 'undefined') {
            const idx = projectsData.findIndex(x => x.codigo === _specProjetoAtual.codigo);
            if (idx >= 0) {
                projectsData[idx].spec_modo   = modo;
                projectsData[idx].spec_estado = 'SPEC_DISCOVERY';
            }
        }
        _specProjetoAtual.spec_modo   = modo;
        _specProjetoAtual.spec_estado = 'SPEC_DISCOVERY';

        // Re-render
        _specRenderTabBar(); // D-06: atualiza visibilidade de Controle Externo
        _specRenderAba('spec_resumo');

    } catch (err) {
        alert('Erro ao salvar modo: ' + (err.message || err));
    }
}

function _specAcaoPrincipal(estado, readOnly) {
    if (readOnly) return '';
    const acoes = {
        SPEC_DISCOVERY: `<button class="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-700 text-white hover:bg-indigo-800" onclick="alert('Iniciar rascunho da spec — em desenvolvimento')">Iniciar Rascunho</button>`,
        SPEC_DRAFT:     `<button class="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-700 text-white hover:bg-indigo-800" onclick="alert('Enviar para Revisão Interna — em desenvolvimento')">Enviar para Revisão Interna</button>`,
    };
    return acoes[estado] || '';
}

// -------------------------------------------------------------------------
// ABA: ORIGEM
// -------------------------------------------------------------------------
function _specRenderOrigem() {
    const el = document.getElementById('specBody_spec_origem');
    if (!el || !_specProjetoAtual) return;

    const p = _specProjetoAtual;
    const bcCodigo = p.business_case_codigo || p.codigo;
    const bcOrig = (typeof projectsData !== 'undefined' ? projectsData : [])
        .find(x => x.codigo === bcCodigo) || p;

    el.innerHTML = `
        <div class="space-y-3">
            <div class="bg-white border border-gray-200 rounded-lg p-4">
                <div class="flex items-center gap-2 mb-3">
                    <i class="fa-solid fa-code-branch text-indigo-600"></i>
                    <span class="text-sm font-bold text-gray-800">Origem — Requerimentos Baselineado</span>
                </div>
                <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    ${[
                        ['Projeto', escapeHtml(p.codigo || '—')],
                        ['REQ Baseline', 'REQ-BL v1'],
                        ['Budget V1', formatCurrency(Number(bcOrig.val_aprovado_fy || bcOrig.val_bc || 0))],
                        ['Aprovado em', p.dt_aprovacao_req || '—'],
                    ].map(([lbl, val]) => `
                        <div class="flex flex-col gap-1">
                            <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400">${lbl}</span>
                            <span class="text-xs font-semibold text-gray-800">${escapeHtml(String(val))}</span>
                        </div>`).join('')}
                </div>
            </div>
            <div class="bg-gray-50 border border-dashed border-gray-200 rounded-lg p-4 text-xs text-gray-400 text-center">
                Lista de requerimentos baselineados e EST-02 herdada disponíveis quando SCR-05 for concluído.
            </div>
        </div>`;
}
