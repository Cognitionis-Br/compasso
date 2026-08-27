// =========================================================================
// config/prazos.js
// CORRIGIDO 10/08/2026 (G24, Especificacao_Workflow_v4.md): esta tela era
// um segundo sistema de SLA, paralelo e desconectado de sla_etapa_porte
// (a fonte de verdade do motor de workflow genérico). Agora é SÓ
// CONSULTA — lê fasesEtapasData + slaEtapaPorteData (já carregados por
// loadFasesEtapas, em core/workflow-engine.js) e mostra tudo numa tabela
// única. O cadastro/edição de SLA continua só na aba "Fases e Etapas".
//
// A tabela parametros_prazos e a função obterSlaPorte() foram retiradas
// — os 8 pontos do sistema que as usavam foram migrados para
// obterSlaPorNomeEtapa() (definida aqui embaixo), que por baixo já usa
// sla_etapa_porte via obterSlaEtapaPorte() (core/workflow-engine.js).
// =========================================================================

// AJUSTADO 10/08/2026 (G26, consequência do Cadastro de Porte): a lista de
// portes deixou de ser fixa (P/M/G/GG) — agora vem de portesData (ver
// config/portes.js), ordenada por horas mínimo (AJUSTADO 24/08/2026 —
// era valor mínimo, porte passou a ser por horas). Cabeçalho e corpo da
// tabela são gerados juntos, pra sempre baterem com quantos portes
// existirem no momento.
function renderPrazosTable() {
    const thead = document.getElementById('prazosMatrizTableHead');
    const tbody = document.getElementById('prazosMatrizTableBody');
    if (!tbody || !thead) return;

    const portesOrdenados = [...(portesData || [])].sort((a, b) => a.horas_minimo - b.horas_minimo);

    if (portesOrdenados.length === 0) {
        thead.innerHTML = `<th class="p-3">Fase</th><th class="p-3">Etapa</th>`;
        tbody.innerHTML = `<tr><td colspan="2" class="p-4 text-center text-gray-400 font-bold">Nenhum porte cadastrado ainda — vá em "Cadastro de Porte"</td></tr>`;
        return;
    }

    thead.innerHTML = `<th class="p-3">Fase</th><th class="p-3">Etapa</th>` +
        portesOrdenados.map(p => `<th class="p-3 text-center">Porte ${p.codigo}</th>`).join('');

    if (!fasesEtapasData || fasesEtapasData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${2 + portesOrdenados.length}" class="p-4 text-center text-gray-400 font-bold">Nenhuma etapa cadastrada ainda — vá em "Fases e Etapas do Workflow"</td></tr>`;
        return;
    }

    tbody.innerHTML = fasesEtapasData.map(etapa => {
        const cols = portesOrdenados.map(p => {
            const dias = obterSlaEtapaPorte(etapa.id, p.codigo);
            return `<td class="p-3 text-center font-mono font-bold">${dias} d.u.</td>`;
        }).join('');
        return `
            <tr>
                <td class="p-3 text-xs font-bold">${etapa.fase}</td>
                <td class="p-3 text-xs">${etapa.etapa}</td>
                ${cols}
            </tr>
        `;
    }).join('');
}

// Helper central usado pelos 8 pontos do sistema que precisam do SLA de
// uma etapa pelo NOME (mais conveniente que buscar o id toda vez).
// Fallback conservador de 5 dias úteis se a etapa não existir ainda
// (ex.: banco recém-criado, seed ainda não rodado).
function obterSlaPorNomeEtapa(nomeEtapa, porte) {
    const etapa = obterEtapaPorNome(nomeEtapa);
    if (!etapa) {
        console.error(`obterSlaPorNomeEtapa: etapa "${nomeEtapa}" não encontrada em fases_etapas.`);
        return 5;
    }
    return obterSlaEtapaPorte(etapa.id, porte);
}
