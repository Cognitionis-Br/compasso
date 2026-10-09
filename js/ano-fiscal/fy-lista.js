// =========================================================================
// ano-fiscal/fy-lista.js — VIS-FY-01 · Lista de Exercícios Fiscais
//
// Tela principal de gestão de exercícios fiscais. Acionada por
// switchTab('fy_lista') em navigation.js.
//
// Referência: telas/html/FY-Lista.html (M12A).
// =========================================================================

// ---- helpers de badge de status ----------------------------------------

const _FY_STATUS_CFG = {
    PLANNING:  { label: 'Em planejamento', cls: 'fy-badge-in'  },
    BUDGETING: { label: 'Em orçamentação', cls: 'fy-badge-wa'  },
    OPEN:      { label: 'Em execução',     cls: 'fy-badge-ok'  },
    CLOSING:   { label: 'Em fechamento',   cls: 'fy-badge-wa'  },
    CLOSED:    { label: 'Fechado',         cls: 'fy-badge-nu'  },
    REOPENED:  { label: 'Reaberto',        cls: 'fy-badge-wa'  },
};

const _FY_PKG_CFG = {
    NAO_INICIADO:  { label: 'Não iniciado',    cls: 'fy-badge-nu' },
    EM_COMPOSICAO: { label: 'Em composição',   cls: 'fy-badge-wa' },
    EM_APROVACAO:  { label: 'Em aprovação',    cls: 'fy-badge-wa' },
    FECHADO:       { label: 'Fechado',         cls: 'fy-badge-ok' },
};

function _fyStatusBadge(status) {
    const cfg = _FY_STATUS_CFG[status] || { label: status || '—', cls: 'fy-badge-nu' };
    return `<span class="fy-b ${cfg.cls}">${cfg.label}</span>`;
}

function _fyPkgBadge(status) {
    const cfg = _FY_PKG_CFG[status] || { label: status || '—', cls: 'fy-badge-nu' };
    return `<span class="fy-b ${cfg.cls}">${cfg.label}</span>`;
}

function _fyFmtDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('pt-BR');
}

// ---- estado local -------------------------------------------------------

let _fyListaProjetosCount = {}; // { fiscal_year_codigo: count }
let _fyListaFiltroTexto   = '';
let _fyListaFiltroStatus  = '';

// ---- render principal ---------------------------------------------------

async function renderFYListaView() {
    const el = document.getElementById('view-fy_lista');
    if (!el) return;

    el.innerHTML = `<div class="p-8 text-center text-gray-400">
        <i class="fa-solid fa-calendar-days text-3xl mb-3 block animate-pulse"></i>
        <p class="text-sm">Carregando exercícios fiscais…</p></div>`;

    // Garante que o cache está carregado (normalmente já está do login)
    if (fiscalYearsCache.length === 0) await carregarFiscalYears();

    // Contagem de projetos por exercício (uma query só)
    try {
        const { data: pfyRows } = await _supabase
            .from('project_fiscal_year')
            .select('fiscal_year_codigo');
        _fyListaProjetosCount = {};
        (pfyRows || []).forEach(r => {
            _fyListaProjetosCount[r.fiscal_year_codigo] = (_fyListaProjetosCount[r.fiscal_year_codigo] || 0) + 1;
        });
    } catch (_) { _fyListaProjetosCount = {}; }

    _fyListaFiltroTexto  = '';
    _fyListaFiltroStatus = '';
    _fyListaRenderHTML(el);
}

