// =========================================================================
// execucao/workspace-exec.js
// Compasso 2.0 — Fase 5 (D-12/D-10): workspace de Execução (SCR-03).
//
// Dispatch: etapa-dispatcher.js → renderWorkspaceExec(projeto, bodyId)
//
// Abas implementadas:
//   Resumo       — estado + ações principais
//   Plano de Entrega — timeline D-12 com 3 blocos + Registro de Planejamento
// Abas stub:
//   Pacotes de Trabalho, Cronograma, Tarefas, Times, Financeiro, RAID,
//   Mudanças, Liberação para UAT, Histórico
// =========================================================================

let _execProjetoAtual  = null;
let _execAbaAtual      = 'exe_resumo';
let _execPlanoAtual    = null;   // linha de plano_entrega mais recente
let _execBlocosAtual   = [];     // linhas de plano_entrega_bloco do plano atual
let _execRegistro      = [];     // linhas de registro_planejamento

const EXEC_READONLY_ESTADOS = new Set(['READY_FOR_UAT_REVIEW', 'ON_HOLD', 'CANCELLED']);

const EXEC_ESTADO_META = {
    READY_FOR_EXECUTION: { label: 'Pronto para Execução',  cor: 'indigo' },
    IN_EXECUTION:        { label: 'Em Execução',            cor: 'green'  },
    READY_FOR_UAT_REVIEW:{ label: 'Pronto para UAT',        cor: 'indigo' },
    ON_HOLD:             { label: 'Em Espera',              cor: 'amber'  },
    CANCELLED:           { label: 'Cancelado',              cor: 'red'    },
};

const BLOCO_META = {
    EXECUCAO: { label: 'Execução', cor: '#0f1e3d' },
    UAT:      { label: 'UAT',      cor: '#d97706' },
    GO_LIVE:  { label: 'Go Live',  cor: '#16a34a' },
};

const BLOCO_STATUS_BADGE = {
    PLANEJADO:           '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">Planejado</span>',
    RATIFICADO:          '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-800">Ratificado</span>',
    RETIFICADO:          '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">Retificado</span>',
    REQUER_RATIFICACAO:  '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800"><i class="fa-solid fa-triangle-exclamation"></i>Requer ratificação</span>',
};

// -------------------------------------------------------------------------
// ENTRY POINT
// -------------------------------------------------------------------------
async function renderWorkspaceExec(projeto, bodyId) {
    _execProjetoAtual = projeto;
    const el = document.getElementById(bodyId);
    if (!el) return;

    el.className = 'rounded-lg border border-gray-200 shadow-sm overflow-hidden bg-white';

    await _execCarregarPlano();

    el.innerHTML = `
        ${_execRenderStepper()}
        ${_execRenderInfoStrip()}
        ${_execRenderTabBar()}
        <div class="p-4 space-y-3">
            <div id="execBody_exe_resumo"></div>
            <div id="execBody_exe_plano_entrega" class="hidden"></div>
            <div id="execBody_exe_pacotes" class="hidden"></div>
            <div id="execBody_exe_cronograma" class="hidden"></div>
            <div id="execBody_exe_tarefas" class="hidden"></div>
            <div id="execBody_exe_times" class="hidden"></div>
            <div id="execBody_exe_financeiro" class="hidden"></div>
            <div id="execBody_exe_raid" class="hidden"></div>
            <div id="execBody_exe_mudancas" class="hidden"></div>
            <div id="execBody_exe_liberacao_uat" class="hidden"></div>
            <div id="execBody_exe_historico" class="hidden"></div>
        </div>`;

    mudarAbaExec('exe_resumo');
}

// -------------------------------------------------------------------------
// CARREGAMENTO DE DADOS
// -------------------------------------------------------------------------
async function _execCarregarPlano() {
    _execPlanoAtual = null;
    _execBlocosAtual = [];
    _execRegistro = [];
    if (!_execProjetoAtual) return;
    const codigo = _execProjetoAtual.codigo;

    try {
        const { data: planos } = await _supabase.from('plano_entrega')
            .select('*').eq('projeto_codigo', codigo)
            .order('versao', { ascending: false }).limit(1);
        if (planos && planos.length > 0) {
            _execPlanoAtual = planos[0];
            const { data: blocos } = await _supabase.from('plano_entrega_bloco')
                .select('*').eq('plano_id', _execPlanoAtual.id);
            _execBlocosAtual = blocos || [];
        }

        const { data: reg } = await _supabase.from('registro_planejamento')
            .select('*').eq('projeto_codigo', codigo)
            .order('criado_em', { ascending: true });
        _execRegistro = reg || [];
    } catch (_) {}
}

