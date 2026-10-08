// =============================================================================
// administracao/adm-configuracoes.js — Fase 1A · A5
// SCR-25 VIEWs: cfg_organizacao, cfg_licenca, cfg_fy, cfg_estimativas,
//   cfg_ratecards, cfg_financeiro, cfg_notificacoes, cfg_eventos,
//   cfg_templates, cfg_ia, cfg_parametros
// =============================================================================

// ─── Dispatcher ──────────────────────────────────────────────────────────────
document.addEventListener('adm:view-activated', ({ detail: { tabId } }) => {
    const h = {
        cfg_organizacao:  _cfgOrgLoad,
        cfg_licenca:      _cfgLicencaLoad,
        cfg_fy:           _cfgFyLoad,
        cfg_estimativas:  _cfgEstimativasLoad,
        cfg_ratecards:    _cfgRatecardsLoad,
        cfg_financeiro:   _cfgFinanceiroLoad,
        cfg_notificacoes: _cfgNotificacoesLoad,
        cfg_eventos:      _cfgEventosLoad,
        cfg_templates:    _cfgTemplatesLoad,
        cfg_ia:           _cfgIaLoad,
        cfg_parametros:   _cfgParametrosLoad,
    };
    if (h[tabId]) h[tabId]();
});

// ─── Helpers locais ───────────────────────────────────────────────────────────
function _cfgQuem() {
    return (typeof currentUser !== 'undefined' && currentUser?.nome) ? currentUser.nome : 'sistema';
}
function _cfgEhProp() { return typeof ehProprietario !== 'undefined' && ehProprietario === true; }
function _cfgEhAdmin() {
    return (typeof ehAdministrador !== 'undefined' && ehAdministrador) || _cfgEhProp();
}
function _cfgNaView(tabId, icon, titulo, corpo) {
    admSetState(tabId, 'na');
    const el = admGetContentEl(tabId);
    if (!el) return;
    el.innerHTML = `
    <div class="flex flex-col items-center justify-center py-12 text-center">
        <i class="${icon} text-3xl text-gray-300 mb-3"></i>
        <p class="text-sm font-semibold text-gray-500 mb-1">${titulo}</p>
        <p class="text-xs text-gray-400 max-w-sm">${corpo}</p>
    </div>`;
    admSetState(tabId, 'content');
}
function _cfgSemPermissao(tabId) {
    const el = admGetContentEl(tabId);
    if (el) el.innerHTML = `
    <div class="flex flex-col items-center justify-center py-12 text-center">
        <i class="fa-solid fa-lock text-3xl text-gray-300 mb-3"></i>
        <p class="text-sm font-semibold text-gray-500">Sem permissão</p>
        <p class="text-xs text-gray-400 mt-1">Esta configuração é restrita ao Proprietário.</p>
    </div>`;
    admSetState(tabId, 'content');
}

// =============================================================================
// VIEW: cfg_organizacao — empresa_licenciada
// =============================================================================
async function _cfgOrgLoad() {
    admSetState('cfg_organizacao', 'loading');
    if (typeof carregarEmpresaLicenciada === 'function') await carregarEmpresaLicenciada();
    const el = admGetContentEl('cfg_organizacao');
    if (!el) return;
    const e = (typeof empresaLicenciadaCache !== 'undefined' && empresaLicenciadaCache) ? empresaLicenciadaCache : {};
    const podeEditar = _cfgEhProp();

    const diasRestantes = typeof licencaDiasRestantes === 'function' ? licencaDiasRestantes() : null;
    const statusLicenca = (typeof licencaExpirada === 'function' && licencaExpirada())
        ? `<span class="px-2 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-700">Expirada</span>`
        : (diasRestantes !== null && diasRestantes <= 30)
            ? `<span class="px-2 py-0.5 rounded text-xs font-semibold bg-amber-100 text-amber-700">Vence em ${diasRestantes} dia(s)</span>`
            : `<span class="px-2 py-0.5 rounded text-xs font-semibold bg-green-100 text-green-700">Vigente</span>`;

    el.innerHTML = `
    <div id="adm-cfg-org-form" class="hidden mb-4"></div>
    <div class="grid grid-cols-2 gap-4 mb-4">
        <div class="col-span-2 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-semibold text-gray-500 uppercase tracking-wider">Dados da Organização</span>
                ${podeEditar ? `<button onclick="cfgOrgEditarForm()"
                    class="px-2.5 py-1 text-xs font-semibold text-indigo-600 border border-indigo-200 rounded hover:bg-indigo-50">
                    <i class="fa-solid fa-pen-to-square mr-1"></i>Editar</button>` : ''}
            </div>
            <div class="grid grid-cols-3 gap-3 text-sm">
                <div><div class="text-xs text-gray-400 mb-0.5">Razão Social</div><div class="font-semibold text-gray-800">${escapeHtml(e.razao_social || '-')}</div></div>
                <div><div class="text-xs text-gray-400 mb-0.5">Nome Fantasia</div><div class="font-semibold text-gray-800">${escapeHtml(e.nome_fantasia || '-')}</div></div>
                <div><div class="text-xs text-gray-400 mb-0.5">Nome no Cabeçalho</div><div class="font-semibold text-gray-800">${escapeHtml(e.nome_cabecalho || '-')}</div></div>
                <div><div class="text-xs text-gray-400 mb-0.5">CNPJ</div><div class="font-semibold font-mono text-gray-800">${escapeHtml(e.cnpj || '-')}</div></div>
                <div><div class="text-xs text-gray-400 mb-0.5">Cor de Exibição</div>
                    <div class="flex items-center gap-2">
                        ${e.cor_exibicao ? `<span class="w-5 h-5 rounded border border-gray-200 inline-block" style="background:${escapeHtml(e.cor_exibicao)}"></span>` : ''}
                        <span class="font-mono text-gray-800">${escapeHtml(e.cor_exibicao || '-')}</span>
                    </div>
                </div>
                <div><div class="text-xs text-gray-400 mb-0.5">Status da Licença</div><div>${statusLicenca}</div></div>
                <div><div class="text-xs text-gray-400 mb-0.5">Vigência Início</div><div class="font-semibold text-gray-800">${e.vigencia_inicio ? (typeof formatDate === 'function' ? formatDate(e.vigencia_inicio) : e.vigencia_inicio) : '-'}</div></div>
                <div><div class="text-xs text-gray-400 mb-0.5">Vigência Término</div><div class="font-semibold text-gray-800">${e.vigencia_termino ? (typeof formatDate === 'function' ? formatDate(e.vigencia_termino) : e.vigencia_termino) : '-'}</div></div>
            </div>
        </div>
    </div>`;
    admSetState('cfg_organizacao', 'content');
}

