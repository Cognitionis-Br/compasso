// =========================================================================
// ano-fiscal/fy-workspace.js
// Workspace do Exercício Fiscal — VIS-FY-02, VIS-FY-04, VIS-FY-05.
// Abas Planejamento / Transições / Fechamento / Histórico: placeholder.
//
// Entry point : renderFYWorkspace()
// Contexto    : window.fyWorkspaceContext = { fy_id, codigo }
// =========================================================================

const _FY_WS_STATUS_CFG = {
    PLANNING:  { label: 'Em planejamento',  cls: 'fy-badge-in' },
    BUDGETING: { label: 'Em orçamentação',  cls: 'fy-badge-wa' },
    OPEN:      { label: 'Em execução',      cls: 'fy-badge-ok' },
    CLOSING:   { label: 'Em fechamento',    cls: 'fy-badge-wa' },
    CLOSED:    { label: 'Fechado',          cls: 'fy-badge-nu' },
    REOPENED:  { label: 'Reaberto',         cls: 'fy-badge-cr' },
};

const _FY_WS_WINDOW_LABEL = {
    EXECUTION:           'Execução',
    CLOSING_PREPARATION: 'Preparação do fechamento',
    CLOSING:             'Fechamento',
    BC_CREATION:         'Criação de BCs',
    BC_ESTIMATION:       'Estimativa de BCs',
    BC_PACKAGE:          'Pacote de BCs',
};

const _FY_WS_MILESTONE_TYPE_LABEL = {
    PLANNING: 'Planejamento',
    CLOSING:  'Fechamento',
    BC_CYCLE: 'Ciclo de BC',
    CUSTOM:   'Personalizado',
};

const _FY_WS_DESTINO_CFG = {
    CONCLUIR_NO_FY:     { label: 'Concluir no FY',     cls: 'fy-badge-ok', cor: '#16a34a' },
    CARRYOVER:          { label: 'Carryover',           cls: 'fy-badge-in', cor: '#7c3aed' },
    CONTINUAR_CROSS_FY: { label: 'Continuar CROSS-FY', cls: 'fy-badge-in', cor: '#2563eb' },
    HOLD:               { label: 'Hold',                cls: 'fy-badge-wa', cor: '#d97706' },
    TERMINAR:           { label: 'Terminar',            cls: 'fy-badge-cr', cor: '#dc2626' },
    A_DEFINIR:          { label: 'A definir',           cls: 'fy-badge-cr', cor: '#991b1b' },
    NAO_SE_APLICA:      { label: 'Não se aplica',       cls: 'fy-badge-nu', cor: '#94a3b8' },
};

// ---- Estado do módulo ----
let _fyWSAbaAtiva        = 'visao';
let _fyWSProjetosCache   = [];
let _fyWSProjetosFiltro  = { texto: '', chip: 'todos' };
let _fyWSWindowsCache    = [];
let _fyWSMilestoneCache  = [];
let _fyProjModalCodigo   = '';
let _fyProjModalFYCodigo = '';

// =========================================================================
// Entry point
// =========================================================================
async function renderFYWorkspace() {
    const el = document.getElementById('view-fy_workspace');
    if (!el) return;

    const ctx = window.fyWorkspaceContext || {};
    const codigo = ctx.codigo || '';
    if (!codigo) {
        el.innerHTML = '<div style="padding:40px;color:#dc2626;">Nenhum exercício selecionado.</div>';
        return;
    }

    let fy = (typeof getAFPorCodigo === 'function') ? getAFPorCodigo(codigo) : null;
    if (!fy && typeof carregarFiscalYears === 'function') {
        await carregarFiscalYears();
        fy = (typeof getAFPorCodigo === 'function') ? getAFPorCodigo(codigo) : null;
    }
    if (!fy) {
        el.innerHTML = `<div style="padding:40px;color:#dc2626;">Exercício "${codigo}" não encontrado.</div>`;
        return;
    }

    _fyWSRenderShell(el, fy);
    await _fyWSCarregarAba(_fyWSAbaAtiva, fy);
}

// =========================================================================
// Shell (header + abas)
// =========================================================================
function _fyWSRenderShell(el, fy) {
    const stsCfg = _FY_WS_STATUS_CFG[fy.fy_status] || { label: fy.fy_status || '—', cls: 'fy-badge-nu' };
    const nome   = fy.fy_name || ('Exercício Fiscal ' + fy.ano_fiscal);

    const abas = [
        { id: 'visao',        label: 'Visão Geral'  },
        { id: 'planejamento', label: 'Planejamento' },
        { id: 'projetos',     label: 'Projetos'     },
        { id: 'calendario',   label: 'Calendário'   },
        { id: 'transicoes',   label: 'Transições'   },
        { id: 'fechamento',   label: 'Fechamento'   },
        { id: 'historico',    label: 'Histórico'    },
    ];

    const tabsHtml = abas.map(a => {
        const on = a.id === _fyWSAbaAtiva;
        return `<button id="fy-ws-tab-${a.id}" onclick="_fyWSAba('${a.id}')"
            style="padding:7px 12px 9px;border:none;background:none;cursor:pointer;font-family:inherit;font-size:13px;
                   color:${on?'#0f1e3d':'#64748b'};border-bottom:${on?'2px solid #4338ca':'2px solid transparent'};
                   font-weight:${on?'700':'400'};white-space:nowrap;">${a.label}</button>`;
    }).join('');

    el.innerHTML = `
<style>
.fy-ws-card{background:#fff;border:1px solid #e5e7eb;border-radius:10px;}
.fy-ws-h2{font-size:12.5px;font-weight:700;color:#0f1e3d;}
.fy-ws-lbl{font-size:11px;color:#93a4c3;}
.fy-ws-sub{font-size:11.5px;color:#64748b;}
.fy-ws-kv{display:flex;flex-direction:column;gap:2px;}
.fy-ws-kpi{padding:9px 12px;display:flex;flex-direction:column;gap:2px;}
.fy-ws-kpi .num{font-size:19px;font-weight:800;color:#0f1e3d;}
.fy-ws-table{width:100%;border-collapse:collapse;font-size:12.5px;}
.fy-ws-table th{padding:6px 9px;text-align:left;font-size:11px;font-weight:700;color:#64748b;border-bottom:1px solid #e5e7eb;white-space:nowrap;}
.fy-ws-table td{padding:6px 9px;border-bottom:1px solid #f1f5f9;}
.fy-ws-table tr:last-child td{border-bottom:none;}
.fy-ws-btn{background:#fff;border:1px solid #d1d5db;border-radius:6px;padding:5px 12px;font-size:12.5px;cursor:pointer;font-family:inherit;}
.fy-ws-btn:hover{background:#f8fafc;}
.fy-ws-btn-p{background:#4338ca;border:1px solid #4338ca;color:#fff;border-radius:6px;padding:5px 12px;font-size:12.5px;cursor:pointer;font-family:inherit;}
.fy-ws-btn-p:hover{background:#3730a3;}
.fy-ws-chip{padding:4px 10px;border-radius:999px;border:1px solid #e5e7eb;font-size:12px;cursor:pointer;background:#fff;font-family:inherit;}
.fy-ws-chip.on{background:#0f1e3d;color:#fff;border-color:#0f1e3d;}
.fy-ws-row-info{display:flex;align-items:flex-start;gap:7px;font-size:12px;line-height:1.35;}
.fy-ws-row-info .ic{width:16px;height:16px;border-radius:999px;background:#4338ca;color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.fy-ws-row-info .ic.ok{background:#16a34a;}
.fy-ws-row-info .ic.wa{background:#d97706;}
.fy-ws-input{border:1px solid #d1d5db;border-radius:8px;padding:7px 10px;font-size:12.5px;font-family:inherit;outline:none;background:#fff;}
.fy-ws-select{border:1px solid #d1d5db;border-radius:8px;padding:7px 10px;font-size:12.5px;font-family:inherit;outline:none;background:#fff;}
</style>
<div style="padding:16px 24px 0;display:flex;flex-direction:column;gap:0;">
  <div class="fy-ws-card" style="padding:12px 16px;display:flex;align-items:center;gap:20px;border-bottom-left-radius:0;border-bottom-right-radius:0;border-bottom:none;">
    <div style="display:flex;flex-direction:column;gap:5px;flex-shrink:0;">
      <div style="display:flex;align-items:center;gap:6px;">
        <span class="fy-ws-sub" style="font-weight:700;" id="fy-ws-breadcrumb">${fy.ano_fiscal}</span>
        <span class="fy-b ${stsCfg.cls}">${stsCfg.label}</span>
      </div>
      <h1 style="margin:0;font-size:19px;color:#0f1e3d;white-space:nowrap;">${nome}</h1>
    </div>
    <div style="display:flex;gap:18px;flex-grow:1;justify-content:flex-end;" id="fy-ws-nav-links"></div>
    <div><button class="fy-ws-btn" onclick="switchTab('fy_lista')">← Exercícios</button></div>
  </div>
  <div style="background:#fff;border:1px solid #e5e7eb;border-top:none;display:flex;align-items:flex-end;padding:0 16px;gap:2px;border-radius:0;">
    ${tabsHtml}
  </div>
  <div id="fy-ws-content" style="margin-top:12px;display:flex;flex-direction:column;gap:12px;">
    <div style="padding:40px;text-align:center;color:#93a4c3;font-size:12.5px;">Carregando…</div>
  </div>
</div>`;

    _fyWSPreencherNavLinks(fy);
}

function _fyWSPreencherNavLinks(fy) {
    const nav = document.getElementById('fy-ws-nav-links');
    if (!nav) return;
    const todos = (typeof fiscalYearsCache !== 'undefined') ? fiscalYearsCache : [];
    const idx = todos.findIndex(f => f.ano_fiscal === fy.ano_fiscal);
    const ant  = idx > 0 ? todos[idx - 1] : null;
    const prox = (idx >= 0 && idx < todos.length - 1) ? todos[idx + 1] : null;
    const fmt = f => {
        const c = _FY_WS_STATUS_CFG[f.fy_status] || { label: f.fy_status };
        return `<div class="fy-ws-kv"><span class="fy-ws-lbl">${ant === f ? 'Anterior' : 'Próximo'}</span>
            <b><a href="#" onclick="_fyListaAbrirExercicio(${f.fy_id},'${f.ano_fiscal}');return false;" style="color:#4338ca;font-size:12.5px;">${f.ano_fiscal} · ${c.label}</a></b></div>`;
    };
    nav.innerHTML = (ant ? fmt(ant) : '') + (prox ? fmt(prox) : '');
}

// =========================================================================
// Troca de aba
// =========================================================================
async function _fyWSAba(aba) {
    _fyWSAbaAtiva = aba;
    ['visao','planejamento','projetos','calendario','transicoes','fechamento','historico'].forEach(id => {
        const btn = document.getElementById('fy-ws-tab-' + id);
        if (!btn) return;
        const on = id === aba;
        btn.style.color      = on ? '#0f1e3d' : '#64748b';
        btn.style.borderBottom = on ? '2px solid #4338ca' : '2px solid transparent';
        btn.style.fontWeight = on ? '700' : '400';
    });
    const fy = (typeof getAFPorCodigo === 'function') ? getAFPorCodigo((window.fyWorkspaceContext || {}).codigo || '') : null;
    if (!fy) return;
    await _fyWSCarregarAba(aba, fy);
}

async function _fyWSCarregarAba(aba, fy) {
    const content = document.getElementById('fy-ws-content');
    if (!content) return;
    content.innerHTML = '<div style="padding:40px;text-align:center;color:#93a4c3;font-size:12.5px;">Carregando…</div>';

    if      (aba === 'visao')        { await _fyVisaoCarregar(fy); }
    else if (aba === 'projetos')     { await _fyProjetosCarregar(fy); }
    else if (aba === 'calendario')   { await _fyCalendarioCarregar(fy); }
    else if (aba === 'planejamento') { await _fyPlanejamentoCarregar(fy); }
    else if (aba === 'transicoes')   { await _fyTransicoesCarregar(fy); }
    else if (aba === 'fechamento')   { await _fyFechamentoCarregar(fy); }
    else if (aba === 'historico')    { await _fyHistoricoCarregar(fy); }
    else                             { _fyWSPlaceholder(content, aba); }
}

function _fyWSPlaceholder(content, aba) {
    content.innerHTML = `
<div class="fy-ws-card" style="padding:48px 24px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:12px;">
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#93a4c3" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M12 8v5"/><circle cx="12" cy="16.5" r=".5" fill="#93a4c3"/></svg>
  <span style="font-size:15px;font-weight:700;color:#0f1e3d;">${aba}</span>
  <span class="fy-ws-sub">Esta funcionalidade estará disponível em breve.</span>
</div>`;
}

