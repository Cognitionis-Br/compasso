// =========================================================================
// workspace-projeto/financeiro-projeto.js
// Compasso 2.0 — Release 3, aba Financeiro do Workspace ("Projeto -
// Financeiro" do pacote). Não cria nenhum conceito novo de orçamento —
// só apresenta, numa aba dedicada, os MESMOS campos já usados em
// js/projeto-detalhe/projeto-detalhe.js (val_bc/val_req/val_tech/
// realizado/horas_*) e o mesmo alerta de bloqueio por variação
// (bloqueado_mudanca_orcamento, js/governanca/mudanca-orcamento.js).
//
// NOVO (V4 do Plano de Evolução — Estimation, 2026-09-25): enquanto o
// projeto ainda é um Business Case (etapa_atual === 'BUSINESS CASE'),
// esta aba ganha o bloco "Estimativa (EST-01)" — o primeiro mecanismo
// real que preenche horas_bc/val_bc (nenhuma tela de produção fazia isso
// antes; só o seed de teste). Baseado em Rate Card (rate_card_papeis) +
// um histórico versionado (business_case_estimativas). Uma vez que o
// projeto vira Project de verdade, esta aba volta a ser só leitura, sem
// mudança nenhuma no comportamento de antes.
//
// NOVO (V5 — Estimation, continuação, 2026-09-25): o mesmo bloco agora
// também aparece em Requerimentos (EST-02, REQ-02) e Especificação
// (EST-03, SPEC-02) — mesmo mecanismo de Rate Card, só trocando qual
// campo de horas_*/val_* é preenchido e o "fase" gravado no histórico
// (business_case_estimativas.fase, coluna do V5). ESTIMATIVA_FASES abaixo
// é o único lugar que sabe a diferença entre as 3 fases.
// =========================================================================

const ESTIMATIVA_FASES = {
    'BUSINESS CASE': { fase: 'BC', label: 'EST-01', campoHoras: 'horas_bc', campoValor: 'val_bc' },
    'REQUIREMENTS': { fase: 'REQ', label: 'EST-02', campoHoras: 'horas_req', campoValor: 'val_req' },
    'TECHNICAL': { fase: 'TECH', label: 'EST-03', campoHoras: 'horas_tech', campoValor: 'val_tech' }
};

let _estProjetoAtual = null;
let _estFaseAtual = null; // uma das chaves de ESTIMATIVA_FASES[x].fase ('BC'/'REQ'/'TECH')
let _estLinhas = []; // [{papel, horas}] — rascunho em edição, não salvo ainda
let _estHistorico = []; // business_case_estimativas do projeto+fase atual, mais recente primeiro

