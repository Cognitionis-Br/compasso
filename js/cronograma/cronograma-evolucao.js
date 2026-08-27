// =========================================================================
// cronograma/cronograma-evolucao.js
// Cronograma & Evolução — tela consolidada de gestão de prazos e
// evolução, reunindo TODAS as fases numa visão só (não uma etapa por
// vez, como o resto do sistema).
//
// Reaproveita a lógica de "etapa atual dentro da fase" já usada pelo
// motor genérico (obterEtapasDaFase) — não reimplementa, só consolida
// através de todas as fases de uma vez.
//
// AJUSTADO 10/08/2026: inclui tanto "A Planejar" (ainda sem cronograma —
// mostrado sem farol, já que não tem data pra comparar) quanto "Em
// Andamento" (com farol calculado pela mesma regra de sempre —
// calcularAlertaEvolucao).
// =========================================================================

let cronogramaFiltroFase = '';
let cronogramaFiltroResponsavel = '';
let cronogramaFiltroFarol = '';
let cronogramaLinhasCache = [];

async function renderCronogramaEvolucaoView() {
    const { data, error } = await _supabase.from('projeto_etapas').select('*');
    const todasEtapas = error ? [] : (data || []);

    const linhas = [];
    // NOVO (Controle de acesso por atividade, Fase 5): restrição de área.
    filtrarProjetosPorArea(projectsData, 'cronograma_evolucao').forEach(p => {
        const sub = (p.sub_status || '').toUpperCase();
        if (sub === 'CANCELADO' || sub === 'REPROVADO' || sub === 'HOLD') return;
        // NOVO (item 2 — subprojetos/conclusão): projeto já concluído sai
        // do acompanhamento ativo — subprojeto continua aparecendo
        // normalmente aqui (é justamente onde faz sentido acompanhá-lo).
        if (p.projeto_concluido === true) return;

        // Reaproveita a mesma lógica de "achar etapa corrente" usada pelo
        // Dashboard (generic-workflow-ui.js) — evita duas versões da
        // mesma regra que podem ficar dessincronizadas.
        const resultado = obterEtapaCorrenteEProgresso(p, todasEtapas);
        if (!resultado) return;

        linhas.push({ projeto: p, etapa: resultado.etapa, pe: resultado.pe });
    });

    cronogramaLinhasCache = linhas;
    popularFiltrosCronograma(linhas);
    renderCronogramaConteudo();
}

function popularFiltrosCronograma(linhas) {
    const selFase = document.getElementById('cronogramaFiltroFaseSelect');
    if (selFase) {
        const atual = selFase.value;
        const fases = [...new Set(linhas.map(l => l.etapa.fase))].sort();
        selFase.innerHTML = '<option value="">-- Todas --</option>' + fases.map(f => `<option value="${f}" ${f === atual ? 'selected' : ''}>${f}</option>`).join('');
    }
    const selResp = document.getElementById('cronogramaFiltroResponsavelSelect');
    if (selResp) {
        const atual = selResp.value;
        const responsaveis = [...new Set(linhas.map(l => l.pe && l.pe.responsavel_etapa_nome).filter(Boolean))].sort();
        selResp.innerHTML = '<option value="">-- Todos --</option>' + responsaveis.map(r => `<option value="${escapeHtml(r)}" ${r === atual ? 'selected' : ''}>${escapeHtml(r)}</option>`).join('');
    }
}

function onFiltroCronogramaChange() {
    cronogramaFiltroFase = (document.getElementById('cronogramaFiltroFaseSelect') || {}).value || '';
    cronogramaFiltroResponsavel = (document.getElementById('cronogramaFiltroResponsavelSelect') || {}).value || '';
    cronogramaFiltroFarol = (document.getElementById('cronogramaFiltroFarolSelect') || {}).value || '';
    renderCronogramaConteudo();
}

