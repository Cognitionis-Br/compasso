// =========================================================================
// phases/stubs.js
// Telas ainda não implementadas — funções vazias, mantidas apenas para
// switchTab (js/ui/navigation.js) não quebrar ao tentar chamá-las.
//
// Ver GAPS_FUNCIONAIS.md (registrado em 10/08/2026) para o acompanhamento
// desse trabalho funcional futuro. Quando cada uma for implementada de
// verdade, sai daqui e vira seu próprio módulo dedicado (ex.:
// js/execution/, js/uat/, js/golive/, js/carryover/, js/users/).
//
// NOTA: renderTechView saiu daqui em 10/08/2026 — Technical ganhou lógica
// própria (fase com 2 etapas + revisão de orçamento), agora em
// js/technical/technical.js. renderUsuariosView também saiu — Cadastro
// de Usuários ganhou lógica própria, agora em js/users/usuarios.js.
// renderCarryOverView também saiu — Carry Over ganhou lógica própria,
// agora em js/carryover/carryover.js.
// =========================================================================

// NOVO: alterna entre as 3 abas de Execution (item 10, relatório de
// melhorias).
function mudarAbaExecution(aba) {
    ['a_planejar', 'em_andamento', 'subprojetos'].forEach(a => {
        const btn = document.getElementById(`execBtn-${a}`);
        const painel = document.getElementById(`execPainel-${a}`);
        if (btn) btn.className = `exec-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    aplicarVisibilidadeSubAbas('fase_execution', 'execBtn');
}

async function renderExecutionView() {
    await renderFaseGenericaView('EXECUTION', 'EXECUTAR (EXECUTION)', 'execAPlanejarTableBody', 'execExecucaoTableBody', renderExecutionView, false, 'fase_execution');
    await renderSubprojetosSection(); // item 2: lista/cria subprojetos vinculados a projetos em Execution
}

// NOVO (a pedido do usuário 25/08/2026 — padronização/segregação de
// atividades): UAT ganha 2 sub-abas — "Retificar/Ratificar Planejamento"
// (renderListaRatificarPlanejamento, generic-workflow-ui.js) separada de
// "Projetos em Andamento" (o puro registro de evolução, sem o botão de
// ratificar embutido — ver exigeRatificacao=true em
// renderListaPlanejamentoEvolucao). Mesmo padrão V2 de mudarAbaExecution.
function mudarAbaUAT(aba) {
    ['ratificar', 'em_andamento'].forEach(a => {
        const btn = document.getElementById(`uatBtn-${a}`);
        const painel = document.getElementById(`uatPainel-${a}`);
        if (btn) btn.className = `uat-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    aplicarVisibilidadeSubAbas('fase_uat', 'uatBtn');
}

async function renderUatView() {
    // NOVO (a pedido do usuário 25/08/2026): UAT recebe plano herdado de
    // "Planejar Execução" — exigeRatificacao=true faz "Projetos em
    // Andamento" não desenhar mais o botão de ratificar (ele virou a sua
    // própria aba abaixo).
    await renderFaseGenericaView('UAT', 'EXECUTAR (UAT)', null, 'uatExecucaoTableBody', renderUatView, true, 'fase_uat');
    await renderListaRatificarPlanejamento('EXECUTAR (UAT)', 'uatRatificarTableBody', 'fase_uat:ratificar');
}

// NOVO (a pedido do usuário 25/08/2026): Go-Live ganha 4 sub-abas — as 2
// de UAT (mesmo motivo) + "Gestão de Ocorrências" e "Termo de Aceite",
// que antes eram botões embutidos na lista de Execução e agora viram
// telas de listagem próprias (mesmos modais de sempre, só muda o ponto
// de entrada — ver js/golive/golive-ocorrencias.js e golive-termo-aceite.js).
function mudarAbaGoLive(aba) {
    ['ratificar', 'em_andamento', 'ocorrencias', 'termo_aceite'].forEach(a => {
        const btn = document.getElementById(`goliveBtn-${a}`);
        const painel = document.getElementById(`golivePainel-${a}`);
        if (btn) btn.className = `golive-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    aplicarVisibilidadeSubAbas('fase_golive', 'goliveBtn');
}

async function renderGoliveView() {
    // CORRIGIDO 10/08/2026 (bug reportado: projeto não aparecia após
    // concluir UAT): fases_etapas.fase para esta fase é 'GOLIVE' (sem
    // espaço) — é esse valor que o avanço automático de fase grava em
    // projeto.etapa_atual. O filtro aqui procurava 'GO LIVE' (com
    // espaço), nunca batendo.
    await renderFaseGenericaView('GOLIVE', 'EXECUTAR (GO-LIVE)', null, 'goliveExecucaoTableBody', renderGoliveView, true, 'fase_golive');
    await renderListaRatificarPlanejamento('EXECUTAR (GO-LIVE)', 'goliveRatificarTableBody', 'fase_golive:ratificar');
    await renderListaGoliveOcorrencias('goliveOcorrenciasListaGeralTableBody');
    await renderListaGoliveTermoAceite('goliveTermoAceiteListaTableBody');
}
