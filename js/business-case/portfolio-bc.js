// =========================================================================
// business-case/portfolio-bc.js
// Fase 2 — D-01 / D-02 / D-10:
//   renderPortfolioBCView()  — lista de BCs (SCR portfolio)
//   abrirWorkspaceBC(codigo) — abre o workspace SCR-01 de um BC
//   renderWorkspaceBC()      — renderiza o workspace com tab bar D-01
// =========================================================================

// Código do BC atualmente aberto no workspace
let _bcAtual = null;
let _bcAbaAtual = 'bc_resumo';
let _bcFiscalPlan = null; // cache do project_fiscal_plan do BC aberto

// Mapa de abas do workspace BC (D-01)
const BC_ABAS = [
    'bc_resumo',
    'bc_estrategia', 'bc_escopo', 'bc_dependencias', 'bc_documentos_bc',
    'bc_estimativa', 'bc_orcamento_bc',
    'bc_aprovacoes',
    'bc_versoes', 'bc_historico_bc',
];

const BC_ABA_LABELS = {
    bc_resumo:          'Resumo',
    bc_estrategia:      'Estratégia e Valor',
    bc_escopo:          'Escopo e Entregáveis',
    bc_dependencias:    'Dependências e Aceites',
    bc_documentos_bc:   'Documentos',
    bc_estimativa:      'Tecnologia e Estimativa (EST-01)',
    bc_orcamento_bc:    'Orçamento',
    bc_aprovacoes:      'Aprovações',
    bc_versoes:         'Versões',
    bc_historico_bc:    'Histórico',
};

// -------------------------------------------------------------------------
// LISTA DE BUSINESS CASES
// -------------------------------------------------------------------------
function renderPortfolioBCView() {
    const wrapper = document.getElementById('view-portfolio_business_cases');
    if (!wrapper) return;

    const bcs = (typeof projectsData !== 'undefined' ? projectsData : [])
        .filter(p => p.etapa_atual === 'BUSINESS CASE' || !p.etapa_atual);

    const badge = (p) => {
        const s = (p.sub_status || '').toUpperCase();
        if (s === 'APROVADO')         return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-800">Aprovado</span>';
        if (s === 'DEVOLVED')         return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-800">Devolvido FY</span>';
        if (s === 'ORÇAMENTO REALIZADO') return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">Orçamento OK</span>';
        if (s === 'PLANEJADO')        return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">Planejado</span>';
        return '<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">' + escapeHtml(p.sub_status || 'Rascunho') + '</span>';
    };

    const rows = bcs.map(p => `
        <tr class="hover:bg-gray-50 cursor-pointer" onclick="abrirWorkspaceBC('${escapeHtml(p.codigo)}')">
            <td class="px-4 py-2.5 text-xs font-mono text-gray-500">${escapeHtml(p.codigo)}</td>
            <td class="px-4 py-2.5 text-xs font-bold text-gray-800">${escapeHtml(p.nome || '')}</td>
            <td class="px-4 py-2.5 text-xs text-gray-600">${escapeHtml(p.area_solicitante || p.area || '—')}</td>
            <td class="px-4 py-2.5 text-xs text-gray-600">${escapeHtml(p.ano_fiscal || '—')}</td>
            <td class="px-4 py-2.5 text-xs">${badge(p)}</td>
            <td class="px-4 py-2.5 text-xs font-mono text-right text-emerald-700 font-bold">${formatCurrency(Number(p.val_bc)||Number(p.previsto)||0)}</td>
            <td class="px-4 py-2.5 text-right">
                <button onclick="event.stopPropagation(); abrirWorkspaceBC('${escapeHtml(p.codigo)}')"
                    class="text-xs font-bold text-indigo-700 hover:text-indigo-900">
                    Abrir <i class="fa-solid fa-arrow-right ml-1"></i>
                </button>
            </td>
        </tr>`).join('');

    const empty = `<tr><td colspan="7" class="px-4 py-8 text-center text-xs text-gray-400">Nenhum Business Case encontrado.</td></tr>`;

    wrapper.innerHTML = `
        <div class="mb-4 flex items-center justify-between">
            <div>
                <h2 class="text-lg font-bold text-gray-800 flex items-center gap-2">
                    <i class="fa-solid fa-briefcase brand-red-text"></i>
                    Business Cases
                </h2>
                <p class="text-xs text-gray-500 mt-0.5">${bcs.length} business case${bcs.length !== 1 ? 's' : ''} no portfólio</p>
            </div>
        </div>
        <div class="bg-white rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
            <table class="w-full text-left">
                <thead class="border-b border-gray-100">
                    <tr>
                        <th class="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Código</th>
                        <th class="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Nome</th>
                        <th class="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Área</th>
                        <th class="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">FY</th>
                        <th class="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</th>
                        <th class="px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 text-right">Budget</th>
                        <th class="px-4 py-2.5"></th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-50">
                    ${rows || empty}
                </tbody>
            </table>
        </div>`;
}