// -------------------------------------------------------------------------
// STEPPER DO CICLO
// -------------------------------------------------------------------------
function _execRenderStepper() {
    const fases = [
        { label: 'Requerimentos', done: true  },
        { label: 'Especificação', done: true  },
        { label: 'Execução',      done: false, active: true },
        { label: 'UAT',           done: false },
        { label: 'Go Live',       done: false },
        { label: 'Encerramento',  done: false },
    ];
    const items = fases.map((f, i) => {
        const circleCls = f.done ? 'background:#16a34a;color:#fff' : (f.active ? 'background:#4338ca;color:#fff' : 'background:#e5e7eb;color:#64748b');
        const labelCls  = f.done ? 'color:#166534' : (f.active ? 'color:#3730a3;font-weight:800' : 'color:#64748b');
        const lineCls   = f.done ? '#16a34a' : '#e5e7eb';
        const inner     = f.done ? '✓' : (i + 1);
        const line      = i < fases.length - 1 ? `<div style="flex-grow:1;height:2px;margin-top:-18px;background:${lineCls};"></div>` : '';
        return `
            <div style="display:flex;align-items:center;${i < fases.length - 1 ? 'flex-grow:1;' : ''}">
                <div style="display:flex;flex-direction:column;align-items:center;gap:5px;width:90px;flex-shrink:0;">
                    <div style="width:24px;height:24px;border-radius:999px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;${circleCls}">${inner}</div>
                    <span style="font-size:10.5px;${labelCls};text-align:center;line-height:1.2;">${f.label}</span>
                </div>
                ${line}
            </div>`;
    }).join('');
    return `<div style="height:64px;flex-shrink:0;box-sizing:border-box;padding:10px 20px;display:flex;align-items:center;background:#fff;border-bottom:1px solid #e5e7eb;">
        <div style="display:flex;align-items:center;width:100%;">${items}</div>
    </div>`;
}

// -------------------------------------------------------------------------
// INFO STRIP (cabeçalho do projeto)
// -------------------------------------------------------------------------
function _execRenderInfoStrip() {
    const p = _execProjetoAtual;
    const estado = (p.exec_estado || 'READY_FOR_EXECUTION').toUpperCase();
    const meta   = EXEC_ESTADO_META[estado] || { label: estado, cor: 'slate' };
    const badgeCls = { indigo: 'bg-indigo-100 text-indigo-800', green: 'bg-green-100 text-green-800', amber: 'bg-amber-100 text-amber-800', red: 'bg-red-100 text-red-800', slate: 'bg-slate-100 text-slate-700' }[meta.cor] || 'bg-slate-100 text-slate-700';
    const versaoLabel = _execPlanoAtual ? `Plano de Entrega v${_execPlanoAtual.versao}` : 'Sem plano';
    const versaoBadge = _execPlanoAtual
        ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800">${versaoLabel}</span>`
        : `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-500">Sem plano</span>`;

    return `
        <div class="px-5 py-3 bg-white border-b border-gray-100 flex items-center gap-5 flex-wrap">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-xs text-gray-400 font-semibold">${escapeHtml(p.codigo)} · Execução</span>
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${badgeCls}">${meta.label}</span>
                    ${versaoBadge}
                </div>
                <h1 class="text-lg font-black text-[#0f1e3d] truncate mt-0.5">${escapeHtml(p.nome || '')}</h1>
            </div>
            <div class="flex gap-5 flex-shrink-0">
                ${[['Owner', p.pessoa_responsavel || '—'], ['FY', p.ano_fiscal || '—'], ['Aprovado FY', formatCurrency(Number(p.val_aprovado_fy || 0))]]
                    .map(([l, v]) => `<div class="flex flex-col gap-0.5"><span class="text-[10px] font-bold uppercase tracking-wider text-gray-400">${l}</span><b class="text-sm text-[#0f1e3d]">${escapeHtml(String(v))}</b></div>`).join('')}
            </div>
        </div>`;
}