async function renderFinanceiroProjeto(projetoCodigo, wrapperElId) {
    const wrapper = document.getElementById(wrapperElId);
    if (!wrapper) return;

    const p = (typeof projectsData !== 'undefined') ? projectsData.find(x => x.codigo === projetoCodigo) : null;
    if (!p) { wrapper.innerHTML = '<p class="text-xs text-gray-400 italic py-4 text-center">Projeto não encontrado.</p>'; return; }

    const estConfig = ESTIMATIVA_FASES[p.etapa_atual] || (!p.etapa_atual ? ESTIMATIVA_FASES['BUSINESS CASE'] : null);
    if (estConfig) {
        await _estCarregar(projetoCodigo, estConfig.fase);
    }

    const valBc = Number(p.val_bc) || Number(p.previsto) || 0;
    const valReq = Number(p.val_req) || 0;
    const valTech = Number(p.val_tech) || 0;
    const valAtual = valTech || valReq || valBc;
    const valUtilizado = Number(p.realizado) || 0;
    const horasBc = Number(p.horas_bc) || 0;
    const horasReq = Number(p.horas_req) || 0;
    const horasTech = Number(p.horas_tech) || 0;

    const cardValor = (rotulo, valor, destaque) => `
        <div class="bg-white rounded-lg border border-gray-200 p-4 ${destaque ? 'border-t-4 border-t-indigo-500' : ''}">
            <div class="text-[10px] font-bold uppercase text-gray-400">${rotulo}</div>
            <div class="text-lg font-extrabold text-gray-900 tabular-nums mt-1">${formatCurrency(valor)}</div>
        </div>`;

    wrapper.innerHTML = `
        ${p.bloqueado_mudanca_orcamento ? `
            <div class="bg-danger-50 border-2 border-danger-300 rounded-lg p-3 mb-4 flex items-center justify-between">
                <span class="text-xs font-bold text-danger-800"><i class="fa-solid fa-triangle-exclamation"></i> Projeto bloqueado por variação de orçamento acima do limite.</span>
                <button onclick="abrirDetalheProjeto('${projetoCodigo}', 'workspace')" class="text-[11px] font-bold text-danger-700 hover:text-danger-900 underline">Ver / Aprovar</button>
            </div>` : ''}

        ${estConfig ? _estRenderBloco(estConfig) : ''}

        <h4 class="text-xs font-black uppercase text-gray-500 mb-2">Evolução do Orçamento (Valor)</h4>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            ${cardValor('Business Case', valBc)}
            ${cardValor('Requerimentos', valReq || valBc)}
            ${cardValor('Especificação', valTech || valReq || valBc)}
            ${cardValor('Atual', valAtual, true)}
        </div>

        <h4 class="text-xs font-black uppercase text-gray-500 mb-2">Realizado</h4>
        <div class="grid grid-cols-2 gap-3 mb-6">
            ${cardValor('Valor Utilizado', valUtilizado)}
            ${cardValor('Saldo Disponível', Math.max(valAtual - valUtilizado, 0))}
        </div>

        ${(horasBc || horasReq || horasTech) ? `
        <h4 class="text-xs font-black uppercase text-gray-500 mb-2">Evolução do Orçamento (Horas)</h4>
        <div class="grid grid-cols-3 gap-3">
            <div class="bg-white rounded-lg border border-gray-200 p-4"><div class="text-[10px] font-bold uppercase text-gray-400">Business Case</div><div class="text-lg font-extrabold text-gray-900">${horasBc}h</div></div>
            <div class="bg-white rounded-lg border border-gray-200 p-4"><div class="text-[10px] font-bold uppercase text-gray-400">Requerimentos</div><div class="text-lg font-extrabold text-gray-900">${horasReq || horasBc}h</div></div>
            <div class="bg-white rounded-lg border border-gray-200 p-4"><div class="text-[10px] font-bold uppercase text-gray-400">Especificação</div><div class="text-lg font-extrabold text-gray-900">${horasTech || horasReq || horasBc}h</div></div>
        </div>` : ''}
    `;
}

// -------------------------------------------------------------------------
// Estimativa (Rate Card) — EST-01 (Business Case) / EST-02 (Requerimentos)
// / EST-03 (Especificação). Qual fase está ativa vem de ESTIMATIVA_FASES,
// resolvido em renderFinanceiroProjeto a partir de p.etapa_atual.
// -------------------------------------------------------------------------
async function _estCarregar(projetoCodigo, fase) {
    if (typeof rateCardData === 'undefined' || rateCardData.length === 0) {
        const { data } = await _supabase.from('rate_card_papeis').select('*').eq('ativo', true).order('papel');
        rateCardData = data || [];
    }

    const { data: hist } = await _supabase
        .from('business_case_estimativas')
        .select('*')
        .eq('business_case_codigo', projetoCodigo)
        .eq('fase', fase)
        .order('versao', { ascending: false });
    _estHistorico = hist || [];

    // Só reinicia o rascunho ao trocar de projeto OU de fase (ex.: acabou
    // de sair de Business Case pra Requerimentos) — evita perder linhas já
    // digitadas se o wrapper for re-renderizado pro mesmo projeto+fase
    // (ex.: depois de salvar).
    if (_estProjetoAtual !== projetoCodigo || _estFaseAtual !== fase) {
        _estProjetoAtual = projetoCodigo;
        _estFaseAtual = fase;
        _estLinhas = [];
    }
}

function _estPapelAtivo(papel) {
    return (rateCardData || []).find(r => r.papel === papel);
}

function _estTotais() {
    let totalHoras = 0, totalCusto = 0;
    _estLinhas.forEach(l => {
        const rc = _estPapelAtivo(l.papel);
        const valorHora = rc ? Number(rc.valor_hora) : 0;
        totalHoras += Number(l.horas) || 0;
        totalCusto += (Number(l.horas) || 0) * valorHora;
    });
    return { totalHoras, totalCusto };
}

