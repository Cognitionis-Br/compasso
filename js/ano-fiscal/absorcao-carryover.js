// =========================================================================
// ano-fiscal/absorcao-carryover.js
// Aba "Absorção de Carryover" da tela fechamento_af (V15 — M12 FY-02).
//
// "Carryover operacional é distinto do financeiro" (FY-02): após o AF
// anterior ser fechado com projetos marcados como CONTINUAR/HOLD, o novo
// AF precisa formalmente absorvê-los — atualizando ano_fiscal para o AF
// atual, limpando is_carryover/valor_carryover, e gravando o evento em
// fechamento_af_decisoes. Enquanto não absorvidos, eles ficam com
// is_carryover=true e ano_fiscal do AF antigo.
//
// Permissão: usuarioPodeAlterar('fechamento_af:projetos').
// =========================================================================

async function renderAbsorcaoCarryoverView() {
    const wrapper = document.getElementById('absorcaoCarryoverBody');
    if (!wrapper) return;

    const afAtual = (typeof fechamentoAfTargetAF === 'function') ? fechamentoAfTargetAF() : null;
    const afAnterior = (typeof proximoAnoFiscal === 'function' && afAtual)
        ? (() => {
            const n = parseInt(String(afAtual).replace('AF', ''), 10);
            return isNaN(n) ? null : ('AF' + (n - 1));
        })()
        : null;

    if (!afAnterior) {
        wrapper.innerHTML = '<p class="text-xs text-gray-400 italic py-4 text-center">Não foi possível determinar o Ano Fiscal anterior.</p>';
        return;
    }

    const pendentes = (projectsData || []).filter(p =>
        p.is_subprojeto !== true &&
        p.is_carryover === true &&
        p.ano_fiscal === afAnterior
    );

    const podeAbsorver = (typeof usuarioPodeAlterar === 'function') && usuarioPodeAlterar('fechamento_af:projetos');

    const elCtx = document.getElementById('absorcaoCarryoverContexto');
    if (elCtx) {
        elCtx.innerHTML = `
            <div class="text-xs text-gray-600 mb-4">
                Projetos do <b class="font-mono">${afAnterior}</b> marcados como carryover aguardando absorção formal no <b class="font-mono">${afAtual}</b>.
                Absorver atualiza o <b>Ano Fiscal</b> do projeto para <b>${afAtual}</b> e encerra o estado de carryover.
            </div>`;
    }

    if (pendentes.length === 0) {
        wrapper.innerHTML = `
            <div class="py-8 text-center">
                <i class="fa-solid fa-circle-check text-emerald-500 text-2xl mb-2"></i>
                <p class="text-sm font-bold text-emerald-700">Nenhum projeto do ${afAnterior} aguardando absorção.</p>
                <p class="text-[11px] text-gray-400 mt-1">Todos os projetos carryover já foram absorvidos ou o ${afAnterior} não tem projetos marcados como CONTINUAR.</p>
            </div>`;
        return;
    }

    wrapper.innerHTML = `
        <div class="overflow-x-auto">
            <table class="w-full text-xs border-collapse">
                <thead>
                    <tr class="bg-gray-50 border-b border-gray-200">
                        <th class="text-left p-2 font-bold uppercase text-[10px] text-gray-500">Código</th>
                        <th class="text-left p-2 font-bold uppercase text-[10px] text-gray-500">Projeto</th>
                        <th class="text-left p-2 font-bold uppercase text-[10px] text-gray-500">Fase / Status</th>
                        <th class="text-right p-2 font-bold uppercase text-[10px] text-gray-500">Orç. Carryover</th>
                        <th class="text-left p-2 font-bold uppercase text-[10px] text-gray-500">Marcado por</th>
                        <th class="text-center p-2 font-bold uppercase text-[10px] text-gray-500">Ação</th>
                    </tr>
                </thead>
                <tbody>
                    ${pendentes.map(p => {
                        const saldo = Number(p.valor_carryover) || 0;
                        const fmtSaldo = (typeof formatCurrency === 'function') ? formatCurrency(saldo) : 'R$ ' + saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
                        return `
                        <tr class="border-b border-gray-100 hover:bg-orange-50">
                            <td class="p-2">
                                <button onclick="abrirDetalheProjeto('${escapeJsAttr(p.codigo)}','fechamento_af')" class="font-mono font-bold text-red-700 hover:underline">${escapeHtml(p.codigo)}</button>
                            </td>
                            <td class="p-2 font-semibold text-gray-800">${escapeHtml(p.nome || '')}</td>
                            <td class="p-2 text-gray-600">${escapeHtml(p.etapa_atual || 'BUSINESS CASE')}<br><span class="text-gray-400">${escapeHtml(p.sub_status || '-')}</span></td>
                            <td class="p-2 text-right font-mono font-bold text-amber-700">${fmtSaldo}</td>
                            <td class="p-2 text-gray-500">${escapeHtml(p.carryover_marcado_por || '-')}<br><span class="text-gray-400">${p.carryover_marcado_em ? formatDate(p.carryover_marcado_em) : ''}</span></td>
                            <td class="p-2 text-center">
                                ${podeAbsorver
                                    ? `<button onclick="confirmarAbsorcaoCarryover('${escapeJsAttr(p.codigo)}')" class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] px-3 py-1.5 rounded whitespace-nowrap">Absorver no ${escapeHtml(afAtual)}</button>`
                                    : '<span class="text-gray-400 text-[10px] italic">somente consulta</span>'}
                            </td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>`;
}

async function confirmarAbsorcaoCarryover(codigo) {
    if (!(typeof usuarioPodeAlterar === 'function' && usuarioPodeAlterar('fechamento_af:projetos'))) {
        return alert('Você não tem permissão para absorver projetos carryover.');
    }
    const p = (projectsData || []).find(x => x.codigo === codigo);
    if (!p) return;

    const afAtual = (typeof fechamentoAfTargetAF === 'function') ? fechamentoAfTargetAF() : null;
    if (!afAtual) return alert('Não foi possível determinar o Ano Fiscal atual.');

    const saldo = Number(p.valor_carryover) || 0;
    const fmtSaldo = (typeof formatCurrency === 'function') ? formatCurrency(saldo) : 'R$ ' + saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    if (!confirm(`Absorver "${codigo}" no Ano Fiscal ${afAtual}?\n\nO projeto passará a fazer parte do ${afAtual}, com orçamento de carryover de ${fmtSaldo}.\n\nEssa ação atualiza o Ano Fiscal do projeto e encerra o estado de carryover.`)) return;

    const quem = currentUser ? currentUser.nome : 'desconhecido';
    const afAnterior = p.ano_fiscal;

    const payload = {
        ano_fiscal: afAtual,
        is_carryover: false,
        carryover_ano_origem: afAnterior,
        valor_carryover: null,
        carryover_marcado_por: null,
        carryover_marcado_em: null,
        carryover_etapa_marcacao: null,
        carryover_sub_status_marcacao: null
    };
    if ((p.sub_status || '').toUpperCase() === 'HOLD') {
        // Carryover Hold absorvido: mantém HOLD (continua retomável), só migra o AF.
        // sub_status não é limpo aqui — segue em Hold até retomado explicitamente.
    }

    const { error } = await _supabase.from('projetos').update(payload).eq('codigo', codigo);
    if (error) return alert('Erro ao absorver o projeto: ' + error.message);
    Object.assign(p, payload);

    const { error: errLog } = await _supabase.from('fechamento_af_decisoes').insert([{
        ano_fiscal: afAtual,
        projeto_codigo: codigo,
        decisao: 'ABSORVIDO',
        valor_remanescente: saldo,
        observacao: `Absorvido do ${afAnterior} para o ${afAtual}.`,
        decidido_por: quem
    }]);
    if (errLog) console.error('Absorção aplicada, mas houve erro ao gravar o log:', errLog.message);

    alert(`✅ "${codigo}" absorvido no ${afAtual}.`);
    if (typeof loadProjects === 'function') await loadProjects();
    await renderAbsorcaoCarryoverView();
}