function cfgOrgEditarForm() {
    if (!_cfgEhProp()) return alert('Apenas o Proprietário pode editar.');
    const e = (typeof empresaLicenciadaCache !== 'undefined' && empresaLicenciadaCache) ? empresaLicenciadaCache : {};
    const panel = document.getElementById('adm-cfg-org-form');
    if (!panel) return;
    panel.innerHTML = `
    <div class="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
        <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-semibold text-indigo-800">Editar Organização</span>
            <button onclick="cfgOrgFecharForm()" class="text-gray-400 hover:text-gray-600"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <p class="text-xs text-amber-600 mb-3"><i class="fa-solid fa-triangle-exclamation mr-1"></i>
            CNPJ e datas de vigência são gerenciados pelo Suporte Cognitionis.</p>
        <div class="grid grid-cols-3 gap-3 mb-3">
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Razão Social *</label>
                <input id="adm-cfg-org-razao" type="text" value="${escapeHtml(e.razao_social || '')}"
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Nome Fantasia *</label>
                <input id="adm-cfg-org-fantasia" type="text" value="${escapeHtml(e.nome_fantasia || '')}"
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Nome no Cabeçalho *</label>
                <input id="adm-cfg-org-cabecalho" type="text" value="${escapeHtml(e.nome_cabecalho || '')}"
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Cor de Exibição (hex)</label>
                <div class="flex gap-2">
                    <input id="adm-cfg-org-cor-picker" type="color" value="${e.cor_exibicao || '#3730A3'}"
                        class="w-10 h-8 rounded border border-gray-300 cursor-pointer p-0.5"
                        oninput="document.getElementById('adm-cfg-org-cor-text').value=this.value" />
                    <input id="adm-cfg-org-cor-text" type="text" value="${escapeHtml(e.cor_exibicao || '#3730A3')}"
                        class="flex-1 border border-gray-300 rounded px-2 py-1.5 text-sm font-mono focus:outline-none focus:border-indigo-400"
                        oninput="if(/^#[0-9a-fA-F]{6}$/.test(this.value))document.getElementById('adm-cfg-org-cor-picker').value=this.value" />
                </div>
            </div>
        </div>
        <button onclick="cfgOrgSalvar()" class="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700">
            <i class="fa-solid fa-floppy-disk mr-1"></i>Salvar</button>
    </div>`;
    panel.classList.remove('hidden');
    document.getElementById('adm-cfg-org-razao')?.focus();
}

function cfgOrgFecharForm() {
    const p = document.getElementById('adm-cfg-org-form');
    if (p) { p.classList.add('hidden'); p.innerHTML = ''; }
}