function _fyListaRenderHTML(el) {
    const fys   = fiscalYearsCache.slice().sort((a, b) => (b.ano_fiscal || '').localeCompare(a.ano_fiscal || ''));
    const hoje  = new Date();

    // Exercícios especiais para os 3 cards de topo
    const fyOp   = fys.find(f => f.fy_status === 'OPEN' || f.fy_status === 'CLOSING') || null;
    const fyProx = fys.find(f => f.fy_status === 'PLANNING' || f.fy_status === 'BUDGETING') || null;
    const fyFech = [...fys].reverse().find(f => f.fy_status === 'CLOSED') || null;

    // Filtro
    const filtrados = fys.filter(f => {
        if (_fyListaFiltroStatus && f.fy_status !== _fyListaFiltroStatus) return false;
        if (_fyListaFiltroTexto) {
            const q = _fyListaFiltroTexto.toLowerCase();
            const nome = (f.fy_name || '').toLowerCase();
            const cod  = (f.ano_fiscal || '').toLowerCase();
            const inicio = _fyFmtDate(f.data_inicio);
            if (!cod.includes(q) && !nome.includes(q) && !inicio.includes(q)) return false;
        }
        return true;
    });

    const cardCSS = `
    <style>
      .fy-b  { display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap }
      .fy-badge-ok { background:#dcfce7;color:#166534 }
      .fy-badge-wa { background:#fef3c7;color:#92400e }
      .fy-badge-cr { background:#fee2e2;color:#991b1b }
      .fy-badge-nu { background:#f1f5f9;color:#475569 }
      .fy-badge-in { background:#eef2ff;color:#3730a3 }
      .fy-tbl th   { background:#f8fafc;font-size:10.5px;text-transform:uppercase;letter-spacing:.04em;color:#64748b;text-align:left;padding:8px 10px;font-weight:800 }
      .fy-tbl td   { border-top:1px solid #f1f5f9;padding:8px 10px;font-size:12px;vertical-align:middle }
      .fy-tbl tr:hover td { background:#fafafa }
      .fy-card-top { background:#fff;border:1px solid #e5e7eb;border-radius:10px;padding:12px 14px;display:flex;gap:14px }
      .fy-card-meta { display:flex;flex-direction:column;gap:4px;min-width:0 }
      .fy-card-side { flex-grow:1;border-left:1px solid #f1f5f9;padding-left:12px;display:flex;flex-direction:column;gap:4px }
      .fy-kv       { display:flex;justify-content:space-between;font-size:11.5px }
      .fy-card-side .fy-kv span { color:#64748b }
      .fy-card-side .fy-kv b   { color:#0f1e3d }
    </style>`;

    const _cardTop = (fy, cor, label) => {
        if (!fy) {
            return `<div class="fy-card-top" style="border-top:3px solid ${cor};opacity:.45">
                <div class="fy-card-meta"><span style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:${cor}">${label}</span>
                <span style="font-size:13px;color:#94a3b8">Nenhum exercício</span></div></div>`;
        }
        const qtd = _fyListaProjetosCount[fy.ano_fiscal] || 0;
        return `<div class="fy-card-top" style="border-top:3px solid ${cor}">
            <div class="fy-card-meta" style="width:160px">
                <span style="font-size:10.5px;font-weight:800;text-transform:uppercase;letter-spacing:.06em;color:${cor}">${label}</span>
                <b style="font-size:20px;color:#0f1e3d">${fy.ano_fiscal}</b>
                <span style="font-size:11.5px;color:#64748b">${_fyFmtDate(fy.data_inicio)} a ${_fyFmtDate(fy.data_fim)}</span>
                ${_fyStatusBadge(fy.fy_status)}
                <a href="#" onclick="event.preventDefault();_fyListaAbrirExercicio('${fy.fy_id}','${fy.ano_fiscal}')" style="font-size:11.5px;color:#4338ca;margin-top:2px">Abrir exercício →</a>
            </div>
            <div class="fy-card-side">
                <div class="fy-kv"><span>Projetos no exercício</span><b>${qtd}</b></div>
                <div class="fy-kv"><span>Pacote de BC</span><b>${_FY_PKG_CFG[fy.bc_package_status]?.label || '—'}</b></div>
                <div class="fy-kv"><span>Status</span><b>${_FY_STATUS_CFG[fy.fy_status]?.label || fy.fy_status}</b></div>
            </div>
        </div>`;
    };

    const _linhaTabela = (fy) => {
        const qtd = _fyListaProjetosCount[fy.ano_fiscal] || 0;
        const eOp = (fy.fy_status === 'OPEN' || fy.fy_status === 'CLOSING');
        const btnAbrir = `<button onclick="_fyListaAbrirExercicio('${fy.fy_id}','${fy.ano_fiscal}')"
            class="text-xs font-semibold px-3 py-1 rounded-lg border transition-colors ${eOp ? 'bg-indigo-700 text-white border-indigo-700 hover:bg-indigo-800' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}">
            Abrir</button>`;
        return `<tr>
            <td><b class="text-gray-900">${fy.ano_fiscal}</b></td>
            <td class="text-gray-700">${fy.fy_name || fy.ano_fiscal}</td>
            <td class="text-gray-600">${_fyFmtDate(fy.data_inicio)}</td>
            <td class="text-gray-600">${_fyFmtDate(fy.data_fim)}</td>
            <td>${_fyStatusBadge(fy.fy_status)}</td>
            <td>${_fyPkgBadge(fy.bc_package_status)}</td>
            <td class="text-gray-700 text-center">${qtd}</td>
            <td><button onclick="_fyListaNovoExercicio()"
                class="text-xs text-indigo-600 hover:underline">Configurar</button></td>
            <td class="whitespace-nowrap">${btnAbrir}</td>
        </tr>`;
    };

    el.innerHTML = cardCSS + `
    <div class="p-6" style="font-family:'Segoe UI',-apple-system,sans-serif">

      <!-- Cabeçalho -->
      <div class="flex items-end justify-between mb-4">
        <div>
          <h1 class="text-2xl font-extrabold text-gray-900" style="color:#0f1e3d">Anos Fiscais</h1>
          <p class="text-sm text-gray-500 mt-1">Exercícios da organização, com período parametrizado.</p>
        </div>
        <div class="flex gap-2">
          <button onclick="_fyListaExportar()" class="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors">
            <i class="fa-solid fa-download mr-1"></i>Exportar</button>
          <button onclick="_fyListaNovoExercicio()" class="text-xs font-semibold px-3 py-2 rounded-lg bg-indigo-700 text-white hover:bg-indigo-800 transition-colors">
            + Novo exercício</button>
        </div>
      </div>

      <!-- 3 cards de topo -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        ${_cardTop(fyOp,   '#d97706', 'Exercício operacional')}
        ${_cardTop(fyProx, '#4338ca', 'Próximo exercício')}
        ${_cardTop(fyFech, '#64748b', 'Último fechado')}
      </div>

      <!-- Tabela -->
      <div class="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div class="px-4 py-3 flex items-center gap-3 border-b border-gray-100">
          <b class="text-sm font-extrabold" style="color:#0f1e3d">Exercícios</b>
          <div class="flex gap-2 flex-grow flex-wrap">
            <input id="fyListaBusca" type="text" placeholder="Buscar por código, nome ou período"
              oninput="_fyListaFiltrar()"
              class="text-xs border border-gray-200 rounded-lg px-3 py-1.5 w-64 focus:outline-none focus:border-indigo-400" />
            <select id="fyListaStatus" onchange="_fyListaFiltrar()"
              class="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-400">
              <option value="">Todos os status</option>
              <option value="PLANNING">Em planejamento</option>
              <option value="BUDGETING">Em orçamentação</option>
              <option value="OPEN">Em execução</option>
              <option value="CLOSING">Em fechamento</option>
              <option value="CLOSED">Fechado</option>
              <option value="REOPENED">Reaberto</option>
            </select>
          </div>
          <span class="text-xs text-gray-400 whitespace-nowrap">${filtrados.length} exercício${filtrados.length !== 1 ? 's' : ''}</span>
        </div>
        <div class="overflow-x-auto">
          <table class="fy-tbl w-full border-collapse">
            <thead><tr>
              <th>Código</th><th>Nome</th><th>Início</th><th>Fim</th>
              <th>Status</th><th>Pacote de BC</th><th class="text-center">Projetos</th>
              <th>Organização</th><th>Ações</th>
            </tr></thead>
            <tbody id="fyListaTbody">
              ${filtrados.length === 0
                ? `<tr><td colspan="9" class="text-center py-8 text-gray-400 text-sm">Nenhum exercício encontrado.</td></tr>`
                : filtrados.map(_linhaTabela).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>

    <!-- Modal: Novo exercício -->
    <div id="fyNovoModal" class="hidden fixed inset-0 z-50 flex items-center justify-center" style="background:rgba(15,30,61,.45)">
      <div class="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md p-6" onclick="event.stopPropagation()">
        <h2 class="text-base font-extrabold mb-4" style="color:#0f1e3d">Novo exercício fiscal</h2>
        <div class="flex flex-col gap-3">
          <div>
            <label class="text-xs font-bold text-gray-500 uppercase tracking-wide">Código <span class="text-red-500">*</span></label>
            <input id="fyNovoCodigo" type="text" placeholder="Ex: AF2028"
              class="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400" />
          </div>
          <div>
            <label class="text-xs font-bold text-gray-500 uppercase tracking-wide">Nome</label>
            <input id="fyNovoNome" type="text" placeholder="Ex: Exercício Fiscal 2028"
              class="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-xs font-bold text-gray-500 uppercase tracking-wide">Data início <span class="text-red-500">*</span></label>
              <input id="fyNovoInicio" type="date"
                class="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
              <label class="text-xs font-bold text-gray-500 uppercase tracking-wide">Data fim <span class="text-red-500">*</span></label>
              <input id="fyNovoFim" type="date"
                class="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-400" />
            </div>
          </div>
          <div id="fyNovoErro" class="hidden text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2"></div>
        </div>
        <div class="flex justify-end gap-2 mt-5">
          <button onclick="_fyNovoFechar()" class="text-xs font-semibold px-4 py-2 rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button onclick="_fyNovoSalvar()" class="text-xs font-semibold px-4 py-2 rounded-lg bg-indigo-700 text-white hover:bg-indigo-800">Criar exercício</button>
        </div>
      </div>
    </div>`;
}