// -------------------------------------------------------------------------
// TAB BAR
// -------------------------------------------------------------------------
function _execRenderTabBar() {
    function btn(id, label) {
        return `<button id="execTab_${id}" onclick="mudarAbaExec('${id}')" class="exec-tab-btn px-2 py-1.5 text-xs text-gray-500 border-b-2 border-transparent whitespace-nowrap hover:text-gray-800">${label}</button>`;
    }
    function sep() { return `<div class="w-px h-5 bg-gray-200 mx-1 self-end mb-1.5"></div>`; }
    function grp(label, btns) {
        return `<div class="flex flex-col gap-0.5">
            <span class="text-[9px] font-bold uppercase tracking-widest text-[#93a4c3] pl-0.5">${label}</span>
            <div class="flex">${btns.join('')}</div>
        </div>`;
    }
    return `
        <div class="flex items-end gap-1.5 bg-white border-b border-gray-200 px-3 pt-1.5 pb-0 flex-wrap">
            <div class="flex flex-col gap-0.5">
                <span class="text-[9px] font-bold uppercase tracking-widest text-transparent pl-0.5">—</span>
                <div class="flex">${btn('exe_resumo','Resumo')}</div>
            </div>
            ${sep()}
            ${grp('Planejamento', [btn('exe_plano_entrega','Plano de Entrega'), btn('exe_pacotes','Pacotes de Trabalho'), btn('exe_cronograma','Cronograma')])}
            ${sep()}
            ${grp('Trabalho', [btn('exe_tarefas','Tarefas'), btn('exe_times','Times')])}
            ${sep()}
            ${grp('Controle', [btn('exe_financeiro','Financeiro'), btn('exe_raid','RAID'), btn('exe_mudancas','Mudanças')])}
            ${sep()}
            ${grp('Decisão', [btn('exe_liberacao_uat','Liberação para UAT')])}
            ${sep()}
            ${grp('Registro', [btn('exe_historico','Histórico')])}
        </div>`;
}

function mudarAbaExec(aba) {
    _execAbaAtual = aba;
    document.querySelectorAll('.exec-tab-btn').forEach(b => {
        const isActive = b.id === `execTab_${aba}`;
        b.classList.toggle('text-indigo-700', isActive);
        b.classList.toggle('border-indigo-600', isActive);
        b.classList.toggle('font-bold', isActive);
        b.classList.toggle('text-gray-500', !isActive);
        b.classList.toggle('border-transparent', !isActive);
    });
    const paineis = ['exe_resumo','exe_plano_entrega','exe_pacotes','exe_cronograma',
                     'exe_tarefas','exe_times','exe_financeiro','exe_raid','exe_mudancas',
                     'exe_liberacao_uat','exe_historico'];
    paineis.forEach(id => {
        const el = document.getElementById(`execBody_${id}`);
        if (el) el.classList.toggle('hidden', id !== aba);
    });

    if (aba === 'exe_resumo')          _execRenderResumo();
    else if (aba === 'exe_plano_entrega') _execRenderPlanoEntrega();
    else _execRenderStub(aba);
}