// -------------------------------------------------------------------------
// WORKSPACE BC
// -------------------------------------------------------------------------
async function abrirWorkspaceBC(codigo) {
    _bcAtual = (typeof projectsData !== 'undefined' ? projectsData : [])
        .find(p => p.codigo === codigo) || { codigo };
    _bcAbaAtual = 'bc_resumo';
    _bcFiscalPlan = null;

    const allViews = document.querySelectorAll('.tab-content');
    allViews.forEach(v => v.classList.add('hidden'));
    const ws = document.getElementById('view-workspace_bc');
    if (ws) ws.classList.remove('hidden');

    // Fase 3D — carrega o plano fiscal do BC (se existir)
    const { data: pfp } = await _supabase
        .from('project_fiscal_plan')
        .select('*')
        .eq('business_case_codigo', codigo)
        .maybeSingle();
    _bcFiscalPlan = pfp || null;

    _bcRenderTabBar();
    _bcRenderAba('bc_resumo');
}

function _bcRenderTabBar() {
    const bar = document.getElementById('bcAbaBar');
    if (!bar) return;

    const btnCls = (a) =>
        `px-3 py-2 text-xs font-bold border-b-2 whitespace-nowrap transition-colors ` +
        (_bcAbaAtual === a
            ? 'border-indigo-700 text-indigo-700'
            : 'border-transparent text-gray-500 hover:text-gray-800');
    const btn  = (a) => `<button onclick="mudarAbaBc('${a}')" class="${btnCls(a)}">${BC_ABA_LABELS[a]}</button>`;
    const sep  = (l) => `<span class="px-2 text-[9px] font-black uppercase tracking-widest text-gray-400 border-b-2 border-transparent self-end pb-2 shrink-0">${l}</span>`;

    bar.innerHTML =
        btn('bc_resumo') +
        sep('Construção') +
        btn('bc_estrategia') + btn('bc_escopo') + btn('bc_dependencias') + btn('bc_documentos_bc') +
        sep('Avaliação') +
        btn('bc_estimativa') + btn('bc_orcamento_bc') +
        sep('Decisão') +
        btn('bc_aprovacoes') +
        sep('Registro') +
        btn('bc_versoes') + btn('bc_historico_bc');
}

function mudarAbaBc(aba) {
    _bcAbaAtual = aba;
    _bcRenderTabBar();
    _bcRenderAba(aba);
}

function _bcRenderAba(aba) {
    const bodyIds = [
        'bcBody_resumo', 'bcBody_estrategia', 'bcBody_escopo', 'bcBody_dependencias',
        'bcBody_documentos_bc', 'bcBody_estimativa', 'bcBody_orcamento_bc',
        'bcBody_aprovacoes', 'bcBody_versoes', 'bcBody_historico_bc',
    ];
    bodyIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });

    if (aba === 'bc_resumo') {
        const el = document.getElementById('bcBody_resumo');
        if (el) { el.classList.remove('hidden'); _bcRenderResumo(); }
    } else {
        const map = {
            bc_estrategia:    ['bcBody_estrategia',    'Estratégia e Valor',           'fa-bullseye'],
            bc_escopo:        ['bcBody_escopo',         'Escopo e Entregáveis',          'fa-list-check'],
            bc_dependencias:  ['bcBody_dependencias',   'Dependências e Aceites',        'fa-link'],
            bc_documentos_bc: ['bcBody_documentos_bc',  'Documentos',                    'fa-file'],
            bc_estimativa:    ['bcBody_estimativa',     'Tecnologia e Estimativa (EST-01)','fa-calculator'],
            bc_orcamento_bc:  ['bcBody_orcamento_bc',   'Orçamento',                     'fa-coins'],
            bc_aprovacoes:    ['bcBody_aprovacoes',     'Aprovações',                    'fa-check-circle'],
            bc_versoes:       ['bcBody_versoes',        'Versões',                       'fa-code-branch'],
            bc_historico_bc:  ['bcBody_historico_bc',   'Histórico',                     'fa-clock-rotate-left'],
        };
        const [bodyId, label, icon] = map[aba] || ['', aba, 'fa-circle'];
        _bcRenderStub(bodyId, label, icon);
    }
}

