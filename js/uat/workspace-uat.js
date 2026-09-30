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

let _uatProjetoAtual    = null;
let _uatAbaAtual        = 'uat_resumo';
let _uatCiclos          = [];
let _uatDefeitos        = [];
let _uatCasosTeste      = [];
let _uatBlocoPlano      = null;   // plano_entrega_bloco do bloco UAT atual
let _uatPlanoVersao     = 1;
let _uatModoRetificacao = false;

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
    _uatCiclos = []; _uatDefeitos = []; _uatCasosTeste = [];
    _uatBlocoPlano = null; _uatPlanoVersao = 1;
    if (!_uatProjetoAtual) return;
    const codigo = _uatProjetoAtual.codigo;
    try {
        const { data: c } = await _supabase.from('uat_ciclos').select('*')
            .eq('projeto_codigo', codigo).order('numero');
        _uatCiclos = c || [];

        const { data: d } = await _supabase.from('uat_defeitos').select('*')
            .eq('projeto_codigo', codigo).order('criado_em');
        _uatDefeitos = d || [];

        const { data: ct } = await _supabase.from('uat_casos_teste').select('*')
            .eq('projeto_codigo', codigo).order('codigo');
        _uatCasosTeste = ct || [];

        // Carrega bloco UAT do plano mais recente
        const { data: planos } = await _supabase.from('plano_entrega').select('id, versao')
            .eq('projeto_codigo', codigo).order('versao', { ascending: false }).limit(1);
        if (planos?.length) {
            _uatPlanoVersao = planos[0].versao;
            const { data: blocos } = await _supabase.from('plano_entrega_bloco').select('*')
                .eq('plano_id', planos[0].id).eq('bloco', 'UAT');
            _uatBlocoPlano = blocos?.[0] || null;
        }
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
    if (aba === 'uat_resumo')         _uatRenderResumo();
    else if (aba === 'uat_plano')     _uatRenderPlanoUat();
    else if (aba === 'uat_casos')     _uatRenderCasosTeste();
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
        if (_uatBlocoPlano?.id) {
            await _supabase.from('plano_entrega_bloco').update({ status: 'RATIFICADO' }).eq('id', _uatBlocoPlano.id);
        }
        const dtAnt = _uatBlocoPlano ? `${_uatBlocoPlano.dt_inicio || '—'} – ${_uatBlocoPlano.dt_fim || '—'}` : '—';
        await _supabase.from('registro_planejamento').insert({
            projeto_codigo: _uatProjetoAtual.codigo,
            data_acao:      new Date().toISOString().split('T')[0],
            etapa: 'UAT', bloco: 'UAT', acao: 'Ratificado',
            autor:          currentUser?.email || '',
            justificativa:  'Bloco ratificado sem alterações ao entrar na etapa de UAT.',
            datas_antes: dtAnt, datas_depois: dtAnt,
            versao: _uatPlanoVersao,
        });
        await _supabase.from('projetos').update({ uat_estado: 'UAT_READY' }).eq('codigo', _uatProjetoAtual.codigo);
        _uatProjetoAtual = { ..._uatProjetoAtual, uat_estado: 'UAT_READY' };
        const idx = projectsData.findIndex(p => p.codigo === _uatProjetoAtual.codigo);
        if (idx >= 0) projectsData[idx] = { ...projectsData[idx], uat_estado: 'UAT_READY' };
        _execBlocoUatRequerRatificacao = false;
        await _uatCarregarDados();
        mudarAbaUat('uat_ciclos');
    } catch (err) {
        alert('Erro: ' + (err.message || JSON.stringify(err)));
    }
}

function _uatAbrirFormRetificacao() {
    _uatModoRetificacao = true;
    mudarAbaUat('uat_plano');
}

