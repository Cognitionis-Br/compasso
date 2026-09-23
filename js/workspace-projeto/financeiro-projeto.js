// =========================================================================
// workspace-projeto/financeiro-projeto.js
// Compasso 2.0 — Release 3, aba Financeiro do Workspace ("Projeto -
// Financeiro" do pacote). Não cria nenhum conceito novo de orçamento —
// só apresenta, numa aba dedicada, os MESMOS campos já usados em
// js/projeto-detalhe/projeto-detalhe.js (val_bc/val_req/val_tech/
// realizado/horas_*) e o mesmo alerta de bloqueio por variação
// (bloqueado_mudanca_orcamento, js/governanca/mudanca-orcamento.js).
// =========================================================================

function renderFinanceiroProjeto(projetoCodigo, wrapperElId) {
    const wrapper = document.getElementById(wrapperElId);
    if (!wrapper) return;

    const p = (typeof projectsData !== 'undefined') ? projectsData.find(x => x.codigo === projetoCodigo) : null;
    if (!p) { wrapper.innerHTML = '<p class="text-xs text-gray-400 italic py-4 text-center">Projeto não encontrado.</p>'; return; }

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