// -------------------------------------------------------------------------
// ABA: RESUMO
// -------------------------------------------------------------------------
function _execRenderResumo() {
    const el = document.getElementById('execBody_exe_resumo');
    if (!el || !_execProjetoAtual) return;
    const p      = _execProjetoAtual;
    const estado = (p.exec_estado || 'READY_FOR_EXECUTION').toUpperCase();
    const temPlano = !!_execPlanoAtual;

    const kpis = [
        { lbl: 'Estado',         val: (EXEC_ESTADO_META[estado] || { label: estado }).label, sub: 'SCR-03 Execução' },
        { lbl: 'Plano',          val: temPlano ? `v${_execPlanoAtual.versao}` : '—', sub: temPlano ? 'versão atual' : 'Não criado' },
        { lbl: 'Tarefas',        val: '—', sub: 'Ver aba Tarefas' },
        { lbl: 'Health',         val: '—', sub: 'A calcular' },
    ];

    const cardsHtml = `
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
            ${kpis.map(c => `
                <div class="bg-white border border-gray-200 rounded-lg p-3">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500">${c.lbl}</span>
                    <p class="text-base font-black text-gray-800 mt-1">${c.val}</p>
                    <p class="text-[11px] text-gray-400 mt-0.5">${c.sub}</p>
                </div>`).join('')}
        </div>`;

    // Ação principal por estado
    let acaoHtml = '';
    if (estado === 'READY_FOR_EXECUTION') {
        if (!temPlano) {
            acaoHtml = `
                <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 flex gap-2 items-start">
                    <i class="fa-solid fa-info-circle mt-0.5 text-blue-500 flex-shrink-0"></i>
                    <div>
                        <b>Crie o Plano de Entrega antes de iniciar.</b>
                        <span class="ml-1">O plano define as janelas de Execução, UAT e Go Live e vira a baseline do Cronograma (D-10).</span>
                    </div>
                </div>
                <div class="flex justify-end">
                    <button onclick="mudarAbaExec('exe_plano_entrega')"
                        class="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-700 text-white hover:bg-indigo-800">
                        <i class="fa-solid fa-calendar-plus mr-1"></i>Criar Plano de Entrega
                    </button>
                </div>`;
        } else {
            acaoHtml = `
                <div class="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-900 flex gap-2 items-start">
                    <i class="fa-solid fa-check-circle mt-0.5 text-green-600 flex-shrink-0"></i>
                    <div><b>Plano de Entrega criado.</b> <span class="ml-1">Revise os blocos e inicie a execução.</span></div>
                </div>
                <div class="flex justify-end gap-2">
                    <button onclick="mudarAbaExec('exe_plano_entrega')"
                        class="px-4 py-2 rounded-lg text-xs font-bold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
                        Ver Plano de Entrega
                    </button>
                    <button onclick="_execIniciarExecucao()"
                        class="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-700 text-white hover:bg-indigo-800">
                        <i class="fa-solid fa-play mr-1"></i>Iniciar Execução
                    </button>
                </div>`;
        }
    } else if (estado === 'IN_EXECUTION') {
        acaoHtml = `
            <div class="flex justify-end gap-2">
                <button onclick="mudarAbaExec('exe_plano_entrega')"
                    class="px-4 py-2 rounded-lg text-xs font-bold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
                    <i class="fa-solid fa-calendar mr-1"></i>Ver Plano de Entrega
                </button>
                <button onclick="mudarAbaExec('exe_liberacao_uat')"
                    class="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-700 text-white hover:bg-indigo-800">
                    Liberar para UAT
                </button>
            </div>`;
    }

    el.innerHTML = `<div class="space-y-3">${cardsHtml}${acaoHtml}</div>`;
}

// -------------------------------------------------------------------------
// ABA: PLANO DE ENTREGA (D-12)
// -------------------------------------------------------------------------
function _execRenderPlanoEntrega() {
    const el = document.getElementById('execBody_exe_plano_entrega');
    if (!el || !_execProjetoAtual) return;

    if (!_execPlanoAtual) {
        el.innerHTML = _execRenderFormCriarPlano();
        return;
    }

    el.innerHTML = `
        <div class="space-y-4">
            ${_execRenderTimelinePlano()}
            ${_execRenderRegistroPlanejamento()}
        </div>`;
}