function _uatRenderFormRetificacao() {
    const b = _uatBlocoPlano;
    return `
        <div class="bg-white border border-amber-300 rounded-lg overflow-hidden">
            <div class="px-4 py-2.5 border-b border-amber-200 bg-amber-50 flex justify-between items-center">
                <span class="text-sm font-bold text-amber-900"><i class="fa-solid fa-pencil mr-1"></i>Retificar bloco UAT</span>
                <button onclick="_uatModoRetificacao=false; mudarAbaUat('uat_plano')" class="text-xs text-gray-500 hover:text-gray-800 font-semibold">Cancelar</button>
            </div>
            <div class="p-4 space-y-4">
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Data início atual</label>
                        <p class="text-xs text-gray-600 mt-1">${b?.dt_inicio ? formatDate(b.dt_inicio) : '—'}</p>
                        <label class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-2 block">Nova data de início</label>
                        <input type="date" id="uatRetifNovoInicio" value="${b?.dt_inicio || ''}" class="mt-1 w-full text-xs border border-gray-300 rounded px-2 py-1.5">
                    </div>
                    <div>
                        <label class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Data fim atual</label>
                        <p class="text-xs text-gray-600 mt-1">${b?.dt_fim ? formatDate(b.dt_fim) : '—'}</p>
                        <label class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mt-2 block">Nova data de fim</label>
                        <input type="date" id="uatRetifNovaFim" value="${b?.dt_fim || ''}" class="mt-1 w-full text-xs border border-gray-300 rounded px-2 py-1.5">
                    </div>
                </div>
                <div>
                    <label class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Justificativa <span class="text-red-500">*</span></label>
                    <textarea id="uatRetifJustificativa" rows="3" placeholder="Motivo da alteração (obrigatório)..."
                        class="mt-1 w-full text-xs border border-gray-300 rounded px-2 py-1.5 resize-none"></textarea>
                </div>
                <div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">
                    <b>Impacto:</b> o bloco de Go Live passará para "Requer ratificação" e o go/no-go ficará bloqueado até nova ratificação ou retificação naquela etapa.
                </div>
                <div class="flex justify-end gap-2">
                    <button onclick="_uatModoRetificacao=false; mudarAbaUat('uat_plano')" class="px-4 py-2 rounded-lg text-xs font-bold border border-gray-300 bg-white text-gray-700 hover:bg-gray-50">Cancelar</button>
                    <button onclick="_uatConfirmarRetificacao()" class="px-4 py-2 rounded-lg text-xs font-bold bg-indigo-700 text-white hover:bg-indigo-800">
                        <i class="fa-solid fa-check mr-1"></i>Confirmar retificação (v${_uatPlanoVersao + 1})
                    </button>
                </div>
            </div>
        </div>`;
}