function renderCronogramaConteudo() {
    const linhasFiltradas = cronogramaLinhasCache.filter(l => {
        if (cronogramaFiltroFase && l.etapa.fase !== cronogramaFiltroFase) return false;
        if (cronogramaFiltroResponsavel && (!l.pe || l.pe.responsavel_etapa_nome !== cronogramaFiltroResponsavel)) return false;
        return true;
    });

    // Os totais do farol (topo da tela) refletem fase/responsável, mas
    // NÃO o próprio filtro de farol — assim dá pra ver o panorama geral
    // enquanto se olha só uma fatia (ex.: só os críticos) na lista.
    let noPrazo = 0, atencao = 0, critico = 0, aPlanejarQtd = 0;
    const linhasComFarol = linhasFiltradas.map(l => {
        if (!l.pe || l.pe.situacao === 'PLANEJAMENTO_A_INICIAR') {
            aPlanejarQtd++;
            return { ...l, farolNivel: null };
        }
        const alerta = calcularAlertaEvolucao(l.pe);
        const nivel = alerta ? alerta.nivel : 'ok';
        if (nivel === 'vermelho') critico++;
        else if (nivel === 'amarelo') atencao++;
        else noPrazo++;
        return { ...l, farolNivel: nivel, farolAlerta: alerta };
    });

    const elNoPrazo = document.getElementById('cronogramaFarolNoPrazo');
    if (elNoPrazo) elNoPrazo.innerText = noPrazo;
    const elAtencao = document.getElementById('cronogramaFarolAtencao');
    if (elAtencao) elAtencao.innerText = atencao;
    const elCritico = document.getElementById('cronogramaFarolCritico');
    if (elCritico) elCritico.innerText = critico;
    const elAPlanejar = document.getElementById('cronogramaFarolAPlanejar');
    if (elAPlanejar) elAPlanejar.innerText = aPlanejarQtd;

    // NOVO (item 4 do relatório de testes): filtro por situação do
    // farol, aplicado só na LISTA (os totais acima continuam mostrando
    // o panorama geral) — 'aplanejar' corresponde a farolNivel === null.
    const linhasParaExibir = cronogramaFiltroFarol
        ? linhasComFarol.filter(l => (cronogramaFiltroFarol === 'aplanejar' ? l.farolNivel === null : l.farolNivel === cronogramaFiltroFarol))
        : linhasComFarol;

    const tbody = document.getElementById('cronogramaTableBody');
    if (!tbody) return;

    if (linhasParaExibir.length === 0) {
        const msgVazia = 'Nenhum projeto encontrado com esses filtros';
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-400 font-bold">${msgVazia}</td></tr>`;
        const cardsVazio = document.getElementById('cronogramaCardsBody');
        if (cardsVazio) cardsVazio.innerHTML = `<div class="p-4 text-center text-gray-400 font-bold text-sm">${msgVazia}</div>`;
    } else {
        let linhasTabela = '';
        let cartoes = '';

        linhasParaExibir.forEach(l => {
            const p = l.projeto, pe = l.pe;
            const farolHtml = l.farolNivel === null
                ? '<span class="bg-gray-100 text-gray-500 font-bold px-2 py-0.5 rounded text-[10px]">A PLANEJAR</span>'
                : l.farolNivel === 'vermelho'
                    ? '<span class="bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded text-[10px]">🔴 CRÍTICO</span>'
                    : l.farolNivel === 'amarelo'
                        ? '<span class="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[10px]">🟡 ATENÇÃO</span>'
                        : '<span class="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px]">🟢 NO PRAZO</span>';
            const previstoRealizado = pe && pe.situacao === 'EXECUCAO_EM_ANDAMENTO'
                ? `${l.farolAlerta ? l.farolAlerta.percentualPrevisto + '%' : '-'} x ${pe.percentual_evolucao || 0}%`
                : '-';
            const periodo = pe ? `${pe.data_inicio_planejamento || '-'} a ${pe.data_termino_planejamento || '-'}` : '-';
            const responsavel = pe ? (pe.responsavel_etapa_nome || '-') : '-';

            linhasTabela += `
                <tr>
                    <td class="p-3 font-mono font-bold text-gray-700">${p.codigo}</td>
                    <td class="p-3 font-semibold">${escapeHtml(p.nome)}</td>
                    <td class="p-3 text-xs font-bold">${l.etapa.etapa}</td>
                    <td class="p-3 text-xs uppercase">${escapeHtml(responsavel)}</td>
                    <td class="p-3 text-xs">${periodo}</td>
                    <td class="p-3 text-xs text-center font-mono">${previstoRealizado}</td>
                    <td class="p-3 text-center">${farolHtml}</td>
                </tr>
            `;

            cartoes += `
                <div class="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
                    <div class="flex justify-between items-start mb-2">
                        <span class="text-gray-700 font-bold text-sm">${p.codigo}</span>
                        ${farolHtml}
                    </div>
                    <div class="font-semibold text-sm text-gray-800 mb-1">${escapeHtml(p.nome)}</div>
                    <div class="text-xs text-gray-500 mb-2">${l.etapa.etapa}</div>
                    <div class="grid grid-cols-2 gap-2 text-xs text-gray-600 border-t pt-2">
                        <div><span class="text-gray-400 block">Responsável</span><b class="uppercase">${escapeHtml(responsavel)}</b></div>
                        <div><span class="text-gray-400 block">Previsto x Real</span><b class="font-mono">${previstoRealizado}</b></div>
                        <div class="col-span-2"><span class="text-gray-400 block">Período</span><b>${periodo}</b></div>
                    </div>
                </div>
            `;
        });

        tbody.innerHTML = linhasTabela;
        const cardsBody = document.getElementById('cronogramaCardsBody');
        if (cardsBody) cardsBody.innerHTML = cartoes;
    }

    renderResponsaveisSemAtualizacao(linhasFiltradas);
}