// Formulário para criar o plano inicial
function _execRenderFormCriarPlano() {
    return `
        <div class="space-y-4">
            <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-3 text-xs text-indigo-900 flex gap-2">
                <i class="fa-solid fa-calendar-plus mt-0.5 text-indigo-500 flex-shrink-0"></i>
                <div>
                    <b>Plano de Entrega inicial.</b>
                    <span class="ml-1">Define as janelas de Execução, UAT e Go Live. A versão criada aqui vira a baseline do Cronograma (D-10) ao Iniciar Execução.</span>
                </div>
            </div>
            <div class="bg-white border border-gray-200 rounded-lg p-4 space-y-5">
                <h3 class="text-sm font-bold text-gray-800">Blocos do Plano de Entrega</h3>

                ${['EXECUCAO','UAT','GO_LIVE'].map(bloco => {
                    const meta = BLOCO_META[bloco];
                    return `
                        <div class="rounded-lg border border-gray-200 p-3 space-y-2">
                            <span class="text-xs font-bold text-gray-700">${meta.label}</span>
                            <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
                                <div>
                                    <label class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Início</label>
                                    <input type="date" id="execPlanInicio_${bloco}" class="mt-1 w-full text-xs border border-gray-300 rounded px-2 py-1.5">
                                </div>
                                <div>
                                    <label class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Fim</label>
                                    <input type="date" id="execPlanFim_${bloco}" class="mt-1 w-full text-xs border border-gray-300 rounded px-2 py-1.5">
                                </div>
                                <div class="sm:col-span-2">
                                    <label class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Responsável</label>
                                    <input type="text" id="execPlanResp_${bloco}" placeholder="Nome do responsável"
                                        class="mt-1 w-full text-xs border border-gray-300 rounded px-2 py-1.5">
                                </div>
                            </div>
                        </div>`;
                }).join('')}

                <div class="flex justify-end gap-2">
                    <button onclick="mudarAbaExec('exe_resumo')"
                        class="px-4 py-2 rounded-lg text-xs font-bold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">Cancelar</button>
                    <button onclick="_execSalvarPlano()"
                        class="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-700 text-white hover:bg-indigo-800">
                        <i class="fa-solid fa-floppy-disk mr-1"></i>Criar Plano de Entrega (v1)
                    </button>
                </div>
            </div>
        </div>`;
}

