// =========================================================================
// uat/workspace-uat.js
// Compasso 2.0 — Fase 6 (cap.07): workspace de UAT (SCR-03 aba etapa_uat).
//
// Abas implementadas:
//   Resumo       — estado, resultado acumulado, UAV checklist parcial
//   Ciclos       — tabela de ciclos + ratificar/retificar bloco D-12
//   Defeitos     — grid de defeitos por ciclo
//   Aceite do UAT — UAV-01 a 06 + ação formal
// Abas stub:
//   Plano de UAT, Casos de Teste, Histórico
// =========================================================================

let _uatProjetoAtual = null;
let _uatAbaAtual     = 'uat_resumo';
let _uatCiclos       = [];
let _uatDefeitos     = [];

const UAT_ESTADO_META = {
    UAT_PLANNING:                     { label: 'Planejamento do UAT',  cor: 'indigo' },
    UAT_READY:                        { label: 'Pronto para Iniciar',  cor: 'indigo' },
    UAT_CYCLE_IN_PROGRESS:            { label: 'Ciclo em Andamento',   cor: 'green'  },
    UAT_CYCLE_CLOSED:                 { label: 'Ciclo Encerrado',      cor: 'slate'  },
    UAT_ACCEPTANCE:                   { label: 'Aguardando Aceite',    cor: 'amber'  },
    UAT_ACCEPTED:                     { label: 'UAT Aceito',           cor: 'green'  },
    UAT_ACCEPTED_WITH_RESTRICTIONS:   { label: 'Aceito com Restrições', cor: 'amber' },
    UAT_REJECTED:                     { label: 'UAT Rejeitado',        cor: 'red'    },
};

// -------------------------------------------------------------------------
// ENTRY POINT
// -------------------------------------------------------------------------
async function renderWorkspaceUat(projeto, bodyId) {
    _uatProjetoAtual = projeto;
    const el = document.getElementById(bodyId);
    if (!el) return;

    el.className = 'rounded-lg border border-gray-200 shadow-sm overflow-hidden bg-white';

    await _uatCarregarDados();

    el.innerHTML = `
        ${_uatRenderStepper()}
        ${_uatRenderInfoStrip()}
        ${_uatRenderTabBar()}
        <div class="p-4 space-y-3">
            <div id="uatBody_uat_resumo"></div>
            <div id="uatBody_uat_plano" class="hidden"></div>
            <div id="uatBody_uat_casos" class="hidden"></div>
            <div id="uatBody_uat_ciclos" class="hidden"></div>
            <div id="uatBody_uat_defeitos" class="hidden"></div>
            <div id="uatBody_uat_aceite" class="hidden"></div>
            <div id="uatBody_uat_historico" class="hidden"></div>
        </div>`;

    mudarAbaUat('uat_resumo');
}

// -------------------------------------------------------------------------
// DADOS
// -------------------------------------------------------------------------
async function _uatCarregarDados() {
    _uatCiclos = [];
    _uatDefeitos = [];
    if (!_uatProjetoAtual) return;
    const codigo = _uatProjetoAtual.codigo;
    try {
        const { data: c } = await _supabase.from('uat_ciclos').select('*')
            .eq('projeto_codigo', codigo).order('numero');
        _uatCiclos = c || [];

        const { data: d } = await _supabase.from('uat_defeitos').select('*')
            .eq('projeto_codigo', codigo).order('criado_em');
        _uatDefeitos = d || [];
    } catch (_) {}
}