function _estRenderBloco(estConfig) {
    const opcoesPapel = (rateCardData || []).map(r => `<option value="${escapeHtml(r.papel)}">${escapeHtml(r.papel)} (${formatCurrency(Number(r.valor_hora))}/h)</option>`).join('');

    const linhasHtml = _estLinhas.map((l, idx) => {
        const rc = _estPapelAtivo(l.papel);
        const valorHora = rc ? Number(rc.valor_hora) : 0;
        const subtotal = (Number(l.horas) || 0) * valorHora;
        return `
            <tr>
                <td class="p-2">
                    <select onchange="_estAtualizarLinha(${idx}, 'papel', this.value)" class="p-1.5 border border-gray-300 rounded text-xs w-full">
                        <option value="">-- Papel --</option>
                        ${opcoesPapel}
                    </select>
                </td>
                <td class="p-2"><input type="number" min="0" step="0.5" value="${l.horas || ''}" onchange="_estAtualizarLinha(${idx}, 'horas', this.value)" class="p-1.5 border border-gray-300 rounded text-xs w-24"></td>
                <td class="p-2 text-right font-mono">${formatCurrency(valorHora)}</td>
                <td class="p-2 text-right font-mono font-bold">${formatCurrency(subtotal)}</td>
                <td class="p-2 text-center"><button onclick="_estRemoverLinha(${idx})" class="text-danger-600 hover:text-danger-800"><i class="fa-solid fa-trash"></i></button></td>
            </tr>`;
    }).join('');

    const { totalHoras, totalCusto } = _estTotais();

    const historicoHtml = _estHistorico.length === 0
        ? '<p class="text-xs text-gray-400 italic">Nenhuma estimativa salva ainda.</p>'
        : `<div class="space-y-1">${_estHistorico.map(h => `
            <div class="border border-gray-100 rounded">
                <button onclick="_estToggleVersao(${h.id})" class="w-full flex justify-between items-center px-3 py-1.5 text-xs hover:bg-gray-50">
                    <span class="font-bold">Versão ${h.versao} — ${new Date(h.criado_em).toLocaleDateString('pt-BR')} — ${escapeHtml(h.criado_por) || 'desconhecido'}</span>
                    <span class="font-mono font-bold">${formatCurrency(Number(h.custo_estimado))} (${Number(h.total_horas)}h)</span>
                </button>
                <div id="estVersaoDetalhe_${h.id}" class="hidden px-3 pb-2 text-[11px] text-gray-600">
                    ${h.premissas ? `<p class="italic mb-1">${escapeHtml(h.premissas)}</p>` : ''}
                    ${(h.itens || []).map(it => `<div>${escapeHtml(it.papel)}: ${it.horas}h × ${formatCurrency(it.valor_hora_snapshot)} = ${formatCurrency(it.subtotal)}</div>`).join('')}
                </div>
            </div>`).join('')}</div>`;

    return `
        <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
            <h4 class="text-xs font-black uppercase text-indigo-700 mb-3">Estimativa (${estConfig.label})</h4>

            <label class="block text-[10px] font-bold uppercase text-gray-500 mb-1">Premissas</label>
            <textarea id="estPremissasInput" rows="2" class="w-full p-2 border border-gray-300 rounded text-xs mb-3" placeholder="Premissas consideradas nesta estimativa...">${_estLinhas._premissas || ''}</textarea>

            <table class="w-full text-left border-collapse text-xs mb-2">
                <thead>
                    <tr class="text-[10px] uppercase text-gray-500 border-b">
                        <th class="p-2">Papel</th><th class="p-2">Horas</th><th class="p-2 text-right">Valor/Hora</th><th class="p-2 text-right">Subtotal</th><th class="p-2"></th>
                    </tr>
                </thead>
                <tbody>${linhasHtml || '<tr><td colspan="5" class="p-2 text-center text-gray-400 italic">Nenhum papel adicionado.</td></tr>'}</tbody>
            </table>
            <button onclick="_estAdicionarLinha()" class="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 mb-3"><i class="fa-solid fa-plus"></i> Adicionar Papel</button>

            <div class="flex justify-between items-center bg-white rounded p-3 mb-3">
                <span class="text-xs font-bold text-gray-600">Total de Horas: <span class="font-mono">${totalHoras}h</span></span>
                <span class="text-sm font-black text-gray-800">Custo Estimado Total: <span class="font-mono">${formatCurrency(totalCusto)}</span></span>
            </div>

            <button onclick="salvarEstimativa('${_estProjetoAtual}')" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded text-xs mb-4">
                <i class="fa-solid fa-floppy-disk"></i> Salvar Estimativa
            </button>

            <h5 class="text-[11px] font-black uppercase text-gray-500 mb-2">Histórico de Versões</h5>
            ${historicoHtml}
        </div>`;
}