// Timeline visual dos 3 blocos
function _execRenderTimelinePlano() {
    const blocos = ['EXECUCAO', 'UAT', 'GO_LIVE'].map(k =>
        _execBlocosAtual.find(b => b.bloco === k)
    ).filter(Boolean);

    if (blocos.length === 0) {
        return `<div class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-xs text-gray-400">Blocos não carregados.</div>`;
    }

    // Date range
    const datas = blocos.flatMap(b => [b.dt_inicio, b.dt_fim].filter(Boolean));
    if (datas.length < 2) {
        return `<div class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-xs text-gray-400">Datas incompletas.</div>`;
    }
    const dtMin = datas.reduce((a, b) => a < b ? a : b);
    const dtMax = datas.reduce((a, b) => a > b ? a : b);
    const totalDias = Math.max(1, (new Date(dtMax) - new Date(dtMin)) / 86400000);

    function pct(dt) {
        if (!dt) return 0;
        return Math.min(100, Math.max(0, ((new Date(dt) - new Date(dtMin)) / 86400000 / totalDias) * 100));
    }

    const hoje = new Date().toISOString().split('T')[0];
    const hojePct = pct(hoje);

    const versaoLabel = `v${_execPlanoAtual.versao}${_execPlanoAtual.eh_baseline ? ' · baseline' : ''}`;

    const linhas = blocos.map(b => {
        const meta   = BLOCO_META[b.bloco] || { label: b.bloco, cor: '#64748b' };
        const badge  = BLOCO_STATUS_BADGE[b.status] || '';
        const left   = pct(b.dt_inicio).toFixed(1);
        const width  = b.dt_inicio && b.dt_fim
            ? Math.max(2, ((new Date(b.dt_fim) - new Date(b.dt_inicio)) / 86400000 / totalDias * 100)).toFixed(1)
            : '10';
        const isRequer = b.status === 'REQUER_RATIFICACAO';
        const barStyle = isRequer
            ? `left:${left}%;width:${width}%;background:transparent;border:2px dashed #dc2626;color:#991b1b;`
            : `left:${left}%;width:${width}%;background:${meta.cor};`;
        return `
            <div class="flex items-center border-t border-gray-100 py-2">
                <div class="w-52 flex-shrink-0 flex flex-col gap-1 pr-4">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-gray-800">${meta.label}</span>
                        ${badge}
                    </div>
                    <span class="text-[11px] text-gray-400">${escapeHtml(b.responsavel || '—')}</span>
                </div>
                <div class="flex-1 relative h-10">
                    <div style="position:absolute;${barStyle}top:11px;height:18px;border-radius:4px;display:flex;align-items:center;padding-left:6px;overflow:hidden;white-space:nowrap;">
                        <span style="font-size:10.5px;font-weight:700;color:${isRequer ? '#991b1b' : '#fff'};">
                            ${b.dt_inicio ? formatDate(b.dt_inicio) : ''}${b.dt_fim ? ' – ' + formatDate(b.dt_fim) : ''}
                        </span>
                    </div>
                    ${hojePct >= 0 && hojePct <= 100 ? `<div style="position:absolute;left:${hojePct.toFixed(1)}%;top:0;bottom:0;width:2px;background:#4338ca;opacity:0.5;"></div>` : ''}
                </div>
                <div class="w-24 flex justify-end flex-shrink-0 pl-2">
                    ${b.status === 'PLANEJADO' ?
                        `<button onclick="_execRatificarBloco('${b.bloco}')" class="text-xs font-bold text-indigo-700 hover:text-indigo-900">Ratificar</button>` :
                     b.status === 'REQUER_RATIFICACAO' ?
                        `<button onclick="_execRatificarBloco('${b.bloco}')" class="text-xs font-bold text-red-700 hover:text-red-900">Ratificar</button>` : ''}
                </div>
            </div>`;
    }).join('');

    // Marcadores de data no eixo X
    const dataMarcadores = [dtMin, ...blocos.flatMap(b => [b.dt_inicio, b.dt_fim]).filter(Boolean), dtMax]
        .filter((v, i, a) => a.indexOf(v) === i)
        .map(dt => `<div style="position:absolute;left:${pct(dt).toFixed(1)}%;transform:translateX(-50%);font-size:10px;color:#64748b;font-weight:700;white-space:nowrap;">${formatDate(dt)}</div>`).join('');

    return `
        <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div class="px-4 py-2.5 flex justify-between items-center border-b border-gray-100">
                <span class="text-sm font-bold text-gray-800">Plano de Entrega · <span class="text-indigo-700">${versaoLabel}</span></span>
                <div class="flex gap-2">
                    <button onclick="_execAbrirFormRetificacao()" class="text-xs font-semibold text-gray-600 hover:text-gray-900 border border-gray-300 rounded px-2.5 py-1">Retificar bloco</button>
                </div>
            </div>
            <div class="px-4 pb-2">
                <div class="relative h-5 ml-52">
                    ${dataMarcadores}
                </div>
                ${linhas}
                <div class="flex gap-4 pt-2 border-t border-gray-100 mt-1 text-[11px] text-gray-400">
                    <div class="flex items-center gap-1"><span style="display:inline-block;width:18px;height:6px;background:#0f1e3d;border-radius:3px;"></span> Execução</div>
                    <div class="flex items-center gap-1"><span style="display:inline-block;width:18px;height:6px;background:#d97706;border-radius:3px;"></span> UAT</div>
                    <div class="flex items-center gap-1"><span style="display:inline-block;width:18px;height:6px;background:#16a34a;border-radius:3px;"></span> Go Live</div>
                    <div class="flex items-center gap-1"><span style="display:inline-block;width:18px;height:6px;border:2px dashed #dc2626;border-radius:3px;"></span> Requer ratificação</div>
                    <div class="flex items-center gap-1"><span style="display:inline-block;width:2px;height:12px;background:#4338ca;opacity:0.5;"></span> Hoje</div>
                </div>
            </div>
        </div>`;
}