async function cfgOrgSalvar() {
    if (!_cfgEhProp()) return alert('Apenas o Proprietário pode editar.');
    const razao_social = (document.getElementById('adm-cfg-org-razao')?.value || '').trim();
    const nome_fantasia = (document.getElementById('adm-cfg-org-fantasia')?.value || '').trim();
    const nome_cabecalho = (document.getElementById('adm-cfg-org-cabecalho')?.value || '').trim();
    const cor_exibicao = (document.getElementById('adm-cfg-org-cor-text')?.value || '').trim();
    if (!razao_social || !nome_fantasia || !nome_cabecalho) return alert('Preencha os campos obrigatórios.');
    if (cor_exibicao && !/^#[0-9a-fA-F]{6}$/.test(cor_exibicao)) return alert('Cor inválida — use formato hexadecimal #RRGGBB.');
    const { error } = await _supabase.from('empresa_licenciada')
        .update({ razao_social, nome_fantasia, nome_cabecalho, cor_exibicao: cor_exibicao || null })
        .eq('id', 1);
    if (error) return alert('Erro: ' + error.message);
    if (typeof aplicarIdentidadeEmpresa === 'function') {
        if (typeof carregarEmpresaLicenciada === 'function') await carregarEmpresaLicenciada();
        aplicarIdentidadeEmpresa();
    }
    cfgOrgFecharForm();
    _cfgOrgLoad();
}

// =============================================================================
// VIEW: cfg_licenca — licenca_modulos
// =============================================================================
async function _cfgLicencaLoad() {
    admSetState('cfg_licenca', 'loading');
    if (typeof carregarLicenca === 'function') await carregarLicenca();
    const el = admGetContentEl('cfg_licenca');
    if (!el) return;
    const mods = typeof modulosLicenciados !== 'undefined' ? modulosLicenciados : {};
    const nomesModulos = typeof NOME_EXIBICAO_MODULO !== 'undefined' ? NOME_EXIBICAO_MODULO : {};
    const modulos = Object.entries(nomesModulos);

    if (!modulos.length) {
        el.innerHTML = `<div class="py-10 text-center text-gray-400 text-sm">Nenhum módulo licenciado encontrado.</div>`;
        admSetState('cfg_licenca', 'empty');
        return;
    }

    el.innerHTML = `
    <div class="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700">
        <i class="fa-solid fa-circle-info mr-1"></i>
        A ativação de módulos é gerenciada pelo Suporte Cognitionis. Esta tela exibe o status atual do licenciamento.
    </div>
    <div class="border border-gray-200 rounded-lg overflow-hidden">
        <table class="w-full text-sm">
            <thead><tr class="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th class="px-3 py-2.5 text-left font-medium">Módulo</th>
                <th class="px-3 py-2.5 text-left font-medium">Status</th>
                <th class="px-3 py-2.5 text-left font-medium">Vigência</th>
                <th class="px-3 py-2.5 text-left font-medium">Limite</th>
            </tr></thead>
            <tbody class="divide-y divide-gray-100">
            ${modulos.map(([codigo, nome]) => {
                const m = mods[codigo];
                const ativo = !m || m.ativo !== false;
                const statusBadge = ativo
                    ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">Ativo</span>'
                    : '<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700">Inativo</span>';
                const fmt = (d) => d ? (typeof formatDate === 'function' ? formatDate(d) : d) : '-';
                return `<tr class="${!ativo ? 'opacity-50' : ''}">
                    <td class="px-3 py-2.5">
                        <div class="font-semibold text-gray-800">${escapeHtml(nome)}</div>
                        <div class="text-xs text-gray-400 font-mono">${codigo}</div>
                    </td>
                    <td class="px-3 py-2.5">${statusBadge}</td>
                    <td class="px-3 py-2.5 text-xs text-gray-500">
                        ${m ? `${fmt(m.valid_from)} → ${fmt(m.valid_until)}` : '—'}
                    </td>
                    <td class="px-3 py-2.5 text-xs text-gray-500">
                        ${m?.contractual_limit ? escapeHtml(String(m.contractual_limit)) : '—'}
                    </td>
                </tr>`;
            }).join('')}
            </tbody>
        </table>
    </div>`;
    admSetState('cfg_licenca', 'content');
}

// =============================================================================
// VIEW: cfg_fy — Período do Ano Fiscal
// =============================================================================
const _MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
    'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

async function _cfgFyLoad() {
    admSetState('cfg_fy', 'loading');
    if (!_cfgEhAdmin()) { _cfgSemPermissao('cfg_fy'); return; }
    if (typeof carregarConfigPeriodoAF === 'function') await carregarConfigPeriodoAF();
    _cfgFyRender();
}

function _cfgFyRender() {
    const el = admGetContentEl('cfg_fy');
    if (!el) return;
    const cache = typeof configPeriodoAFCache !== 'undefined' ? configPeriodoAFCache : [];
    const mesAtual = typeof mesInicioAnoFiscal === 'function' ? mesInicioAnoFiscal() : 4;
    const mesEncerramento = typeof mesEncerramentoAnoFiscal === 'function'
        ? mesEncerramentoAnoFiscal(mesAtual) : ((mesAtual + 10) % 12) + 1;
    const fmt = (d) => d ? (typeof formatDate === 'function' ? formatDate(d) : d) : '-';
    const fmtDt = (d) => d ? (typeof formatDateTime === 'function' ? formatDateTime(d) : d) : '-';

    const mesesOpts = _MESES_PT.map((n, i) =>
        `<option value="${i+1}" ${(i+1) === mesAtual ? 'selected' : ''}>${n}</option>`).join('');

    // Histórico
    const asc = [...cache].sort((a,b) => String(a.vigencia_de).localeCompare(String(b.vigencia_de)));
    const linhas = asc.map((l, i) => {
        const ini = fmt(l.vigencia_de);
        const fim = i < asc.length - 1
            ? (() => { const d = new Date(String(asc[i+1].vigencia_de).split('T')[0]+'T00:00:00'); d.setDate(d.getDate()-1); return fmt(d); })()
            : 'atual';
        return `<tr>
            <td class="px-3 py-1.5 text-xs">${ini} <span class="text-gray-400">→</span> ${fim}</td>
            <td class="px-3 py-1.5 text-xs font-semibold">${_MESES_PT[(Number(l.mes_inicio)||4)-1]}</td>
            <td class="px-3 py-1.5 text-xs text-gray-500">${l.mes_inicio_anterior ? _MESES_PT[Number(l.mes_inicio_anterior)-1] : '-'}</td>
            <td class="px-3 py-1.5 text-xs text-gray-500 uppercase">${escapeHtml(l.alterado_por||'-')} · ${fmtDt(l.alterado_em)}</td>
        </tr>`;
    }).reverse().join('');

    el.innerHTML = `
    <div class="grid grid-cols-2 gap-4 mb-6">
        <div class="p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Período Atual</div>
            <div class="flex items-center gap-3 mb-3">
                <div>
                    <div class="text-xs text-gray-400 mb-1">Mês de Início</div>
                    <span class="text-xl font-bold text-indigo-700">${_MESES_PT[mesAtual-1]}</span>
                </div>
                <i class="fa-solid fa-arrow-right text-gray-300 text-lg"></i>
                <div>
                    <div class="text-xs text-gray-400 mb-1">Mês de Encerramento</div>
                    <span class="text-xl font-bold text-gray-700">${_MESES_PT[mesEncerramento-1]}</span>
                </div>
            </div>
        </div>
        <div class="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
            <div class="text-xs font-semibold text-indigo-700 uppercase tracking-wider mb-3">Alterar Período</div>
            <p class="text-xs text-gray-500 mb-3">A vigência começa no 1.º dia do mês corrente. Só uma alteração por mês.</p>
            <div class="flex items-end gap-2">
                <div class="flex-1">
                    <label class="block text-xs font-medium text-gray-600 mb-1">Novo mês de início</label>
                    <select id="adm-cfg-fy-mes"
                        onchange="document.getElementById('adm-cfg-fy-fim').textContent=_MESES_PT[((Number(this.value)+10)%12)]"
                        class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400">
                        ${mesesOpts}
                    </select>
                </div>
                <div>
                    <div class="text-xs text-gray-400 mb-1">Encerramento</div>
                    <div id="adm-cfg-fy-fim" class="font-semibold text-gray-700 py-1.5">${_MESES_PT[mesEncerramento-1]}</div>
                </div>
                <button onclick="cfgFySalvar()" class="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700 self-end">
                    <i class="fa-solid fa-floppy-disk mr-1"></i>Salvar</button>
            </div>
        </div>
    </div>
    <div class="border border-gray-200 rounded-lg overflow-hidden">
        <div class="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">Histórico de Alterações</div>
        <table class="w-full text-sm">
            <thead><tr class="text-xs text-gray-400 border-b border-gray-100">
                <th class="px-3 py-2 text-left">Período de Vigência</th>
                <th class="px-3 py-2 text-left">Início AF</th>
                <th class="px-3 py-2 text-left">Anterior</th>
                <th class="px-3 py-2 text-left">Por</th>
            </tr></thead>
            <tbody class="divide-y divide-gray-100">
            ${linhas || `<tr><td colspan="4" class="px-3 py-4 text-center text-gray-400 text-xs">Nenhum histórico — o sistema usa Abril–Março (padrão).</td></tr>`}
            </tbody>
        </table>
    </div>`;
    admSetState('cfg_fy', 'content');
}

async function cfgFySalvar() {
    if (!_cfgEhAdmin()) return alert('Sem permissão.');
    const novoMes = Number(document.getElementById('adm-cfg-fy-mes')?.value);
    if (!(novoMes >= 1 && novoMes <= 12)) return alert('Selecione um mês válido.');
    const mesAtual = typeof mesInicioAnoFiscal === 'function' ? mesInicioAnoFiscal() : 4;
    const cache = typeof configPeriodoAFCache !== 'undefined' ? configPeriodoAFCache : [];
    const d = new Date();
    const vigencia = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
    if (novoMes === mesAtual && cache.length) return alert('O mês de início selecionado já é o vigente — nada a salvar.');
    if (cache.some(l => String(l.vigencia_de).split('T')[0] === vigencia))
        return alert('Já existe um período com vigência neste mês. Só é possível uma alteração por mês.');
    if (!confirm(`Confirmar: o Ano Fiscal passa a começar em ${_MESES_PT[novoMes-1]} a partir de ${vigencia}?\n\nDatas anteriores continuam no período antigo.`)) return;
    const { error } = await _supabase.from('config_periodo_ano_fiscal').insert([{
        mes_inicio: novoMes,
        vigencia_de: vigencia,
        mes_inicio_anterior: cache.length ? mesAtual : null,
        alterado_por: _cfgQuem(),
        alterado_em: new Date().toISOString()
    }]);
    if (error) return alert('Erro: ' + error.message);
    alert('Período do Ano Fiscal salvo. Recarregue a página para as telas refletirem o novo período.');
    if (typeof carregarConfigPeriodoAF === 'function') await carregarConfigPeriodoAF();
    _cfgFyRender();
}

// =============================================================================
// VIEW: cfg_estimativas — N/A (configurações de EST-01 são por projeto)
// =============================================================================
function _cfgEstimativasLoad() {
    _cfgNaView('cfg_estimativas', 'fa-solid fa-calculator',
        'Parâmetros de Estimativa',
        'Configurações globais de EST-01 (templates de papéis, faixas de referência). Previsto para uma próxima fase do módulo de Estimation.');
}

// =============================================================================
// VIEW: cfg_ratecards — rate_card_papeis
// =============================================================================
let _admRcData = [];

async function _cfgRatecardsLoad() {
    admSetState('cfg_ratecards', 'loading');
    const { data, error } = await _supabase.from('rate_card_papeis').select('*').order('papel');
    _admRcData = error ? [] : (data || []);
    const el = admGetContentEl('cfg_ratecards');
    if (!el) { admSetState('cfg_ratecards', error ? 'error' : 'content'); return; }
    const podeEditar = _cfgEhProp();

    const actEl = document.getElementById('adm-header-actions-cfg_ratecards');
    if (actEl && !actEl.dataset.cadInit && podeEditar) {
        actEl.dataset.cadInit = '1';
        actEl.innerHTML = `<button onclick="cfgRcNovoForm()"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold
                   bg-indigo-600 text-white rounded hover:bg-indigo-700 transition-colors">
            <i class="fa-solid fa-plus"></i>Novo Papel</button>`;
    }

    el.innerHTML = `
    <div id="adm-rc-form" class="hidden mb-4"></div>
    <div class="border border-gray-200 rounded-lg overflow-hidden">
        <table class="w-full text-sm">
            <thead><tr class="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <th class="px-3 py-2.5 text-left font-medium">Papel</th>
                <th class="px-3 py-2.5 text-right font-medium">Valor / Hora</th>
                <th class="px-3 py-2.5 text-left font-medium">Status</th>
                ${podeEditar ? '<th class="px-3 py-2.5 text-left font-medium">Ações</th>' : ''}
            </tr></thead>
            <tbody class="divide-y divide-gray-100">
            ${!_admRcData.length
                ? `<tr><td colspan="${podeEditar?4:3}" class="py-10 text-center text-gray-400 text-xs">Nenhum papel no Rate Card</td></tr>`
                : _admRcData.map(r => {
                    const inativo = r.ativo === false;
                    return `<tr class="${inativo ? 'opacity-50' : ''}">
                        <td class="px-3 py-2.5 font-semibold text-gray-800 uppercase">${escapeHtml(r.papel)}</td>
                        <td class="px-3 py-2.5 text-right font-mono font-bold text-gray-700">
                            ${typeof formatCurrency === 'function' ? formatCurrency(Number(r.valor_hora)||0) : `R$ ${Number(r.valor_hora||0).toFixed(2)}`}
                        </td>
                        <td class="px-3 py-2.5">
                            ${inativo
                                ? '<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-100 text-gray-500">Inativo</span>'
                                : '<span class="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700">Ativo</span>'}
                        </td>
                        ${podeEditar ? `<td class="px-3 py-2.5 whitespace-nowrap">
                            <button onclick="cfgRcEditarForm(${r.id})" class="text-xs font-semibold text-indigo-600 hover:text-indigo-800 mr-2">
                                <i class="fa-solid fa-pen-to-square"></i> Editar</button>
                            <button onclick="cfgRcToggle(${r.id}, ${!inativo})" class="text-xs font-semibold ${inativo ? 'text-emerald-600 hover:text-emerald-800' : 'text-red-500 hover:text-red-700'}">
                                ${inativo ? '<i class="fa-solid fa-rotate-left"></i> Reativar' : '<i class="fa-solid fa-ban"></i> Inativar'}</button>
                        </td>` : ''}
                    </tr>`;
                }).join('')}
            </tbody>
        </table>
    </div>`;
    admSetState('cfg_ratecards', _admRcData.length ? 'content' : 'empty');
}

function _cfgRcAbrirForm(id) {
    if (!_cfgEhProp()) return alert('Apenas o Proprietário pode alterar o Rate Card.');
    const r = id ? _admRcData.find(x => x.id === id) : null;
    const panel = document.getElementById('adm-rc-form');
    if (!panel) return;
    panel.innerHTML = `
    <div class="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
        <div class="flex items-center justify-between mb-3">
            <span class="text-sm font-semibold text-indigo-800">${r ? 'Editar Papel' : 'Novo Papel'}</span>
            <button onclick="cfgRcFecharForm()" class="text-gray-400 hover:text-gray-600"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="grid grid-cols-2 gap-3 mb-3">
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Papel *</label>
                <input id="adm-rc-papel" type="text" value="${escapeHtml(r?.papel||'')}"
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
            <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Valor / Hora (R$) *</label>
                <input id="adm-rc-valor" type="number" step="0.01" min="0" value="${r?.valor_hora||''}"
                    class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
            </div>
        </div>
        <input type="hidden" id="adm-rc-id" value="${r?.id||''}">
        <button onclick="cfgRcSalvar()" class="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700">
            <i class="fa-solid fa-floppy-disk mr-1"></i>${r ? 'Atualizar' : 'Salvar'}</button>
    </div>`;
    panel.classList.remove('hidden');
    document.getElementById('adm-rc-papel')?.focus();
}
function cfgRcNovoForm() { _cfgRcAbrirForm(null); }
function cfgRcEditarForm(id) { _cfgRcAbrirForm(id); }
function cfgRcFecharForm() {
    const p = document.getElementById('adm-rc-form');
    if (p) { p.classList.add('hidden'); p.innerHTML = ''; }
}

async function cfgRcSalvar() {
    if (!_cfgEhProp()) return alert('Apenas o Proprietário pode alterar o Rate Card.');
    const id = document.getElementById('adm-rc-id')?.value;
    const papel = (document.getElementById('adm-rc-papel')?.value || '').trim().toUpperCase();
    const valorHora = Number(document.getElementById('adm-rc-valor')?.value);
    if (!papel) return alert('Informe o papel.');
    if (!valorHora || valorHora <= 0) return alert('Informe um valor/hora válido.');
    const payload = { papel, valor_hora: valorHora, atualizado_por: _cfgQuem(), atualizado_em: new Date().toISOString() };
    const { error } = id
        ? await _supabase.from('rate_card_papeis').update(payload).eq('id', Number(id))
        : await _supabase.from('rate_card_papeis').insert([payload]);
    if (error) return alert('Erro: ' + error.message);
    cfgRcFecharForm();
    _cfgRatecardsLoad();
}

async function cfgRcToggle(id, inativar) {
    if (!_cfgEhProp()) return alert('Apenas o Proprietário pode alterar o Rate Card.');
    if (!confirm(inativar ? 'Inativar este papel?' : 'Reativar este papel?')) return;
    const { error } = await _supabase.from('rate_card_papeis').update({ ativo: !inativar }).eq('id', id);
    if (error) return alert('Erro: ' + error.message);
    _cfgRatecardsLoad();
}

// =============================================================================
// VIEW: cfg_financeiro — controle_orcamento + percentual_bloqueio
// =============================================================================
async function _cfgFinanceiroLoad() {
    admSetState('cfg_financeiro', 'loading');
    if (!_cfgEhAdmin()) { _cfgSemPermissao('cfg_financeiro'); return; }
    const [{ data: cfgCO }, { data: cfgBloq }, { data: logBloq }] = await Promise.all([
        _supabase.from('config_controle_orcamento').select('*').order('alterado_em', { ascending: false }).limit(1),
        _supabase.from('config_bloqueio_orcamento').select('*').eq('id', 1).maybeSingle(),
        _supabase.from('log_percentual_bloqueio_orcamento').select('*').order('alterado_em', { ascending: false }).limit(5),
    ]);
    _cfgFinanceiroRender(cfgCO?.[0]||null, cfgBloq||null, logBloq||[]);
}

function _cfgFinanceiroRender(cfgCO, cfgBloq, logBloq) {
    const el = admGetContentEl('cfg_financeiro');
    if (!el) return;
    const fmtDt = (d) => d ? (typeof formatDateTime === 'function' ? formatDateTime(d) : d) : '-';
    const LABELS = { AF: 'Ano Fiscal', AREA: 'Área', PRODUTO: 'Produto' };
    const modoAtual = cfgCO?.modo && LABELS[cfgCO.modo] ? cfgCO.modo : 'AF';
    const bloqAtual = cfgBloq?.percentual_bloqueio_variacao ?? null;

    el.innerHTML = `
    <div class="grid grid-cols-2 gap-4">
        <!-- Controle Orçamentário -->
        <div class="p-4 border border-gray-200 rounded-lg">
            <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Controle Orçamentário do Trade-off</div>
            <p class="text-xs text-gray-400 mb-3">Define quais projetos são elegíveis no trade-off da Demanda Extraordinária.</p>
            <div class="mb-3">
                <div class="text-xs text-gray-500 mb-1">Modo vigente</div>
                <span class="text-base font-bold text-indigo-700">${LABELS[modoAtual]}</span>
                ${cfgCO ? `<div class="text-xs text-gray-400 mt-1">Alterado por <strong>${escapeHtml(cfgCO.alterado_por||'-')}</strong> em ${fmtDt(cfgCO.alterado_em)}</div>` : ''}
            </div>
            <div class="flex items-end gap-2">
                <div class="flex-1">
                    <label class="block text-xs font-medium text-gray-600 mb-1">Novo modo</label>
                    <select id="adm-cfg-co-modo" class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400">
                        <option value="AF" ${modoAtual==='AF'?'selected':''}>Ano Fiscal (padrão)</option>
                        <option value="AREA" ${modoAtual==='AREA'?'selected':''}>Área</option>
                        <option value="PRODUTO" ${modoAtual==='PRODUTO'?'selected':''}>Produto</option>
                    </select>
                </div>
                <button onclick="cfgFinSalvarCO()" class="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700">
                    <i class="fa-solid fa-floppy-disk mr-1"></i>Salvar</button>
            </div>
        </div>
        <!-- Percentual de Bloqueio -->
        <div class="p-4 border border-gray-200 rounded-lg">
            <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Percentual de Bloqueio de Orçamento</div>
            <p class="text-xs text-gray-400 mb-3">Variação máxima aceita na conclusão de Requerimentos e Technical. Em branco = sem bloqueio.</p>
            <div class="mb-3">
                <div class="text-xs text-gray-500 mb-1">Vigente</div>
                <span class="text-base font-bold text-indigo-700">${bloqAtual === null ? 'Sem bloqueio' : bloqAtual + '%'}</span>
                ${cfgBloq?.atualizado_em ? `<div class="text-xs text-gray-400 mt-1">Alterado por <strong>${escapeHtml(cfgBloq.atualizado_por||'-')}</strong> em ${fmtDt(cfgBloq.atualizado_em)}</div>` : ''}
            </div>
            <div class="flex items-end gap-2 mb-3">
                <div class="flex-1">
                    <label class="block text-xs font-medium text-gray-600 mb-1">Novo percentual (%)</label>
                    <input id="adm-cfg-bloq-pct" type="number" min="0" step="1"
                        value="${bloqAtual !== null ? bloqAtual : ''}" placeholder="deixe em branco para sem bloqueio"
                        class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400" />
                </div>
                <button onclick="cfgFinSalvarBloq()" class="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700">
                    <i class="fa-solid fa-floppy-disk mr-1"></i>Salvar</button>
            </div>
            ${logBloq.length ? `<div class="text-xs text-gray-400 border-t border-gray-100 pt-2">
                <div class="font-semibold mb-1">Últimas alterações</div>
                ${logBloq.map(l => `<div>${l.percentual_novo === null ? 'Sem bloqueio' : l.percentual_novo+'%'} — <span class="uppercase font-semibold">${escapeHtml(l.alterado_por||'-')}</span> · ${fmtDt(l.alterado_em)}</div>`).join('')}
            </div>` : ''}
        </div>
    </div>`;
    admSetState('cfg_financeiro', 'content');
}

async function cfgFinSalvarCO() {
    if (!_cfgEhAdmin()) return alert('Sem permissão.');
    const novoModo = document.getElementById('adm-cfg-co-modo')?.value;
    if (!['AF','AREA','PRODUTO'].includes(novoModo)) return alert('Modo inválido.');
    const { data: atual } = await _supabase.from('config_controle_orcamento').select('modo').order('alterado_em',{ascending:false}).limit(1);
    const modoAtual = atual?.[0]?.modo || 'AF';
    if (novoModo === modoAtual) return alert('O modo selecionado já é o vigente.');
    const d = new Date();
    const vigencia = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
    const LABELS = { AF: 'Ano Fiscal', AREA: 'Área', PRODUTO: 'Produto' };
    if (!confirm(`Confirmar: controle orçamentário muda para "${LABELS[novoModo]}" a partir de ${vigencia}?`)) return;
    const { error } = await _supabase.from('config_controle_orcamento').insert([{
        modo: novoModo, vigencia_de: vigencia, modo_anterior: modoAtual,
        alterado_por: _cfgQuem(), alterado_em: new Date().toISOString()
    }]);
    if (error) return alert('Erro: ' + error.message);
    if (typeof carregarConfigControleOrcamento === 'function') await carregarConfigControleOrcamento();
    _cfgFinanceiroLoad();
}

async function cfgFinSalvarBloq() {
    if (!_cfgEhAdmin()) return alert('Sem permissão.');
    const bruto = (document.getElementById('adm-cfg-bloq-pct')?.value || '').trim();
    const valor = bruto === '' ? null : Number(bruto);
    if (valor !== null && (isNaN(valor) || valor < 0)) return alert('Percentual inválido.');
    const { data: atual } = await _supabase.from('config_bloqueio_orcamento').select('*').eq('id',1).maybeSingle();
    const valorAtual = atual?.percentual_bloqueio_variacao ?? null;
    if (valor === valorAtual) return alert('O percentual informado já é o vigente.');
    const { error } = await _supabase.from('config_bloqueio_orcamento').upsert({
        id: 1, percentual_bloqueio_variacao: valor, atualizado_por: _cfgQuem(), atualizado_em: new Date().toISOString()
    });
    if (error) return alert('Erro: ' + error.message);
    await _supabase.from('log_percentual_bloqueio_orcamento').insert([{
        percentual_anterior: valorAtual, percentual_novo: valor, alterado_por: _cfgQuem()
    }]);
    _cfgFinanceiroLoad();
}

// =============================================================================
// VIEW: cfg_notificacoes — toggle de envio de e-mail
// =============================================================================
async function _cfgNotificacoesLoad() {
    admSetState('cfg_notificacoes', 'loading');
    if (!_cfgEhAdmin()) { _cfgSemPermissao('cfg_notificacoes'); return; }
    const { data } = await _supabase.from('config_email_geral').select('*').eq('id', 1).maybeSingle();
    const cfg = data || {};
    const el = admGetContentEl('cfg_notificacoes');
    if (!el) return;
    const fmtDt = (d) => d ? (typeof formatDateTime === 'function' ? formatDateTime(d) : d) : '-';
    el.innerHTML = `
    <div class="p-4 border border-gray-200 rounded-lg max-w-lg">
        <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Envio de Notificações por E-mail</div>
        <p class="text-xs text-gray-400 mb-4">Liga/desliga o disparo de todos os e-mails automáticos do sistema (aprovações, alertas, SLA). Não afeta e-mails já na fila de saída.</p>
        <div class="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 mb-4">
            <div>
                <div class="text-sm font-semibold text-gray-800">${cfg.ativo !== false ? 'Envio ATIVO' : 'Envio DESATIVADO'}</div>
                ${cfg.atualizado_por ? `<div class="text-xs text-gray-400">Último ajuste: ${escapeHtml(cfg.atualizado_por)} · ${fmtDt(cfg.atualizado_em)}</div>` : ''}
            </div>
            <span class="px-2 py-1 rounded text-xs font-semibold ${cfg.ativo !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}">
                ${cfg.ativo !== false ? 'Ligado' : 'Desligado'}</span>
        </div>
        <button onclick="cfgNotifToggle(${cfg.ativo !== false})"
            class="px-3 py-1.5 text-xs font-semibold ${cfg.ativo !== false ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white rounded">
            <i class="fa-solid ${cfg.ativo !== false ? 'fa-toggle-off' : 'fa-toggle-on'} mr-1"></i>
            ${cfg.ativo !== false ? 'Desativar Envio' : 'Ativar Envio'}</button>
        <p class="mt-3 text-xs text-gray-400">Para editar o fluxo de e-mail e os templates, acesse
            <button onclick="switchTab('cfg_eventos')" class="text-indigo-600 underline hover:no-underline">Eventos</button> e
            <button onclick="switchTab('cfg_templates')" class="text-indigo-600 underline hover:no-underline">Templates</button>.</p>
    </div>`;
    admSetState('cfg_notificacoes', 'content');
}

async function cfgNotifToggle(desligar) {
    if (!_cfgEhAdmin()) return alert('Sem permissão.');
    if (!confirm(desligar ? 'Desativar o envio de e-mails automáticos?' : 'Reativar o envio de e-mails automáticos?')) return;
    const { error } = await _supabase.from('config_email_geral').upsert({
        id: 1, ativo: !desligar, atualizado_por: _cfgQuem(), atualizado_em: new Date().toISOString()
    });
    if (error) return alert('Erro: ' + error.message);
    _cfgNotificacoesLoad();
}

// =============================================================================
// VIEW: cfg_eventos — link para a gestão de fluxo de email
// =============================================================================
function _cfgEventosLoad() {
    const el = admGetContentEl('cfg_eventos');
    if (!el) return;
    el.innerHTML = `
    <div class="p-5 border border-indigo-200 bg-indigo-50 rounded-lg max-w-lg">
        <div class="flex items-center gap-3 mb-3">
            <i class="fa-solid fa-envelope-open-text text-2xl text-indigo-400"></i>
            <div>
                <div class="text-sm font-semibold text-indigo-800">Fluxo de E-mail</div>
                <div class="text-xs text-indigo-600">Eventos, gatilhos e configuração do canal de e-mail</div>
            </div>
        </div>
        <p class="text-xs text-gray-500 mb-4">A gestão do fluxo de e-mail (eventos, destinatários, provedores SMTP) é acessada pela tela especializada.</p>
        <button onclick="switchTab('gestao_fluxo_email')"
            class="px-4 py-2 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700">
            <i class="fa-solid fa-arrow-right mr-1"></i>Abrir Gestão de Fluxo de E-mail</button>
    </div>`;
    admSetState('cfg_eventos', 'content');
}

// =============================================================================
// VIEW: cfg_templates — link para templates de email e IA
// =============================================================================
function _cfgTemplatesLoad() {
    const el = admGetContentEl('cfg_templates');
    if (!el) return;
    el.innerHTML = `
    <div class="grid grid-cols-2 gap-4 max-w-2xl">
        <div class="p-4 border border-gray-200 rounded-lg">
            <div class="flex items-center gap-2 mb-2">
                <i class="fa-solid fa-envelope text-xl text-gray-400"></i>
                <span class="text-sm font-semibold text-gray-700">Templates de E-mail</span>
            </div>
            <p class="text-xs text-gray-400 mb-3">Modelos de mensagem para cada evento do workflow.</p>
            <button onclick="switchTab('gestao_templates')"
                class="px-3 py-1.5 text-xs font-semibold bg-gray-800 text-white rounded hover:bg-gray-900">
                <i class="fa-solid fa-arrow-right mr-1"></i>Abrir Templates de E-mail</button>
        </div>
        <div class="p-4 border border-gray-200 rounded-lg">
            <div class="flex items-center gap-2 mb-2">
                <i class="fa-solid fa-wand-magic-sparkles text-xl text-purple-400"></i>
                <span class="text-sm font-semibold text-gray-700">Templates de IA</span>
            </div>
            <p class="text-xs text-gray-400 mb-3">Prompts e instruções usados pelo Módulo de Construção com IA.</p>
            <button onclick="switchTab('ia_templates')"
                class="px-3 py-1.5 text-xs font-semibold bg-purple-700 text-white rounded hover:bg-purple-800">
                <i class="fa-solid fa-arrow-right mr-1"></i>Abrir Templates de IA</button>
        </div>
    </div>`;
    admSetState('cfg_templates', 'content');
}

// =============================================================================
// VIEW: cfg_ia — ia_config_geral
// =============================================================================
const _IA_MODELOS = [
    { valor: 'gpt-4o', rotulo: 'GPT-4o (rápido, recomendado)' },
    { valor: 'gpt-4o-mini', rotulo: 'GPT-4o mini (mais barato, menos profundo)' },
    { valor: 'claude-sonnet-5-5', rotulo: 'Claude Sonnet 5.5 (Anthropic)' },
    { valor: 'claude-haiku-5-5', rotulo: 'Claude Haiku 5.5 (Anthropic, rápido)' },
];

async function _cfgIaLoad() {
    admSetState('cfg_ia', 'loading');
    if (!_cfgEhAdmin()) { _cfgSemPermissao('cfg_ia'); return; }
    if (typeof carregarIaConfigGeral === 'function') await carregarIaConfigGeral();
    const cfg = (typeof iaConfigGeralCache !== 'undefined' && iaConfigGeralCache) ? iaConfigGeralCache : { ativo: true, modelo: 'gpt-4o' };
    const el = admGetContentEl('cfg_ia');
    if (!el) return;
    const modelosOpts = _IA_MODELOS.map(m =>
        `<option value="${m.valor}" ${m.valor === cfg.modelo ? 'selected' : ''}>${escapeHtml(m.rotulo)}</option>`
    ).join('');
    el.innerHTML = `
    <div class="p-5 border border-gray-200 rounded-lg max-w-lg">
        <div class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Módulo de Inteligência Artificial</div>
        <div class="flex items-center justify-between mb-4">
            <div>
                <div class="text-sm font-semibold text-gray-800">Habilitar Módulo de IA</div>
                <div class="text-xs text-gray-400">Liga/desliga o Módulo de Construção de Requerimentos com IA.</div>
            </div>
            <label class="relative inline-flex items-center cursor-pointer">
                <input id="adm-cfg-ia-ativo" type="checkbox" class="sr-only peer" ${cfg.ativo !== false ? 'checked' : ''}>
                <div class="w-9 h-5 bg-gray-200 peer-checked:bg-indigo-600 rounded-full peer
                    after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white
                    after:w-4 after:h-4 after:rounded-full after:transition-all peer-checked:after:translate-x-4"></div>
            </label>
        </div>
        <div class="mb-4">
            <label class="block text-xs font-medium text-gray-600 mb-1">Modelo de IA</label>
            <select id="adm-cfg-ia-modelo" class="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-indigo-400">
                ${modelosOpts}
            </select>
        </div>
        <button onclick="cfgIaSalvar()" class="px-4 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded hover:bg-indigo-700">
            <i class="fa-solid fa-floppy-disk mr-1"></i>Salvar Configuração de IA</button>
        <p class="mt-3 text-xs text-gray-400">Para editar os prompts usados pelo módulo, acesse
            <button onclick="switchTab('cfg_templates')" class="text-indigo-600 underline hover:no-underline">Templates → Templates de IA</button>.</p>
    </div>`;
    admSetState('cfg_ia', 'content');
}

async function cfgIaSalvar() {
    if (!_cfgEhAdmin()) return alert('Sem permissão.');
    const ativo = document.getElementById('adm-cfg-ia-ativo')?.checked ?? true;
    const modelo = document.getElementById('adm-cfg-ia-modelo')?.value || 'gpt-4o';
    const { error } = await _supabase.from('ia_config_geral').update({ ativo, modelo }).eq('id', 1);
    if (error) return alert('Erro: ' + error.message);
    if (typeof carregarIaConfigGeral === 'function') await carregarIaConfigGeral();
    _cfgIaLoad();
}

// =============================================================================
// VIEW: cfg_parametros — N/A
// =============================================================================
function _cfgParametrosLoad() {
    _cfgNaView('cfg_parametros', 'fa-solid fa-sliders',
        'Parâmetros do Sistema',
        'Configurações avançadas de comportamento do sistema (timeouts, limites, features flags). Previsto para uma próxima fase.');
}