// ---- ações --------------------------------------------------------------

function _fyListaAbrirExercicio(fyId, fyCode) {
    window.fyWorkspaceContext = { fy_id: fyId, codigo: fyCode };
    switchTab('fy_workspace');
}

function _fyListaFiltrar() {
    const busca  = document.getElementById('fyListaBusca');
    const status = document.getElementById('fyListaStatus');
    _fyListaFiltroTexto  = busca  ? busca.value.trim()  : '';
    _fyListaFiltroStatus = status ? status.value        : '';

    const el = document.getElementById('view-fy_lista');
    if (!el) return;
    _fyListaRenderHTML(el);
}

function _fyListaExportar() {
    const fys = fiscalYearsCache;
    if (!fys.length) return;
    const header = 'Código,Nome,Início,Fim,Status,Pacote de BC,Projetos';
    const rows = fys.map(f => [
        f.ano_fiscal,
        (f.fy_name || f.ano_fiscal).replace(/,/g, ' '),
        f.data_inicio || '',
        f.data_fim    || '',
        _FY_STATUS_CFG[f.fy_status]?.label || f.fy_status,
        _FY_PKG_CFG[f.bc_package_status]?.label || f.bc_package_status,
        _fyListaProjetosCount[f.ano_fiscal] || 0
    ].join(','));
    const csv = [header, ...rows].join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'exercicios-fiscais.csv'; a.click();
    URL.revokeObjectURL(url);
}