// Registro de Planejamento (append-only)
function _execRenderRegistroPlanejamento() {
    const ACAO_BADGE = {
        'Planejado':           BLOCO_STATUS_BADGE.PLANEJADO,
        'Ratificado':          BLOCO_STATUS_BADGE.RATIFICADO,
        'Retificado':          BLOCO_STATUS_BADGE.RETIFICADO,
        'Requer ratificação':  BLOCO_STATUS_BADGE.REQUER_RATIFICACAO,
    };

    const rows = _execRegistro.map(r => `
        <tr>
            <td class="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">${r.data_acao ? formatDate(r.data_acao) : '—'}</td>
            <td class="px-3 py-2 text-xs text-gray-600">${escapeHtml(r.etapa || '')}</td>
            <td class="px-3 py-2 text-xs font-semibold text-gray-800">${escapeHtml(r.bloco || '—')}</td>
            <td class="px-3 py-2">${ACAO_BADGE[r.acao] || `<span class="text-xs text-gray-600">${escapeHtml(r.acao || '')}</span>`}</td>
            <td class="px-3 py-2 text-xs text-gray-600">${escapeHtml(r.autor || '—')}</td>
            <td class="px-3 py-2 text-xs text-gray-500">${escapeHtml(r.justificativa || '')}</td>
            <td class="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">${escapeHtml(r.datas_antes || '')}${r.datas_antes && r.datas_depois ? ' → ' : ''}${escapeHtml(r.datas_depois || '')}</td>
            <td class="px-3 py-2 text-xs font-bold text-gray-700">${r.versao ? `v${r.versao}` : '—'}</td>
        </tr>`).join('');

    const vazio = `<tr><td colspan="8" class="px-3 py-6 text-center text-xs text-gray-400">Nenhuma ação registrada ainda.</td></tr>`;

    return `
        <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div class="px-4 py-2.5 flex justify-between items-center border-b border-gray-100">
                <span class="text-sm font-bold text-gray-800">Registro de Planejamento</span>
                <span class="text-[11px] text-gray-400">Nenhuma linha é alterada ou apagada (D-12)</span>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead class="border-b border-gray-100 bg-gray-50">
                        <tr>
                            <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Data</th>
                            <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Etapa</th>
                            <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Bloco</th>
                            <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Ação</th>
                            <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Autor</th>
                            <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Justificativa</th>
                            <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Datas antes → depois</th>
                            <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Versão</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-50">${rows || vazio}</tbody>
                </table>
            </div>
        </div>`;
}

// -------------------------------------------------------------------------
// AÇÕES
// -------------------------------------------------------------------------
async function _execSalvarPlano() {
    if (!_execProjetoAtual) return;
    const blocos = ['EXECUCAO', 'UAT', 'GO_LIVE'];
    for (const b of blocos) {
        const ini = document.getElementById(`execPlanInicio_${b}`)?.value;
        const fim = document.getElementById(`execPlanFim_${b}`)?.value;
        if (!ini || !fim) {
            alert(`Preencha início e fim do bloco ${BLOCO_META[b].label}.`);
            return;
        }
        if (ini >= fim) {
            alert(`A data de início do bloco ${BLOCO_META[b].label} deve ser anterior ao fim.`);
            return;
        }
    }

    try {
        const { data: plano, error: ePlano } = await _supabase.from('plano_entrega').insert({
            projeto_codigo: _execProjetoAtual.codigo,
            versao: 1,
            eh_baseline: false,
            criado_por: currentUser?.email || '',
        }).select().single();
        if (ePlano) throw ePlano;

        const blocosPayload = blocos.map(b => ({
            plano_id:    plano.id,
            bloco:       b,
            dt_inicio:   document.getElementById(`execPlanInicio_${b}`).value,
            dt_fim:      document.getElementById(`execPlanFim_${b}`).value,
            responsavel: document.getElementById(`execPlanResp_${b}`)?.value || '',
            status:      'PLANEJADO',
        }));
        const { error: eBlocos } = await _supabase.from('plano_entrega_bloco').insert(blocosPayload);
        if (eBlocos) throw eBlocos;

        // Registro
        await _supabase.from('registro_planejamento').insert({
            projeto_codigo: _execProjetoAtual.codigo,
            data_acao:      new Date().toISOString().split('T')[0],
            etapa:          'Execução',
            bloco:          'Execução · UAT · Go Live',
            acao:           'Planejado',
            autor:          currentUser?.email || '',
            justificativa:  'Plano inicial; vira baseline do Cronograma ao Iniciar Execução (D-10)',
            versao:         1,
        });

        await _execCarregarPlano();
        _execRenderPlanoEntrega();

        // Atualiza cache em memória
        const idx = projectsData.findIndex(p => p.codigo === _execProjetoAtual.codigo);
        if (idx >= 0) projectsData[idx] = { ...projectsData[idx], exec_estado: 'READY_FOR_EXECUTION' };

    } catch (err) {
        alert('Erro ao salvar plano: ' + (err.message || JSON.stringify(err)));
    }
}