function _estAdicionarLinha() {
    _estLinhas.push({ papel: '', horas: '' });
    _estRerender();
}
function _estRemoverLinha(idx) {
    _estLinhas.splice(idx, 1);
    _estRerender();
}
function _estAtualizarLinha(idx, campo, valor) {
    if (!_estLinhas[idx]) return;
    _estLinhas[idx][campo] = valor;
    _estRerender();
}
function _estRerender() {
    // Preserva o texto de premissas já digitado (não está em _estLinhas)
    // antes de re-renderizar a partir do estado das linhas.
    const premissasEl = document.getElementById('estPremissasInput');
    if (premissasEl) _estLinhas._premissas = premissasEl.value;
    if (typeof _wsProjetoAtual !== 'undefined' && _wsProjetoAtual) renderFinanceiroProjeto(_wsProjetoAtual, 'wsFinanceiroBody');
}
function _estToggleVersao(id) {
    const el = document.getElementById(`estVersaoDetalhe_${id}`);
    if (el) el.classList.toggle('hidden');
}

async function salvarEstimativa(projetoCodigo) {
    const p = projectsData.find(x => x.codigo === projetoCodigo);
    const estConfig = p ? (ESTIMATIVA_FASES[p.etapa_atual] || (!p.etapa_atual ? ESTIMATIVA_FASES['BUSINESS CASE'] : null)) : null;
    if (!estConfig) return alert('Não foi possível determinar a fase da estimativa (o projeto pode ter avançado de fase — recarregue a tela).');

    const premissasEl = document.getElementById('estPremissasInput');
    const premissas = premissasEl ? premissasEl.value.trim() : '';

    const linhasValidas = _estLinhas.filter(l => l.papel && Number(l.horas) > 0);
    if (linhasValidas.length === 0) return alert('Adicione ao menos um papel com horas antes de salvar a estimativa!');

    const itens = linhasValidas.map(l => {
        const rc = _estPapelAtivo(l.papel);
        const valorHora = rc ? Number(rc.valor_hora) : 0;
        const horas = Number(l.horas);
        return { papel: l.papel, horas, valor_hora_snapshot: valorHora, subtotal: horas * valorHora };
    });
    const totalHoras = itens.reduce((acc, i) => acc + i.horas, 0);
    const custoEstimado = itens.reduce((acc, i) => acc + i.subtotal, 0);
    const novaVersao = (_estHistorico[0]?.versao || 0) + 1;

    const { error: errorEst } = await _supabase.from('business_case_estimativas').insert([{
        business_case_codigo: projetoCodigo,
        fase: estConfig.fase,
        versao: novaVersao,
        premissas,
        itens,
        total_horas: totalHoras,
        custo_estimado: custoEstimado,
        criado_por: currentUser ? currentUser.nome : 'desconhecido'
    }]);
    if (errorEst) return alert('Erro ao salvar estimativa: ' + errorEst.message);

    const { error: errorProjeto } = await _supabase.from('projetos').update({ [estConfig.campoHoras]: totalHoras, [estConfig.campoValor]: custoEstimado }).eq('codigo', projetoCodigo);
    if (errorProjeto) return alert(`Estimativa salva, mas houve erro ao atualizar ${estConfig.campoHoras}/${estConfig.campoValor}: ` + errorProjeto.message);

    if (p) { p[estConfig.campoHoras] = totalHoras; p[estConfig.campoValor] = custoEstimado; }

    alert(`✅ ESTIMATIVA (${estConfig.label}, versão ${novaVersao}) SALVA COM SUCESSO!\n\nTotal de Horas: ${totalHoras}h\nCusto Estimado: ${formatCurrency(custoEstimado)}`);
    _estLinhas = [];
    await renderFinanceiroProjeto(projetoCodigo, 'wsFinanceiroBody');
}
