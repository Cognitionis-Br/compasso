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
// =========================================================================

let _est01ProjetoAtual = null;
let _est01Linhas = []; // [{papel, horas}] — rascunho em edição, não salvo ainda
let _est01Historico = []; // business_case_estimativas do BC atual, mais recente primeiro

async function renderFinanceiroProjeto(projetoCodigo, wrapperElId) {
    const wrapper = document.getElementById(wrapperElId);
    if (!wrapper) return;

    const p = (typeof projectsData !== 'undefined') ? projectsData.find(x => x.codigo === projetoCodigo) : null;
    if (!p) { wrapper.innerHTML = '<p class="text-xs text-gray-400 italic py-4 text-center">Projeto não encontrado.</p>'; return; }

    const ehBusinessCase = (p.etapa_atual === 'BUSINESS CASE' || !p.etapa_atual);
    if (ehBusinessCase) {
        await _est01Carregar(projetoCodigo);
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

        ${ehBusinessCase ? _est01RenderBloco() : ''}

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
// EST-01 — Estimativa (Rate Card) do Business Case.
// -------------------------------------------------------------------------
async function _est01Carregar(projetoCodigo) {
    if (typeof rateCardData === 'undefined' || rateCardData.length === 0) {
        const { data } = await _supabase.from('rate_card_papeis').select('*').eq('ativo', true).order('papel');
        rateCardData = data || [];
    }

    const { data: hist } = await _supabase
        .from('business_case_estimativas')
        .select('*')
        .eq('business_case_codigo', projetoCodigo)
        .order('versao', { ascending: false });
    _est01Historico = hist || [];

    // Só reinicia o rascunho ao trocar de projeto — evita perder linhas já
    // digitadas se o wrapper for re-renderizado pelo mesmo BC (ex.: depois
    // de salvar).
    if (_est01ProjetoAtual !== projetoCodigo) {
        _est01ProjetoAtual = projetoCodigo;
        _est01Linhas = [];
    }
}

function _est01PapelAtivo(papel) {
    return (rateCardData || []).find(r => r.papel === papel);
}

function _est01Totais() {
    let totalHoras = 0, totalCusto = 0;
    _est01Linhas.forEach(l => {
        const rc = _est01PapelAtivo(l.papel);
        const valorHora = rc ? Number(rc.valor_hora) : 0;
        totalHoras += Number(l.horas) || 0;
        totalCusto += (Number(l.horas) || 0) * valorHora;
    });
    return { totalHoras, totalCusto };
}

function _est01RenderBloco() {
    const opcoesPapel = (rateCardData || []).map(r => `<option value="${escapeHtml(r.papel)}">${escapeHtml(r.papel)} (${formatCurrency(Number(r.valor_hora))}/h)</option>`).join('');

    const linhasHtml = _est01Linhas.map((l, idx) => {
        const rc = _est01PapelAtivo(l.papel);
        const valorHora = rc ? Number(rc.valor_hora) : 0;
        const subtotal = (Number(l.horas) || 0) * valorHora;
        return `
            <tr>
                <td class="p-2">
                    <select onchange="_est01AtualizarLinha(${idx}, 'papel', this.value)" class="p-1.5 border border-gray-300 rounded text-xs w-full">
                        <option value="">-- Papel --</option>
                        ${opcoesPapel}
                    </select>
                </td>
                <td class="p-2"><input type="number" min="0" step="0.5" value="${l.horas || ''}" onchange="_est01AtualizarLinha(${idx}, 'horas', this.value)" class="p-1.5 border border-gray-300 rounded text-xs w-24"></td>
                <td class="p-2 text-right font-mono">${formatCurrency(valorHora)}</td>
                <td class="p-2 text-right font-mono font-bold">${formatCurrency(subtotal)}</td>
                <td class="p-2 text-center"><button onclick="_est01RemoverLinha(${idx})" class="text-danger-600 hover:text-danger-800"><i class="fa-solid fa-trash"></i></button></td>
            </tr>`;
    }).join('');

    const { totalHoras, totalCusto } = _est01Totais();

    const historicoHtml = _est01Historico.length === 0
        ? '<p class="text-xs text-gray-400 italic">Nenhuma estimativa salva ainda.</p>'
        : `<div class="space-y-1">${_est01Historico.map(h => `
            <div class="border border-gray-100 rounded">
                <button onclick="_est01ToggleVersao(${h.id})" class="w-full flex justify-between items-center px-3 py-1.5 text-xs hover:bg-gray-50">
                    <span class="font-bold">Versão ${h.versao} — ${new Date(h.criado_em).toLocaleDateString('pt-BR')} — ${escapeHtml(h.criado_por) || 'desconhecido'}</span>
                    <span class="font-mono font-bold">${formatCurrency(Number(h.custo_estimado))} (${Number(h.total_horas)}h)</span>
                </button>
                <div id="est01VersaoDetalhe_${h.id}" class="hidden px-3 pb-2 text-[11px] text-gray-600">
                    ${h.premissas ? `<p class="italic mb-1">${escapeHtml(h.premissas)}</p>` : ''}
                    ${(h.itens || []).map(it => `<div>${escapeHtml(it.papel)}: ${it.horas}h × ${formatCurrency(it.valor_hora_snapshot)} = ${formatCurrency(it.subtotal)}</div>`).join('')}
                </div>
            </div>`).join('')}</div>`;

    return `
        <div class="bg-indigo-50 border border-indigo-200 rounded-lg p-4 mb-6">
            <h4 class="text-xs font-black uppercase text-indigo-700 mb-3">Estimativa (EST-01)</h4>

            <label class="block text-[10px] font-bold uppercase text-gray-500 mb-1">Premissas</label>
            <textarea id="est01PremissasInput" rows="2" class="w-full p-2 border border-gray-300 rounded text-xs mb-3" placeholder="Premissas consideradas nesta estimativa...">${_est01Linhas._premissas || ''}</textarea>

            <table class="w-full text-left border-collapse text-xs mb-2">
                <thead>
                    <tr class="text-[10px] uppercase text-gray-500 border-b">
                        <th class="p-2">Papel</th><th class="p-2">Horas</th><th class="p-2 text-right">Valor/Hora</th><th class="p-2 text-right">Subtotal</th><th class="p-2"></th>
                    </tr>
                </thead>
                <tbody>${linhasHtml || '<tr><td colspan="5" class="p-2 text-center text-gray-400 italic">Nenhum papel adicionado.</td></tr>'}</tbody>
            </table>
            <button onclick="_est01AdicionarLinha()" class="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 mb-3"><i class="fa-solid fa-plus"></i> Adicionar Papel</button>

            <div class="flex justify-between items-center bg-white rounded p-3 mb-3">
                <span class="text-xs font-bold text-gray-600">Total de Horas: <span class="font-mono">${totalHoras}h</span></span>
                <span class="text-sm font-black text-gray-800">Custo Estimado Total: <span class="font-mono">${formatCurrency(totalCusto)}</span></span>
            </div>

            <button onclick="salvarEstimativaBC('${_est01ProjetoAtual}')" class="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded text-xs mb-4">
                <i class="fa-solid fa-floppy-disk"></i> Salvar Estimativa
            </button>

            <h5 class="text-[11px] font-black uppercase text-gray-500 mb-2">Histórico de Versões</h5>
            ${historicoHtml}
        </div>`;
}

function _est01AdicionarLinha() {
    _est01Linhas.push({ papel: '', horas: '' });
    _est01Rerender();
}
function _est01RemoverLinha(idx) {
    _est01Linhas.splice(idx, 1);
    _est01Rerender();
}
function _est01AtualizarLinha(idx, campo, valor) {
    if (!_est01Linhas[idx]) return;
    _est01Linhas[idx][campo] = valor;
    _est01Rerender();
}
function _est01Rerender() {
    // Preserva o texto de premissas já digitado (não está em _est01Linhas)
    // antes de re-renderizar a partir do estado das linhas.
    const premissasEl = document.getElementById('est01PremissasInput');
    if (premissasEl) _est01Linhas._premissas = premissasEl.value;
    if (typeof _wsProjetoAtual !== 'undefined' && _wsProjetoAtual) renderFinanceiroProjeto(_wsProjetoAtual, 'wsFinanceiroBody');
}
function _est01ToggleVersao(id) {
    const el = document.getElementById(`est01VersaoDetalhe_${id}`);
    if (el) el.classList.toggle('hidden');
}

async function salvarEstimativaBC(projetoCodigo) {
    const premissasEl = document.getElementById('est01PremissasInput');
    const premissas = premissasEl ? premissasEl.value.trim() : '';

    const linhasValidas = _est01Linhas.filter(l => l.papel && Number(l.horas) > 0);
    if (linhasValidas.length === 0) return alert('Adicione ao menos um papel com horas antes de salvar a estimativa!');

    const itens = linhasValidas.map(l => {
        const rc = _est01PapelAtivo(l.papel);
        const valorHora = rc ? Number(rc.valor_hora) : 0;
        const horas = Number(l.horas);
        return { papel: l.papel, horas, valor_hora_snapshot: valorHora, subtotal: horas * valorHora };
    });
    const totalHoras = itens.reduce((acc, i) => acc + i.horas, 0);
    const custoEstimado = itens.reduce((acc, i) => acc + i.subtotal, 0);
    const novaVersao = (_est01Historico[0]?.versao || 0) + 1;

    const { error: errorEst } = await _supabase.from('business_case_estimativas').insert([{
        business_case_codigo: projetoCodigo,
        versao: novaVersao,
        premissas,
        itens,
        total_horas: totalHoras,
        custo_estimado: custoEstimado,
        criado_por: currentUser ? currentUser.nome : 'desconhecido'
    }]);
    if (errorEst) return alert('Erro ao salvar estimativa: ' + errorEst.message);

    const { error: errorBc } = await _supabase.from('projetos').update({ horas_bc: totalHoras, val_bc: custoEstimado }).eq('codigo', projetoCodigo);
    if (errorBc) return alert('Estimativa salva, mas houve erro ao atualizar horas_bc/val_bc do Business Case: ' + errorBc.message);

    const p = projectsData.find(x => x.codigo === projetoCodigo);
    if (p) { p.horas_bc = totalHoras; p.val_bc = custoEstimado; }

    alert(`✅ ESTIMATIVA (versão ${novaVersao}) SALVA COM SUCESSO!\n\nTotal de Horas: ${totalHoras}h\nCusto Estimado: ${formatCurrency(custoEstimado)}`);
    _est01Linhas = [];
    await renderFinanceiroProjeto(projetoCodigo, 'wsFinanceiroBody');
}