async function _execIniciarExecucao() {
    if (!_execProjetoAtual || !_execPlanoAtual) return;
    if (!confirm('Iniciar Execução? O Plano de Entrega v1 será gravado como baseline do Cronograma (D-10). Esta ação não pode ser desfeita.')) return;

    try {
        // Marca plano como baseline
        await _supabase.from('plano_entrega').update({ eh_baseline: true }).eq('id', _execPlanoAtual.id);
        // Atualiza estado do projeto
        await _supabase.from('projetos').update({ exec_estado: 'IN_EXECUTION' }).eq('codigo', _execProjetoAtual.codigo);

        // Atualiza cache em memória
        _execProjetoAtual = { ..._execProjetoAtual, exec_estado: 'IN_EXECUTION' };
        const idx = projectsData.findIndex(p => p.codigo === _execProjetoAtual.codigo);
        if (idx >= 0) projectsData[idx] = { ...projectsData[idx], exec_estado: 'IN_EXECUTION' };

        await _execCarregarPlano();
        mudarAbaExec('exe_resumo');
    } catch (err) {
        alert('Erro ao iniciar execução: ' + (err.message || JSON.stringify(err)));
    }
}

async function _execRatificarBloco(bloco) {
    if (!_execProjetoAtual || !_execPlanoAtual) return;
    const b = _execBlocosAtual.find(x => x.bloco === bloco);
    if (!b) return;

    if (!confirm(`Ratificar o bloco ${BLOCO_META[bloco]?.label || bloco} sem alterações?`)) return;

    try {
        const dtAnt = `${b.dt_inicio || '—'} – ${b.dt_fim || '—'}`;
        await _supabase.from('plano_entrega_bloco').update({ status: 'RATIFICADO' }).eq('id', b.id);
        await _supabase.from('registro_planejamento').insert({
            projeto_codigo: _execProjetoAtual.codigo,
            data_acao:      new Date().toISOString().split('T')[0],
            etapa:          BLOCO_META[bloco]?.label || bloco,
            bloco:          BLOCO_META[bloco]?.label || bloco,
            acao:           'Ratificado',
            autor:          currentUser?.email || '',
            justificativa:  'Entrada confirmada: bloco ratificado sem alterações.',
            datas_antes:    dtAnt,
            datas_depois:   dtAnt,
            versao:         _execPlanoAtual.versao,
        });

        await _execCarregarPlano();
        _execRenderPlanoEntrega();
    } catch (err) {
        alert('Erro ao ratificar: ' + (err.message || JSON.stringify(err)));
    }
}

function _execAbrirFormRetificacao() {
    alert('Retificação de bloco — em desenvolvimento (Fase 5+).\n\nRetificar permite alterar as datas de um bloco com justificativa obrigatória, gerando nova versão do plano. Se o bloco retificado for UAT, o bloco de Go Live passa automaticamente para "Requer ratificação".');
}

// -------------------------------------------------------------------------
// STUBS
// -------------------------------------------------------------------------
function _execRenderStub(aba) {
    const labels = {
        exe_pacotes:       { l: 'Pacotes de Trabalho', i: 'fa-boxes-stacked' },
        exe_cronograma:    { l: 'Cronograma',           i: 'fa-bars-progress' },
        exe_tarefas:       { l: 'Tarefas',              i: 'fa-list-check' },
        exe_times:         { l: 'Times',                i: 'fa-users' },
        exe_financeiro:    { l: 'Financeiro',           i: 'fa-coins' },
        exe_raid:          { l: 'RAID',                 i: 'fa-shield-halved' },
        exe_mudancas:      { l: 'Mudanças',             i: 'fa-code-branch' },
        exe_liberacao_uat: { l: 'Liberação para UAT',   i: 'fa-vial-circle-check' },
        exe_historico:     { l: 'Histórico',            i: 'fa-clock-rotate-left' },
    };
    const info = labels[aba] || { l: aba, i: 'fa-diagram-project' };
    const el = document.getElementById(`execBody_${aba}`);
    if (!el) return;
    el.innerHTML = `
        <div class="flex flex-col items-center justify-center py-16 text-gray-400">
            <i class="fa-solid ${info.i} text-3xl mb-3 opacity-40"></i>
            <span class="text-sm font-semibold">${info.l}</span>
            <span class="text-xs mt-1">Em desenvolvimento — Fase 5+</span>
        </div>`;
}