async function _uatConfirmarRetificacao() {
    if (!_uatProjetoAtual) return;
    const novoInicio    = document.getElementById('uatRetifNovoInicio')?.value;
    const novaFim       = document.getElementById('uatRetifNovaFim')?.value;
    const justificativa = document.getElementById('uatRetifJustificativa')?.value?.trim();
    if (!novoInicio || !novaFim) { alert('Preencha as novas datas.'); return; }
    if (!justificativa) { alert('A justificativa é obrigatória.'); return; }

    const codigo     = _uatProjetoAtual.codigo;
    const novaVersao = _uatPlanoVersao + 1;
    const dtAnt      = `${_uatBlocoPlano?.dt_inicio || '—'} – ${_uatBlocoPlano?.dt_fim || '—'}`;

    try {
        // Busca todos os blocos do plano atual para copiar EXECUCAO e GO_LIVE
        const { data: planos } = await _supabase.from('plano_entrega').select('id')
            .eq('projeto_codigo', codigo).order('versao', { ascending: false }).limit(1);
        if (!planos?.length) throw new Error('Plano não encontrado.');
        const { data: todosB } = await _supabase.from('plano_entrega_bloco').select('*').eq('plano_id', planos[0].id);

        const { data: novoPlano, error: ep } = await _supabase.from('plano_entrega').insert({
            projeto_codigo: codigo, versao: novaVersao, eh_baseline: false, criado_por: currentUser?.email || '',
        }).select().single();
        if (ep) throw ep;

        for (const b of ['EXECUCAO', 'UAT', 'GO_LIVE']) {
            const ba = todosB?.find(x => x.bloco === b);
            const st = b === 'UAT' ? 'RETIFICADO' : b === 'GO_LIVE' ? 'REQUER_RATIFICACAO' : 'RATIFICADO';
            await _supabase.from('plano_entrega_bloco').insert({
                plano_id: novoPlano.id, bloco: b,
                dt_inicio:   b === 'UAT' ? novoInicio : (ba?.dt_inicio || null),
                dt_fim:      b === 'UAT' ? novaFim    : (ba?.dt_fim    || null),
                responsavel: ba?.responsavel || null, descricao: ba?.descricao || null, status: st,
            });
        }

        await _supabase.from('registro_planejamento').insert({
            projeto_codigo: codigo, data_acao: new Date().toISOString().split('T')[0],
            etapa: 'UAT', bloco: 'UAT', acao: 'Retificado',
            autor: currentUser?.email || '', justificativa,
            datas_antes: dtAnt, datas_depois: `${novoInicio} – ${novaFim}`, versao: novaVersao,
        });

        // Sinaliza Go Live que precisa ratificar
        _execBlocoUatRequerRatificacao = true;
        _uatModoRetificacao = false;
        await _uatCarregarDados();
        mudarAbaUat('uat_plano');
    } catch (err) {
        alert('Erro ao retificar: ' + (err.message || JSON.stringify(err)));
    }
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
// ABA: PLANO DE UAT
// -------------------------------------------------------------------------
function _uatRenderPlanoUat() {
    const el = document.getElementById('uatBody_uat_plano');
    if (!el || !_uatProjetoAtual) return;

    if (_uatModoRetificacao) {
        el.innerHTML = `<div class="space-y-3">${_uatRenderFormRetificacao()}</div>`;
        return;
    }

    const b = _uatBlocoPlano;
    const blocoHtml = b
        ? `<div class="grid grid-cols-3 gap-3">
            ${[
                { lbl: 'Início planejado', val: b.dt_inicio ? formatDate(b.dt_inicio) : '—' },
                { lbl: 'Fim planejado',    val: b.dt_fim   ? formatDate(b.dt_fim)   : '—' },
                { lbl: 'Status do bloco',  val: b.status || '—' },
            ].map(c => `<div class="bg-white border border-gray-200 rounded-lg p-3">
                <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400">${c.lbl}</span>
                <p class="text-sm font-black text-gray-800 mt-1">${c.val}</p>
            </div>`).join('')}
        </div>`
        : `<div class="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-900">Plano de Entrega não definido. Crie o plano na etapa de Execução primeiro.</div>`;

    const ratHtml = b && (b.status === 'PLANEJADO' || b.status === 'REQUER_RATIFICACAO')
        ? `<div class="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-3">
            <i class="fa-solid fa-triangle-exclamation text-amber-500 mt-0.5 flex-shrink-0"></i>
            <div class="flex-1 text-xs text-amber-900">
                <b>Bloco UAT ainda não ratificado.</b> Confirme as datas sem alteração (Ratificar) ou ajuste-as com justificativa (Retificar) antes de iniciar o UAT.
            </div>
            <div class="flex gap-2 flex-shrink-0">
                <button onclick="_uatRatificarBloco()" class="px-3 py-1.5 text-xs font-bold border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50">Ratificar</button>
                <button onclick="_uatAbrirFormRetificacao()" class="px-3 py-1.5 text-xs font-bold bg-indigo-700 text-white rounded-lg hover:bg-indigo-800">Retificar</button>
            </div>
        </div>` : '';

    el.innerHTML = `<div class="space-y-3">
        ${ratHtml}
        <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div class="px-4 py-2.5 border-b border-gray-100">
                <span class="text-sm font-bold text-gray-800">Plano de UAT · Bloco do Plano de Entrega (D-12)</span>
            </div>
            <div class="p-4 space-y-3">${blocoHtml}</div>
        </div>
        <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
            <div class="px-4 py-2.5 border-b border-gray-100 flex justify-between items-center">
                <span class="text-sm font-bold text-gray-800">Ciclos planejados</span>
                <button onclick="mudarAbaUat('uat_ciclos')" class="text-xs text-indigo-700 font-bold hover:text-indigo-900">Ver ciclos →</button>
            </div>
            <div class="p-3 text-xs text-gray-500">${_uatCiclos.length
                ? `${_uatCiclos.length} ciclo${_uatCiclos.length > 1 ? 's' : ''} registrado${_uatCiclos.length > 1 ? 's' : ''}. Acesse a aba Ciclos para detalhes.`
                : 'Nenhum ciclo cadastrado ainda. Use a aba Ciclos para adicionar o primeiro.'}</div>
        </div>
    </div>`;
}

// -------------------------------------------------------------------------
// ABA: CASOS DE TESTE
// -------------------------------------------------------------------------
function _uatRenderCasosTeste() {
    const el = document.getElementById('uatBody_uat_casos');
    if (!el || !_uatProjetoAtual) return;

    const SEV_BADGE = {
        APROVADO:  '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-100 text-green-800">Aprovado</span>',
        REPROVADO: '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-800">Reprovado</span>',
        BLOQUEADO: '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">Bloqueado</span>',
        PENDENTE:  '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700">Pendente</span>',
    };

    const rows = _uatCasosTeste.map(ct => `
        <tr>
            <td class="px-3 py-2 text-xs font-mono text-indigo-700">${escapeHtml(ct.codigo || '')}</td>
            <td class="px-3 py-2 text-xs text-gray-800 max-w-xs">${escapeHtml(ct.titulo || '')}
                ${ct.criterio_ac ? `<br><span class="text-gray-400 text-[11px]">AC: ${escapeHtml(ct.criterio_ac)}</span>` : ''}
            </td>
            <td class="px-3 py-2 text-xs text-gray-500">${escapeHtml(ct.responsavel || '—')}</td>
            <td class="px-3 py-2">${SEV_BADGE[ct.status] || SEV_BADGE.PENDENTE}</td>
            <td class="px-3 py-2">
                <select onchange="_uatAtualizarStatusCaso(${ct.id}, this.value)" class="text-[11px] border border-gray-200 rounded px-1 py-0.5">
                    ${['PENDENTE','APROVADO','REPROVADO','BLOQUEADO'].map(s =>
                        `<option value="${s}" ${ct.status === s ? 'selected' : ''}>${s.charAt(0)+s.slice(1).toLowerCase()}</option>`
                    ).join('')}
                </select>
            </td>
        </tr>`).join('');

    const totais = { APROVADO: 0, REPROVADO: 0, BLOQUEADO: 0, PENDENTE: 0 };
    _uatCasosTeste.forEach(ct => { if (totais[ct.status] !== undefined) totais[ct.status]++; });

    el.innerHTML = `
        <div class="space-y-3">
            <div class="grid grid-cols-4 gap-2">
                ${[
                    { lbl: 'Total',      val: _uatCasosTeste.length, cls: 'text-gray-800' },
                    { lbl: 'Aprovados',  val: totais.APROVADO,       cls: 'text-green-700' },
                    { lbl: 'Reprovados', val: totais.REPROVADO,      cls: 'text-red-700'   },
                    { lbl: 'Pendentes',  val: totais.PENDENTE + totais.BLOQUEADO, cls: 'text-amber-700' },
                ].map(c => `<div class="bg-white border border-gray-200 rounded-lg p-3 text-center">
                    <p class="text-xl font-black ${c.cls}">${c.val}</p>
                    <span class="text-[10px] font-bold uppercase tracking-wider text-gray-400">${c.lbl}</span>
                </div>`).join('')}
            </div>
            <div class="bg-white border border-gray-200 rounded-lg overflow-hidden">
                <div class="px-4 py-2.5 border-b border-gray-100 flex justify-between items-center">
                    <span class="text-sm font-bold text-gray-800">Casos de Teste</span>
                    <button onclick="_uatAdicionarCaso()" class="px-3 py-1.5 text-xs font-bold border border-gray-300 bg-white text-gray-700 rounded-lg hover:bg-gray-50">
                        <i class="fa-solid fa-plus mr-1"></i>Novo caso
                    </button>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left">
                        <thead class="border-b border-gray-100 bg-gray-50">
                            <tr>
                                <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Código</th>
                                <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Título · AC</th>
                                <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Responsável</th>
                                <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</th>
                                <th class="px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">Alterar</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-50">
                            ${rows || `<tr><td colspan="5" class="px-3 py-8 text-center text-xs text-gray-400">Nenhum caso de teste cadastrado. Clique em "+ Novo caso".</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>`;
}

async function _uatAdicionarCaso() {
    if (!_uatProjetoAtual) return;
    const proximoNum = (_uatCasosTeste.length + 1).toString().padStart(3, '0');
    const codigo = `CT-${proximoNum}`;
    const titulo = prompt(`${codigo} — Título do caso de teste:`);
    if (!titulo) return;
    const ac   = prompt('Critério de aceite associado (ex.: AC-001, opcional):') || '';
    const resp = prompt('Responsável pelo teste:') || '';
    try {
        await _supabase.from('uat_casos_teste').insert({
            projeto_codigo: _uatProjetoAtual.codigo,
            codigo, titulo, criterio_ac: ac || null,
            responsavel: resp || null, status: 'PENDENTE', obrigatorio: true,
        });
        await _uatCarregarDados();
        _uatRenderCasosTeste();
    } catch (err) {
        alert('Erro: ' + (err.message || JSON.stringify(err)));
    }
}

async function _uatAtualizarStatusCaso(id, novoStatus) {
    try {
        await _supabase.from('uat_casos_teste').update({ status: novoStatus }).eq('id', id);
        const idx = _uatCasosTeste.findIndex(c => c.id === id);
        if (idx >= 0) _uatCasosTeste[idx] = { ..._uatCasosTeste[idx], status: novoStatus };
        _uatRenderCasosTeste();
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