// =========================================================================
// Helpers
// =========================================================================
function _fyWsFmtData(d) {
    if (!d) return '';
    const dt = new Date(d.slice(0,10) + 'T00:00:00');
    return dt.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function _fyWsFmtDataCurta(d) {
    if (!d) return '';
    const dt = new Date(d.slice(0,10) + 'T00:00:00');
    return dt.toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' });
}
function _fyWsDiasDiff(a, b) {
    return Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
}
function _fyWsUsuario() {
    try { return (window._authUser && window._authUser.email) || ''; } catch(e) { return ''; }
}

// =========================================================================
// VIS-FY-02 — Visão Geral
// =========================================================================
async function _fyVisaoCarregar(fy) {
    const [pfyResult, mlResult] = await Promise.all([
        _supabase.from('project_fiscal_year').select('*').eq('fiscal_year_codigo', fy.ano_fiscal),
        _supabase.from('fiscal_milestones').select('*').eq('fiscal_year_codigo', fy.ano_fiscal).order('milestone_date'),
    ]);
    _fyVisaoRender(fy, pfyResult.data || [], mlResult.data || []);
}

function _fyVisaoRender(fy, pfyList, mlList) {
    const content = document.getElementById('fy-ws-content');
    if (!content) return;

    const hoje  = new Date();
    const inicio = fy.data_inicio ? new Date(fy.data_inicio + 'T00:00:00') : null;
    const fim    = fy.data_fim    ? new Date(fy.data_fim    + 'T00:00:00') : null;

    let pctDecorrido = 0, diasDecorridos = 0, diasRestantes = 0, diasTotal = 0;
    if (inicio && fim) {
        diasTotal      = Math.max(1, _fyWsDiasDiff(fy.data_inicio, fy.data_fim));
        diasDecorridos = Math.max(0, Math.min(diasTotal, Math.round((hoje - inicio) / 86400000)));
        diasRestantes  = Math.max(0, diasTotal - diasDecorridos);
        pctDecorrido   = Math.min(100, Math.round(diasDecorridos / diasTotal * 100));
    }

    // KPIs via projectsData join
    const projetosMap = {};
    if (typeof projectsData !== 'undefined') projectsData.forEach(p => { projetosMap[p.codigo] = p; });

    let emAndamento = 0, concluidos = 0, cancelados = 0, emHold = 0;
    const destinoCount = {};
    pfyList.forEach(row => {
        const p   = projetosMap[row.projeto_codigo] || {};
        const ss  = (p.sub_status   || '').toUpperCase();
        const fase = (p.etapa_atual || '').toUpperCase();
        if (ss === 'CANCELADO' || fase === 'CANCELADO')                       cancelados++;
        else if (ss === 'HOLD' || ss === 'SUSPENSO')                          emHold++;
        else if (fase === 'ENCERRAMENTO' || ss === 'CONCLUÍDO' || ss === 'CONCLUIDO') concluidos++;
        else                                                                   emAndamento++;
        const dest = (row.destino || 'A_DEFINIR').toUpperCase().replace(/\s/g, '_');
        destinoCount[dest] = (destinoCount[dest] || 0) + 1;
    });
    const total = pfyList.length;

    // Marcos card
    const agora = Date.now();
    const futuros = mlList.filter(m => new Date(m.milestone_date + 'T00:00:00') >= hoje).slice(0, 4);
    const passados = mlList.filter(m => new Date(m.milestone_date + 'T00:00:00') < hoje);
    const ultPass  = passados.length ? passados[passados.length - 1] : null;
    const marcosLista = ultPass ? [ultPass, ...futuros] : futuros;
    const marcosHtml = marcosLista.length
        ? marcosLista.map(m => {
            const isPass = new Date(m.milestone_date + 'T00:00:00') < hoje;
            const isSoon = !isPass && (new Date(m.milestone_date + 'T00:00:00') - agora) < 14 * 86400000;
            const cor = isPass ? '#16a34a' : isSoon ? '#d97706' : '#94a3b8';
            const ic  = isPass ? '✓' : '·';
            return `<div class="fy-ws-row-info" style="margin-bottom:4px;">
                <span class="ic" style="background:${cor};">${ic}</span>
                <span style="flex-grow:1;">${_fyWsFmtDataCurta(m.milestone_date)} · ${m.name}</span>
            </div>`;
          }).join('')
        : `<span class="fy-ws-sub">Nenhum marco. <a href="#" onclick="_fyWSAba('calendario');return false;" style="color:#4338ca;">Adicionar →</a></span>`;

    // Destino bars
    const destinoOrdem = ['CONCLUIR_NO_FY','CARRYOVER','CONTINUAR_CROSS_FY','HOLD','TERMINAR','A_DEFINIR','NAO_SE_APLICA'];
    const barsHtml = destinoOrdem.map(d => {
        const cnt  = destinoCount[d] || 0;
        const pct  = total > 0 ? (cnt / total * 100).toFixed(1) : '0.0';
        const cfg  = _FY_WS_DESTINO_CFG[d] || { label: d, cor: '#94a3b8' };
        return `<div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:2px 0;">
            <span style="width:9px;height:9px;border-radius:999px;background:${cfg.cor};flex-shrink:0;"></span>
            <span style="width:160px;white-space:nowrap;">${cfg.label}</span>
            <div style="flex-grow:1;height:7px;border-radius:4px;background:#f1f5f9;overflow:hidden;">
                <div style="height:100%;border-radius:4px;background:${cfg.cor};width:${pct}%;"></div>
            </div>
            <b style="width:22px;text-align:right;">${cnt}</b>
            <span class="fy-ws-sub" style="width:38px;text-align:right;">${pct}%</span>
        </div>`;
    }).join('');

    // Status sidebar
    const stsCfg = _FY_WS_STATUS_CFG[fy.fy_status] || { label: fy.fy_status, cls: 'fy-badge-nu' };
    const PKG_LABEL = { NAO_INICIADO:'Não iniciado', EM_COMPOSICAO:'Em composição', EM_APROVACAO:'Em aprovação', FECHADO:'Fechado' };
    const pkgLabel = PKG_LABEL[fy.bc_package_status] || fy.bc_package_status || '—';
    const semDestino = destinoCount['A_DEFINIR'] || 0;
    const readPct   = total > 0 ? Math.round((1 - semDestino / total) * 100) : 100;
    const readCor   = readPct >= 90 ? '#16a34a' : readPct >= 70 ? '#d97706' : '#dc2626';

    // Projetos críticos (sem destino ou saúde crítica, top 4)
    const criticos = pfyList.filter(r => {
        const dest = (r.destino || 'A_DEFINIR').toUpperCase().replace(/\s/g,'_');
        const p = projetosMap[r.projeto_codigo] || {};
        return dest === 'A_DEFINIR' || (p.sub_status || '').toUpperCase() === 'CRITICO';
    }).slice(0, 4);

    const criticosHtml = criticos.length === 0
        ? `<tr><td colspan="7" style="padding:16px 9px;text-align:center;color:#93a4c3;">Nenhum projeto crítico.</td></tr>`
        : criticos.map(r => {
            const p = projetosMap[r.projeto_codigo] || {};
            const dest = (r.destino || 'A_DEFINIR').toUpperCase().replace(/\s/g,'_');
            const dCfg = _FY_WS_DESTINO_CFG[dest] || { label: dest, cls: 'fy-badge-nu' };
            const rCfg = (r.regime || '') === 'CROSS_FY'
                ? { label:'CROSS_FY', cls:'fy-badge-in' }
                : { label:'FY_BOUND', cls:'fy-badge-nu' };
            const ssCor = { CRITICO:'#dc2626', ATENCAO:'#d97706', 'ATENÇÃO':'#d97706' }[(p.sub_status||'').toUpperCase()] || '#16a34a';
            return `<tr>
                <td style="padding:6px 9px;white-space:nowrap;"><b>${p.codigo||r.projeto_codigo}</b></td>
                <td style="padding:6px 9px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p.nome||'—'}</td>
                <td style="padding:6px 9px;white-space:nowrap;"><span class="fy-b ${rCfg.cls}" style="padding:2px 6px;">${rCfg.label}</span></td>
                <td style="padding:6px 9px;white-space:nowrap;">${p.etapa_atual||'—'}</td>
                <td style="padding:6px 9px;white-space:nowrap;"><span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:8px;height:8px;border-radius:999px;background:${ssCor};"></span>${p.sub_status||'N/A'}</span></td>
                <td style="padding:6px 9px;white-space:nowrap;"><span class="fy-b ${dCfg.cls}">${dCfg.label}</span></td>
                <td style="padding:6px 9px;white-space:nowrap;"><button class="fy-ws-btn" onclick="_fyWSAba('projetos')" style="padding:3px 9px;font-size:11.5px;">Abrir</button></td>
            </tr>`;
          }).join('');

    // Próximo exercício
    const todosCache = (typeof fiscalYearsCache !== 'undefined') ? fiscalYearsCache : [];
    const idxFY = todosCache.findIndex(f => f.ano_fiscal === fy.ano_fiscal);
    const proxFY = (idxFY >= 0 && idxFY < todosCache.length - 1) ? todosCache[idxFY + 1] : null;
    const proxHtml = proxFY ? (() => {
        const pCfg = _FY_WS_STATUS_CFG[proxFY.fy_status] || { label: proxFY.fy_status, cls: 'fy-badge-nu' };
        return `<div class="fy-ws-card" style="width:230px;flex-shrink:0;overflow:hidden;">
            <div style="padding:10px 12px 0 12px;"><span class="fy-ws-h2">Próximo exercício</span></div>
            <div style="padding:8px 12px 12px;display:flex;flex-direction:column;gap:6px;font-size:12px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <b style="font-size:15px;color:#0f1e3d;">${proxFY.ano_fiscal}</b>
                    <span class="fy-b ${pCfg.cls}">${pCfg.label}</span>
                </div>
                ${proxFY.data_inicio ? `<span class="fy-ws-sub">${_fyWsFmtData(proxFY.data_inicio)} a ${_fyWsFmtData(proxFY.data_fim)}</span>` : ''}
                <a href="#" onclick="_fyListaAbrirExercicio(${proxFY.fy_id},'${proxFY.ano_fiscal}');return false;"
                   class="fy-ws-sub" style="color:#4338ca;">Abrir exercício →</a>
            </div>
        </div>`;
    })() : '';

    content.innerHTML = `
<div style="display:flex;gap:14px;align-items:flex-start;">
  <!-- coluna principal -->
  <div style="flex-grow:1;min-width:0;display:flex;flex-direction:column;gap:12px;">

    <!-- Linha do tempo -->
    <div class="fy-ws-card" style="overflow:hidden;">
      <div style="padding:10px 12px 0 12px;"><span class="fy-ws-h2">Linha do tempo</span></div>
      <div style="padding:8px 12px 12px;">
        <div style="position:relative;height:64px;margin:4px 6px 0;">
          <div style="position:absolute;left:0;right:0;top:30px;height:10px;border-radius:5px;overflow:hidden;background:#f1f5f9;">
            <div style="height:100%;width:${pctDecorrido}%;background:rgba(22,163,74,.55);"></div>
          </div>
          ${pctDecorrido > 0 && pctDecorrido < 100 ? `
          <div style="position:absolute;left:${pctDecorrido}%;top:0;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;">
            <b style="font-size:11px;color:#3730a3;">Hoje</b>
            <span style="width:2px;height:34px;background:#3730a3;"></span>
          </div>` : ''}
          <div style="position:absolute;left:0;top:46px;" class="fy-ws-sub">${_fyWsFmtData(fy.data_inicio)}</div>
          <div style="position:absolute;right:0;top:46px;" class="fy-ws-sub">${_fyWsFmtData(fy.data_fim)}</div>
        </div>
        <div style="display:flex;gap:14px;font-size:11px;margin-top:4px;flex-wrap:wrap;">
          <span><i style="display:inline-block;width:9px;height:9px;background:rgba(22,163,74,.55);border-radius:2px;"></i> Decorrido</span>
          <span style="flex-grow:1;"></span>
          <span>Decorrido <b>${pctDecorrido}%</b> · ${diasDecorridos} de ${diasTotal} dias</span>
          <span>Restante <b>${diasRestantes} dias</b></span>
        </div>
      </div>
    </div>

    <!-- KPIs -->
    <div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;">
      <div class="fy-ws-card fy-ws-kpi"><span class="fy-ws-lbl">Projetos no exercício</span><span class="num">${total}</span><span class="fy-ws-sub">participações</span></div>
      <div class="fy-ws-card fy-ws-kpi"><span class="fy-ws-lbl">Em andamento</span><span class="num" style="color:#166534;">${emAndamento}</span><span class="fy-ws-sub">${total>0?Math.round(emAndamento/total*100):0}%</span></div>
      <div class="fy-ws-card fy-ws-kpi"><span class="fy-ws-lbl">Concluídos</span><span class="num" style="color:#166534;">${concluidos}</span><span class="fy-ws-sub">${total>0?Math.round(concluidos/total*100):0}%</span></div>
      <div class="fy-ws-card fy-ws-kpi"><span class="fy-ws-lbl">Cancelados</span><span class="num" style="color:#991b1b;">${cancelados}</span><span class="fy-ws-sub">${total>0?Math.round(cancelados/total*100):0}%</span></div>
      <div class="fy-ws-card fy-ws-kpi"><span class="fy-ws-lbl">Em Hold</span><span class="num" style="color:#92400e;">${emHold}</span><span class="fy-ws-sub">${total>0?Math.round(emHold/total*100):0}%</span></div>
    </div>

    <!-- Situação de transição + próximo FY -->
    <div style="display:flex;gap:14px;align-items:flex-start;">
      <div class="fy-ws-card" style="flex-grow:1;overflow:hidden;">
        <div style="padding:10px 12px 0 12px;"><span class="fy-ws-h2">Situação de transição</span></div>
        <div style="padding:8px 12px 12px;">${barsHtml || '<span class="fy-ws-sub">Sem dados de destino cadastrados.</span>'}</div>
      </div>
      ${proxHtml}
    </div>

    <!-- Projetos críticos -->
    <div class="fy-ws-card" style="overflow:hidden;">
      <div style="padding:10px 12px;display:flex;justify-content:space-between;align-items:center;">
        <span class="fy-ws-h2">Projetos a resolver</span>
        <a href="#" onclick="_fyWSAba('projetos');return false;" class="fy-ws-sub" style="color:#4338ca;">Ver todos os ${total} →</a>
      </div>
      <table class="fy-ws-table">
        <thead><tr><th>Código</th><th>Nome</th><th>Regime</th><th>Fase</th><th>Saúde</th><th>Destino</th><th></th></tr></thead>
        <tbody>${criticosHtml}</tbody>
      </table>
    </div>
  </div>

  <!-- sidebar direita -->
  <div style="width:260px;flex-shrink:0;display:flex;flex-direction:column;gap:10px;">
    <div class="fy-ws-card" style="overflow:hidden;">
      <div style="padding:10px 12px 0 12px;"><span class="fy-ws-h2">Status do exercício</span></div>
      <div style="padding:8px 12px 12px;display:flex;flex-direction:column;gap:6px;">
        <div class="fy-ws-row-info"><span class="ic ok">✓</span><span style="flex-grow:1;">Status</span><b><span class="fy-b ${stsCfg.cls}">${stsCfg.label}</span></b></div>
        <div class="fy-ws-row-info"><span class="ic">i</span><span style="flex-grow:1;">Pacote de BC</span><b style="white-space:nowrap;">${pkgLabel}</b></div>
        ${fy.data_inicio ? `<div class="fy-ws-row-info"><span class="ic">i</span><span style="flex-grow:1;">Período</span><b style="white-space:nowrap;font-size:11px;">${_fyWsFmtData(fy.data_inicio)} a ${_fyWsFmtData(fy.data_fim)}</b></div>` : ''}
      </div>
    </div>

    <div class="fy-ws-card" style="overflow:hidden;">
      <div style="padding:10px 12px 0 12px;"><span class="fy-ws-h2">Prontidão para fechamento</span></div>
      <div style="padding:8px 12px 12px;display:flex;gap:12px;align-items:center;">
        <div style="width:76px;height:76px;border-radius:999px;background:conic-gradient(${readCor} 0 ${readPct}%,#e5e7eb ${readPct}% 100%);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <div style="width:56px;height:56px;border-radius:999px;background:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;">
            <b style="font-size:17px;color:#0f1e3d;">${readPct}%</b>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;font-size:12px;">
          <b style="color:${readCor};">${semDestino === 0 ? 'Pronto' : semDestino + ' sem destino'}</b>
          <span class="fy-ws-sub">${semDestino > 0 ? 'Bloqueiam o fechamento.' : 'Todos com destino.'}</span>
          <a href="#" onclick="_fyWSAba('projetos');return false;" class="fy-ws-sub" style="color:#4338ca;">Ver projetos →</a>
        </div>
      </div>
    </div>

    <div class="fy-ws-card" style="overflow:hidden;">
      <div style="padding:10px 12px;display:flex;justify-content:space-between;align-items:center;">
        <span class="fy-ws-h2">Marcos</span>
        <a href="#" onclick="_fyWSAba('calendario');return false;" class="fy-ws-sub" style="color:#4338ca;">Calendário</a>
      </div>
      <div style="padding:0 12px 12px;">${marcosHtml}</div>
    </div>
  </div>
</div>`;
}

// =========================================================================
// VIS-FY-04 — Projetos
// =========================================================================
async function _fyProjetosCarregar(fy) {
    const { data } = await _supabase
        .from('project_fiscal_year')
        .select('*')
        .eq('fiscal_year_codigo', fy.ano_fiscal);
    _fyWSProjetosCache  = data || [];
    _fyWSProjetosFiltro = { texto: '', chip: 'todos' };
    _fyProjetosRender(fy);
}

function _fyProjetosRender(fy) {
    const content = document.getElementById('fy-ws-content');
    if (!content) return;

    const projetosMap = {};
    if (typeof projectsData !== 'undefined') projectsData.forEach(p => { projetosMap[p.codigo] = p; });

    const filtro = _fyWSProjetosFiltro;
    let lista = _fyWSProjetosCache.map(r => ({ ...r, _p: projetosMap[r.projeto_codigo] || {} }));

    if (filtro.texto) {
        const t = filtro.texto.toLowerCase();
        lista = lista.filter(r =>
            (r.projeto_codigo||'').toLowerCase().includes(t) ||
            (r._p.nome||'').toLowerCase().includes(t) ||
            (r._p.gerente||'').toLowerCase().includes(t)
        );
    }
    if (filtro.chip === 'sem_definicao') {
        lista = lista.filter(r => (r.destino||'A_DEFINIR').toUpperCase().replace(/\s/g,'_') === 'A_DEFINIR');
    } else if (filtro.chip === 'fy_bound') {
        lista = lista.filter(r => (r.regime||'').toUpperCase() === 'FY_BOUND');
    } else if (filtro.chip === 'cross_fy') {
        lista = lista.filter(r => (r.regime||'').toUpperCase() === 'CROSS_FY');
    }

    const total  = _fyWSProjetosCache.length;
    const semDef = _fyWSProjetosCache.filter(r => (r.destino||'A_DEFINIR').toUpperCase().replace(/\s/g,'_') === 'A_DEFINIR').length;
    const fyBound = _fyWSProjetosCache.filter(r => (r.regime||'').toUpperCase() === 'FY_BOUND').length;
    const crossFY = _fyWSProjetosCache.filter(r => (r.regime||'').toUpperCase() === 'CROSS_FY').length;

    const chips = [
        { id:'todos',         label:`Todos (${total})`           },
        { id:'sem_definicao', label:`Sem definição (${semDef})`  },
        { id:'fy_bound',      label:`FY_BOUND (${fyBound})`      },
        { id:'cross_fy',      label:`CROSS_FY (${crossFY})`      },
    ];

    const destinoOpts = Object.entries(_FY_WS_DESTINO_CFG)
        .map(([v, c]) => `<option value="${v}">${c.label}</option>`).join('');

    const rowsHtml = lista.length === 0
        ? `<tr><td colspan="10" style="padding:20px 9px;text-align:center;color:#93a4c3;">Nenhum projeto encontrado.</td></tr>`
        : lista.map(r => {
            const dest = (r.destino||'A_DEFINIR').toUpperCase().replace(/\s/g,'_');
            const dCfg = _FY_WS_DESTINO_CFG[dest] || { label:dest, cls:'fy-badge-nu' };
            const rCfg = (r.regime||'') === 'CROSS_FY'
                ? { label:'CROSS_FY', cls:'fy-badge-in' }
                : { label:'FY_BOUND', cls:'fy-badge-nu' };
            const ssCor = { CRITICO:'#dc2626', ATENCAO:'#d97706', 'ATENÇÃO':'#d97706' }[(r._p.sub_status||'').toUpperCase()] || '#16a34a';
            const termino = r.data_termino_previsto || r._p.data_fim_prev || '';
            const pjCod = r.projeto_codigo || '';
            return `<tr>
                <td style="padding:5px 9px;white-space:nowrap;"><b>${r._p.codigo||pjCod}</b></td>
                <td style="padding:5px 9px;max-width:170px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r._p.nome||'—'}</td>
                <td style="padding:5px 9px;white-space:nowrap;">${r._p.gerente||'—'}</td>
                <td style="padding:5px 9px;white-space:nowrap;"><span class="fy-b ${rCfg.cls}" style="padding:2px 6px;">${rCfg.label}</span></td>
                <td style="padding:5px 9px;white-space:nowrap;">${r._p.etapa_atual||'—'}</td>
                <td style="padding:5px 9px;white-space:nowrap;"><span style="display:inline-flex;align-items:center;gap:5px;"><span style="width:8px;height:8px;border-radius:999px;background:${ssCor};"></span>${r._p.sub_status||'N/A'}</span></td>
                <td style="padding:5px 9px;white-space:nowrap;">${termino ? _fyWsFmtData(termino) : '—'}</td>
                <td style="padding:5px 9px;white-space:nowrap;"><span class="fy-b ${dCfg.cls}">${dCfg.label}</span></td>
                <td style="padding:5px 9px;white-space:nowrap;">${r.decisao_status||'—'}</td>
                <td style="padding:5px 9px;white-space:nowrap;">
                    <button class="fy-ws-btn" onclick="_fyProjDefinirDestino('${pjCod}','${fy.ano_fiscal}')"
                        style="padding:3px 9px;font-size:11.5px;${dest==='A_DEFINIR'?'border-color:#4338ca;color:#4338ca;':''}"
                    >${dest==='A_DEFINIR'?'Definir destino':'Abrir'}</button>
                </td>
            </tr>`;
          }).join('');

    content.innerHTML = `
<div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;">
  <div class="fy-ws-card fy-ws-kpi"><span class="fy-ws-lbl">Projetos</span><span class="num">${total}</span><span class="fy-ws-sub">participações no FY</span></div>
  <div class="fy-ws-card fy-ws-kpi"><span class="fy-ws-lbl">Sem definição</span><span class="num" style="color:${semDef>0?'#991b1b':'#166534'};">${semDef}</span><span class="fy-ws-sub">${semDef>0?'bloqueiam fechamento':'tudo definido'}</span></div>
  <div class="fy-ws-card fy-ws-kpi"><span class="fy-ws-lbl">FY_BOUND</span><span class="num">${fyBound}</span><span class="fy-ws-sub">${total>0?Math.round(fyBound/total*100):0}%</span></div>
  <div class="fy-ws-card fy-ws-kpi"><span class="fy-ws-lbl">CROSS_FY</span><span class="num" style="color:#1d4ed8;">${crossFY}</span><span class="fy-ws-sub">${total>0?Math.round(crossFY/total*100):0}%</span></div>
  <div class="fy-ws-card fy-ws-kpi"><span class="fy-ws-lbl">Listados</span><span class="num">${lista.length}</span><span class="fy-ws-sub">${filtro.chip!=='todos'?'filtro ativo':'sem filtro'}</span></div>
</div>

<div class="fy-ws-card" style="overflow:hidden;">
  <div style="padding:10px 12px 8px;display:flex;justify-content:space-between;align-items:center;">
    <span class="fy-ws-h2">Projetos do ${fy.ano_fiscal} · ${lista.length} de ${total}</span>
  </div>
  <div style="display:flex;gap:6px;padding:0 12px 8px;align-items:center;flex-wrap:wrap;">
    ${chips.map(c => `<button class="fy-ws-chip${filtro.chip===c.id?' on':''}" onclick="_fyProjChip('${c.id}')">${c.label}</button>`).join('')}
    <span style="flex-grow:1;"></span>
    <input type="text" value="${filtro.texto}" placeholder="Buscar código, nome ou gerente"
        oninput="_fyProjBusca(this.value)"
        style="border:1px solid #d1d5db;border-radius:8px;padding:5px 10px;font-size:12.5px;font-family:inherit;width:220px;outline:none;">
    <button class="fy-ws-btn" onclick="_fyProjExportar()">Exportar</button>
  </div>
  <div style="overflow-x:auto;">
    <table class="fy-ws-table" style="min-width:940px;">
      <thead><tr>
        <th>Código</th><th>Nome</th><th>Gerente</th><th>Regime</th>
        <th>Fase</th><th>Saúde</th><th>Término prev.</th>
        <th>Destino</th><th>Decisão</th><th></th>
      </tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  </div>
</div>

<!-- Modal destino -->
<div id="fy-proj-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000;align-items:center;justify-content:center;">
  <div class="fy-ws-card" style="width:420px;padding:20px;display:flex;flex-direction:column;gap:14px;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span class="fy-ws-h2" id="fy-proj-modal-titulo">Definir destino</span>
      <button onclick="_fyProjModalFechar()" style="background:none;border:none;cursor:pointer;font-size:18px;color:#64748b;">×</button>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;">
      <label style="font-size:12.5px;font-weight:600;">Destino do projeto neste exercício</label>
      <select id="fy-proj-destino-sel" class="fy-ws-select" style="width:100%;">${destinoOpts}</select>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;">
      <button class="fy-ws-btn" onclick="_fyProjModalFechar()">Cancelar</button>
      <button class="fy-ws-btn-p" onclick="_fyProjSalvarDestino()">Salvar</button>
    </div>
  </div>
</div>`;
}

function _fyProjChip(chip) {
    _fyWSProjetosFiltro.chip = chip;
    const fy = (typeof getAFPorCodigo === 'function') ? getAFPorCodigo((window.fyWorkspaceContext||{}).codigo||'') : null;
    if (fy) _fyProjetosRender(fy);
}
function _fyProjBusca(texto) {
    _fyWSProjetosFiltro.texto = texto;
    const fy = (typeof getAFPorCodigo === 'function') ? getAFPorCodigo((window.fyWorkspaceContext||{}).codigo||'') : null;
    if (fy) _fyProjetosRender(fy);
}
function _fyProjDefinirDestino(pjCodigo, fyCodigo) {
    _fyProjModalCodigo   = pjCodigo;
    _fyProjModalFYCodigo = fyCodigo;
    const row = _fyWSProjetosCache.find(r => r.projeto_codigo === pjCodigo);
    const destAtual = (row && row.destino) ? row.destino.toUpperCase().replace(/\s/g,'_') : 'A_DEFINIR';
    const sel = document.getElementById('fy-proj-destino-sel');
    if (sel) sel.value = destAtual;
    const projetosMap = {};
    if (typeof projectsData !== 'undefined') projectsData.forEach(p => { projetosMap[p.codigo] = p; });
    const titulo = document.getElementById('fy-proj-modal-titulo');
    if (titulo) titulo.textContent = 'Destino — ' + ((projetosMap[pjCodigo] || {}).nome || pjCodigo);
    const modal = document.getElementById('fy-proj-modal');
    if (modal) modal.style.display = 'flex';
}
function _fyProjModalFechar() {
    const modal = document.getElementById('fy-proj-modal');
    if (modal) modal.style.display = 'none';
}
async function _fyProjSalvarDestino() {
    const sel = document.getElementById('fy-proj-destino-sel');
    if (!sel) return;
    const novoDestino = sel.value;
    const { error } = await _supabase
        .from('project_fiscal_year')
        .update({ destino: novoDestino })
        .eq('projeto_codigo', _fyProjModalCodigo)
        .eq('fiscal_year_codigo', _fyProjModalFYCodigo);
    if (error) { alert('Erro ao salvar destino: ' + error.message); return; }
    const row = _fyWSProjetosCache.find(r => r.projeto_codigo === _fyProjModalCodigo);
    if (row) row.destino = novoDestino;
    _fyProjModalFechar();
    const fy = (typeof getAFPorCodigo === 'function') ? getAFPorCodigo(_fyProjModalFYCodigo) : null;
    if (fy) _fyProjetosRender(fy);
}
function _fyProjExportar() {
    const ctx = window.fyWorkspaceContext || {};
    const fy = (typeof getAFPorCodigo === 'function') ? getAFPorCodigo(ctx.codigo||'') : null;
    const projetosMap = {};
    if (typeof projectsData !== 'undefined') projectsData.forEach(p => { projetosMap[p.codigo] = p; });
    const linhas = [['Código','Nome','Gerente','Regime','Fase','Saúde','Término Previsto','Destino','Decisão']];
    _fyWSProjetosCache.forEach(r => {
        const p = projetosMap[r.projeto_codigo] || {};
        linhas.push([p.codigo||r.projeto_codigo, p.nome||'', p.gerente||'', r.regime||'',
            p.etapa_atual||'', p.sub_status||'',
            r.data_termino_previsto||p.data_fim_prev||'',
            r.destino||'A_DEFINIR', r.decisao_status||'']);
    });
    const csv = '﻿' + linhas.map(l => l.map(c => '"' + String(c).replace(/"/g,'""') + '"').join(',')).join('\r\n');
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'projetos_' + (fy ? fy.ano_fiscal : 'fy') + '.csv'; a.click();
    URL.revokeObjectURL(url);
}

// =========================================================================
// VIS-FY-05 — Calendário
// =========================================================================
async function _fyCalendarioCarregar(fy) {
    const [winR, mlR] = await Promise.all([
        _supabase.from('fiscal_windows').select('*').eq('fiscal_year_codigo', fy.ano_fiscal).order('start_date'),
        _supabase.from('fiscal_milestones').select('*').eq('fiscal_year_codigo', fy.ano_fiscal).order('milestone_date'),
    ]);
    _fyWSWindowsCache   = winR.data || [];
    _fyWSMilestoneCache = mlR.data  || [];
    _fyCalendarioRender(fy);
}

function _fyCalendarioRender(fy) {
    const content = document.getElementById('fy-ws-content');
    if (!content) return;

    const hoje   = new Date();
    const inicio = fy.data_inicio ? new Date(fy.data_inicio + 'T00:00:00') : null;
    const fim    = fy.data_fim    ? new Date(fy.data_fim    + 'T00:00:00') : null;
    const diasTotal = (inicio && fim) ? Math.max(1, _fyWsDiasDiff(fy.data_inicio, fy.data_fim)) : 365;
    const todayPct  = inicio && fim ? Math.min(100, Math.max(0, (hoje - inicio) / 86400000 / diasTotal * 100)) : -1;

    // Períodos mensais calculados
    const periodos = [];
    if (inicio && fim) {
        let cur = new Date(inicio); let num = 1;
        while (cur <= fim) {
            const mes  = cur.getMonth();
            const ano  = cur.getFullYear();
            const proxMes  = new Date(ano, mes + 1, 1);
            const fimPer   = new Date(Math.min(proxMes - 1, fim.getTime()));
            const iniPer   = new Date(cur);
            const status   = fimPer < hoje ? 'Fechado' : iniPer <= hoje ? 'Aberto' : 'Planejado';
            const statusCls = { Fechado:'fy-badge-nu', Aberto:'fy-badge-ok', Planejado:'fy-badge-in' }[status];
            const nomeMes  = iniPer.toLocaleDateString('pt-BR', { month:'short', year:'numeric' });
            periodos.push({
                cod: 'P' + String(num).padStart(2,'0'),
                nome: nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1).replace('.',''),
                inicio: _fyWsFmtData(iniPer.toISOString().slice(0,10)),
                fim: _fyWsFmtData(fimPer.toISOString().slice(0,10)),
                status, statusCls,
            });
            cur = proxMes; num++;
        }
    }

    // Timeline bar
    const WIN_COLORS = {
        EXECUTION:           { bg:'#dcfce7', text:'#166534' },
        CLOSING_PREPARATION: { bg:'#e0e7ff', text:'#3730a3' },
        CLOSING:             { bg:'#fee2e2', text:'#991b1b' },
        BC_CREATION:         { bg:'#fef9c3', text:'#92400e' },
        BC_ESTIMATION:       { bg:'#fef9c3', text:'#92400e' },
        BC_PACKAGE:          { bg:'#fef9c3', text:'#92400e' },
    };
    const mainTypes = ['EXECUTION','CLOSING_PREPARATION','CLOSING'];
    const timelineWins = mainTypes.map(wt => _fyWSWindowsCache.find(w => w.window_type === wt)).filter(Boolean);

    const timelineHtml = timelineWins.length > 0 && inicio
        ? timelineWins.map(w => {
            const wS = new Date(w.start_date + 'T00:00:00');
            const wE = new Date(w.end_date   + 'T00:00:00');
            const ps = Math.max(0, (wS - inicio) / 86400000 / diasTotal * 100);
            const pw = Math.min(100 - ps, (wE - wS) / 86400000 / diasTotal * 100);
            const cl = WIN_COLORS[w.window_type] || { bg:'#f1f5f9', text:'#0f1e3d' };
            const lb = _FY_WS_WINDOW_LABEL[w.window_type] || w.window_type;
            return `<div style="position:absolute;left:${ps.toFixed(1)}%;width:${pw.toFixed(1)}%;top:0;bottom:0;background:${cl.bg};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:${cl.text};overflow:hidden;white-space:nowrap;padding:0 4px;">${lb}</div>`;
          }).join('')
        : `<div style="width:100%;height:100%;background:#f1f5f9;border-radius:6px;display:flex;align-items:center;justify-content:center;" class="fy-ws-sub">Nenhuma janela cadastrada</div>`;

    // Windows table
    const winsHtml = _fyWSWindowsCache.length === 0
        ? `<tr><td colspan="3" style="padding:12px 9px;text-align:center;color:#93a4c3;">Nenhuma janela. Clique em "+ Janela" para adicionar.</td></tr>`
        : _fyWSWindowsCache.map(w => `<tr>
            <td style="padding:6px 9px;">${_FY_WS_WINDOW_LABEL[w.window_type]||w.window_type}${w.description?`<br><span class="fy-ws-sub">${w.description}</span>`:''}</td>
            <td style="padding:6px 9px;white-space:nowrap;">${_fyWsFmtData(w.start_date)}</td>
            <td style="padding:6px 9px;white-space:nowrap;">${_fyWsFmtData(w.end_date)}</td>
          </tr>`).join('');

    // Milestones table
    const mlHtml = _fyWSMilestoneCache.length === 0
        ? `<tr><td colspan="4" style="padding:12px 9px;text-align:center;color:#93a4c3;">Nenhum marco. Clique em "+ Marco" para adicionar.</td></tr>`
        : _fyWSMilestoneCache.map(m => {
            const mlDate  = new Date(m.milestone_date + 'T00:00:00');
            const isPass  = mlDate < hoje;
            const isSoon  = !isPass && (mlDate - hoje) < 14 * 86400000;
            const sCls    = isPass ? 'fy-badge-ok' : isSoon ? 'fy-badge-wa' : 'fy-badge-in';
            const sLbl    = isPass ? 'Concluído' : isSoon ? 'Em andamento' : 'Pendente';
            return `<tr>
                <td style="padding:6px 9px;white-space:nowrap;">${_fyWsFmtData(m.milestone_date)}</td>
                <td style="padding:6px 9px;">${m.name}</td>
                <td style="padding:6px 9px;white-space:nowrap;">${m.responsavel||'—'}</td>
                <td style="padding:6px 9px;white-space:nowrap;">
                    <span class="fy-b ${sCls}">${sLbl}</span>
                    <button onclick="_fyMilestoneExcluir(${m.id},'${fy.ano_fiscal}')"
                        style="background:none;border:none;cursor:pointer;color:#dc2626;font-size:13px;margin-left:4px;" title="Excluir">×</button>
                </td>
            </tr>`;
          }).join('');

    // Periods table
    const periodsHtml = periodos.length === 0
        ? `<tr><td colspan="5" style="padding:12px 9px;text-align:center;color:#93a4c3;">Configure as datas do exercício para ver os períodos.</td></tr>`
        : periodos.map(p => `<tr>
            <td style="padding:4px 9px;white-space:nowrap;"><b>${p.cod}</b></td>
            <td style="padding:4px 9px;white-space:nowrap;">${p.nome}</td>
            <td style="padding:4px 9px;white-space:nowrap;">${p.inicio}</td>
            <td style="padding:4px 9px;white-space:nowrap;">${p.fim}</td>
            <td style="padding:4px 9px;white-space:nowrap;"><span class="fy-b ${p.statusCls}">${p.status}</span></td>
          </tr>`).join('');

    const winOpts = Object.entries(_FY_WS_WINDOW_LABEL).map(([v,l]) => `<option value="${v}">${l}</option>`).join('');
    const mlTypeOpts = Object.entries(_FY_WS_MILESTONE_TYPE_LABEL).map(([v,l]) => `<option value="${v}">${l}</option>`).join('');

    content.innerHTML = `
<!-- Linha do tempo -->
<div style="display:flex;gap:14px;align-items:flex-start;">
  <div class="fy-ws-card" style="flex-grow:1;overflow:hidden;">
    <div style="padding:10px 12px 0 12px;"><span class="fy-ws-h2">Linha do tempo · janelas operacionais</span></div>
    <div style="padding:8px 12px 12px;">
      <div style="position:relative;height:26px;border-radius:6px;overflow:hidden;">${timelineHtml}</div>
      ${todayPct >= 0 ? `<div style="position:relative;margin-top:-26px;height:26px;pointer-events:none;">
        <div style="position:absolute;left:${todayPct.toFixed(1)}%;top:0;bottom:0;width:2px;background:#3730a3;transform:translateX(-1px);"></div>
      </div>` : ''}
      <div style="display:flex;justify-content:space-between;margin-top:4px;" class="fy-ws-sub">
        <span>${_fyWsFmtData(fy.data_inicio)}</span>
        ${todayPct > 5 && todayPct < 95 ? `<span style="color:#3730a3;font-weight:700;">Hoje ${_fyWsFmtData(hoje.toISOString().slice(0,10))}</span>` : ''}
        <span>${_fyWsFmtData(fy.data_fim)}</span>
      </div>
    </div>
  </div>
  <div class="fy-ws-card" style="width:260px;flex-shrink:0;overflow:hidden;">
    <div style="padding:10px 12px 0 12px;"><span class="fy-ws-h2">Parâmetros</span></div>
    <div style="padding:8px 12px 12px;display:flex;flex-direction:column;gap:6px;">
      ${fy.data_inicio ? `<div class="fy-ws-row-info"><span class="ic">i</span><span style="flex-grow:1;">Período total</span><b style="font-size:11px;white-space:nowrap;">${_fyWsFmtData(fy.data_inicio)} a ${_fyWsFmtData(fy.data_fim)}</b></div>` : ''}
      <div class="fy-ws-row-info"><span class="ic">i</span><span style="flex-grow:1;">Estrutura</span><b style="white-space:nowrap;">${periodos.length} períodos · MONTHLY</b></div>
      <div class="fy-ws-row-info"><span class="ic">i</span><span style="flex-grow:1;">Janelas</span><b style="white-space:nowrap;">${_fyWSWindowsCache.length} cadastradas</b></div>
      <div class="fy-ws-row-info"><span class="ic">i</span><span style="flex-grow:1;">Marcos</span><b style="white-space:nowrap;">${_fyWSMilestoneCache.length} cadastrados</b></div>
    </div>
  </div>
</div>

<div style="display:flex;gap:14px;align-items:flex-start;">
  <!-- Períodos -->
  <div class="fy-ws-card" style="flex-grow:1;overflow:hidden;">
    <div style="padding:10px 12px 0 12px;"><span class="fy-ws-h2">Períodos fiscais (calculados)</span></div>
    <div style="overflow-x:auto;">
      <table class="fy-ws-table" style="min-width:380px;">
        <thead><tr><th>Código</th><th>Nome</th><th>Início</th><th>Fim</th><th>Status</th></tr></thead>
        <tbody>${periodsHtml}</tbody>
      </table>
    </div>
  </div>

  <!-- Janelas + Marcos -->
  <div style="width:380px;flex-shrink:0;display:flex;flex-direction:column;gap:10px;">
    <div class="fy-ws-card" style="overflow:hidden;">
      <div style="padding:10px 12px 0 12px;"><span class="fy-ws-h2">Janelas operacionais</span></div>
      <table class="fy-ws-table">
        <thead><tr><th>Janela</th><th>Início</th><th>Fim</th></tr></thead>
        <tbody>${winsHtml}</tbody>
      </table>
      <div style="padding:8px 12px;">
        <button class="fy-ws-btn" onclick="_fyJanelaModalAbrir('${fy.ano_fiscal}')">+ Janela</button>
      </div>
    </div>

    <div class="fy-ws-card" style="overflow:hidden;">
      <div style="padding:10px 12px;display:flex;justify-content:space-between;align-items:center;">
        <span class="fy-ws-h2">Marcos</span>
        <button class="fy-ws-btn" onclick="_fyMilestoneModalAbrir('${fy.ano_fiscal}')">+ Marco</button>
      </div>
      <table class="fy-ws-table">
        <thead><tr><th>Data</th><th>Marco</th><th>Resp.</th><th></th></tr></thead>
        <tbody>${mlHtml}</tbody>
      </table>
    </div>
  </div>
</div>

<!-- Modal Marco -->
<div id="fy-cal-ml-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000;align-items:center;justify-content:center;">
  <div class="fy-ws-card" style="width:420px;padding:20px;display:flex;flex-direction:column;gap:14px;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span class="fy-ws-h2">Novo Marco</span>
      <button onclick="_fyMilestoneModalFechar()" style="background:none;border:none;cursor:pointer;font-size:18px;color:#64748b;">×</button>
    </div>
    <input type="hidden" id="fy-cal-ml-fy">
    <div style="display:flex;flex-direction:column;gap:6px;">
      <label style="font-size:12.5px;font-weight:600;">Nome do marco</label>
      <input id="fy-cal-ml-nome" type="text" class="fy-ws-input" style="width:100%;box-sizing:border-box;" placeholder="Ex: Prazo de destinação">
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      <div style="display:flex;flex-direction:column;gap:6px;">
        <label style="font-size:12.5px;font-weight:600;">Data</label>
        <input id="fy-cal-ml-data" type="date" class="fy-ws-input">
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        <label style="font-size:12.5px;font-weight:600;">Tipo</label>
        <select id="fy-cal-ml-tipo" class="fy-ws-select">${mlTypeOpts}</select>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;">
      <label style="font-size:12.5px;font-weight:600;">Responsável (opcional)</label>
      <input id="fy-cal-ml-resp" type="text" class="fy-ws-input" style="width:100%;box-sizing:border-box;" placeholder="Ex: Governança">
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;">
      <button class="fy-ws-btn" onclick="_fyMilestoneModalFechar()">Cancelar</button>
      <button class="fy-ws-btn-p" onclick="_fyMilestoneSalvar()">Salvar marco</button>
    </div>
  </div>
</div>

<!-- Modal Janela -->
<div id="fy-cal-win-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000;align-items:center;justify-content:center;">
  <div class="fy-ws-card" style="width:420px;padding:20px;display:flex;flex-direction:column;gap:14px;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span class="fy-ws-h2">Nova Janela Operacional</span>
      <button onclick="_fyJanelaModalFechar()" style="background:none;border:none;cursor:pointer;font-size:18px;color:#64748b;">×</button>
    </div>
    <input type="hidden" id="fy-cal-win-fy">
    <div style="display:flex;flex-direction:column;gap:6px;">
      <label style="font-size:12.5px;font-weight:600;">Tipo de janela</label>
      <select id="fy-cal-win-tipo" class="fy-ws-select" style="width:100%;">${winOpts}</select>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
      <div style="display:flex;flex-direction:column;gap:6px;">
        <label style="font-size:12.5px;font-weight:600;">Data início</label>
        <input id="fy-cal-win-ini" type="date" class="fy-ws-input">
      </div>
      <div style="display:flex;flex-direction:column;gap:6px;">
        <label style="font-size:12.5px;font-weight:600;">Data fim</label>
        <input id="fy-cal-win-fim" type="date" class="fy-ws-input">
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;">
      <label style="font-size:12.5px;font-weight:600;">Descrição (opcional)</label>
      <input id="fy-cal-win-desc" type="text" class="fy-ws-input" style="width:100%;box-sizing:border-box;">
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;">
      <button class="fy-ws-btn" onclick="_fyJanelaModalFechar()">Cancelar</button>
      <button class="fy-ws-btn-p" onclick="_fyJanelaSalvar()">Salvar janela</button>
    </div>
  </div>
</div>`;
}

// ---- Marco modal ----
function _fyMilestoneModalAbrir(fyCodigo) {
    const modal = document.getElementById('fy-cal-ml-modal');
    if (!modal) return;
    document.getElementById('fy-cal-ml-fy').value    = fyCodigo;
    document.getElementById('fy-cal-ml-nome').value  = '';
    document.getElementById('fy-cal-ml-data').value  = '';
    document.getElementById('fy-cal-ml-resp').value  = '';
    modal.style.display = 'flex';
}
function _fyMilestoneModalFechar() {
    const modal = document.getElementById('fy-cal-ml-modal');
    if (modal) modal.style.display = 'none';
}
async function _fyMilestoneSalvar() {
    const fyCodigo = document.getElementById('fy-cal-ml-fy').value;
    const nome     = document.getElementById('fy-cal-ml-nome').value.trim();
    const data     = document.getElementById('fy-cal-ml-data').value;
    const tipo     = document.getElementById('fy-cal-ml-tipo').value;
    const resp     = document.getElementById('fy-cal-ml-resp').value.trim();
    if (!nome || !data) { alert('Preencha nome e data.'); return; }
    const { error } = await _supabase.from('fiscal_milestones').insert({
        fiscal_year_codigo: fyCodigo,
        name: nome, milestone_date: data, milestone_type: tipo,
        responsavel: resp || null, criado_por: _fyWsUsuario(),
    });
    if (error) { alert('Erro: ' + error.message); return; }
    _fyMilestoneModalFechar();
    const fy = (typeof getAFPorCodigo === 'function') ? getAFPorCodigo(fyCodigo) : null;
    if (fy) await _fyCalendarioCarregar(fy);
}
async function _fyMilestoneExcluir(id, fyCodigo) {
    if (!confirm('Excluir este marco?')) return;
    const { error } = await _supabase.from('fiscal_milestones').delete().eq('id', id);
    if (error) { alert('Erro: ' + error.message); return; }
    const fy = (typeof getAFPorCodigo === 'function') ? getAFPorCodigo(fyCodigo) : null;
    if (fy) await _fyCalendarioCarregar(fy);
}

// ---- Janela modal ----
function _fyJanelaModalAbrir(fyCodigo) {
    const modal = document.getElementById('fy-cal-win-modal');
    if (!modal) return;
    document.getElementById('fy-cal-win-fy').value   = fyCodigo;
    document.getElementById('fy-cal-win-ini').value  = '';
    document.getElementById('fy-cal-win-fim').value  = '';
    document.getElementById('fy-cal-win-desc').value = '';
    modal.style.display = 'flex';
}
function _fyJanelaModalFechar() {
    const modal = document.getElementById('fy-cal-win-modal');
    if (modal) modal.style.display = 'none';
}
async function _fyJanelaSalvar() {
    const fyCodigo = document.getElementById('fy-cal-win-fy').value;
    const tipo     = document.getElementById('fy-cal-win-tipo').value;
    const inicio   = document.getElementById('fy-cal-win-ini').value;
    const fim      = document.getElementById('fy-cal-win-fim').value;
    const desc     = document.getElementById('fy-cal-win-desc').value.trim();
    if (!inicio || !fim) { alert('Preencha as datas de início e fim.'); return; }
    if (fim < inicio)    { alert('A data de fim deve ser igual ou posterior ao início.'); return; }
    const { error } = await _supabase.from('fiscal_windows').insert({
        fiscal_year_codigo: fyCodigo,
        window_type: tipo, start_date: inicio, end_date: fim,
        description: desc || null, criado_por: _fyWsUsuario(),
    });
    if (error) { alert('Erro: ' + error.message); return; }
    _fyJanelaModalFechar();
    const fy = (typeof getAFPorCodigo === 'function') ? getAFPorCodigo(fyCodigo) : null;
    if (fy) await _fyCalendarioCarregar(fy);
}

// =========================================================================
// VIS-FY-03 — Planejamento (Carteira Candidata + Pacote de BC)
// =========================================================================

// Sub-chip ativo dentro da aba Planejamento: 'carteira' | 'pacote'
let _fyPlanSubChip = 'carteira';

async function _fyPlanejamentoCarregar(fy) {
    _fyPlanSubChip = 'carteira';
    await _fyPlanCarregarDados(fy);
}

async function _fyPlanCarregarDados(fy) {
    const content = document.getElementById('fy-ws-content');
    if (!content) return;
    content.innerHTML = '<div style="padding:40px;text-align:center;color:#93a4c3;font-size:12.5px;">Carregando…</div>';

    // BCs do FY: business_cases com ano_fiscal = fy.codigo, via view projetos
    const bcs = (typeof projectsData !== 'undefined')
        ? projectsData.filter(p => p.etapa_atual === 'BUSINESS CASE' && p.ano_fiscal === fy.ano_fiscal)
        : [];

    // Participações CROSS_FY já confirmadas (project_fiscal_year com regime=CROSS_FY)
    const { data: crossFyRows } = await _supabase
        .from('project_fiscal_year')
        .select('*')
        .eq('fiscal_year_codigo', fy.ano_fiscal)
        .eq('regime', 'CROSS_FY');
    const crossFyList = crossFyRows || [];

    // Itens do pacote (se já existe pacote fechado)
    const pacoteFy = await _fyPlanObterPacote(fy.ano_fiscal);

    if (_fyPlanSubChip === 'pacote') {
        _fyPacoteBCRender(fy, bcs, crossFyList, pacoteFy);
    } else {
        _fyCarteiraCandidataRender(fy, bcs, crossFyList, pacoteFy);
    }
}

async function _fyPlanObterPacote(anofiscal) {
    const { data } = await _supabase
        .from('pacotes_fy')
        .select('*, pacote_fy_itens(*)')
        .eq('ano_fiscal', anofiscal)
        .order('id', { ascending: false })
        .limit(1)
        .maybeSingle();
    return data || null;
}

// ---- Sub-chip toggle ----
async function _fyPlanChip(chip) {
    _fyPlanSubChip = chip;
    const fy = (typeof getAFPorCodigo === 'function') ? getAFPorCodigo((window.fyWorkspaceContext||{}).codigo||'') : null;
    if (fy) await _fyPlanCarregarDados(fy);
}

// ---- Situação de planejamento derivada ----
function _fyPlanSituacao(bc, pacoteItens) {
    const ss = (bc.sub_status||'').toUpperCase();
    if (ss === 'APROVADO')  return { label: 'No pacote',         cls: 'fy-badge-ok' };
    if (ss === 'DEVOLVED' || ss === 'DEVOLVIDO') return { label: 'Devolvido pelo FY', cls: 'fy-badge-wa' };
    if (ss === 'POSTERGADO') return { label: 'Postergado',       cls: 'fy-badge-nu' };
    if (ss === 'ORÇAMENTO REALIZADO' || ss === 'EM ESTIMATIVA') return { label: 'Em estimativa', cls: 'fy-badge-in' };
    if (ss === 'PLANEJADO')  return { label: 'Planejado',        cls: 'fy-badge-in' };
    return { label: 'Em análise', cls: 'fy-badge-nu' };
}

// =========================================================================
// VIS-FY-03 · Sub-tela A: Carteira Candidata
// =========================================================================
function _fyCarteiraCandidataRender(fy, bcs, crossFyList, pacote) {
    const content = document.getElementById('fy-ws-content');
    if (!content) return;

    const projetosMap = {};
    if (typeof projectsData !== 'undefined') projectsData.forEach(p => { projetosMap[p.codigo] = p; });

    const pacoteItens = pacote ? (pacote.pacote_fy_itens || []) : [];

    // Totais KPI
    const noPackCount = bcs.filter(p => (p.sub_status||'').toUpperCase() === 'APROVADO').length;
    const emConstrCount = bcs.filter(p => !['APROVADO','DEVOLVED','DEVOLVIDO'].includes((p.sub_status||'').toUpperCase())).length;
    const crossCount = crossFyList.length;
    const postergCount = bcs.filter(p => (p.sub_status||'').toUpperCase() === 'POSTERGADO').length;
    const semDecisaoCount = bcs.filter(p => {
        const ss = (p.sub_status||'').toUpperCase();
        return ss !== 'APROVADO' && ss !== 'DEVOLVED' && ss !== 'DEVOLVIDO' && ss !== 'POSTERGADO';
    }).length;

    const pacoteFechado = pacote && pacote.status === 'FECHADO';
    const valorNoPackTotal = bcs
        .filter(p => (p.sub_status||'').toUpperCase() === 'APROVADO')
        .reduce((a, p) => a + (Number(p.val_bc)||Number(p.previsto)||0), 0);
    const valorCross = crossFyList.reduce((a, r) => a + (Number(r.valor_alocado)||0), 0);

    function fmtBRL(v) {
        if (!v) return '—';
        return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }

    // Linhas da tabela
    const allRows = [
        ...bcs.map(bc => ({ tipo: 'BC', codigo: bc.codigo, nome: bc.nome, regime: bc.regime || 'FY_BOUND', classif: bc.classificacao_estrategica || '—', sit: _fyPlanSituacao(bc, pacoteItens), valor: Number(bc.val_bc)||Number(bc.previsto)||0 })),
        ...crossFyList.map(r => {
            const p = projetosMap[r.projeto_codigo] || {};
            return { tipo: 'Projeto', codigo: r.projeto_codigo, nome: p.nome||'—', regime: 'CROSS_FY', classif: p.classificacao_estrategica||'—', sit: { label: 'Continuidade aprovada', cls: 'fy-badge-ok' }, valor: Number(r.valor_alocado)||0 };
        }),
    ];

    const regimeCfg = { CROSS_FY: { label:'CROSS_FY', cls:'fy-badge-in' }, FY_BOUND: { label:'FY_BOUND', cls:'fy-badge-nu' } };

    const rowsHtml = allRows.length === 0
        ? `<tr><td colspan="7" style="padding:20px 9px;text-align:center;color:#93a4c3;">Nenhum BC ou projeto vinculado a este exercício.</td></tr>`
        : allRows.map(r => {
            const rCfg = regimeCfg[r.regime] || regimeCfg['FY_BOUND'];
            return `<tr>
                <td style="padding:6px 9px;white-space:nowrap;">${r.tipo}</td>
                <td style="padding:6px 9px;white-space:nowrap;"><b>${r.codigo}</b></td>
                <td style="padding:6px 9px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.nome}</td>
                <td style="padding:6px 9px;white-space:nowrap;"><span class="fy-b ${rCfg.cls}">${rCfg.label}</span></td>
                <td style="padding:6px 9px;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.classif}</td>
                <td style="padding:6px 9px;white-space:nowrap;"><span class="fy-b ${r.sit.cls}">${r.sit.label}</span></td>
                <td style="padding:6px 9px;white-space:nowrap;text-align:right;">${r.valor > 0 ? fmtBRL(r.valor) : 'em estimativa'}</td>
            </tr>`;
          }).join('');

    content.innerHTML = `
<!-- Sub-chips + header -->
<div class="fy-ws-card" style="padding:10px 14px;display:flex;align-items:center;gap:8px;">
  <span class="fy-ws-h2" style="margin-right:8px;">Planejamento · ${fy.ano_fiscal}</span>
  <button class="fy-ws-chip${_fyPlanSubChip==='carteira'?' on':''}" onclick="_fyPlanChip('carteira')">Carteira candidata</button>
  <button class="fy-ws-chip${_fyPlanSubChip==='pacote'?' on':''}" onclick="_fyPlanChip('pacote')">Pacote de BC <b>${noPackCount}</b></button>
  <span style="flex-grow:1;"></span>
  ${!pacoteFechado ? `<button class="fy-ws-btn-p" onclick="switchTab('aprov_orcamento_af')">+ Nova Demanda</button>` : ''}
</div>

<!-- KPIs -->
<div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px;">
  <div class="fy-ws-card fy-ws-kpi"><span class="fy-ws-lbl">BCs no pacote</span><span class="num" style="color:#3730a3;">${noPackCount}</span><span class="fy-ws-sub">${fmtBRL(valorNoPackTotal)}</span></div>
  <div class="fy-ws-card fy-ws-kpi"><span class="fy-ws-lbl">BCs em construção/avaliação</span><span class="num">${emConstrCount}</span><span class="fy-ws-sub">entram até o fechamento</span></div>
  <div class="fy-ws-card fy-ws-kpi"><span class="fy-ws-lbl">CROSS-FY previstos</span><span class="num" style="color:#1d4ed8;">${crossCount}</span><span class="fy-ws-sub">${fmtBRL(valorCross)}</span></div>
  <div class="fy-ws-card fy-ws-kpi"><span class="fy-ws-lbl">Postergados</span><span class="num" style="color:#64748b;">${postergCount}</span><span class="fy-ws-sub">do FY anterior</span></div>
  <div class="fy-ws-card fy-ws-kpi"><span class="fy-ws-lbl">Decisão pendente</span><span class="num" style="color:${semDecisaoCount>0?'#991b1b':'#166534'};">${semDecisaoCount}</span><span class="fy-ws-sub">${semDecisaoCount>0?'requer ação':'tudo definido'}</span></div>
</div>

<!-- Tabela + sidebar -->
<div style="display:flex;gap:14px;align-items:flex-start;">
  <div class="fy-ws-card" style="flex-grow:1;overflow:hidden;">
    <div style="padding:10px 12px;display:flex;justify-content:space-between;align-items:center;">
      <span class="fy-ws-h2">Carteira candidata do ${fy.ano_fiscal}</span>
      <span class="fy-ws-sub">${allRows.length} itens</span>
    </div>
    <div style="overflow-x:auto;">
      <table class="fy-ws-table" style="min-width:800px;">
        <thead><tr><th>Origem</th><th>Código</th><th>Nome</th><th>Regime</th><th>Classif. Estratégica</th><th>Situação de planejamento</th><th style="text-align:right;">Valor</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  </div>

  <!-- Sidebar composição -->
  <div style="width:280px;flex-shrink:0;display:flex;flex-direction:column;gap:10px;">
    <div class="fy-ws-card" style="overflow:hidden;">
      <div style="padding:10px 12px 0 12px;"><span class="fy-ws-h2">Composição do ${fy.ano_fiscal}</span></div>
      <div style="padding:8px 12px 12px;display:flex;flex-direction:column;gap:6px;font-size:12px;">
        <div style="display:flex;justify-content:space-between;gap:8px;"><span>Novos BCs (pacote)</span><b style="white-space:nowrap;">${fmtBRL(valorNoPackTotal)}</b></div>
        <div style="display:flex;justify-content:space-between;gap:8px;"><span>CROSS-FY (alocação anual)</span><b style="white-space:nowrap;">${fmtBRL(valorCross)}</b></div>
        <div style="border-top:1px solid #e5e7eb;padding-top:6px;display:flex;justify-content:space-between;">
          <span style="font-weight:700;">Total planejado</span>
          <b>${fmtBRL(valorNoPackTotal + valorCross)}</b>
        </div>
      </div>
    </div>
    <div style="background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;padding:9px 11px;font-size:11.5px;color:#78350f;line-height:1.45;">
      <b>DV-02 e DV-03.</b> "+ Nova Demanda" abre o fluxo M05. Não há Novo Projeto nesta tela. Regime e classificação estratégica são colunas distintas.
    </div>
    <div style="background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;padding:9px 11px;font-size:11.5px;color:#78350f;line-height:1.45;">
      <b>R-IN-07.</b> CROSS-FY e Carryover entram como participações do projeto existente, nunca como nova demanda.
    </div>
  </div>
</div>`;
}

// =========================================================================
// VIS-FY-03 · Sub-tela B: Pacote de BC
// =========================================================================
function _fyPacoteBCRender(fy, bcs, crossFyList, pacote) {
    const content = document.getElementById('fy-ws-content');
    if (!content) return;

    const pacoteItens  = pacote ? (pacote.pacote_fy_itens || []) : [];
    const pacoteFechado = pacote && pacote.status === 'FECHADO';

    // BCs com alguma decisão (estão no pacote ou foram devolvidos/postergados)
    const bcsPacote = bcs.filter(p => {
        const ss = (p.sub_status||'').toUpperCase();
        return ['APROVADO','DEVOLVED','DEVOLVIDO','POSTERGADO'].includes(ss);
    });
    const semDecisao = bcsPacote.filter(p => (p.sub_status||'').toUpperCase() === 'SEM_DECISAO').length;
    const aprovados  = bcsPacote.filter(p => (p.sub_status||'').toUpperCase() === 'APROVADO');
    const valorTotal = aprovados.reduce((a, p) => a + (Number(p.val_bc)||Number(p.previsto)||0), 0);
    const valorAprov = aprovados.reduce((a, p) => a + (Number(p.val_bc)||Number(p.previsto)||0), 0);
    const bcsSemDec  = bcsPacote.filter(p => (p.sub_status||'').toUpperCase() === 'SEM_DECISAO');

    function fmtBRL(v) {
        if (!v) return '—';
        return 'R$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }

    function decisaoCfg(bc) {
        const ss = (bc.sub_status||'').toUpperCase();
        if (ss === 'APROVADO')  return { label: 'Aprovado',    cls: 'fy-badge-ok' };
        if (ss === 'DEVOLVED' || ss === 'DEVOLVIDO') return { label: 'Devolvido', cls: 'fy-badge-wa' };
        if (ss === 'POSTERGADO') return { label: 'Postergado', cls: 'fy-badge-nu' };
        return { label: 'Sem decisão', cls: 'fy-badge-cr' };
    }

    const regimeCfg = { CROSS_FY: { label:'CROSS_FY', cls:'fy-badge-in' }, FY_BOUND: { label:'FY_BOUND', cls:'fy-badge-nu' } };

    const rowsHtml = bcsPacote.length === 0
        ? `<tr><td colspan="6" style="padding:20px 9px;text-align:center;color:#93a4c3;">Nenhum BC com decisão registrada para este exercício.</td></tr>`
        : bcsPacote.map(bc => {
            const dec  = decisaoCfg(bc);
            const rCfg = regimeCfg[bc.regime||'FY_BOUND'] || regimeCfg['FY_BOUND'];
            const val  = Number(bc.val_bc)||Number(bc.previsto)||0;
            const ss   = (bc.sub_status||'').toUpperCase();
            const mostrarAcao = !pacoteFechado && ss !== 'APROVADO';
            return `<tr>
                <td style="padding:6px 9px;white-space:nowrap;"><b>${bc.codigo}</b></td>
                <td style="padding:6px 9px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${bc.nome||'—'}</td>
                <td style="padding:6px 9px;white-space:nowrap;"><span class="fy-b ${rCfg.cls}">${rCfg.label}</span></td>
                <td style="padding:6px 9px;white-space:nowrap;text-align:right;">${val > 0 ? fmtBRL(val) : 'em estimativa'}</td>
                <td style="padding:6px 9px;white-space:nowrap;"><span class="fy-b ${dec.cls}">${dec.label}</span></td>
                <td style="padding:6px 9px;white-space:nowrap;">
                    ${!pacoteFechado && ss === 'APROVADO' ? `<button class="fy-ws-btn" onclick="_fyPacoteDevolverBC('${bc.codigo}')" style="padding:3px 9px;font-size:11.5px;">Devolver</button>` : ''}
                    ${mostrarAcao ? `<button class="fy-ws-btn-p" onclick="_fyPacoteDecidirBC('${bc.codigo}')" style="padding:3px 9px;font-size:11.5px;">Decidir</button>` : ''}
                </td>
            </tr>`;
          }).join('');

    // Card de extraordinários (do pacote fechado)
    const extrasHtml = pacoteItens.filter(i => {
        const p = (typeof projectsData !== 'undefined') ? projectsData.find(x => x.codigo === i.business_case_codigo) : null;
        return p && p.is_adhoc === true;
    }).map(i => {
        const p = (typeof projectsData !== 'undefined') ? projectsData.find(x => x.codigo === i.business_case_codigo) : {};
        return `<tr>
            <td style="padding:6px 9px;white-space:nowrap;"><b>${i.business_case_codigo}</b></td>
            <td style="padding:6px 9px;">${(p&&p.nome)||'—'}</td>
            <td style="padding:6px 9px;white-space:nowrap;text-align:right;">${fmtBRL(i.valor_incluido)}</td>
            <td style="padding:6px 9px;white-space:nowrap;"><span class="fy-b fy-badge-ok">Convertido</span></td>
        </tr>`;
    }).join('') || `<tr><td colspan="4" style="padding:12px 9px;text-align:center;color:#93a4c3;">Nenhum extraordinário.</td></tr>`;

    const bloqueio = bcsSemDec.length > 0;
    const podeFechar = !pacoteFechado && !bloqueio && aprovados.length > 0;

    content.innerHTML = `
<!-- Sub-chips -->
<div class="fy-ws-card" style="padding:10px 14px;display:flex;align-items:center;gap:8px;">
  <span class="fy-ws-h2" style="margin-right:8px;">Planejamento · ${fy.ano_fiscal}</span>
  <button class="fy-ws-chip${_fyPlanSubChip==='carteira'?' on':''}" onclick="_fyPlanChip('carteira')">Carteira candidata</button>
  <button class="fy-ws-chip${_fyPlanSubChip==='pacote'?' on':''}" onclick="_fyPlanChip('pacote')">Pacote de BC <b>${bcsPacote.length}</b></button>
  ${pacoteFechado ? `<span class="fy-b fy-badge-ok" style="margin-left:8px;">Pacote fechado</span>` : ''}
</div>

<!-- KPIs -->
<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;">
  <div class="fy-ws-card fy-ws-kpi"><span class="fy-ws-lbl">Teto do exercício</span><span class="num">—</span><span class="fy-ws-sub">configurar em Financeiro</span></div>
  <div class="fy-ws-card fy-ws-kpi"><span class="fy-ws-lbl">No pacote</span><span class="num" style="color:#3730a3;">${fmtBRL(valorTotal)}</span><span class="fy-ws-sub">${bcsPacote.length} BCs</span></div>
  <div class="fy-ws-card fy-ws-kpi"><span class="fy-ws-lbl">Aprovados</span><span class="num" style="color:#166534;">${fmtBRL(valorAprov)}</span><span class="fy-ws-sub">${aprovados.length} BCs</span></div>
  <div class="fy-ws-card fy-ws-kpi"><span class="fy-ws-lbl">Sem decisão</span><span class="num" style="color:${bcsSemDec.length>0?'#991b1b':'#166534'};">${bcsSemDec.length}</span><span class="fy-ws-sub">${bcsSemDec.length>0?'bloqueia o fechamento':'pronto para fechar'}</span></div>
</div>

<!-- Tabela + sidebar -->
<div style="display:flex;gap:14px;align-items:flex-start;">
  <div style="flex-grow:1;min-width:0;display:flex;flex-direction:column;gap:12px;">
    <div class="fy-ws-card" style="overflow:hidden;">
      <div style="padding:10px 12px;"><span class="fy-ws-h2">BCs no pacote · M05 item C</span></div>
      <div style="overflow-x:auto;">
        <table class="fy-ws-table" style="min-width:700px;">
          <thead><tr><th>BC</th><th>Nome</th><th>Regime previsto</th><th style="text-align:right;">Valor aprovado</th><th>Decisão do FY</th><th></th></tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </div>
    </div>
    <div class="fy-ws-card" style="overflow:hidden;">
      <div style="padding:10px 12px;"><span class="fy-ws-h2">Extraordinários · orçamento próprio (D-07)</span></div>
      <div style="overflow-x:auto;">
        <table class="fy-ws-table">
          <thead><tr><th>BC</th><th>Nome</th><th style="text-align:right;">Valor</th><th>Status</th></tr></thead>
          <tbody>${extrasHtml}</tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Sidebar fechar pacote -->
  <div style="width:300px;flex-shrink:0;display:flex;flex-direction:column;gap:10px;">
    ${pacoteFechado
        ? `<div class="fy-ws-card" style="padding:16px;display:flex;flex-direction:column;gap:8px;border:2px solid #16a34a;">
             <span class="fy-ws-h2" style="color:#16a34a;">Pacote fechado</span>
             <span class="fy-ws-sub">Fechado em ${_fyWsFmtData(pacote.fechado_em||'')} por ${pacote.fechado_por||'—'}.</span>
             <span class="fy-ws-sub">${pacote.qtd_projetos} projetos criados · ${fmtBRL(pacote.valor_total)}</span>
           </div>`
        : `<div class="fy-ws-card" style="padding:14px;display:flex;flex-direction:column;gap:8px;border:2px solid #4338ca;box-shadow:0 10px 30px rgba(15,30,61,.12);">
             <span class="fy-ws-h2">Fechar pacote do ${fy.ano_fiscal}</span>
             ${bloqueio ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:7px 10px;font-size:11.5px;color:#7f1d1d;"><b>PA.8:</b> ${bcsSemDec.length} BC(s) sem decisão. Decida antes de fechar.</div>` : ''}
             <div style="font-size:12px;display:flex;flex-direction:column;gap:4px;">
               <span>Serão criados <b>${aprovados.length} projetos</b> em lote, em Requerimentos.</span>
               <span>Orçamento será fechado: <b>${fmtBRL(valorAprov)}</b>.</span>
               <span>Após fechar, apenas BCs extraordinários serão aceitos neste FY.</span>
             </div>
             <div style="display:flex;justify-content:flex-end;gap:8px;">
               <button class="fy-ws-btn-p" onclick="executarAprovacaoGlobalOrcamentoAF()"
                 ${!podeFechar ? 'disabled style="opacity:.5;cursor:not-allowed;"' : ''}>
                 Fechar pacote e criar projetos
               </button>
             </div>
           </div>`
    }
    <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:9px 11px;font-size:11.5px;color:#78350f;line-height:1.45;">
      <b>R-IN-01.</b> Submeter o pacote leva o ${fy.ano_fiscal} para Em orçamentação (R-IN-02). Após fechar, só BC extraordinário é aceito (R-IN-04).
    </div>
  </div>
</div>

<!-- Modal decisão individual -->
<div id="fy-plan-decisao-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000;align-items:center;justify-content:center;">
  <div class="fy-ws-card" style="width:400px;padding:20px;display:flex;flex-direction:column;gap:14px;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span class="fy-ws-h2" id="fy-plan-decisao-titulo">Decidir BC</span>
      <button onclick="_fyPacoteDecisaoFechar()" style="background:none;border:none;cursor:pointer;font-size:18px;color:#64748b;">×</button>
    </div>
    <input type="hidden" id="fy-plan-decisao-bc">
    <div style="display:flex;flex-direction:column;gap:6px;">
      <label style="font-size:12.5px;font-weight:600;">Decisão</label>
      <select id="fy-plan-decisao-sel" class="fy-ws-select" style="width:100%;">
        <option value="APROVADO">Aprovado</option>
        <option value="DEVOLVED">Devolvido</option>
        <option value="POSTERGADO">Postergado</option>
      </select>
    </div>
    <div style="display:flex;flex-direction:column;gap:6px;" id="fy-plan-motivo-wrap">
      <label style="font-size:12.5px;font-weight:600;">Motivo (obrigatório para Devolvido)</label>
      <input id="fy-plan-motivo-input" type="text" class="fy-ws-input" style="width:100%;box-sizing:border-box;" placeholder="Descreva o motivo">
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;">
      <button class="fy-ws-btn" onclick="_fyPacoteDecisaoFechar()">Cancelar</button>
      <button class="fy-ws-btn-p" onclick="_fyPacoteDecisaoSalvar()">Salvar decisão</button>
    </div>
  </div>
</div>`;
}

// ---- Ações do Pacote de BC ----
function _fyPacoteDevolverBC(codigo) {
    if (typeof devolverBCDoFY === 'function') {
        devolverBCDoFY(codigo);
    } else {
        alert('Função de devolução não disponível.');
    }
}

function _fyPacoteDecidirBC(codigo) {
    const modal = document.getElementById('fy-plan-decisao-modal');
    if (!modal) return;
    document.getElementById('fy-plan-decisao-bc').value = codigo;
    document.getElementById('fy-plan-decisao-titulo').textContent = 'Decidir · ' + codigo;
    document.getElementById('fy-plan-decisao-sel').value = 'APROVADO';
    modal.style.display = 'flex';
}

function _fyPacoteDecisaoFechar() {
    const modal = document.getElementById('fy-plan-decisao-modal');
    if (modal) modal.style.display = 'none';
}

async function _fyPacoteDecisaoSalvar() {
    const codigo  = document.getElementById('fy-plan-decisao-bc').value;
    const decisao = document.getElementById('fy-plan-decisao-sel').value;
    const motivo  = document.getElementById('fy-plan-motivo-input').value.trim();
    if (decisao === 'DEVOLVED' && !motivo) { alert('Informe o motivo da devolução.'); return; }

    const hoje = new Date().toISOString().split('T')[0];
    const payload = { sub_status: decisao };
    if (decisao === 'DEVOLVED') {
        payload.motivo_devolucao_fy = motivo;
        payload.dt_devolucao_fy = hoje;
    }

    const { error } = await _supabase.from('projetos').update(payload).eq('codigo', codigo);
    if (error) { alert('Erro: ' + error.message); return; }

    const prj = (typeof projectsData !== 'undefined') ? projectsData.find(p => p.codigo === codigo) : null;
    if (prj) Object.assign(prj, payload);

    _fyPacoteDecisaoFechar();
    const fy = (typeof getAFPorCodigo === 'function') ? getAFPorCodigo((window.fyWorkspaceContext||{}).codigo||'') : null;
    if (fy) await _fyPlanCarregarDados(fy);
}

// =========================================================================
// VIS-FY-06 — Transições (project_fiscal_transition)
// =========================================================================

const _TRANSICAO_TIPO_CFG = {
    CARRYOVER:         { label: 'Carryover',       cls: 'fy-badge-wa' },
    HOLD:              { label: 'Hold',             cls: 'fy-badge-nu' },
    CROSS_FY_CONTINUE: { label: 'CROSS-FY Cont.',  cls: 'fy-badge-in' },
    COMPLETE:          { label: 'Concluído',        cls: 'fy-badge-ok' },
    TERMINATE:         { label: 'Encerrado',        cls: 'fy-badge-cr' },
    CANCEL:            { label: 'Cancelado',        cls: 'fy-badge-cr' },
};
const _TRANSICAO_STATUS_CFG = {
    DRAFT:        { label: 'Rascunho',    cls: 'fy-badge-nu' },
    SUBMITTED:    { label: 'Submetido',   cls: 'fy-badge-in' },
    UNDER_REVIEW: { label: 'Em análise',  cls: 'fy-badge-wa' },
    APPROVED:     { label: 'Aprovado',    cls: 'fy-badge-ok' },
    REJECTED:     { label: 'Rejeitado',   cls: 'fy-badge-cr' },
    EXECUTED:     { label: 'Executado',   cls: 'fy-badge-ok' },
    CANCELLED:    { label: 'Cancelado',   cls: 'fy-badge-nu' },
};

async function _fyTransicoesCarregar(fy) {
    const content = document.getElementById('fy-ws-content');
    if (!content) return;
    content.innerHTML = '<div style="padding:40px;text-align:center;color:#93a4c3;font-size:12.5px;">Carregando…</div>';

    const { data, error } = await _supabase
        .from('project_fiscal_transition')
        .select('*')
        .eq('fiscal_year_origem', fy.ano_fiscal)
        .order('criado_em', { ascending: false });

    if (error) { content.innerHTML = `<div style="padding:24px;color:#dc2626;">${error.message}</div>`; return; }
    const transicoes = data || [];

    // KPIs
    const exec     = transicoes.filter(t => t.status === 'EXECUTED').length;
    const pendente = transicoes.filter(t => !['EXECUTED','CANCELLED','REJECTED'].includes(t.status)).length;
    const carryover = transicoes.filter(t => t.tipo === 'CARRYOVER').length;
    const crossFy   = transicoes.filter(t => t.tipo === 'CROSS_FY_CONTINUE').length;

    const linhasHtml = transicoes.length === 0
        ? `<tr><td colspan="7" style="padding:20px 9px;text-align:center;color:#93a4c3;">Nenhuma transição registrada para este exercício.</td></tr>`
        : transicoes.map(t => {
            const tipoCfg = _TRANSICAO_TIPO_CFG[t.tipo] || { label: t.tipo, cls: 'fy-badge-nu' };
            const stCfg   = _TRANSICAO_STATUS_CFG[t.status] || { label: t.status, cls: 'fy-badge-nu' };
            const pnome   = (typeof projectsData !== 'undefined') ? (projectsData.find(p => p.codigo === t.projeto_codigo)||{}).nome || '—' : '—';
            const podExecutar = t.status === 'APPROVED';
            return `<tr>
                <td style="padding:6px 9px;white-space:nowrap;"><b>${t.projeto_codigo}</b></td>
                <td style="padding:6px 9px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${pnome}</td>
                <td style="padding:6px 9px;white-space:nowrap;"><span class="fy-b ${tipoCfg.cls}">${tipoCfg.label}</span></td>
                <td style="padding:6px 9px;">${t.fiscal_year_destino||'—'}</td>
                <td style="padding:6px 9px;white-space:nowrap;"><span class="fy-b ${stCfg.cls}">${stCfg.label}</span></td>
                <td style="padding:6px 9px;white-space:nowrap;">${t.executado_em ? _fyWsFmtData(t.executado_em) : '—'}</td>
                <td style="padding:6px 9px;white-space:nowrap;">
                    ${podExecutar ? `<button class="fy-ws-btn-p" onclick="_fyTransicaoExecutar(${t.id})" style="padding:3px 9px;font-size:11.5px;">Executar</button>` : ''}
                    ${t.status === 'DRAFT' ? `<button class="fy-ws-btn" onclick="_fyTransicaoSubmeter(${t.id})" style="padding:3px 9px;font-size:11.5px;">Submeter</button>` : ''}
                </td>
            </tr>`;
          }).join('');

    content.innerHTML = `
<div class="fy-ws-card" style="padding:10px 14px;display:flex;align-items:center;gap:8px;">
  <span class="fy-ws-h2">Transições · ${fy.ano_fiscal}</span>
  <span style="flex-grow:1;"></span>
  <button class="fy-ws-btn-p" onclick="_fyTransicaoAbrirModal('${fy.ano_fiscal}')">+ Nova Transição</button>
</div>

<div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;">
  <div class="fy-ws-card fy-ws-kpi"><span class="fy-ws-lbl">Executadas</span><span class="num" style="color:#166534;">${exec}</span><span class="fy-ws-sub">de ${transicoes.length}</span></div>
  <div class="fy-ws-card fy-ws-kpi"><span class="fy-ws-lbl">Pendentes</span><span class="num" style="color:${pendente>0?'#d97706':'#166534'};">${pendente}</span><span class="fy-ws-sub">${pendente>0?'requerem ação':'tudo resolvido'}</span></div>
  <div class="fy-ws-card fy-ws-kpi"><span class="fy-ws-lbl">Carryover</span><span class="num">${carryover}</span><span class="fy-ws-sub">saldo p/ próximo FY</span></div>
  <div class="fy-ws-card fy-ws-kpi"><span class="fy-ws-lbl">CROSS-FY Cont.</span><span class="num" style="color:#1d4ed8;">${crossFy}</span><span class="fy-ws-sub">continuidade</span></div>
</div>

<div class="fy-ws-card" style="overflow:hidden;">
  <div style="padding:10px 12px;"><span class="fy-ws-h2">Transições do ${fy.ano_fiscal}</span></div>
  <div style="overflow-x:auto;">
    <table class="fy-ws-table" style="min-width:700px;">
      <thead><tr><th>Projeto</th><th>Nome</th><th>Tipo</th><th>FY Destino</th><th>Status</th><th>Executado em</th><th></th></tr></thead>
      <tbody>${linhasHtml}</tbody>
    </table>
  </div>
</div>

<!-- Modal nova transição -->
<div id="fy-trans-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000;align-items:center;justify-content:center;">
  <div class="fy-ws-card" style="width:440px;padding:20px;display:flex;flex-direction:column;gap:12px;">
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span class="fy-ws-h2">Nova Transição</span>
      <button onclick="_fyTransicaoFecharModal()" style="background:none;border:none;cursor:pointer;font-size:18px;color:#64748b;">×</button>
    </div>
    <input type="hidden" id="fy-trans-fy-origem">
    <div style="display:flex;flex-direction:column;gap:4px;">
      <label style="font-size:12.5px;font-weight:600;">Projeto</label>
      <select id="fy-trans-projeto" class="fy-ws-select" style="width:100%;"></select>
    </div>
    <div style="display:flex;flex-direction:column;gap:4px;">
      <label style="font-size:12.5px;font-weight:600;">Tipo de Transição</label>
      <select id="fy-trans-tipo" class="fy-ws-select" style="width:100%;">
        <option value="CARRYOVER">Carryover (saldo vai pro próximo FY)</option>
        <option value="CROSS_FY_CONTINUE">CROSS-FY Continuidade</option>
        <option value="HOLD">Hold (pausa formal)</option>
        <option value="COMPLETE">Concluído no FY</option>
        <option value="TERMINATE">Encerrado antecipadamente</option>
        <option value="CANCEL">Cancelado</option>
      </select>
    </div>
    <div style="display:flex;flex-direction:column;gap:4px;">
      <label style="font-size:12.5px;font-weight:600;">FY Destino (opcional)</label>
      <select id="fy-trans-destino" class="fy-ws-select" style="width:100%;"><option value="">— nenhum —</option></select>
    </div>
    <div style="display:flex;flex-direction:column;gap:4px;">
      <label style="font-size:12.5px;font-weight:600;">Justificativa</label>
      <textarea id="fy-trans-just" class="fy-ws-input" rows="2" style="width:100%;box-sizing:border-box;resize:vertical;" placeholder="Descreva a razão da transição"></textarea>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;">
      <button class="fy-ws-btn" onclick="_fyTransicaoFecharModal()">Cancelar</button>
      <button class="fy-ws-btn-p" onclick="_fyTransicaoSalvar()">Criar transição</button>
    </div>
  </div>
</div>`;
}

function _fyTransicaoAbrirModal(fyOrigem) {
    const modal = document.getElementById('fy-trans-modal');
    if (!modal) return;
    document.getElementById('fy-trans-fy-origem').value = fyOrigem;

    // Popula projetos do FY
    const selPrj = document.getElementById('fy-trans-projeto');
    const pfyProjs = (typeof projectsData !== 'undefined')
        ? projectsData.filter(p => p.ano_fiscal === fyOrigem || (p.etapa_atual !== 'BUSINESS CASE' && !['ENCERRADO','CANCELADO'].includes(p.etapa_atual||'')))
        : [];
    selPrj.innerHTML = '<option value="">— selecione —</option>' + pfyProjs.map(p => `<option value="${p.codigo}">${p.codigo} · ${p.nome||''}</option>`).join('');

    // Popula FY destino
    const selDest = document.getElementById('fy-trans-destino');
    selDest.innerHTML = '<option value="">— nenhum —</option>';
    if (typeof fiscalYearsCache !== 'undefined') {
        fiscalYearsCache.filter(f => f.ano_fiscal !== fyOrigem).forEach(f => {
            selDest.innerHTML += `<option value="${f.ano_fiscal}">${f.ano_fiscal}</option>`;
        });
    }

    modal.style.display = 'flex';
}

function _fyTransicaoFecharModal() {
    const modal = document.getElementById('fy-trans-modal');
    if (modal) modal.style.display = 'none';
}

async function _fyTransicaoSalvar() {
    const fyOrigem  = document.getElementById('fy-trans-fy-origem').value;
    const projeto   = document.getElementById('fy-trans-projeto').value;
    const tipo      = document.getElementById('fy-trans-tipo').value;
    const destino   = document.getElementById('fy-trans-destino').value || null;
    const just      = document.getElementById('fy-trans-just').value.trim();

    if (!projeto) { alert('Selecione um projeto.'); return; }

    const { error } = await _supabase.from('project_fiscal_transition').insert([{
        projeto_codigo:     projeto,
        fiscal_year_origem: fyOrigem,
        fiscal_year_destino: destino,
        tipo,
        status: 'DRAFT',
        justificativa: just || null,
        criado_por: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.nome : 'desconhecido',
    }]);

    if (error) { alert('Erro: ' + error.message); return; }
    _fyTransicaoFecharModal();
    const fy = (typeof getAFPorCodigo === 'function') ? getAFPorCodigo(fyOrigem) : null;
    if (fy) await _fyTransicoesCarregar(fy);
}

async function _fyTransicaoSubmeter(id) {
    const { error } = await _supabase.from('project_fiscal_transition')
        .update({ status: 'SUBMITTED' }).eq('id', id);
    if (error) { alert('Erro: ' + error.message); return; }
    const fy = (typeof getAFPorCodigo === 'function') ? getAFPorCodigo((window.fyWorkspaceContext||{}).codigo||'') : null;
    if (fy) await _fyTransicoesCarregar(fy);
}

async function _fyTransicaoExecutar(id) {
    if (!confirm('Executar esta transição? A operação será registrada.')) return;
    const agora = new Date().toISOString();
    const user  = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.nome : 'desconhecido';
    const { error } = await _supabase.from('project_fiscal_transition')
        .update({ status: 'EXECUTED', executado_por: user, executado_em: agora }).eq('id', id);
    if (error) { alert('Erro: ' + error.message); return; }
    const fy = (typeof getAFPorCodigo === 'function') ? getAFPorCodigo((window.fyWorkspaceContext||{}).codigo||'') : null;
    if (fy) await _fyTransicoesCarregar(fy);
}

// =========================================================================
// VIS-FY-07 — Fechamento (fiscal_year_closing)
// =========================================================================

// Sub-chip ativo dentro da aba Fechamento: 'executar' | 'reabertura'
let _fyFechSubChip = 'executar';

async function _fyFechamentoCarregar(fy) {
    const content = document.getElementById('fy-ws-content');
    if (!content) return;
    content.innerHTML = '<div style="padding:40px;text-align:center;color:#93a4c3;font-size:12.5px;">Carregando…</div>';

    const [closingRes, transRes, projetosRes] = await Promise.all([
        _supabase.from('fiscal_year_closing').select('*, fiscal_year_closing_item(*)').eq('fiscal_year_codigo', fy.ano_fiscal).maybeSingle(),
        _supabase.from('project_fiscal_transition').select('id,status').eq('fiscal_year_origem', fy.ano_fiscal),
        _supabase.from('project_fiscal_year').select('id,status,projeto_codigo').eq('fiscal_year_codigo', fy.ano_fiscal),
    ]);

    const closing      = closingRes.data || null;
    const transicoes   = transRes.data || [];
    const participacoes = projetosRes.data || [];

    // Status real do FY a partir do cache
    const fyStatus  = fy.fy_status || (closing && closing.status === 'EXECUTADO' ? 'CLOSED' : '');
    const jaClosed  = fyStatus === 'CLOSED';
    const reaberto  = fyStatus === 'REOPENED';
    const transExec = transicoes.filter(t => t.status === 'EXECUTED').length;
    const transPend = transicoes.filter(t => !['EXECUTED','CANCELLED','REJECTED'].includes(t.status)).length;
    const totalProj = participacoes.length;

    // Validações automáticas
    const validas = [
        { ok: transPend === 0, label: 'Todas as transições resolvidas', val: transPend === 0 ? 'OK' : `${transPend} pendentes` },
        { ok: totalProj > 0,   label: 'Participações registradas',      val: `${totalProj} projetos` },
        { ok: !!fy.data_fim,   label: 'Data de término configurada',    val: fy.data_fim ? _fyWsFmtData(fy.data_fim) : 'não configurado' },
        { ok: fy.bc_package_status === 'FECHADO' || fy.bc_package_status === 'NAO_INICIADO',
          label: 'Pacote de BC resolvido',
          val:   fy.bc_package_status === 'FECHADO' ? 'Fechado' : (fy.bc_package_status === 'NAO_INICIADO' ? 'Sem BCs (OK)' : 'Em aberto') },
    ];
    const bloqueios = validas.filter(v => !v.ok).length;
    const pronto    = !jaClosed && !reaberto && bloqueios === 0;

    const validHtml = validas.map(v => `
        <div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:4px 0;border-bottom:1px solid #f1f5f9;">
          <span style="width:18px;height:18px;border-radius:50%;background:${v.ok?'#16a34a':'#dc2626'};color:#fff;font-size:10px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${v.ok?'✓':'!'}</span>
          <span style="flex-grow:1;">${v.label}</span>
          <b style="white-space:nowrap;color:${v.ok?'#166534':'#991b1b'};">${v.val}</b>
        </div>`).join('');

    const snapshotResumo = closing ? `
        <div style="display:flex;flex-direction:column;gap:4px;font-size:12px;">
          <div style="display:flex;justify-content:space-between;"><span>Participações</span><b>${closing.total_projetos||totalProj}</b></div>
          <div style="display:flex;justify-content:space-between;"><span>Transições executadas</span><b>${transExec}</b></div>
          <div style="display:flex;justify-content:space-between;"><span>Blockers hard</span><b style="color:${(closing.total_blockers_hard||0)>0?'#dc2626':'#166534'};">${closing.total_blockers_hard||0}</b></div>
          <div style="display:flex;justify-content:space-between;"><span>Executado por</span><b>${closing.executado_por||'—'}</b></div>
          <div style="display:flex;justify-content:space-between;"><span>Executado em</span><b>${closing.executado_em?_fyWsFmtData(closing.executado_em):'—'}</b></div>
        </div>` : '<span style="font-size:12px;color:#93a4c3;">Fechamento ainda não iniciado.</span>';

    // Badge de status no cabeçalho
    const statusBadge = jaClosed  ? `<span class="fy-b fy-badge-ok" style="margin-left:8px;">Fechado</span>`
                      : reaberto  ? `<span class="fy-b fy-badge-wa" style="margin-left:8px;">Reaberto</span>`
                      : bloqueios > 0 ? `<span class="fy-b fy-badge-cr" style="margin-left:8px;">${bloqueios} bloqueio(s)</span>`
                      : `<span class="fy-b fy-badge-ok" style="margin-left:8px;">Pronto para fechar</span>`;

    const conteudoExecutar = `
<div style="display:flex;gap:14px;align-items:flex-start;">
  <div style="flex-grow:1;min-width:0;display:flex;flex-direction:column;gap:12px;">
    <div class="fy-ws-card" style="padding:14px;">
      <div style="padding-bottom:10px;"><span class="fy-ws-h2">Validações automáticas · R-FC-01</span></div>
      <div style="display:flex;flex-direction:column;gap:0;">${validHtml}</div>
    </div>
    <div class="fy-ws-card" style="padding:14px;">
      <div style="padding-bottom:10px;"><span class="fy-ws-h2">Resumo do fechamento</span></div>
      ${snapshotResumo}
    </div>
  </div>
  <div style="width:310px;flex-shrink:0;display:flex;flex-direction:column;gap:10px;">
    ${(jaClosed && !reaberto)
        ? `<div class="fy-ws-card" style="padding:16px;border:2px solid #16a34a;">
             <span class="fy-ws-h2" style="color:#16a34a;">FY fechado</span>
             <p style="font-size:12px;margin:6px 0 0 0;color:#64748b;">Este exercício está encerrado. Use o sub-chip "Reabertura controlada" para reabrir pontualmente.</p>
           </div>`
        : reaberto
        ? `<div class="fy-ws-card" style="padding:16px;border:2px solid #d97706;">
             <span class="fy-ws-h2" style="color:#92400e;">FY reaberto</span>
             <p style="font-size:12px;margin:6px 0 0 0;color:#64748b;">Finalize as correções do escopo e re-feche usando o botão abaixo.</p>
             <div style="display:flex;justify-content:flex-end;margin-top:10px;">
               <button class="fy-ws-btn-p" onclick="_fyExecutarFechamento('${fy.ano_fiscal}')">Re-fechar o ${fy.ano_fiscal}</button>
             </div>
           </div>`
        : `<div class="fy-ws-card" style="padding:16px;border:2px solid #4338ca;box-shadow:0 10px 30px rgba(15,30,61,.12);">
             <span class="fy-ws-h2">Fechar o ${fy.ano_fiscal}</span>
             <p style="font-size:12px;margin:8px 0 12px 0;color:#334155;">O FY fica somente leitura e o snapshot é gravado. O próximo FY não é ativado aqui — isso é uma ação separada.</p>
             ${bloqueios > 0 ? `<div style="background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:7px 10px;font-size:11.5px;color:#7f1d1d;margin-bottom:10px;"><b>Bloqueado:</b> resolva os itens acima antes de fechar.</div>` : ''}
             <textarea id="fy-fech-comentario" class="fy-ws-input" rows="2" style="width:100%;box-sizing:border-box;resize:none;margin-bottom:10px;" placeholder="Comentário de fechamento (opcional)"></textarea>
             <div style="display:flex;justify-content:flex-end;">
               <button class="fy-ws-btn-p" onclick="_fyExecutarFechamento('${fy.ano_fiscal}')"
                 ${!pronto ? 'disabled style="opacity:.5;cursor:not-allowed;"' : ''}>
                 Fechar o ${fy.ano_fiscal}
               </button>
             </div>
           </div>`
    }
    <div style="background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;padding:9px 11px;font-size:11.5px;color:#78350f;line-height:1.45;">
      <b>DV-07.</b> O fechamento termina em CLOSED nesta tela. A ativação do próximo FY é uma ação separada (R-FY-04). Mudança entre pré-validação e execução exige revalidar (R-FC-02).
    </div>
  </div>
</div>`;

    const conteudoRea = _fyReaberturaRender(fy, closing, jaClosed, reaberto, participacoes);

    content.innerHTML = `
<div class="fy-ws-card" style="padding:10px 14px;display:flex;align-items:center;gap:8px;">
  <span class="fy-ws-h2" style="margin-right:8px;">Fechamento · ${fy.ano_fiscal}</span>
  <button class="fy-ws-chip${_fyFechSubChip==='executar'?' on':''}" onclick="_fyFechChip('executar')">Executar fechamento</button>
  <button class="fy-ws-chip${_fyFechSubChip==='reabertura'?' on':''}" onclick="_fyFechChip('reabertura')">Reabertura controlada</button>
  ${statusBadge}
</div>
${_fyFechSubChip === 'reabertura' ? conteudoRea : conteudoExecutar}`;
}

async function _fyFechChip(chip) {
    _fyFechSubChip = chip;
    const fy = (typeof getAFPorCodigo === 'function') ? getAFPorCodigo((window.fyWorkspaceContext||{}).codigo||'') : null;
    if (fy) await _fyFechamentoCarregar(fy);
}

// =========================================================================
// VIS-FY-07B — Reabertura controlada
// =========================================================================

function _fyReaberturaRender(fy, closing, jaClosed, reaberto, participacoes) {
    const podEditar = (typeof ehProprietario !== 'undefined' && ehProprietario);
    const snapshotRea = closing && closing.snapshot && closing.snapshot.reabertura
        ? closing.snapshot.reabertura : null;

    if (!jaClosed && !reaberto) {
        return `
<div class="fy-ws-card" style="padding:48px 24px;text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;">
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#93a4c3" stroke-width="1.5"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>
  <span style="font-size:14px;font-weight:700;color:#0f1e3d;">Disponível apenas após o fechamento do FY</span>
  <span class="fy-ws-sub">Feche o FY primeiro pelo sub-chip "Executar fechamento".</span>
</div>`;
    }

    if (reaberto) {
        const reaInfo = snapshotRea || {};
        return `
<div style="display:flex;gap:14px;align-items:flex-start;">
  <div style="flex-grow:1;min-width:0;display:flex;flex-direction:column;gap:12px;">
    <div class="fy-ws-card" style="padding:16px;border-left:4px solid #d97706;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
        <span class="fy-b fy-badge-wa">FY REABERTO</span>
        <span class="fy-ws-sub">desde ${reaInfo.executado_em ? _fyWsFmtData(reaInfo.executado_em) : '—'} por ${reaInfo.executado_por||'—'}</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;font-size:12.5px;">
        <div><b style="font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;">Escopo da reabertura</b><p style="margin:4px 0 0 0;">${reaInfo.escopo||'—'}</p></div>
        <div><b style="font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;">Justificativa</b><p style="margin:4px 0 0 0;">${reaInfo.justificativa||'—'}</p></div>
        ${reaInfo.projetos && reaInfo.projetos.length > 0 ? `
        <div><b style="font-size:11.5px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;">Projetos afetados</b>
          <p style="margin:4px 0 0 0;">${reaInfo.projetos.join(', ')}</p></div>` : ''}
      </div>
    </div>
    <div style="background:#fffbeb;border:1px solid #f59e0b;border-radius:8px;padding:10px 12px;font-size:12px;color:#78350f;">
      Finalize as correções do escopo acima e re-feche o FY pelo sub-chip <b>"Executar fechamento"</b>. Um novo snapshot será gerado.
    </div>
  </div>
  <div style="width:310px;flex-shrink:0;">
    <div class="fy-ws-card" style="padding:14px;display:flex;flex-direction:column;gap:8px;">
      <span class="fy-ws-h2">Reverter reabertura</span>
      <p style="font-size:12px;margin:0;color:#64748b;">Se a reabertura foi executada por engano e nenhuma alteração foi feita, você pode reverter para CLOSED.</p>
      ${podEditar ? `<div style="display:flex;justify-content:flex-end;">
        <button class="fy-ws-btn" onclick="_fyReverterRea('${fy.ano_fiscal}')" style="color:#991b1b;border-color:#fca5a5;">Reverter para fechado</button>
      </div>` : `<span style="font-size:11.5px;color:#93a4c3;">Restrito a Proprietários.</span>`}
    </div>
  </div>
</div>`;
    }

    // FY está CLOSED — mostrar formulário de reabertura
    const projOpts = participacoes.map(p => {
        const nome = (typeof projectsData !== 'undefined') ? ((projectsData.find(x => x.codigo === p.projeto_codigo)||{}).nome||'') : '';
        return `<option value="${p.projeto_codigo}">${p.projeto_codigo}${nome ? ' · ' + nome : ''}</option>`;
    }).join('');

    return `
<div style="display:flex;gap:14px;align-items:flex-start;">
  <div style="flex-grow:1;min-width:0;display:flex;flex-direction:column;gap:12px;">
    <div class="fy-ws-card" style="padding:14px;">
      <div style="padding-bottom:10px;"><span class="fy-ws-h2">O que é reabertura controlada?</span></div>
      <div style="font-size:12.5px;color:#334155;display:flex;flex-direction:column;gap:6px;line-height:1.5;">
        <p style="margin:0;">Uma reabertura permite corrigir pontualmente registros de um FY já fechado — por exemplo, acertar uma transição errada, ajustar um valor alocado ou incluir um carryover que ficou pendente.</p>
        <p style="margin:0;">O escopo deve ser declarado antes: o sistema registra <b>o que</b> e <b>por quê</b> foi reaberto. Após as correções, o FY é re-fechado gerando um novo snapshot (V2, V3, …).</p>
      </div>
    </div>
    ${closing ? `
    <div class="fy-ws-card" style="padding:14px;">
      <div style="padding-bottom:8px;"><span class="fy-ws-h2">Último fechamento registrado</span></div>
      <div style="display:flex;flex-direction:column;gap:4px;font-size:12px;">
        <div style="display:flex;justify-content:space-between;"><span>Projetos</span><b>${closing.total_projetos||'—'}</b></div>
        <div style="display:flex;justify-content:space-between;"><span>Executado por</span><b>${closing.executado_por||'—'}</b></div>
        <div style="display:flex;justify-content:space-between;"><span>Executado em</span><b>${closing.executado_em?_fyWsFmtData(closing.executado_em):'—'}</b></div>
      </div>
    </div>` : ''}
  </div>

  <div style="width:360px;flex-shrink:0;display:flex;flex-direction:column;gap:10px;">
    <div class="fy-ws-card" style="padding:16px;border:2px solid #d97706;${!podEditar?'opacity:.7;':''}" >
      <span class="fy-ws-h2">Executar reabertura · ${fy.ano_fiscal}</span>
      ${!podEditar ? `<p style="font-size:12px;margin:6px 0 0 0;color:#64748b;">Restrito a Proprietários.</p>` : `
      <div style="display:flex;flex-direction:column;gap:10px;margin-top:12px;">
        <div style="display:flex;flex-direction:column;gap:4px;">
          <label style="font-size:12.5px;font-weight:600;">Escopo da reabertura <span style="color:#dc2626;">*</span></label>
          <input id="fy-rea-escopo" type="text" class="fy-ws-input" style="width:100%;box-sizing:border-box;" placeholder="Ex.: corrigir carryover do PRJ-045">
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <label style="font-size:12.5px;font-weight:600;">Justificativa <span style="color:#dc2626;">*</span></label>
          <textarea id="fy-rea-just" class="fy-ws-input" rows="2" style="width:100%;box-sizing:border-box;resize:none;" placeholder="Razão da reabertura (autorização, incidente, etc.)"></textarea>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;">
          <label style="font-size:12.5px;font-weight:600;">Projetos afetados <span class="fy-ws-sub">(opcional, ctrl+clique para múltiplos)</span></label>
          <select id="fy-rea-projetos" multiple class="fy-ws-select" style="width:100%;height:80px;">${projOpts}</select>
        </div>
        <div style="display:flex;justify-content:flex-end;">
          <button class="fy-ws-btn-p" style="background:#d97706;border-color:#d97706;" onclick="_fyExecutarRea('${fy.ano_fiscal}')">
            Executar reabertura do ${fy.ano_fiscal}
          </button>
        </div>
      </div>`}
    </div>
    <div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;padding:9px 11px;font-size:11.5px;color:#78350f;line-height:1.45;">
      <b>R-FY-05.</b> A reabertura não desfaz o fechamento — apenas retorna o FY para edição temporária. O próximo fechamento gera um novo snapshot imutável.
    </div>
  </div>
</div>`;
}

async function _fyExecutarFechamento(fyCodigo) {
    if (!confirm(`Fechar o exercício ${fyCodigo}? O FY ficará somente leitura após esta ação.`)) return;
    const agora = new Date().toISOString();
    const user  = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.nome : 'desconhecido';
    const coment = (document.getElementById('fy-fech-comentario')||{}).value || '';

    const { data: pfy } = await _supabase.from('project_fiscal_year')
        .select('id').eq('fiscal_year_codigo', fyCodigo);
    const totalProj = (pfy||[]).length;

    const { data: transData } = await _supabase.from('project_fiscal_transition')
        .select('id').eq('fiscal_year_origem', fyCodigo).eq('status', 'EXECUTED');
    const transExec = (transData||[]).length;

    const snapshot = { comentario: coment, gerado_em: agora, usuario: user, total_projetos: totalProj, transicoes_executadas: transExec };

    // Upsert no registro de fechamento
    const { error: ec } = await _supabase.from('fiscal_year_closing').upsert({
        fiscal_year_codigo: fyCodigo,
        status: 'EXECUTADO',
        total_projetos: totalProj,
        total_blockers_hard: 0,
        total_blockers_soft: 0,
        executado_por: user,
        executado_em: agora,
        snapshot,
    }, { onConflict: 'fiscal_year_codigo' });
    if (ec) { alert('Erro ao registrar fechamento: ' + ec.message); return; }

    // Atualiza status do FY
    const { error: ef } = await _supabase.from('fiscal_years')
        .update({ status: 'CLOSED' }).eq('codigo', fyCodigo);
    if (ef) { alert('Erro ao atualizar status do FY: ' + ef.message); return; }

    // Invalida cache
    if (typeof carregarFiscalYears === 'function') await carregarFiscalYears();
    const fy = (typeof getAFPorCodigo === 'function') ? getAFPorCodigo(fyCodigo) : null;
    if (fy) await _fyFechamentoCarregar(fy);
}

async function _fyExecutarRea(fyCodigo) {
    const escopo = (document.getElementById('fy-rea-escopo')||{}).value||'';
    const just   = (document.getElementById('fy-rea-just')||{}).value||'';
    if (!escopo.trim() || !just.trim()) {
        alert('Preencha o escopo e a justificativa antes de executar a reabertura.');
        return;
    }
    const sel = document.getElementById('fy-rea-projetos');
    const projetos = sel ? [...sel.selectedOptions].map(o => o.value) : [];

    const usuarioAtual = (typeof supabase !== 'undefined' && supabase.auth)
        ? ((await supabase.auth.getUser()).data?.user?.email || 'sistema')
        : 'sistema';
    const agora = new Date().toISOString();

    // 1. Busca o registro de closing existente para mesclar o snapshot
    const { data: closingAtual } = await _supabase
        .from('fiscal_year_closing')
        .select('snapshot')
        .eq('fiscal_year_codigo', fyCodigo)
        .maybeSingle();

    const snapshotAtualizado = {
        ...(closingAtual?.snapshot || {}),
        reabertura: { escopo, justificativa: just, projetos, executado_por: usuarioAtual, executado_em: agora },
    };

    // 2. Atualiza fiscal_year_closing: volta para PREPARANDO + grava escopo da reabertura no snapshot
    const { error: errClosing } = await _supabase
        .from('fiscal_year_closing')
        .update({ status: 'PREPARANDO', snapshot: snapshotAtualizado })
        .eq('fiscal_year_codigo', fyCodigo);
    if (errClosing) { alert('Erro ao atualizar registro de closing: ' + errClosing.message); return; }

    // 3. Atualiza status do FY para REOPENED
    const { error: errFY } = await _supabase
        .from('fiscal_years')
        .update({ status: 'REOPENED' })
        .eq('ano_fiscal', fyCodigo);
    if (errFY) { alert('Erro ao atualizar status do FY: ' + errFY.message); return; }

    // 4. Invalida cache e recarrega
    if (typeof carregarFiscalYears === 'function') await carregarFiscalYears();
    const fyAtualizado = (typeof fiscalYearsCache !== 'undefined' ? fiscalYearsCache : []).find(f => f.ano_fiscal === fyCodigo);
    if (fyAtualizado) await _fyFechamentoCarregar(fyAtualizado);
}

async function _fyReverterRea(fyCodigo) {
    if (!confirm(`Reverter o FY ${fyCodigo} de REOPENED para CLOSED?\n\nUse apenas se a reabertura foi executada por engano e nenhuma alteração foi feita.`)) return;

    const { error: errClosing } = await _supabase
        .from('fiscal_year_closing')
        .update({ status: 'EXECUTADO' })
        .eq('fiscal_year_codigo', fyCodigo);
    if (errClosing) { alert('Erro ao reverter closing: ' + errClosing.message); return; }

    const { error: errFY } = await _supabase
        .from('fiscal_years')
        .update({ status: 'CLOSED' })
        .eq('ano_fiscal', fyCodigo);
    if (errFY) { alert('Erro ao reverter FY: ' + errFY.message); return; }

    if (typeof carregarFiscalYears === 'function') await carregarFiscalYears();
    const fyAtualizado = (typeof fiscalYearsCache !== 'undefined' ? fiscalYearsCache : []).find(f => f.ano_fiscal === fyCodigo);
    if (fyAtualizado) await _fyFechamentoCarregar(fyAtualizado);
}

// =========================================================================
// VIS-FY-08 — Histórico e auditoria
// =========================================================================

async function _fyHistoricoCarregar(fy) {
    const content = document.getElementById('fy-ws-content');
    if (!content) return;
    content.innerHTML = '<div style="padding:40px;text-align:center;color:#93a4c3;font-size:12.5px;">Carregando…</div>';

    const [closingRes, transRes, pacotesRes] = await Promise.all([
        _supabase.from('fiscal_year_closing').select('*').eq('fiscal_year_codigo', fy.ano_fiscal).order('id', { ascending: false }),
        _supabase.from('project_fiscal_transition').select('*').eq('fiscal_year_origem', fy.ano_fiscal).order('criado_em', { ascending: false }),
        _supabase.from('pacotes_fy').select('*').eq('ano_fiscal', fy.ano_fiscal).order('fechado_em', { ascending: false }),
    ]);

    const closings  = closingRes.data  || [];
    const transicoes = transRes.data   || [];
    const pacotes   = pacotesRes.data  || [];

    // Montar linha do tempo a partir de eventos concretos
    const eventos = [];

    pacotes.forEach(p => eventos.push({
        data: p.fechado_em, tipo: 'FY_PACKAGE_CLOSED', cls: 'fy-badge-ok',
        desc: `Pacote de BC fechado · ${p.qtd_projetos} projetos`,
        por: p.fechado_por||'—',
    }));

    closings.forEach(c => {
        if (c.executado_em) eventos.push({
            data: c.executado_em, tipo: c.status === 'EXECUTADO' ? 'FY_CLOSED' : 'FY_CLOSING_INICIADO',
            cls: c.status === 'EXECUTADO' ? 'fy-badge-ok' : 'fy-badge-in',
            desc: `Fechamento ${c.status === 'EXECUTADO' ? 'executado' : 'iniciado'} · ${c.total_projetos||'?'} projetos`,
            por: c.executado_por||c.iniciado_por||'—',
        });
        if (c.iniciado_em && c.iniciado_em !== c.executado_em) eventos.push({
            data: c.iniciado_em, tipo: 'FY_CLOSING_INICIADO', cls: 'fy-badge-in',
            desc: 'Processo de fechamento iniciado',
            por: c.iniciado_por||'—',
        });
    });

    transicoes.filter(t => t.executado_em).forEach(t => {
        const tipoCfg = _TRANSICAO_TIPO_CFG[t.tipo] || { label: t.tipo };
        eventos.push({
            data: t.executado_em, tipo: 'FY_TRANSITION_EXECUTED', cls: 'fy-badge-in',
            desc: `${t.projeto_codigo} · ${tipoCfg.label}`,
            por: t.executado_por||'—',
        });
    });

    // Criar eventos das transições submetidas/aprovadas
    transicoes.filter(t => t.criado_em && t.status !== 'DRAFT').forEach(t => {
        const tipoCfg = _TRANSICAO_TIPO_CFG[t.tipo] || { label: t.tipo };
        eventos.push({
            data: t.criado_em, tipo: 'FY_TRANSITION_CREATED', cls: 'fy-badge-nu',
            desc: `Transição criada: ${t.projeto_codigo} · ${tipoCfg.label}`,
            por: t.criado_por||'—',
        });
    });

    if (fy.data_inicio) eventos.push({
        data: fy.data_inicio + 'T00:00:00Z', tipo: 'FY_ACTIVATED', cls: 'fy-badge-in',
        desc: `FY ${fy.ano_fiscal} ativado · início de execução`,
        por: 'Sistema',
    });

    eventos.sort((a, b) => new Date(b.data) - new Date(a.data));

    const eventoHtml = eventos.length === 0
        ? `<tr><td colspan="5" style="padding:20px 9px;text-align:center;color:#93a4c3;">Nenhum evento registrado.</td></tr>`
        : eventos.map(e => `<tr>
            <td style="padding:6px 9px;white-space:nowrap;font-size:11.5px;">${_fyWsFmtData(e.data)}</td>
            <td style="padding:6px 9px;white-space:nowrap;"><span class="fy-b ${e.cls}">${e.tipo}</span></td>
            <td style="padding:6px 9px;max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${e.desc}</td>
            <td style="padding:6px 9px;white-space:nowrap;">${e.por}</td>
          </tr>`).join('');

    const snapshotHtml = closings.length === 0
        ? `<tr><td colspan="3" style="padding:12px 9px;text-align:center;color:#93a4c3;">Nenhum fechamento registrado.</td></tr>`
        : closings.map((c, i) => `<tr>
            <td style="padding:6px 9px;white-space:nowrap;"><b>V${closings.length - i}</b>${i===0?' <span style="color:#166534;font-size:10.5px;">vigente</span>':''}</td>
            <td style="padding:6px 9px;white-space:nowrap;">${c.executado_em?_fyWsFmtData(c.executado_em):'—'}</td>
            <td style="padding:6px 9px;white-space:nowrap;">${c.total_projetos||'—'}</td>
          </tr>`).join('');

    content.innerHTML = `
<div class="fy-ws-card" style="padding:10px 14px;display:flex;align-items:center;gap:8px;">
  <span class="fy-ws-h2">Histórico e auditoria · ${fy.ano_fiscal}</span>
  <span style="flex-grow:1;"></span>
  <span class="fy-ws-sub">${eventos.length} evento(s)</span>
</div>

<div style="display:flex;gap:14px;align-items:flex-start;">
  <div style="flex-grow:1;min-width:0;">
    <div class="fy-ws-card" style="overflow:hidden;">
      <div style="padding:10px 12px;display:flex;justify-content:space-between;align-items:center;">
        <span class="fy-ws-h2">Eventos · somente leitura</span>
        <span class="fy-ws-sub">${eventos.length} eventos</span>
      </div>
      <div style="overflow-x:auto;">
        <table class="fy-ws-table" style="min-width:600px;">
          <thead><tr><th>Data e hora</th><th>Evento</th><th>Descrição</th><th>Por</th></tr></thead>
          <tbody>${eventoHtml}</tbody>
        </table>
      </div>
    </div>
  </div>

  <div style="width:280px;flex-shrink:0;">
    <div class="fy-ws-card" style="overflow:hidden;">
      <div style="padding:10px 12px;"><span class="fy-ws-h2">Snapshots de fechamento</span></div>
      <div style="overflow-x:auto;">
        <table class="fy-ws-table">
          <thead><tr><th>Versão</th><th>Data</th><th>Projetos</th></tr></thead>
          <tbody>${snapshotHtml}</tbody>
        </table>
      </div>
    </div>
  </div>
</div>`;
}
