// =========================================================================
// projects/orcamento.js
// Tela de Orçamento Inicial do Business Case — MIGRADA 10/08/2026 pro
// motor de workflow genérico (Especificacao_Workflow_v4.md, seção 13/5.1
// — G5): agora usa planejamento com data/responsável + % de evolução com
// alerta previsto/realizado, com a definição de orçamento (classificação
// financeira, valor, porte) acontecendo na conclusão (100%) do modal de
// evolução — etapa "REALIZAR ORÇAMENTO" com requer_definicao_orcamento
// marcado como true.
//
// Elegibilidade: etapa_atual = 'BUSINESS CASE' E sub_status = 'A PLANEJAR'
// (ver correção detalhada logo abaixo, junto de renderF1OrcamentoView).
// (mesmo critério de antes — usa renderListaPlanejamentoEvolucao em vez
// de renderFaseGenericaView porque etapa_atual sozinho não seria
// suficiente pra filtrar, já que Business Case cobre várias sub-etapas
// com o mesmo etapa_atual).
//
// O formulário antigo (panelFormOrcamentoInicial, prepararFormOrcamento,
// saveOrcamentoBC) foi removido — a captura agora acontece no modal
// genérico de evolução. A tela de Comitê (approvals/comite.js) não
// mudou: continua lendo projetos.sub_status/val_bc/tipo_orcamento
// diretamente, e o motor genérico já grava esses campos na conclusão.
// =========================================================================

// Elegibilidade: etapa_atual = 'BUSINESS CASE' E sub_status = 'A PLANEJAR'
// (estado logo após a Formalização — CORRIGIDO 10/08/2026: a tela
// "Planejar Análise" foi retirada do fluxo por duplicar o que esta etapa
// já faz sozinha; antes esperava sub_status = 'PLANEJADO', que só a tela
// antiga produzia, deixando todo projeto novo travado sem aparecer aqui).
// NOVO: alterna entre as 3 abas de Orçamentar Demanda (A Planejar / Em
// Andamento / Concluídas) — proposição V2, mesmo padrão de Formalizar
// Demanda, e base a ser reaproveitada em Requerimentos.
function mudarAbaOrcamentarDemanda(aba) {
    ['a_planejar', 'em_andamento', 'concluidas'].forEach(a => {
        const btn = document.getElementById(`orcDemandaBtn-${a}`);
        const painel = document.getElementById(`orcDemandaPainel-${a}`);
        if (btn) btn.className = `orc-demanda-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    aplicarVisibilidadeSubAbas('f1_orcamento', 'orcDemandaBtn');
}

async function renderF1OrcamentoView() {
    // CORRIGIDO 10/08/2026 (bug reportado): desde que "Realizar Orçamento"
    // passou a marcar sub_status='PLANEJADO' assim que o planejamento
    // começa (pra sumir de "Formalizar Demanda"), esse filtro de
    // elegibilidade não reconhecia o novo valor — o projeto sumia da
    // tela inteira (Aguardando E Em Andamento), não só de "Aguardando".
    const elegiveis = projectsData.filter(p => p.etapa_atual === 'BUSINESS CASE' && (p.sub_status === 'A PLANEJAR' || p.sub_status === 'PLANEJADO'));
    await renderListaPlanejamentoEvolucao(elegiveis, 'REALIZAR ORÇAMENTO', 'f1AguardandoOrcTableBody', 'f1OrcEmAndamentoTableBody', renderF1OrcamentoView, false, 'f1_orcamento');
    renderF1OrcamentoConcluidoView();
}

function renderF1OrcamentoConcluidoView() {
    const orcados = projectsData.filter(p => p.sub_status === 'ORÇAMENTO REALIZADO');
    const tbodyConcluido = document.getElementById('f1OrcConcluidoTableBody');
    if (!tbodyConcluido) return;

    if (orcados.length === 0) {
        tbodyConcluido.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 font-bold">Nenhum orçamento concluído nesta etapa</td></tr>`;
        return;
    }

    tbodyConcluido.innerHTML = orcados.map(p => `
        <tr>
            <td class="p-3 font-mono font-bold text-green-800">${p.codigo}</td>
            <td class="p-3 font-semibold">${escapeHtml(p.nome)}</td>
            <td class="p-3 text-xs font-bold text-blue-900">${p.tipo_orcamento || 'CAPEX'}</td>
            <td class="p-3 font-mono font-bold text-right text-green-700">R$ ${(Number(p.val_bc)||Number(p.previsto)||0).toLocaleString('pt-BR',{minimumFractionDigits:2})}</td>
            <td class="p-3 text-xs"><span class="bg-green-100 text-green-800 font-bold px-2 py-1 rounded">ORÇAMENTO REALIZADO</span></td>
        </tr>
    `).join('');
}