// Modal Novo exercício
function _fyListaNovoExercicio() {
    const modal = document.getElementById('fyNovoModal');
    if (!modal) return;
    document.getElementById('fyNovoCodigo').value = '';
    document.getElementById('fyNovoNome').value   = '';
    document.getElementById('fyNovoInicio').value = '';
    document.getElementById('fyNovoFim').value    = '';
    const erroEl = document.getElementById('fyNovoErro');
    if (erroEl) { erroEl.classList.add('hidden'); erroEl.textContent = ''; }
    modal.classList.remove('hidden');
}

function _fyNovoFechar() {
    const modal = document.getElementById('fyNovoModal');
    if (modal) modal.classList.add('hidden');
}

async function _fyNovoSalvar() {
    const codigo = (document.getElementById('fyNovoCodigo')?.value || '').trim();
    const nome   = (document.getElementById('fyNovoNome')?.value  || '').trim();
    const inicio = document.getElementById('fyNovoInicio')?.value || '';
    const fim    = document.getElementById('fyNovoFim')?.value    || '';
    const erroEl = document.getElementById('fyNovoErro');

    const mostrarErro = (msg) => {
        if (erroEl) { erroEl.textContent = msg; erroEl.classList.remove('hidden'); }
    };

    if (!codigo) { mostrarErro('Informe o código do exercício (ex: AF2028).'); return; }
    if (!inicio || !fim) { mostrarErro('Informe as datas de início e fim.'); return; }
    if (fim < inicio) { mostrarErro('A data de fim deve ser posterior à data de início.'); return; }

    const { error } = await _supabase
        .from('fiscal_years')
        .insert({
            codigo,
            name:         nome || `Exercício Fiscal ${codigo}`,
            data_inicio:  inicio,
            data_fim:     fim,
            status:       'PLANNING',
            bc_package_status: 'NAO_INICIADO',
            recebimento_demandas_aberto: false,
            orcamento_fechado: false,
            ano_fiscal_fechado: false
        });

    if (error) {
        mostrarErro(error.code === '23505'
            ? `Já existe um exercício com o código "${codigo}".`
            : `Erro ao criar exercício: ${error.message}`);
        return;
    }

    _fyNovoFechar();
    await carregarFiscalYears();
    renderFYListaView();
}