function _bcRenderStub(bodyId, label, icon) {
    const el = document.getElementById(bodyId);
    if (!el) return;
    el.classList.remove('hidden');
    el.innerHTML = `
        <div class="flex flex-col items-center justify-center py-20 text-center">
            <i class="fa-solid ${icon} text-4xl text-gray-300 mb-4"></i>
            <h3 class="text-base font-bold text-gray-500">${label}</h3>
            <p class="text-xs text-gray-400 mt-1 max-w-xs">Em desenvolvimento — disponível nas próximas fases.</p>
        </div>`;
}

// -------------------------------------------------------------------------
// RESUMO TAB (D-01 / D-02)
// -------------------------------------------------------------------------
function _bcRenderResumo() {
    const el = document.getElementById('bcBody_resumo');
    if (!el || !_bcAtual) return;

    const p = _bcAtual;
    const devolvido = p.sub_status === 'DEVOLVED';
    const motivo    = escapeHtml(p.motivo_devolucao_fy || '');
    const dtDev     = p.dt_devolucao_fy ? formatDate(p.dt_devolucao_fy) : '';

    const bannerDevolvido = devolvido ? `
        <div class="flex items-start gap-3 bg-amber-50 border border-amber-300 rounded-lg p-3 text-xs text-amber-900">
            <i class="fa-solid fa-rotate-left mt-0.5 text-amber-600"></i>
            <div class="flex-1">
                <b>Devolvido pelo Comitê FY${dtDev ? ' em ' + dtDev : ''}.</b>
                <span class="ml-1">${motivo ? 'Motivo: "' + motivo + '".' : ''} O BC volta para Avaliação → Orçamento; o novo valor aceito pelo Owner é reenviado ao FY.</span>
            </div>
        </div>` : '';

    // Stepper
    const steps = [
        { label: 'Rascunho', done: true },
        { label: 'Dependências', done: true },
        { label: 'Avaliação técnica', done: !!(Number(p.horas_bc)) },
        { label: 'EST-01', done: !!(Number(p.horas_bc)) },
        { label: 'Budget', done: !!(Number(p.val_bc)) },
        { label: 'Aceite do Owner', done: (p.sub_status||'').toUpperCase() === 'APROVADO' || devolvido },
        { label: 'Pacote FY', done: !!(p.val_aprovado_fy) },
    ];

    const stepHtml = steps.map((s, i) => {
        const circle = s.done
            ? `<span class="w-5 h-5 rounded-full bg-green-600 text-white text-[10px] font-bold flex items-center justify-center">✓</span>`
            : `<span class="w-5 h-5 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold flex items-center justify-center">${i+1}</span>`;
        const lbl = `<span class="text-[11px] font-bold ${s.done ? 'text-green-700' : 'text-gray-500'}">${s.label}</span>`;
        const line = i < steps.length - 1
            ? `<div class="flex-1 h-0.5 ${s.done ? 'bg-green-500' : 'bg-gray-200'}"></div>`
            : '';
        return `<div class="flex items-center gap-1.5">${circle}${lbl}</div>${line}`;
    }).join('');

    // 4 cards
    const cards = [
        { lbl: 'Budget aceito (V1)', val: formatCurrency(Number(p.val_aprovado_fy)||Number(p.val_bc)||0), sub: 'EST-01: ' + (p.horas_bc ? p.horas_bc + ' h' : '—') },
        { lbl: 'Cost of Delay', val: '—', sub: 'Não informado' },
        { lbl: 'Dependências', val: '—', sub: 'Ver aba Dependências' },
        { lbl: 'Documentos', val: '—', sub: 'Ver aba Documentos' },
    ];

    const cardsHtml = cards.map(c => `
        <div class="bg-white border border-gray-200 rounded-lg p-3">
            <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500">${c.lbl}</span>
            <p class="text-lg font-black text-gray-800 mt-1">${c.val}</p>
            <p class="text-[11px] text-gray-400 mt-0.5">${c.sub}</p>
        </div>`).join('');

    // Plano fiscal (Fase 3D)
    const pfp = _bcFiscalPlan;
    const regime = (pfp && pfp.regime_fiscal) || (p.regime_fiscal) || 'FY_BOUND';
    const isCrossFy = regime === 'CROSS_FY';
    const regimeBadge = isCrossFy
        ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-800">CROSS_FY</span>`
        : `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">FY_BOUND</span>`;
    const planFiscalHtml = `
        <div class="bg-white border border-gray-200 rounded-lg p-3" id="bcPlanFiscalCard">
            <div class="flex items-center justify-between mb-2">
                <span class="text-sm font-bold text-gray-800"><i class="fa-solid fa-calendar-days mr-1 text-indigo-600"></i>Plano Fiscal</span>
                <button onclick="_bcAbrirEditarPlanFiscal()" class="text-xs text-indigo-700 font-bold hover:text-indigo-900">
                    <i class="fa-solid fa-pen-to-square mr-1"></i>Editar
                </button>
            </div>
            <div class="grid grid-cols-3 gap-3 text-xs">
                <div>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Regime</span>
                    <div class="mt-1">${regimeBadge}</div>
                </div>
                ${isCrossFy ? `
                <div>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">FY Previsto</span>
                    <p class="font-mono font-bold text-gray-800 mt-1">${escapeHtml(pfp.fy_previsto_inicio || '—')} → ${escapeHtml(pfp.fy_previsto_fim || '—')}</p>
                </div>
                <div>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">Justificativa</span>
                    <p class="text-gray-600 mt-1">${escapeHtml(pfp.justificativa || '—')}</p>
                </div>` : '<div></div><div></div>'}
            </div>
            <div id="bcPlanFiscalEditPanel" class="hidden mt-3 border-t border-gray-100 pt-3">
                <div class="grid grid-cols-1 gap-2 text-xs">
                    <div>
                        <label class="text-[10px] font-bold uppercase tracking-wider text-gray-500">Regime Fiscal</label>
                        <select id="bcPfpRegime" class="mt-1 w-full border border-gray-300 rounded p-1.5 text-xs" onchange="_bcPfpToggleCrossFy()">
                            <option value="FY_BOUND" ${regime === 'FY_BOUND' ? 'selected' : ''}>FY_BOUND — nasce e termina no mesmo exercício</option>
                            <option value="CROSS_FY" ${regime === 'CROSS_FY' ? 'selected' : ''}>CROSS_FY — atravessa exercícios fiscais</option>
                        </select>
                    </div>
                    <div id="bcPfpCrossFyFields" class="${isCrossFy ? '' : 'hidden'} grid grid-cols-2 gap-2">
                        <div>
                            <label class="text-[10px] font-bold uppercase tracking-wider text-gray-500">FY Início Previsto</label>
                            <select id="bcPfpFyInicio" class="mt-1 w-full border border-gray-300 rounded p-1.5 text-xs">
                                <option value="">— selecione —</option>
                                ${(typeof fiscalYearsCache !== 'undefined' ? fiscalYearsCache : []).map(fy =>
                                    `<option value="${escapeHtml(fy.codigo)}" ${(pfp && pfp.fy_previsto_inicio === fy.codigo) ? 'selected' : ''}>${escapeHtml(fy.codigo)}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="text-[10px] font-bold uppercase tracking-wider text-gray-500">FY Fim Previsto</label>
                            <select id="bcPfpFyFim" class="mt-1 w-full border border-gray-300 rounded p-1.5 text-xs">
                                <option value="">— selecione —</option>
                                ${(typeof fiscalYearsCache !== 'undefined' ? fiscalYearsCache : []).map(fy =>
                                    `<option value="${escapeHtml(fy.codigo)}" ${(pfp && pfp.fy_previsto_fim === fy.codigo) ? 'selected' : ''}>${escapeHtml(fy.codigo)}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <div class="col-span-2">
                            <label class="text-[10px] font-bold uppercase tracking-wider text-gray-500">Justificativa</label>
                            <textarea id="bcPfpJustificativa" rows="2" class="mt-1 w-full border border-gray-300 rounded p-1.5 text-xs resize-none" placeholder="Por que este projeto atravessa exercícios?">${escapeHtml((pfp && pfp.justificativa) || '')}</textarea>
                        </div>
                    </div>
                    <div class="flex gap-2 justify-end">
                        <button onclick="_bcFecharEditarPlanFiscal()" class="text-xs text-gray-500 hover:text-gray-700 font-bold px-3 py-1 border border-gray-300 rounded">Cancelar</button>
                        <button onclick="_bcSalvarPlanFiscal()" class="text-xs bg-indigo-700 hover:bg-indigo-800 text-white font-bold px-3 py-1.5 rounded">Salvar Plano Fiscal</button>
                    </div>
                </div>
            </div>
        </div>`;

    el.innerHTML = `
        <div class="space-y-3">
            ${bannerDevolvido}
            <div class="bg-white border border-gray-200 rounded-lg p-3">
                <div class="flex items-center gap-2 overflow-x-auto no-scrollbar">
                    ${stepHtml}
                </div>
            </div>
            <div class="grid grid-cols-4 gap-3">${cardsHtml}</div>
            ${planFiscalHtml}
            <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div class="px-3 py-2 border-b border-gray-100 flex justify-between items-center">
                    <span class="text-sm font-bold text-gray-800">Pendências (V-01 a V-16)</span>
                    <span class="text-xs text-gray-400">Nenhuma pendência registrada</span>
                </div>
                <div class="px-4 py-8 text-center text-xs text-gray-400">
                    Pendências de validação aparecerão aqui quando o BC entrar no fluxo de revisão.
                </div>
            </div>
        </div>`;
}

// -------------------------------------------------------------------------
// PLANO FISCAL (Fase 3D)
// -------------------------------------------------------------------------
function _bcAbrirEditarPlanFiscal() {
    const painel = document.getElementById('bcPlanFiscalEditPanel');
    if (painel) painel.classList.remove('hidden');
}

function _bcFecharEditarPlanFiscal() {
    const painel = document.getElementById('bcPlanFiscalEditPanel');
    if (painel) painel.classList.add('hidden');
}

function _bcPfpToggleCrossFy() {
    const sel = document.getElementById('bcPfpRegime');
    const fields = document.getElementById('bcPfpCrossFyFields');
    if (!sel || !fields) return;
    fields.classList.toggle('hidden', sel.value !== 'CROSS_FY');
}

async function _bcSalvarPlanFiscal() {
    if (!_bcAtual) return;
    const codigo = _bcAtual.codigo;
    const regime = document.getElementById('bcPfpRegime').value;
    const fyInicio = document.getElementById('bcPfpFyInicio') ? document.getElementById('bcPfpFyInicio').value || null : null;
    const fyFim    = document.getElementById('bcPfpFyFim')    ? document.getElementById('bcPfpFyFim').value    || null : null;
    const just     = document.getElementById('bcPfpJustificativa') ? document.getElementById('bcPfpJustificativa').value.trim() || null : null;

    const quem = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.nome : 'desconhecido';

    // 1. Atualiza regime_fiscal no business_case (via view projetos)
    const { error: errProj } = await _supabase
        .from('projetos')
        .update({ regime_fiscal: regime })
        .eq('codigo', codigo);
    if (errProj) return alert('Erro ao salvar regime fiscal: ' + errProj.message);

    // 2. Upsert project_fiscal_plan (só persiste se CROSS_FY ou já existia)
    if (regime === 'CROSS_FY' || _bcFiscalPlan) {
        const payload = {
            business_case_codigo: codigo,
            regime_fiscal:        regime,
            fy_previsto_inicio:   regime === 'CROSS_FY' ? fyInicio : null,
            fy_previsto_fim:      regime === 'CROSS_FY' ? fyFim    : null,
            justificativa:        regime === 'CROSS_FY' ? just     : null,
            criado_por:           _bcFiscalPlan ? undefined : quem,
            atualizado_em:        new Date().toISOString()
        };
        if (!_bcFiscalPlan) payload.criado_por = quem;
        const { data: pfpSalvo, error: errPfp } = await _supabase
            .from('project_fiscal_plan')
            .upsert(payload, { onConflict: 'business_case_codigo' })
            .select()
            .single();
        if (errPfp) return alert('Erro ao salvar plano fiscal: ' + errPfp.message);
        _bcFiscalPlan = pfpSalvo;
    }

    // Atualiza cache local do BC
    if (_bcAtual) _bcAtual.regime_fiscal = regime;
    const projIdx = (typeof projectsData !== 'undefined' ? projectsData : []).findIndex(x => x.codigo === codigo);
    if (projIdx >= 0) projectsData[projIdx].regime_fiscal = regime;

    _bcFecharEditarPlanFiscal();
    _bcRenderResumo(); // re-renderiza com os novos dados
}

// -------------------------------------------------------------------------
// FECHAR WORKSPACE BC
// -------------------------------------------------------------------------
function fecharWorkspaceBC() {
    _bcAtual = null;
    _bcFiscalPlan = null;
    switchTab('portfolio_business_cases');
}