function renderResponsaveisSemAtualizacao(linhas) {
    const container = document.getElementById('cronogramaSemAtualizacaoBody');
    const cardsContainer = document.getElementById('cronogramaSemAtualizacaoCardsBody');
    if (!container) return;

    const LIMITE_DIAS = 3;
    const agora = new Date();
    const pendentes = linhas.filter(l => {
        if (!l.pe || l.pe.situacao !== 'EXECUCAO_EM_ANDAMENTO' || !l.pe.evolucao_atualizada_em) return false;
        const diffDias = (agora - new Date(l.pe.evolucao_atualizada_em)) / (1000 * 60 * 60 * 24);
        return diffDias > LIMITE_DIAS;
    });

    if (pendentes.length === 0) {
        const msgVazia = `Nenhum responsável com evolução parada há mais de ${LIMITE_DIAS} dias`;
        container.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-400 font-bold">${msgVazia}</td></tr>`;
        if (cardsContainer) cardsContainer.innerHTML = `<div class="p-4 text-center text-gray-400 font-bold text-sm">${msgVazia}</div>`;
        return;
    }

    const porResponsavel = {};
    pendentes.forEach(l => {
        const resp = l.pe.responsavel_etapa_nome || '(sem responsável)';
        if (!porResponsavel[resp]) porResponsavel[resp] = [];
        porResponsavel[resp].push(l);
    });

    const linhasHtml = [];
    const cartoesHtml = [];

    Object.keys(porResponsavel).sort().forEach(resp => {
        porResponsavel[resp].forEach(l => {
            const diasParado = Math.floor((agora - new Date(l.pe.evolucao_atualizada_em)) / (1000 * 60 * 60 * 24));

            linhasHtml.push(`
                <tr>
                    <td class="p-3 text-xs uppercase font-bold">${escapeHtml(resp)}</td>
                    <td class="p-3 font-mono font-bold text-gray-700">${l.projeto.codigo}</td>
                    <td class="p-3 text-xs">${l.etapa.etapa}</td>
                    <td class="p-3 text-center font-bold text-red-700">${diasParado} dias</td>
                </tr>
            `);

            cartoesHtml.push(`
                <div class="bg-white border border-gray-200 border-l-4 border-l-red-500 rounded-lg p-3 shadow-sm">
                    <div class="flex justify-between items-start mb-1">
                        <span class="font-mono font-bold text-gray-700 text-sm">${l.projeto.codigo}</span>
                        <span class="text-red-700 font-bold text-xs">${diasParado} dias parado</span>
                    </div>
                    <div class="text-xs text-gray-600"><span class="text-gray-400">Responsável:</span> <b class="uppercase">${escapeHtml(resp)}</b></div>
                    <div class="text-xs text-gray-600"><span class="text-gray-400">Etapa:</span> <b>${l.etapa.etapa}</b></div>
                </div>
            `);
        });
    });

    container.innerHTML = linhasHtml.join('');
    if (cardsContainer) cardsContainer.innerHTML = cartoesHtml.join('');
}