// -------------------------------------------------------------------------
// STEPPER
// -------------------------------------------------------------------------
function _uatRenderStepper() {
    const fases = [
        { label: 'Requerimentos', done: true  },
        { label: 'Especificação', done: true  },
        { label: 'Execução',      done: true  },
        { label: 'UAT',           done: false, active: true },
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
// INFO STRIP
// -------------------------------------------------------------------------
function _uatRenderInfoStrip() {
    const p = _uatProjetoAtual;
    const estado = (p.uat_estado || 'UAT_PLANNING').toUpperCase();
    const meta = UAT_ESTADO_META[estado] || { label: estado, cor: 'slate' };
    const badgeCls = { indigo: 'bg-indigo-100 text-indigo-800', green: 'bg-green-100 text-green-800', amber: 'bg-amber-100 text-amber-800', red: 'bg-red-100 text-red-800', slate: 'bg-slate-100 text-slate-700' }[meta.cor] || 'bg-slate-100 text-slate-700';
    const cicloAtual = _uatCiclos.length > 0 ? `UAT-${String(_uatCiclos[_uatCiclos.length - 1].numero).padStart(2, '0')}` : 'Sem ciclos';
    const versaoBloco = (p.plano_uat_versao) ? `Bloco v${p.plano_uat_versao}` : '';
    const blocoRequer = _execBlocoUatRequerRatificacao ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800"><i class="fa-solid fa-triangle-exclamation mr-1"></i>Bloco requer ratificação</span>` : '';

    return `
        <div class="px-5 py-3 bg-white border-b border-gray-100 flex items-center gap-5 flex-wrap">
            <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-xs text-gray-400 font-semibold">${escapeHtml(p.codigo)} · UAT</span>
                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${badgeCls}">${meta.label}</span>
                    ${cicloAtual !== 'Sem ciclos' ? `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">${cicloAtual}</span>` : ''}
                    ${blocoRequer}
                </div>
                <h1 class="text-lg font-black text-[#0f1e3d] truncate mt-0.5">${escapeHtml(p.nome || '')}</h1>
            </div>
            <div class="flex gap-5 flex-shrink-0">
                ${[['Owner', p.pessoa_responsavel || '—'], ['FY', p.ano_fiscal || '—']]
                    .map(([l, v]) => `<div class="flex flex-col gap-0.5"><span class="text-[10px] font-bold uppercase tracking-wider text-gray-400">${l}</span><b class="text-sm text-[#0f1e3d]">${escapeHtml(String(v))}</b></div>`).join('')}
            </div>
        </div>`;
}

// Indica se bloco UAT está em REQUER_RATIFICACAO (lido do plano de entrega via cache)
let _execBlocoUatRequerRatificacao = false;

// -------------------------------------------------------------------------
// TAB BAR
// -------------------------------------------------------------------------
function _uatRenderTabBar() {
    function btn(id, label) {
        return `<button id="uatTab_${id}" onclick="mudarAbaUat('${id}')" class="uat-tab-btn px-2 py-1.5 text-xs text-gray-500 border-b-2 border-transparent whitespace-nowrap hover:text-gray-800">${label}</button>`;
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
                <div class="flex">${btn('uat_resumo','Resumo')}</div>
            </div>
            ${sep()}
            ${grp('Preparação', [btn('uat_plano','Plano de UAT'), btn('uat_casos','Casos de Teste')])}
            ${sep()}
            ${grp('Execução', [btn('uat_ciclos','Ciclos'), btn('uat_defeitos','Defeitos')])}
            ${sep()}
            ${grp('Decisão', [btn('uat_aceite','Aceite do UAT')])}
            ${sep()}
            ${grp('Registro', [btn('uat_historico','Histórico')])}
        </div>`;
}

function mudarAbaUat(aba) {
    _uatAbaAtual = aba;
    document.querySelectorAll('.uat-tab-btn').forEach(b => {
        const on = b.id === `uatTab_${aba}`;
        b.classList.toggle('text-indigo-700', on);
        b.classList.toggle('border-indigo-600', on);
        b.classList.toggle('font-bold', on);
        b.classList.toggle('text-gray-500', !on);
        b.classList.toggle('border-transparent', !on);
    });
    ['uat_resumo','uat_plano','uat_casos','uat_ciclos','uat_defeitos','uat_aceite','uat_historico'].forEach(id => {
        const el = document.getElementById(`uatBody_${id}`);
        if (el) el.classList.toggle('hidden', id !== aba);
    });
    if (aba === 'uat_resumo')     _uatRenderResumo();
    else if (aba === 'uat_ciclos')    _uatRenderCiclos();
    else if (aba === 'uat_defeitos')  _uatRenderDefeitos();
    else if (aba === 'uat_aceite')    _uatRenderAceite();
    else _uatRenderStub(aba);
}

// -------------------------------------------------------------------------
// ABA: RESUMO
// -------------------------------------------------------------------------
function _uatRenderResumo() {
    const el = document.getElementById('uatBody_uat_resumo');
    if (!el || !_uatProjetoAtual) return;
    const p = _uatProjetoAtual;

    const totalCiclos   = _uatCiclos.length;
    const cicloAtivo    = _uatCiclos.find(c => c.status === 'EM_ANDAMENTO');
    const defAbertos    = _uatDefeitos.filter(d => d.status === 'ABERTO').length;
    const defCriticos   = _uatDefeitos.filter(d => d.severidade === 'CRITICA' && d.status === 'ABERTO').length;
    const defAltos      = _uatDefeitos.filter(d => d.severidade === 'ALTA' && d.status === 'ABERTO').length;

    const kpis = [
        { lbl: 'Ciclos',          val: totalCiclos || '0',   sub: cicloAtivo ? `UAT-${cicloAtivo.numero} em andamento` : 'Nenhum ativo' },
        { lbl: 'Defeitos Abertos',val: defAbertos || '0',    sub: `${defCriticos} críticos · ${defAltos} altos` },
        { lbl: 'Estado',          val: (UAT_ESTADO_META[p.uat_estado || 'UAT_PLANNING'] || {}).label || '—', sub: 'UAT' },
    ];

    const cardsHtml = `
        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            ${kpis.map(c => `
                <div class="bg-white border border-gray-200 rounded-lg p-3">
                    <span class="text-[10px] font-bold uppercase tracking-wider text-gray-500">${c.lbl}</span>
                    <p class="text-base font-black text-gray-800 mt-1">${c.val}</p>
                    <p class="text-[11px] text-gray-400 mt-0.5">${c.sub}</p>
                </div>`).join('')}
        </div>`;

    const estado = (p.uat_estado || 'UAT_PLANNING').toUpperCase();
    let acaoHtml = '';
    if (estado === 'UAT_PLANNING') {
        acaoHtml = `
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 flex gap-2 items-start">
                <i class="fa-solid fa-info-circle mt-0.5 text-blue-500 flex-shrink-0"></i>
                <div><b>Ratifique ou retifique o bloco de UAT antes de abrir o primeiro ciclo.</b> <span class="ml-1">O bloco vem do Plano de Entrega da Execução. Toda retificação gera nova versão e notifica o responsável pelo Go Live.</span></div>
            </div>
            <div class="flex justify-end">
                <button onclick="mudarAbaUat('uat_ciclos')" class="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-700 text-white hover:bg-indigo-800">
                    <i class="fa-solid fa-check-circle mr-1"></i>Ratificar bloco de UAT
                </button>
            </div>`;
    } else if (['UAT_ACCEPTED','UAT_ACCEPTED_WITH_RESTRICTIONS'].includes(estado)) {
        acaoHtml = `
            <div class="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-900 flex gap-2 items-start">
                <i class="fa-solid fa-check-circle mt-0.5 text-green-600 flex-shrink-0"></i>
                <div><b>UAT aceito.</b> <span class="ml-1">O Go Live está habilitado.</span></div>
            </div>`;
    } else if (estado === 'UAT_CYCLE_IN_PROGRESS') {
        acaoHtml = `
            <div class="flex justify-end gap-2">
                <button onclick="mudarAbaUat('uat_defeitos')" class="px-4 py-2 rounded-lg text-xs font-bold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">
                    <i class="fa-solid fa-bug mr-1"></i>Ver defeitos
                </button>
                <button onclick="mudarAbaUat('uat_ciclos')" class="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-700 text-white hover:bg-indigo-800">
                    Ver ciclo atual
                </button>
            </div>`;
    }

    el.innerHTML = `<div class="space-y-3">${cardsHtml}${acaoHtml}</div>`;
}

// -------------------------------------------------------------------------
// ABA: CICLOS
// -------------------------------------------------------------------------
function _uatRenderCiclos() {
    const el = document.getElementById('uatBody_uat_ciclos');
    if (!el || !_uatProjetoAtual) return;
    const p = _uatProjetoAtual;

    // Banner ratificação/retificação (D-12)
    const bannerHtml = `
        <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex gap-2 items-start">
            <i class="fa-solid fa-circle-exclamation mt-0.5 text-amber-500 flex-shrink-0"></i>
            <div class="flex-1">
                <b>Bloco de UAT do Plano de Entrega.</b>
                <span class="ml-1">Ao entrar no UAT, ratifique (confirma como está) ou retifique (altera com justificativa) o bloco. A retificação gera nova versão no Registro de Planejamento e coloca o bloco de Go Live em "Requer ratificação".</span>
            </div>
            <div class="flex gap-2 flex-shrink-0">
                <button onclick="_uatRatificarBloco()" class="px-3 py-1.5 text-xs font-bold border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50">Ratificar</button>
                <button onclick="_uatAbrirFormRetificacao()" class="px-3 py-1.5 text-xs font-bold bg-indigo-700 text-white rounded-lg hover:bg-indigo-800">Retificar</button>
            </div>
        </div>`;

    const CICLO_STATUS_BADGE = {
        PLANEJADO:    '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">Planejado</span>',
        EM_ANDAMENTO: '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-800">Em andamento</span>',
        ENCERRADO:    '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-800">Concluído</span>',
    };

    const rows = _uatCiclos.map(c => {
        const defCiclo = _uatDefeitos.filter(d => d.ciclo_id === c.id);
        return `
            <tr>
                <td class="px-3 py-2 font-bold text-xs text-gray-800">UAT-${String(c.numero).padStart(2, '0')}</td>
                <td class="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">${c.dt_inicio ? formatDate(c.dt_inicio) : '—'}${c.dt_fim ? ' – ' + formatDate(c.dt_fim) : ''}</td>
                <td class="px-3 py-2">${CICLO_STATUS_BADGE[c.status] || ''}</td>
                <td class="px-3 py-2 text-xs text-gray-600">${escapeHtml(c.ambiente || '—')}</td>
                <td class="px-3 py-2 text-xs text-gray-600">${defCiclo.length}</td>
                <td class="px-3 py-2 text-xs text-gray-500">${escapeHtml(c.resultado || '—')}</td>
            </tr>`;
    }).join('');

    const tabelaVazia = `<tr><td colspan="6" class="px-3 py-8 text-center text-xs text-gray-400">Nenhum ciclo registrado. Ratifique o bloco de UAT para abrir o primeiro ciclo.</td></tr>`;

    el.innerHTML = `
        <div class="space-y-3">
            ${bannerHtml}
            <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div class="px-4 py-2.5 flex justify-between items-center border-b border-gray-100">
                    <span class="text-sm font-bold text-gray-800">Ciclos de UAT</span>
                    <button onclick="_uatAbrirNovoCiclo()" class="px-3 py-1.5 text-xs font-bold bg-indigo-700 text-white rounded-lg hover:bg-indigo-800">
                        <i class="fa-solid fa-plus mr-1"></i>Novo ciclo
                    </button>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead class="border-b border-gray-100 bg-gray-50">
                            <tr>
                                <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Ciclo</th>
                                <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Datas</th>
                                <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</th>
                                <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Ambiente</th>
                                <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Defeitos</th>
                                <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Resultado</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-50">${rows || tabelaVazia}</tbody>
                    </table>
                </div>
            </div>
        </div>`;
}

// -------------------------------------------------------------------------
// ABA: DEFEITOS
// -------------------------------------------------------------------------
function _uatRenderDefeitos() {
    const el = document.getElementById('uatBody_uat_defeitos');
    if (!el || !_uatProjetoAtual) return;

    const SEV_BADGE = {
        CRITICA: '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800">Crítica</span>',
        ALTA:    '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-orange-100 text-orange-800">Alta</span>',
        MEDIA:   '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-yellow-100 text-yellow-800">Média</span>',
        BAIXA:   '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">Baixa</span>',
    };
    const STATUS_BADGE = {
        ABERTO:          '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800">Aberto</span>',
        EM_CORRECAO:     '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800">Em correção</span>',
        PRONTO_RETESTE:  '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">Pronto p/ reteste</span>',
        FECHADO:         '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-800">Fechado</span>',
        ACEITO_RESTRICAO:'<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">Aceito como restrição</span>',
    };

    const rows = _uatDefeitos.map((d, i) => {
        const ciclo = _uatCiclos.find(c => c.id === d.ciclo_id);
        return `
            <tr>
                <td class="px-3 py-2 font-bold text-xs text-gray-800">D-${String(i + 1).padStart(3,'0')}</td>
                <td class="px-3 py-2 text-xs text-gray-700 max-w-xs truncate">${escapeHtml(d.descricao || '')}</td>
                <td class="px-3 py-2 text-xs text-gray-500">${ciclo ? `UAT-${ciclo.numero}` : '—'}</td>
                <td class="px-3 py-2">${SEV_BADGE[d.severidade] || ''}</td>
                <td class="px-3 py-2">${STATUS_BADGE[d.status] || ''}</td>
                <td class="px-3 py-2 text-xs text-gray-500">${escapeHtml(d.responsavel || '—')}</td>
                <td class="px-3 py-2 text-xs text-gray-400">${d.prazo ? formatDate(d.prazo) : '—'}</td>
            </tr>`;
    }).join('');

    const vazio = `<tr><td colspan="7" class="px-3 py-8 text-center text-xs text-gray-400">Nenhum defeito registrado.</td></tr>`;

    el.innerHTML = `
        <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div class="px-4 py-2.5 flex justify-between items-center border-b border-gray-100">
                <span class="text-sm font-bold text-gray-800">Defeitos do UAT</span>
                <button onclick="_uatAbrirNovoDefeito()" class="px-3 py-1.5 text-xs font-bold bg-indigo-700 text-white rounded-lg hover:bg-indigo-800">
                    <i class="fa-solid fa-bug mr-1"></i>Registrar defeito
                </button>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left">
                    <thead class="border-b border-gray-100 bg-gray-50">
                        <tr>
                            <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">ID</th>
                            <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Descrição</th>
                            <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Ciclo</th>
                            <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Severidade</th>
                            <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</th>
                            <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Responsável</th>
                            <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Prazo</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-50">${rows || vazio}</tbody>
                </table>
            </div>
        </div>`;
}

// -------------------------------------------------------------------------
// ABA: ACEITE DO UAT
// -------------------------------------------------------------------------
function _uatRenderAceite() {
    const el = document.getElementById('uatBody_uat_aceite');
    if (!el || !_uatProjetoAtual) return;
    const p = _uatProjetoAtual;
    const estado = (p.uat_estado || 'UAT_PLANNING').toUpperCase();
    const jaAceito = ['UAT_ACCEPTED','UAT_ACCEPTED_WITH_RESTRICTIONS'].includes(estado);

    const defCritAbertos = _uatDefeitos.filter(d => d.severidade === 'CRITICA' && d.status === 'ABERTO').length;
    const defAltoAbertos = _uatDefeitos.filter(d => d.severidade === 'ALTA' && d.status === 'ABERTO').length;
    const totalCiclos    = _uatCiclos.length;
    const ultimoCiclo    = _uatCiclos[_uatCiclos.length - 1];

    const checks = [
        { id: 'UAV-01', label: 'Todos os casos obrigatórios executados no último ciclo', ok: totalCiclos > 0 && ultimoCiclo?.status === 'ENCERRADO' },
        { id: 'UAV-02', label: 'Nenhum defeito Crítico ou Alto aberto', ok: defCritAbertos === 0 && defAltoAbertos === 0 },
        { id: 'UAV-03', label: 'Taxa de aprovação igual ou acima do mínimo do plano', ok: false },
        { id: 'UAV-04', label: 'Todo critério AC-### do escopo com ao menos um caso aprovado', ok: false },
        { id: 'UAV-05', label: 'Evidências anexadas aos casos', ok: false },
        { id: 'UAV-06', label: 'Defeitos restantes classificados como restrição, com responsável e prazo', ok: false },
    ];

    const todasOk = checks.every(c => c.ok);

    const checklistHtml = `
        <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div class="px-4 py-2.5 border-b border-gray-100">
                <span class="text-sm font-bold text-gray-800">Critérios de saída do UAT</span>
            </div>
            <div class="divide-y divide-gray-50">
                ${checks.map(c => `
                    <div class="flex items-center gap-3 px-4 py-2.5">
                        <div class="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${c.ok ? 'bg-green-100' : 'bg-red-50'}">
                            <i class="fa-solid ${c.ok ? 'fa-check text-green-700' : 'fa-times text-red-400'} text-[10px]"></i>
                        </div>
                        <span class="text-xs font-bold text-gray-400 flex-shrink-0">${c.id}</span>
                        <span class="text-xs text-gray-700">${c.label}</span>
                    </div>`).join('')}
            </div>
        </div>`;

    if (jaAceito) {
        el.innerHTML = `
            <div class="space-y-3">
                ${checklistHtml}
                <div class="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-900 flex gap-2">
                    <i class="fa-solid fa-check-circle text-green-600 mt-0.5 flex-shrink-0"></i>
                    <b>UAT ${estado === 'UAT_ACCEPTED_WITH_RESTRICTIONS' ? 'aceito com restrições' : 'aceito'}.</b>
                </div>
            </div>`;
        return;
    }

    const acaoHtml = todasOk
        ? `<div class="flex justify-end gap-2">
               <button onclick="_uatRegistrarAceite('ACEITO_COM_RESTRICOES')" class="px-4 py-2 rounded-lg text-xs font-bold border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100">Aceitar com restrições</button>
               <button onclick="_uatRegistrarAceite('ACEITO')" class="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-700 text-white hover:bg-indigo-800">Aceitar UAT</button>
           </div>`
        : `<div class="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-900 flex gap-2">
               <i class="fa-solid fa-triangle-exclamation text-red-500 mt-0.5 flex-shrink-0"></i>
               <span>Há critérios UAV não atendidos. Resolva-os antes de solicitar o aceite.</span>
           </div>`;

    el.innerHTML = `<div class="space-y-3">${checklistHtml}${acaoHtml}</div>`;
}

// -------------------------------------------------------------------------
// AÇÕES
// -------------------------------------------------------------------------
async function _uatRatificarBloco() {
    if (!_uatProjetoAtual) return;
    if (!confirm('Ratificar o bloco de UAT sem alterações? A ação será registrada no Registro de Planejamento (D-12).')) return;
    try {
        await _supabase.from('registro_planejamento').insert({
            projeto_codigo: _uatProjetoAtual.codigo,
            data_acao:      new Date().toISOString().split('T')[0],
            etapa:          'UAT',
            bloco:          'UAT',
            acao:           'Ratificado',
            autor:          currentUser?.email || '',
            justificativa:  'Bloco ratificado sem alterações ao entrar na etapa de UAT.',
            versao:         1,
        });
        await _supabase.from('projetos').update({ uat_estado: 'UAT_READY' }).eq('codigo', _uatProjetoAtual.codigo);
        _uatProjetoAtual = { ..._uatProjetoAtual, uat_estado: 'UAT_READY' };
        const idx = projectsData.findIndex(p => p.codigo === _uatProjetoAtual.codigo);
        if (idx >= 0) projectsData[idx] = { ...projectsData[idx], uat_estado: 'UAT_READY' };
        mudarAbaUat('uat_ciclos');
    } catch (err) {
        alert('Erro: ' + (err.message || JSON.stringify(err)));
    }
}

function _uatAbrirFormRetificacao() {
    alert('Retificação do bloco de UAT:\n\nAltera as datas com justificativa obrigatória. O bloco de Go Live passa automaticamente para "Requer ratificação" e o responsável é notificado.\n\n(Formulário completo — Fase 6+)');
}

async function _uatAbrirNovoCiclo() {
    if (!_uatProjetoAtual) return;
    const numero = _uatCiclos.length + 1;
    const ini    = prompt(`Ciclo UAT-${String(numero).padStart(2,'0')} — Data de início (AAAA-MM-DD):`);
    if (!ini) return;
    const fim    = prompt('Data de fim (AAAA-MM-DD):');
    if (!fim) return;
    const amb    = prompt('Ambiente (ex.: Homologação, Produção):') || 'Homologação';
    try {
        await _supabase.from('uat_ciclos').insert({
            projeto_codigo: _uatProjetoAtual.codigo,
            numero, ambiente: amb, dt_inicio: ini, dt_fim: fim,
            status: 'PLANEJADO', criado_por: currentUser?.email || '',
        });
        await _supabase.from('projetos').update({ uat_estado: 'UAT_READY' }).eq('codigo', _uatProjetoAtual.codigo);
        await _uatCarregarDados();
        mudarAbaUat('uat_ciclos');
    } catch (err) {
        alert('Erro: ' + (err.message || JSON.stringify(err)));
    }
}

async function _uatAbrirNovoDefeito() {
    if (!_uatProjetoAtual) return;
    const cicloAtivo = _uatCiclos.find(c => c.status === 'EM_ANDAMENTO') || _uatCiclos[_uatCiclos.length - 1];
    if (!cicloAtivo) { alert('Abra um ciclo antes de registrar defeitos.'); return; }
    const desc = prompt('Descrição do defeito:');
    if (!desc) return;
    const sevOpts = ['CRITICA','ALTA','MEDIA','BAIXA'];
    const sev = prompt('Severidade (CRITICA / ALTA / MEDIA / BAIXA):', 'ALTA')?.toUpperCase();
    if (!sevOpts.includes(sev)) { alert('Severidade inválida.'); return; }
    try {
        await _supabase.from('uat_defeitos').insert({
            projeto_codigo: _uatProjetoAtual.codigo,
            ciclo_id: cicloAtivo.id, descricao: desc, severidade: sev,
            criado_por: currentUser?.email || '',
        });
        await _uatCarregarDados();
        mudarAbaUat('uat_defeitos');
    } catch (err) {
        alert('Erro: ' + (err.message || JSON.stringify(err)));
    }
}

async function _uatRegistrarAceite(tipo) {
    if (!_uatProjetoAtual) return;
    const novoEstado = tipo === 'ACEITO' ? 'UAT_ACCEPTED' : 'UAT_ACCEPTED_WITH_RESTRICTIONS';
    if (!confirm(`${tipo === 'ACEITO' ? 'Aceitar' : 'Aceitar com restrições'} o UAT? Esta ação habilita o Go Live.`)) return;
    try {
        await _supabase.from('projetos').update({ uat_estado: novoEstado }).eq('codigo', _uatProjetoAtual.codigo);
        _uatProjetoAtual = { ..._uatProjetoAtual, uat_estado: novoEstado };
        const idx = projectsData.findIndex(p => p.codigo === _uatProjetoAtual.codigo);
        if (idx >= 0) projectsData[idx] = { ...projectsData[idx], uat_estado: novoEstado };
        mudarAbaUat('uat_aceite');
    } catch (err) {
        alert('Erro: ' + (err.message || JSON.stringify(err)));
    }
}

// -------------------------------------------------------------------------
// STUBS
// -------------------------------------------------------------------------
function _uatRenderStub(aba) {
    const labels = {
        uat_plano:     { l: 'Plano de UAT',  i: 'fa-file-lines' },
        uat_casos:     { l: 'Casos de Teste', i: 'fa-list-check' },
        uat_historico: { l: 'Histórico',      i: 'fa-clock-rotate-left' },
    };
    const info = labels[aba] || { l: aba, i: 'fa-diagram-project' };
    const el = document.getElementById(`uatBody_${aba}`);
    if (!el) return;
    el.innerHTML = `
        <div class="flex flex-col items-center justify-center py-16 text-gray-400">
            <i class="fa-solid ${info.i} text-3xl mb-3 opacity-40"></i>
            <span class="text-sm font-semibold">${info.l}</span>
            <span class="text-xs mt-1">Em desenvolvimento — Fase 6+</span>
        </div>`;
}
