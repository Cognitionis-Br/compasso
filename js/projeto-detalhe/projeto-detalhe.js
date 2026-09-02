// =========================================================================
// projeto-detalhe/projeto-detalhe.js
// Tela de Detalhamento do Projeto (item 9 do relatório de testes) —
// acessada por link a partir da lista detalhada do Dashboard. Não é uma
// aba do menu principal, só um "drill-down".
//
// Mostra: dados gerais, os 4 valores de orçamento (BC/Req/Tech/
// Utilizado), a linha do tempo completa de cada etapa (datas, quem
// executou, % evolução, decisão quando houver), contrato de execução
// quando aplicável, histórico de reprovação quando houver, e — se o
// projeto nasceu Extraordinário — o detalhamento completo do trade-off que
// liberou orçamento pra ele (via adhoc_aprovacoes).
// =========================================================================

// NOVO (a pedido do usuário 25/08/2026): a tela de Detalhamento é acessada
// tanto do Dashboard quanto de Consultas (js/consultas/consulta-projetos.js)
// — o botão "Voltar" precisa levar de volta pra tela de onde o usuário
// veio, não sempre pro Dashboard.
let projetoDetalheOrigemTab = 'dashboard';
const PROJETO_DETALHE_ORIGENS = {
    dashboard: { tab: 'dashboard', texto: 'Voltar ao Dashboard' },
    consultas: { tab: 'consultas', texto: 'Voltar às Consultas' },
    // NOVO (Mudança de Orçamento, 27/08/2026): zoom reaproveitado a partir
    // da lista de projetos bloqueados (js/governanca/mudanca-orcamento.js).
    mudanca_orcamento: { tab: 'mudanca_orcamento', texto: 'Voltar à Mudança de Orçamento' },
    // NOVO (Fechamento de Ano Fiscal, 2026-09-02): zoom a partir da tela de
    // Fechamento Ano Fiscal (js/ano-fiscal/fechamento-projetos.js).
    fechamento_af: { tab: 'fechamento_af', texto: 'Voltar ao Fechamento Ano Fiscal' }
};

// NOVO (a pedido do usuário): linha "RÓTULO : valor" com rótulo em
// maiúsculas e largura fixa, para o cabeçalho do detalhamento ficar
// alinhado (efeito de "dois-pontos alinhados" do mock enviado).
function linhaDetalhe(rotulo, valor) {
    return `<div class="flex gap-2">
        <span class="font-bold text-blue-700 uppercase text-[11px] w-44 shrink-0">${rotulo}</span>
        <span class="text-[12px] text-gray-800 break-words min-w-0">${valor}</span>
    </div>`;
}

async function abrirDetalheProjeto(codigo, origem) {
    projetoDetalheOrigemTab = PROJETO_DETALHE_ORIGENS[origem] ? origem : 'dashboard';
    switchTab('projeto_detalhe');
    const textoEl = document.getElementById('btnVoltarDetalheProjetoTexto');
    if (textoEl) textoEl.innerText = PROJETO_DETALHE_ORIGENS[projetoDetalheOrigemTab].texto;
    await renderDetalheProjeto(codigo);
}

function voltarDoDetalheProjeto() {
    switchTab(PROJETO_DETALHE_ORIGENS[projetoDetalheOrigemTab].tab);
}

async function renderDetalheProjeto(codigo) {
    const container = document.getElementById('projetoDetalheConteudo');
    if (!container) return;
    container.innerHTML = `<div class="p-8 text-center text-gray-400 font-bold">Carregando...</div>`;

    const p = projectsData.find(x => x.codigo === codigo);
    if (!p) {
        container.innerHTML = `<div class="p-8 text-center text-red-500 font-bold">Projeto ${codigo} não encontrado.</div>`;
        return;
    }

    const { data: etapasData } = await _supabase.from('projeto_etapas').select('*').eq('projeto_codigo', codigo);
    const etapasDoProjeto = (etapasData || []).map(pe => {
        const etapaInfo = fasesEtapasData.find(e => e.id === pe.etapa_id);
        return { ...pe, faseNome: etapaInfo ? etapaInfo.fase : '-', etapaNome: etapaInfo ? etapaInfo.etapa : `(etapa #${pe.etapa_id})`, ordem: etapaInfo ? etapaInfo.ordem : 999 };
    }).sort((a, b) => a.ordem - b.ordem);

    let tradeoffInfo = null;
    if (p.is_adhoc) {
        const { data: adhocData } = await _supabase.from('adhoc_aprovacoes').select('*').eq('projeto_adhoc_codigo', codigo).order('aprovado_em', { ascending: false });
        tradeoffInfo = adhocData || [];
    }

    // NOVO (a pedido do usuário 24/08/2026, regras 2 e 3): histórico de
    // vezes que ESTE projeto entrou como DOADOR em alguma rodada de
    // trade-off (HOLD, CANCELAR ou CEDER_PARTE) — diferente do bloco
    // acima, que só olha quando o projeto foi o RECEPTOR (Extraordinário).
    // `projetos_afetados` é JSONB sem filtro nativo simples via REST
    // aqui, então busca tudo (tabela pequena) e filtra em JS — mesmo
    // padrão já usado nesta função pra `tradeoffInfo`.
    const { data: todasAprovacoesAdhoc } = await _supabase.from('adhoc_aprovacoes').select('*').order('aprovado_em', { ascending: false });
    const historicoComoDoador = (todasAprovacoesAdhoc || [])
        .flatMap(round => (round.projetos_afetados || [])
            .filter(pa => pa.codigo === codigo)
            .map(pa => ({ ...pa, aprovado_por: round.aprovado_por, aprovado_em: round.aprovado_em, projeto_adhoc_codigo: round.projeto_adhoc_codigo })));

    // NOVO (a pedido do usuário 24/08/2026): histórico de retomadas de
    // HOLD (tela "Retomar Projetos em Hold", js/adhoc/retomar-hold.js).
    const { data: historicoRetomadaData } = await _supabase.from('log_retomada_hold').select('*').eq('projeto_codigo', codigo).order('retomado_em', { ascending: false });
    const historicoRetomadaHold = historicoRetomadaData || [];

    // NOVO (item 9-b, novos ajustes): busca os lookups de Tipo de
    // Projeto, Pilar e Iniciativa Estratégica (o projeto só guarda o ID).
    let tipoProjetoTexto = '-', pilarTexto = '-', iniciativaTexto = '-';
    if (p.tipo_projeto_id) {
        const { data: tp } = await _supabase.from('tipos_projeto').select('*').eq('id', p.tipo_projeto_id).maybeSingle();
        if (tp) tipoProjetoTexto = `${tp.codigo} - ${tp.descricao}`;
    }
    if (p.pilar_estrategico_id) {
        const { data: pilar } = await _supabase.from('pilares_estrategicos').select('*').eq('id', p.pilar_estrategico_id).maybeSingle();
        if (pilar) pilarTexto = pilar.nome;
    }
    if (p.iniciativa_estrategica_id) {
        const { data: ini } = await _supabase.from('iniciativas_estrategicas').select('*').eq('id', p.iniciativa_estrategica_id).maybeSingle();
        if (ini) iniciativaTexto = ini.nome;
    }
    // NOVO (a pedido do usuário): Produto passa a ser exibido no cabeçalho
    // do detalhamento — o projeto só guarda produto_id.
    let produtoTexto = '-';
    if (p.produto_id) {
        const { data: prod } = await _supabase.from('produtos').select('codigo, nome').eq('id', p.produto_id).maybeSingle();
        if (prod) produtoTexto = prod.nome || prod.codigo || '-';
    }

    // NOVO (Key Results / Benefit Results): busca as linhas do quadro de
    // Benefit Results da demanda (Tabela 1: js/tipos-projeto/return-benefit.js)
    // pra exibir logo após a linha de Pilar/Iniciativa Estratégica.
    const { data: beneficiosData } = await _supabase.from('projeto_benefit_results').select('*, tipos_return_benefit(nome)').eq('projeto_codigo', codigo);
    const beneficiosDoProjeto = beneficiosData || [];

    const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    const valBc = Number(p.val_bc) || Number(p.previsto) || 0;
    const valReq = Number(p.val_req) || 0;
    const valTech = Number(p.val_tech) || 0;
    const valUtilizado = Number(p.realizado) || 0;
    // NOVO (a pedido do usuário 24/08/2026): mesmo padrão BC/Req/Tech já
    // usado pra valor de orçamento, agora também pra horas.
    const horasBc = Number(p.horas_bc) || 0;
    const horasReq = Number(p.horas_req) || 0;
    const horasTech = Number(p.horas_tech) || 0;

    const { data: logHorasData } = await _supabase.from('log_alteracoes_horas').select('*').eq('projeto_codigo', codigo).order('alterado_em');
    const historicoHoras = logHorasData || [];

    // NOVO (a pedido do usuário 25/08/2026): histórico de Ratificação/
    // Retificação do planejamento herdado de UAT/Go-Live (ver
    // js/phases/generic-workflow-ui.js, confirmarPlanejamentoGenerico).
    const { data: logRatifData } = await _supabase.from('log_ratificacao_planejamento').select('*').eq('projeto_codigo', codigo).order('decidido_em', { ascending: false });
    const historicoRatificacao = logRatifData || [];

    // NOVO (a pedido do usuário 25/08/2026): histórico de Ocorrências de
    // Erro do Go-Live (com solução, quando houver) e o Termo de Aceite —
    // ver js/golive/golive-ocorrencias.js e js/golive/golive-termo-aceite.js.
    const { data: ocorrenciasGoliveData } = await _supabase.from('golive_ocorrencias').select('*').eq('projeto_codigo', codigo).order('registrado_em', { ascending: true });
    const historicoOcorrenciasGolive = ocorrenciasGoliveData || [];
    const { data: termoAceiteGoliveData } = await _supabase.from('golive_termo_aceite').select('*').eq('projeto_codigo', codigo).maybeSingle();

    // NOVO (a pedido do usuário 25/08/2026 — Fase 3): vínculos de Contrato
    // por Projeto (js/contratos/contratos-vinculos.js) e o histórico de
    // alterações desses vínculos.
    const { data: vinculosContratoData } = await _supabase.from('contratos_vinculos_projeto').select('*').eq('projeto_codigo', codigo);
    const vinculosContratoDoProjeto = vinculosContratoData || [];
    let empresasParaVinculos = [], contratosParaVinculos = [];
    if (vinculosContratoDoProjeto.length > 0) {
        const { data: contratosData } = await _supabase.from('contratos_projeto').select('*').in('id', vinculosContratoDoProjeto.map(v => v.contrato_id));
        contratosParaVinculos = contratosData || [];
        const { data: empresasData } = await _supabase.from('empresas_terceirizadas').select('*');
        empresasParaVinculos = empresasData || [];
    }
    const { data: logVinculosData } = await _supabase.from('log_alteracao_vinculo_contrato').select('*').eq('projeto_codigo', codigo).order('alterado_em', { ascending: false });
    const historicoVinculosContrato = logVinculosData || [];

    // NOVO (a pedido do usuário 27/08/2026): histórico completo de
    // aprovações de mudança de orçamento (js/governanca/mudanca-orcamento.js).
    const { data: logMudancaOrcamentoData } = await _supabase.from('log_aprovacao_mudanca_orcamento').select('*').eq('projeto_codigo', codigo).order('aprovado_em', { ascending: false });
    const historicoMudancaOrcamento = logMudancaOrcamentoData || [];

    // NOVO (Fechamento de Ano Fiscal, 2026-09-02): decisões de fechamento
    // registradas para este projeto (js/ano-fiscal/fechamento-projetos.js).
    const { data: logDecisoesFechamentoData } = await _supabase.from('fechamento_af_decisoes').select('*').eq('projeto_codigo', codigo).order('decidido_em', { ascending: false });
    const historicoDecisoesFechamento = logDecisoesFechamentoData || [];

    container.innerHTML = `
        ${p.bloqueado_mudanca_orcamento ? renderSecaoMudancaOrcamentoDetalhe(p) : ''}
        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
            <div class="flex justify-between items-start mb-4 border-b pb-4 gap-4">
                <div class="flex-1 min-w-0 text-[12px] leading-relaxed">
                    <div class="text-[11px] font-bold text-blue-700 uppercase">Ano Fiscal: <span class="text-gray-800">${p.ano_fiscal || '-'}</span></div>
                    <div class="flex flex-wrap items-center gap-2 mt-0.5">
                        <span class="font-mono font-bold text-red-700 text-lg">${p.codigo}</span>
                        <span class="text-lg font-bold text-gray-800 truncate">${escapeHtml(p.nome)}</span>
                        ${p.is_adhoc ? '<span class="bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Extraordinário</span>' : ''}
                        ${p.is_carryover ? '<span class="bg-orange-100 text-orange-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Carryover</span>' : ''}
                        ${p.qtd_reprovacoes > 0 ? `<span class="bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">${p.qtd_reprovacoes}x Reprovado</span>` : ''}
                        ${p.bloqueado_mudanca_orcamento ? `<span class="bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase"><i class="fa-solid fa-triangle-exclamation"></i> Mudança de Orçamento</span>` : ''}
                    </div>
                    <div class="text-[11px] font-bold text-blue-700 uppercase mt-0.5">Formalizado em: <span class="text-gray-800">${p.data_solicitacao || '-'}</span></div>
                    ${linhaDetalhe('Objetivo', escapeHtml(p.objetivo) || '-')}

                    <hr class="my-2 border-gray-200">
                    ${linhaDetalhe('Produto', escapeHtml(produtoTexto))}
                    ${linhaDetalhe('Área Solicitante', p.area || '-')}
                    ${linhaDetalhe('Solicitante', escapeHtml(p.pessoa_solicitante) || '-')}
                    ${linhaDetalhe('Pilar Estratégico', escapeHtml(pilarTexto))}
                    ${linhaDetalhe('Iniciativa Estratégica', escapeHtml(iniciativaTexto))}

                    <hr class="my-2 border-gray-200">
                    <div class="flex flex-wrap gap-x-8">
                        ${linhaDetalhe('Porte', `${p.tamanho || '-'} (${horasAtuaisDoProjeto(p)}h)`)}
                        ${linhaDetalhe('Qualificação', (p.tipo_qualificacao || '-').toUpperCase())}
                    </div>
                    ${linhaDetalhe('Tipo de Projeto', escapeHtml(tipoProjetoTexto))}

                    <hr class="my-2 border-gray-200">
                    ${linhaDetalhe('Key Results', escapeHtml(p.key_results) || '-')}
                    <div class="mt-1 text-[11px] font-bold text-blue-700 uppercase">Benefícios / Resultados:</div>
                    <div class="text-[12px] text-gray-800 pl-1">
                        ${beneficiosDoProjeto.length === 0
                            ? '<span class="italic text-gray-400">Nenhum benefício cadastrado</span>'
                            : beneficiosDoProjeto.map(b => `
                                <div>${(escapeHtml((b.tipos_return_benefit || {}).nome) || '-').toUpperCase()}${b.metrica ? ` — ${escapeHtml(b.metrica)}: R$ ${Number(b.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}</div>
                            `).join('')}
                    </div>
                    ${p.descricao_projeto ? `
                    <div class="mt-2 text-[11px] font-bold text-blue-700 uppercase">Descrição do Projeto:</div>
                    <div class="text-[12px] text-gray-700 whitespace-pre-line bg-gray-50 rounded p-2 mt-0.5 max-w-2xl">${escapeHtml(p.descricao_projeto)}</div>` : ''}
                </div>
                <div class="text-right shrink-0">
                    <span class="text-[10px] font-bold text-gray-400 uppercase block">Fase / Status</span>
                    <span class="text-sm font-bold text-gray-800">${p.etapa_atual || 'BUSINESS CASE'}</span>
                    <span class="text-xs text-gray-500 block">${p.sub_status || '-'}</span>
                </div>
            </div>

            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
                <div class="bg-gray-50 rounded p-3"><span class="text-[10px] font-bold text-gray-500 uppercase block">Orçamento Original (BC)</span><span class="text-sm font-bold text-gray-800">${fmt(valBc)}</span></div>
                <div class="bg-purple-50 rounded p-3"><span class="text-[10px] font-bold text-purple-600 uppercase block">Orçamento Requerimentos</span><span class="text-sm font-bold text-purple-800">${valReq > 0 ? fmt(valReq) : '-'}</span></div>
                <div class="bg-blue-50 rounded p-3"><span class="text-[10px] font-bold text-blue-600 uppercase block">Orçamento Technical</span><span class="text-sm font-bold text-blue-800">${valTech > 0 ? fmt(valTech) : '-'}</span></div>
                <div class="bg-red-50 rounded p-3"><span class="text-[10px] font-bold text-red-600 uppercase block">Orçamento Utilizado</span><span class="text-sm font-bold text-red-800">${fmt(valUtilizado)}</span></div>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div class="bg-gray-50 rounded p-3"><span class="text-[10px] font-bold text-gray-500 uppercase block">Horas (BC)</span><span class="text-sm font-bold text-gray-800">${horasBc > 0 ? horasBc + 'h' : '-'}</span></div>
                <div class="bg-purple-50 rounded p-3"><span class="text-[10px] font-bold text-purple-600 uppercase block">Horas Requerimentos</span><span class="text-sm font-bold text-purple-800">${horasReq > 0 ? horasReq + 'h' : '-'}</span></div>
                <div class="bg-blue-50 rounded p-3"><span class="text-[10px] font-bold text-blue-600 uppercase block">Horas Technical</span><span class="text-sm font-bold text-blue-800">${horasTech > 0 ? horasTech + 'h' : '-'}</span></div>
            </div>
        </div>

        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
            <h3 class="text-sm font-bold text-gray-800 mb-3 uppercase tracking-wider">Linha do Tempo das Etapas</h3>
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-sm">
                    <thead><tr class="bg-gray-50 text-xs uppercase border-b">
                        <th class="p-3">Fase</th><th class="p-3">Etapa</th><th class="p-3">Responsável</th>
                        <th class="p-3">Período</th><th class="p-3 text-center">% Evolução</th>
                        <th class="p-3">Concluído Por</th><th class="p-3">Concluído Em</th><th class="p-3">Decisão</th>
                    </tr></thead>
                    <tbody>
                        ${etapasDoProjeto.length === 0
                            ? `<tr><td colspan="8" class="p-4 text-center text-gray-400 font-bold">Nenhuma etapa iniciada ainda</td></tr>`
                            : etapasDoProjeto.map(pe => {
                                // NOVO (item 9-c, novos ajustes): "Aprovar
                                // Orçamento por Projeto" não grava a decisão em
                                // projeto_etapas — é uma decisão de comitê,
                                // gravada direto no projeto (status_comite,
                                // aprovador_nome/dt_aprovacao ou
                                // resp_reprovacao/dt_reprovacao). Usa isso como
                                // fallback só pra essa etapa específica, quando
                                // a linha de projeto_etapas não tem a decisão.
                                const ehAprovOrcamentoProjeto = pe.etapaNome === 'APROVAR ORÇAMENTO POR PROJETO';
                                let decisaoTexto = pe.decisao_resultado;
                                let concluidoPor = pe.concluido_por, concluidoEm = pe.concluido_em;
                                if (ehAprovOrcamentoProjeto && !decisaoTexto && p.status_comite) {
                                    decisaoTexto = p.status_comite;
                                    concluidoPor = concluidoPor || (p.status_comite === 'APROVADO' ? p.aprovador_nome : p.resp_reprovacao);
                                    concluidoEm = concluidoEm || (p.status_comite === 'APROVADO' ? p.dt_aprovacao : p.dt_reprovacao);
                                }
                                return `
                                <tr class="border-b border-gray-100 text-xs">
                                    <td class="p-3 font-bold">${pe.faseNome}</td>
                                    <td class="p-3">${pe.etapaNome}</td>
                                    <td class="p-3 uppercase">${escapeHtml(pe.responsavel_etapa_nome) || '-'}</td>
                                    <td class="p-3">${pe.data_inicio_planejamento || '-'} a ${pe.data_termino_planejamento || '-'}</td>
                                    <td class="p-3 text-center font-mono">${pe.percentual_evolucao || 0}%</td>
                                    <td class="p-3 uppercase">${concluidoPor || '-'}</td>
                                    <td class="p-3">${concluidoEm ? concluidoEm.split('T')[0] : '-'}</td>
                                    <td class="p-3">${decisaoTexto ? `<span class="${decisaoTexto === 'APROVADO' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'} font-bold px-2 py-0.5 rounded text-[10px]">${decisaoTexto}</span>` : '-'}</td>
                                </tr>
                                ${pe.observacoes_conclusao ? `
                                <tr class="border-b border-gray-100 bg-gray-50 text-xs">
                                    <td class="p-3 text-gray-400 font-bold uppercase whitespace-nowrap">Observação</td>
                                    <td class="p-3 text-gray-600" colspan="7">${escapeHtml(pe.observacoes_conclusao)}</td>
                                </tr>
                                ` : ''}
                                ${pe.relatorio_evolucao ? `
                                <tr class="border-b border-gray-100 bg-indigo-50 text-xs">
                                    <td class="p-3 text-indigo-400 font-bold uppercase whitespace-nowrap">Relatório de Evolução</td>
                                    <td class="p-3 text-indigo-700" colspan="7">${escapeHtml(pe.relatorio_evolucao)}${pe.evolucao_atualizada_por ? ` <span class="text-indigo-400">— ${escapeHtml(pe.evolucao_atualizada_por)}${pe.evolucao_atualizada_em ? ', ' + pe.evolucao_atualizada_em.split('T')[0] : ''}</span>` : ''}</td>
                                </tr>
                                ` : ''}
                                `;
                            }).join('')
                        }
                    </tbody>
                </table>
            </div>
        </div>

        ${renderSecaoDecisoesFechamento(historicoDecisoesFechamento)}
        ${renderSecaoHistoricoAprovacaoMudancaOrcamento(historicoMudancaOrcamento)}
        ${renderSecaoHistoricoHorasDetalhe(historicoHoras)}
        ${renderSecaoHistoricoRatificacao(historicoRatificacao)}
        ${renderSecaoGoliveOcorrenciasTermo(historicoOcorrenciasGolive, termoAceiteGoliveData)}
        ${renderSecaoVinculosContrato(vinculosContratoDoProjeto, contratosParaVinculos, empresasParaVinculos, historicoVinculosContrato)}
        ${p.projeto_concluido === true ? renderSecaoConclusaoDetalhe(p) : ''}
        ${renderSecaoContratoDetalhe(etapasDoProjeto)}
        ${(p.sub_status || '').toUpperCase() === 'HOLD' || (p.sub_status || '').toUpperCase() === 'CANCELADO' ? renderSecaoTradeoffDetalhe(p) : ''}
        ${renderSecaoHistoricoTradeoffComoDoador(historicoComoDoador)}
        ${renderSecaoHistoricoRetomadaHold(historicoRetomadaHold)}
        ${p.qtd_reprovacoes > 0 ? renderSecaoReprovacaoDetalhe(p) : ''}
        ${p.is_adhoc ? renderSecaoAdhocDetalhe(p, tradeoffInfo) : ''}
    `;
}

// NOVO (a pedido do usuário 25/08/2026): quadro com o registro completo
// de Ocorrências de Erro do Go-Live (com a solução de cada uma, quando
// houver) e, ao final, os dados do Termo de Aceite — reaproveita os
// rótulos/cores já definidos em js/golive/golive-ocorrencias.js
// (GOLIVE_OCORRENCIA_STATUS_LABEL/BADGE). Some da tela se o projeto nunca
// teve nenhuma ocorrência nem termo registrado.
function renderSecaoGoliveOcorrenciasTermo(historicoOcorrencias, termoAceite) {
    if ((!historicoOcorrencias || historicoOcorrencias.length === 0) && !termoAceite) return '';

    const linhasOcorrencias = (historicoOcorrencias || []).map(o => {
        const badge = GOLIVE_OCORRENCIA_STATUS_BADGE[o.status] || 'bg-gray-100 text-gray-700';
        const label = GOLIVE_OCORRENCIA_STATUS_LABEL[o.status] || o.status;
        return `
            <div class="border border-gray-200 rounded-lg p-3">
                <div class="flex justify-between items-start gap-2 mb-1">
                    <span class="${badge} font-bold px-2 py-0.5 rounded text-[10px] uppercase">${label}</span>
                    <span class="text-[10px] text-gray-400">${o.data_ocorrencia || '-'} — registrado por ${escapeHtml(o.registrado_por) || '-'}</span>
                </div>
                <p class="text-xs text-gray-800">${escapeHtml(o.descricao_ocorrencia)}</p>
                ${o.descricao_solucao ? `<div class="mt-2 bg-gray-50 border-l-2 border-amber-400 pl-2 py-1"><p class="text-[10px] text-gray-500 font-bold uppercase">Solução</p><p class="text-xs text-gray-700">${escapeHtml(o.descricao_solucao)}</p><p class="text-[10px] text-gray-400 mt-0.5">${escapeHtml(o.solucao_registrada_por) || '-'}${o.solucao_registrada_em ? ', ' + o.solucao_registrada_em.split('T')[0] : ''}</p></div>` : ''}
                ${o.status === 'RESOLVIDA' ? `<p class="text-[10px] text-emerald-600 font-bold mt-1"><i class="fa-solid fa-check"></i> Confirmada por ${escapeHtml(o.confirmado_por) || '-'}${o.confirmado_em ? ' em ' + o.confirmado_em.split('T')[0] : ''}</p>` : ''}
            </div>
        `;
    }).join('');

    const termoHtml = termoAceite ? `
        <div class="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-3">
            <h4 class="text-xs font-bold text-blue-800 uppercase mb-1"><i class="fa-solid fa-file-signature"></i> Termo de Aceite</h4>
            <p class="text-xs text-blue-800">Aceito por <b>${escapeHtml(termoAceite.aceito_por) || '-'}</b> em <b>${termoAceite.data_aceite || '-'}</b>.</p>
            ${termoAceite.ressalvas ? `<p class="text-xs text-blue-700 mt-1"><b>Ressalvas:</b> ${escapeHtml(termoAceite.ressalvas)}</p>` : ''}
            ${termoAceite.observacoes ? `<p class="text-xs text-blue-700 mt-1"><b>Observações:</b> ${escapeHtml(termoAceite.observacoes)}</p>` : ''}
        </div>
    ` : `
        <div class="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-3 text-xs text-gray-400 font-bold text-center">
            Termo de Aceite ainda não registrado.
        </div>
    `;

    return `
        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
            <h3 class="text-sm font-bold text-gray-800 mb-3 uppercase tracking-wider"><i class="fa-solid fa-triangle-exclamation text-red-600"></i> Ocorrências de Erro (Go-Live)</h3>
            ${linhasOcorrencias ? `<div class="space-y-3">${linhasOcorrencias}</div>` : `<p class="text-xs text-gray-400 font-bold text-center py-2">Nenhuma ocorrência registrada.</p>`}
            ${termoHtml}
        </div>
    `;
}

// NOVO (a pedido do usuário 25/08/2026 — Fase 3): mostra os vínculos de
// Contrato por Projeto ativos (js/contratos/contratos-vinculos.js) e, ao
// final, o histórico de toda inclusão/alteração/exclusão desses vínculos
// (log_alteracao_vinculo_contrato). Some da tela se o projeto nunca teve
// nenhum vínculo (nem no histórico).
function renderSecaoVinculosContrato(vinculos, contratos, empresas, historico) {
    if ((!vinculos || vinculos.length === 0) && (!historico || historico.length === 0)) return '';

    const linhasVinculos = (vinculos || []).map(v => {
        const contrato = (contratos || []).find(c => c.id === v.contrato_id);
        const empresa = contrato ? (empresas || []).find(e => e.codigo === contrato.empresa_codigo) : null;
        return `
            <tr class="border-b border-purple-100">
                <td class="p-2 font-bold">${contrato ? escapeHtml(contrato.numero_contrato) : `#${v.contrato_id}`}</td>
                <td class="p-2">${empresa ? escapeHtml(empresa.nome) : (contrato ? contrato.empresa_codigo : '-')}</td>
                <td class="p-2 text-right font-mono">R$ ${Number(v.valor_vinculo).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            </tr>
        `;
    }).join('');

    const ROTULO_ACAO_VINCULO = { CRIADO: '➕ Criado', ALTERADO: '✏️ Alterado', EXCLUIDO: '🗑️ Excluído' };
    const linhasHistorico = (historico || []).map(h => `
        <tr class="border-b border-purple-100">
            <td class="p-2">${ROTULO_ACAO_VINCULO[h.acao] || h.acao}</td>
            <td class="p-2 text-right font-mono">${h.valor_anterior != null ? 'R$ ' + Number(h.valor_anterior).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-'}</td>
            <td class="p-2 text-right font-mono">${h.valor_novo != null ? 'R$ ' + Number(h.valor_novo).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '-'}</td>
            <td class="p-2 uppercase">${escapeHtml(h.alterado_por) || '-'}</td>
            <td class="p-2">${h.alterado_em ? h.alterado_em.split('T')[0] : '-'}</td>
        </tr>
    `).join('');

    return `
        <div class="bg-purple-50 p-6 rounded-lg shadow-sm border border-purple-200 mb-6">
            <h3 class="text-sm font-bold text-purple-800 mb-3 uppercase tracking-wider"><i class="fa-solid fa-link"></i> Contratos Vinculados a este Projeto</h3>
            ${linhasVinculos ? `
                <table class="w-full text-left border-collapse text-xs mb-4">
                    <thead><tr class="text-purple-700 uppercase border-b border-purple-200"><th class="p-2">Contrato</th><th class="p-2">Empresa</th><th class="p-2 text-right">Valor do Vínculo</th></tr></thead>
                    <tbody>${linhasVinculos}</tbody>
                </table>
            ` : `<p class="text-xs text-purple-700 italic mb-4">Nenhum vínculo ativo no momento.</p>`}
            ${historico && historico.length > 0 ? `
                <h4 class="text-xs font-bold text-purple-800 uppercase mb-2 border-t border-purple-200 pt-3">Histórico de Alterações</h4>
                <table class="w-full text-left border-collapse text-xs">
                    <thead><tr class="text-purple-700 uppercase border-b border-purple-200"><th class="p-2">Ação</th><th class="p-2 text-right">Valor Anterior</th><th class="p-2 text-right">Valor Novo</th><th class="p-2">Por</th><th class="p-2">Quando</th></tr></thead>
                    <tbody>${linhasHistorico}</tbody>
                </table>
            ` : ''}
        </div>
    `;
}

// NOVO (a pedido do usuário 25/08/2026): mostra a observação de conclusão
// registrada em "Concluir Projeto" (js/conclusao/conclusao-projeto.js) —
// o campo já era obrigatório e gravado em observacao_conclusao_final,
// mas não aparecia em lugar nenhum depois de salvo.
// NOVO (Mudança de Orçamento, 27/08/2026): exibida no topo do zoom quando
// o projeto está bloqueado por variação de orçamento acima do percentual
// parametrizado (Administração > Percentual de Bloqueio de Orçamento).
// Compara o par de fases relevante — Business Case→Requerimentos se
// bloqueou em Requerimentos, Requerimentos→Technical se bloqueou em
// Technical (etapa_atual não muda enquanto bloqueado, então ele mesmo
// indica qual foi) — e traz o formulário de aprovação (motivo obrigatório
// + log de quem/quando, gravado em aprovarMudancaOrcamento,
// js/governanca/mudanca-orcamento.js).
function renderSecaoMudancaOrcamentoDetalhe(p) {
    // NOVO (a pedido do usuário 27/08/2026): valores/label compartilhados
    // com a lista e o log de aprovação — ver obterValoresMudancaOrcamento
    // em js/governanca/mudanca-orcamento.js.
    const valores = obterValoresMudancaOrcamento(p);
    const alertaValor = calcularAlertaVariacaoOrcamento(valores.valorReferencia, valores.valorNovo);
    const alertaHoras = calcularAlertaVariacaoOrcamento(valores.horasReferencia, valores.horasNovo);
    const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

    return `
        <div class="bg-red-50 border-2 border-red-300 p-6 rounded-lg shadow-sm mb-6">
            <h3 class="text-sm font-bold text-red-800 mb-1 uppercase tracking-wider"><i class="fa-solid fa-triangle-exclamation"></i> Aguardando Aprovação — Mudança de Orçamento</h3>
            <p class="text-xs text-red-700 mb-3">Variação de orçamento entre ${valores.labelFase} acima do percentual de bloqueio parametrizado. O projeto está travado nesta fase até a aprovação da continuidade.</p>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div class="bg-white rounded p-3"><span class="text-[10px] font-bold text-gray-500 uppercase block">Orçamento Original</span><span class="text-sm font-bold text-gray-800">${fmt(valores.valorReferencia)}</span></div>
                <div class="bg-white rounded p-3"><span class="text-[10px] font-bold text-red-600 uppercase block">Orçamento Novo (${alertaValor.percentual}%)</span><span class="text-sm font-bold text-red-800">${fmt(valores.valorNovo)}</span></div>
                <div class="bg-white rounded p-3"><span class="text-[10px] font-bold text-gray-500 uppercase block">Horas Original</span><span class="text-sm font-bold text-gray-800">${valores.horasReferencia > 0 ? valores.horasReferencia + 'h' : '-'}</span></div>
                <div class="bg-white rounded p-3"><span class="text-[10px] font-bold text-red-600 uppercase block">Horas Novo (${alertaHoras.percentual}%)</span><span class="text-sm font-bold text-red-800">${valores.horasNovo > 0 ? valores.horasNovo + 'h' : '-'}</span></div>
            </div>
            <div class="mb-3">
                <label class="block text-[10px] font-bold uppercase text-red-700 mb-1">Motivo da Aprovação *</label>
                <textarea id="mudancaOrcamentoMotivoInput" rows="2" class="w-full p-2 border border-red-300 rounded text-sm"></textarea>
            </div>
            <button onclick="aprovarMudancaOrcamento('${escapeJsAttr(p.codigo)}')" class="bg-red-700 hover:bg-red-800 text-white font-bold py-2 px-4 rounded text-sm transition">
                <i class="fa-solid fa-check"></i> Aprovar Continuidade do Projeto
            </button>
        </div>
    `;
}

// NOVO (a pedido do usuário 27/08/2026): histórico de TODAS as aprovações
// de mudança de orçamento já feitas neste projeto (pode acontecer mais de
// uma vez — uma em Requerimentos, outra em Technical), com valores
// original/novo, motivo, quem aprovou e quando — gravado em
// aprovarMudancaOrcamento (js/governanca/mudanca-orcamento.js).
function renderSecaoHistoricoAprovacaoMudancaOrcamento(historico) {
    if (!historico || historico.length === 0) return '';
    const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    return `
        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
            <h3 class="text-sm font-bold text-gray-800 mb-3 uppercase tracking-wider">Histórico de Aprovação de Mudança de Orçamento</h3>
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse text-sm">
                    <thead><tr class="bg-gray-50 text-xs uppercase border-b">
                        <th class="p-3">Fase Bloqueada</th><th class="p-3 text-right">Orçamento (antes → depois)</th>
                        <th class="p-3 text-right">Horas (antes → depois)</th><th class="p-3">Motivo</th>
                        <th class="p-3">Aprovado Por</th><th class="p-3">Quando</th>
                    </tr></thead>
                    <tbody>
                        ${historico.map(h => `
                            <tr class="border-b border-gray-100 text-xs">
                                <td class="p-3 font-bold">${h.fase_bloqueada || '-'}</td>
                                <td class="p-3 text-right font-mono">${fmt(h.valor_referencia)} → ${fmt(h.valor_novo)}</td>
                                <td class="p-3 text-right font-mono">${h.horas_referencia || 0}h → ${h.horas_novo || 0}h</td>
                                <td class="p-3 text-gray-600">${escapeHtml(h.motivo)}</td>
                                <td class="p-3 uppercase">${escapeHtml(h.aprovado_por) || '-'}</td>
                                <td class="p-3">${h.aprovado_em ? h.aprovado_em.split('T')[0] : '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}

function renderSecaoConclusaoDetalhe(p) {
    return `
        <div class="bg-emerald-50 p-6 rounded-lg shadow-sm border border-emerald-200 mb-6">
            <h3 class="text-sm font-bold text-emerald-800 mb-2 uppercase tracking-wider">🏁 Conclusão do Projeto</h3>
            <p class="text-xs text-emerald-800">Concluído em <b>${p.data_conclusao_final || '-'}</b> por <b>${escapeHtml(p.concluido_final_por) || '-'}</b>.</p>
            ${p.observacao_conclusao_final ? `<p class="text-xs text-emerald-700 mt-2 whitespace-pre-wrap">${escapeHtml(p.observacao_conclusao_final)}</p>` : ''}
        </div>
    `;
}

// NOVO 10/08/2026 (item 1 do relatório de testes): mostra quem/quando
// colocou o projeto em HOLD ou Cancelado — e, quando veio de um trade-off
// Extraordinário, qual projeto foi o motivo (já registrado em tradeoff_observacao).
//
// CORRIGIDO (item 9-a, novos ajustes — bug reportado: cancelamento
// aparecia como "Por (não tem dados), Em (não tem dados)"): essa função
// só lia tradeoff_por/tradeoff_em, campos exclusivos do fluxo de
// trade-off Extraordinário. O cancelamento comum (via botão "Cancelar"
// em Demandas Formalizadas) grava em campos DIFERENTES
// (resp_cancelamento/dt_cancelamento/motivo_cancelamento) — agora usa
// esses como fallback quando os de trade-off estão vazios.
function renderSecaoTradeoffDetalhe(p) {
    const sub = (p.sub_status || '').toUpperCase();
    const por = p.tradeoff_por || p.resp_cancelamento || '-';
    const em = (p.tradeoff_em || p.dt_cancelamento || '').split('T')[0] || p.dt_cancelamento || '-';
    const motivo = p.tradeoff_observacao || p.motivo_cancelamento || null;
    return `
        <div class="bg-yellow-50 p-6 rounded-lg shadow-sm border border-yellow-200 mb-6">
            <h3 class="text-sm font-bold text-yellow-800 mb-2 uppercase tracking-wider">${sub === 'HOLD' ? '⏸️ Projeto em Hold' : '🚫 Projeto Cancelado'}</h3>
            <p class="text-xs text-yellow-800">Por <b>${escapeHtml(por)}</b> em <b>${escapeHtml(em)}</b>.</p>
            ${motivo ? `<p class="text-xs text-yellow-700 mt-1">${escapeHtml(motivo)}</p>` : ''}
        </div>
    `;
}

// NOVO (a pedido do usuário 24/08/2026, regras 2 e 3): toda vez que este
// projeto entrou como DOADOR num trade-off Extraordinário — HOLD/CANCELAR
// (saldo inteiro) ou CEDER_PARTE (só uma fração, projeto continua
// ativo). Cobre os dois pedidos numa seção só: o log detalhado de HOLD
// (quando liberou verba, pra quem) e o aviso de cessão parcial pra
// projetos que continuam rodando.
function renderSecaoHistoricoTradeoffComoDoador(historico) {
    if (!historico || historico.length === 0) return '';
    const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    const rotuloAcao = { HOLD: '⏸️ Colocado em HOLD', CANCELADO: '🚫 Cancelado', CEDER_PARTE: '💸 Cedeu parte do saldo' };
    return `
        <div class="bg-yellow-50 p-6 rounded-lg shadow-sm border border-yellow-200 mb-6">
            <h3 class="text-sm font-bold text-yellow-800 mb-3 uppercase tracking-wider">Histórico de Trade-off (como doador)</h3>
            <table class="w-full text-left border-collapse text-xs">
                <thead><tr class="text-yellow-700 uppercase border-b border-yellow-200">
                    <th class="p-2">Ação</th><th class="p-2 text-right">Valor Liberado</th>
                    <th class="p-2">Para o Projeto</th><th class="p-2">Aprovado Por</th><th class="p-2">Quando</th>
                </tr></thead>
                <tbody>
                    ${historico.map(h => {
                        const projAlvo = (typeof projectsData !== 'undefined' ? projectsData : []).find(pr => pr.codigo === h.projeto_adhoc_codigo);
                        return `
                        <tr class="border-b border-yellow-100">
                            <td class="p-2 font-bold">${rotuloAcao[h.acao] || h.acao}</td>
                            <td class="p-2 text-right font-mono">${fmt(h.saldo_liberado)}</td>
                            <td class="p-2 font-mono">${h.projeto_adhoc_codigo}${projAlvo ? ` - ${escapeHtml(projAlvo.nome)}` : ''}</td>
                            <td class="p-2 uppercase">${escapeHtml(h.aprovado_por) || '-'}</td>
                            <td class="p-2">${h.aprovado_em ? h.aprovado_em.split('T')[0] : '-'}</td>
                        </tr>
                    `;}).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// NOVO (a pedido do usuário 24/08/2026): histórico de retomadas de HOLD
// (js/adhoc/retomar-hold.js) — registra sub_status de origem, quem e
// quando retomou.
function renderSecaoHistoricoRetomadaHold(historico) {
    if (!historico || historico.length === 0) return '';
    return `
        <div class="bg-emerald-50 p-6 rounded-lg shadow-sm border border-emerald-200 mb-6">
            <h3 class="text-sm font-bold text-emerald-800 mb-3 uppercase tracking-wider">▶️ Histórico de Retomada de Hold</h3>
            <table class="w-full text-left border-collapse text-xs">
                <thead><tr class="text-emerald-700 uppercase border-b border-emerald-200">
                    <th class="p-2">Situação Anterior ao Hold</th><th class="p-2">Fase na Retomada</th>
                    <th class="p-2">Retomado Por</th><th class="p-2">Quando</th>
                </tr></thead>
                <tbody>
                    ${historico.map(h => `
                        <tr class="border-b border-emerald-100">
                            <td class="p-2">${h.sub_status_anterior || '-'}</td>
                            <td class="p-2">${h.etapa_atual || '-'}</td>
                            <td class="p-2 uppercase">${escapeHtml(h.retomado_por) || '-'}</td>
                            <td class="p-2">${h.retomado_em ? h.retomado_em.split('T')[0] : '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// NOVO (a pedido do usuário 25/08/2026): histórico de Ratificação/
// Retificação do planejamento herdado de UAT/Go-Live — cada linha vem de
// log_ratificacao_planejamento, gravada em confirmarPlanejamentoGenerico
// (js/phases/generic-workflow-ui.js) toda vez que o plano já existente
// (herdado de "Planejar Execução") é confirmado como está (Ratificado)
// ou editado (Retificado, mostrando o valor antigo → novo).
function renderSecaoHistoricoRatificacao(historico) {
    if (!historico || historico.length === 0) return '';
    return `
        <div class="bg-indigo-50 p-6 rounded-lg shadow-sm border border-indigo-200 mb-6">
            <h3 class="text-sm font-bold text-indigo-800 mb-3 uppercase tracking-wider"><i class="fa-solid fa-scale-balanced"></i> Histórico de Ratificação/Retificação do Planejamento</h3>
            <table class="w-full text-left border-collapse text-xs">
                <thead><tr class="text-indigo-700 uppercase border-b border-indigo-200">
                    <th class="p-2">Etapa</th><th class="p-2">Decisão</th>
                    <th class="p-2">Responsável (antes → depois)</th><th class="p-2">Datas (antes → depois)</th>
                    <th class="p-2">Decidido Por</th><th class="p-2">Quando</th>
                </tr></thead>
                <tbody>
                    ${historico.map(h => {
                        const ehRetificado = h.decisao === 'RETIFICADO';
                        const respostaDatas = ehRetificado
                            ? `${h.data_inicio_anterior || '-'} a ${h.data_termino_anterior || '-'} → ${h.data_inicio_novo || '-'} a ${h.data_termino_novo || '-'}`
                            : `${h.data_inicio_novo || '-'} a ${h.data_termino_novo || '-'}`;
                        const respostaResp = ehRetificado && h.responsavel_anterior !== h.responsavel_novo
                            ? `${h.responsavel_anterior || '-'} → ${h.responsavel_novo || '-'}`
                            : (h.responsavel_novo || '-');
                        return `
                        <tr class="border-b border-indigo-100">
                            <td class="p-2 font-bold">${h.etapa || '-'}</td>
                            <td class="p-2"><span class="${ehRetificado ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'} font-bold px-1.5 py-0.5 rounded text-[10px] uppercase">${ehRetificado ? 'Retificado' : 'Ratificado'}</span></td>
                            <td class="p-2 uppercase">${escapeHtml(respostaResp)}</td>
                            <td class="p-2">${respostaDatas}</td>
                            <td class="p-2 uppercase">${escapeHtml(h.decidido_por) || '-'}</td>
                            <td class="p-2">${h.decidido_em ? h.decidido_em.split('T')[0] : '-'}</td>
                        </tr>
                    `;}).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// NOVO (a pedido do usuário 24/08/2026): histórico de alteração de horas
// do projeto — cada linha vem de log_alteracoes_horas, gravada em
// confirmarConclusaoFaseGenerica (js/requirements/requirements.js) toda
// vez que um novo valor de horas é alimentado nos checkpoints de
// Concluir Requerimentos/Technical (a primeira definição, em Realizar
// Orçamento, não gera log — não há "anterior" pra comparar).
function renderSecaoHistoricoHorasDetalhe(historicoHoras) {
    if (!historicoHoras || historicoHoras.length === 0) return '';
    return `
        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
            <h3 class="text-sm font-bold text-gray-800 mb-3 uppercase tracking-wider">Histórico de Alterações de Horas</h3>
            <table class="w-full text-left border-collapse text-sm">
                <thead><tr class="bg-gray-50 text-xs uppercase border-b">
                    <th class="p-3">Fase</th><th class="p-3 text-right">Horas Antes</th>
                    <th class="p-3 text-right">Horas Depois</th><th class="p-3">Alterado Por</th><th class="p-3">Quando</th>
                </tr></thead>
                <tbody>
                    ${historicoHoras.map(h => `
                        <tr class="border-b border-gray-100 text-xs">
                            <td class="p-3 font-bold">${h.fase}</td>
                            <td class="p-3 text-right font-mono">${h.horas_anterior != null ? h.horas_anterior + 'h' : '-'}</td>
                            <td class="p-3 text-right font-mono font-bold">${h.horas_novo}h</td>
                            <td class="p-3 uppercase">${escapeHtml(h.alterado_por) || '-'}</td>
                            <td class="p-3">${h.alterado_em ? h.alterado_em.split('T')[0] : '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderSecaoContratoDetalhe(etapasDoProjeto) {
    const etapaComContrato = etapasDoProjeto.find(pe => pe.tipo_contratacao);
    if (!etapaComContrato) return '';
    const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    return `
        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
            <h3 class="text-sm font-bold text-gray-800 mb-3 uppercase tracking-wider">Registro de Contrato (Execution)</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div><span class="text-gray-400 font-bold uppercase block">Tipo</span><span class="font-bold">${etapaComContrato.tipo_contratacao}</span></div>
                <div><span class="text-gray-400 font-bold uppercase block">Empresa Executora</span><span class="font-bold">${etapaComContrato.empresa_executora || '-'}</span></div>
                <div><span class="text-gray-400 font-bold uppercase block">Código Proposta</span><span class="font-bold">${etapaComContrato.codigo_proposta || '-'}</span></div>
                <div><span class="text-gray-400 font-bold uppercase block">Valor Proposta</span><span class="font-bold">${etapaComContrato.valor_proposta ? fmt(etapaComContrato.valor_proposta) : '-'}</span></div>
            </div>
            ${etapaComContrato.valor_gasto_divergente_aprovado_por ? `
                <div class="mt-3 bg-amber-50 border border-amber-300 rounded p-3 text-xs">
                    <b>⚠️ Divergência de valor gasto aprovada</b> por ${escapeHtml(etapaComContrato.valor_gasto_divergente_aprovado_por)} em ${(etapaComContrato.valor_gasto_divergente_aprovado_em || '').split('T')[0]} —
                    orçado: ${fmt(etapaComContrato.valor_gasto_divergente_valor_orcado)}, gasto: ${fmt(etapaComContrato.valor_gasto_execucao)}.
                </div>
            ` : ''}
        </div>
    `;
}

// NOVO (Fechamento de Ano Fiscal, 2026-09-02): histórico das decisões de
// fechamento registradas para o projeto (Continuar / Hold / Cancelar).
function renderSecaoDecisoesFechamento(historico) {
    if (!historico || historico.length === 0) return '';
    const rot = { CONTINUAR: 'Carryover Desenvolvimento', HOLD: 'Carryover Hold', CANCELAR: 'Cancelar', REVERTIDO: 'Revertido' };
    const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    return `
        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
            <h3 class="text-sm font-bold text-indigo-700 mb-3 uppercase tracking-wider">Decisões de Fechamento de Ano Fiscal</h3>
            <table class="w-full text-left border-collapse text-xs">
                <thead><tr class="bg-gray-50 text-[10px] uppercase border-b">
                    <th class="p-2">Quando</th><th class="p-2">Ano Fiscal</th><th class="p-2">Decisão</th>
                    <th class="p-2 text-right">Saldo Remanesc.</th><th class="p-2">Por</th><th class="p-2">Observação</th>
                </tr></thead>
                <tbody class="divide-y divide-gray-100">
                    ${historico.map(d => `
                        <tr>
                            <td class="p-2 whitespace-nowrap">${d.decidido_em ? new Date(d.decidido_em).toLocaleString('pt-BR') : '-'}</td>
                            <td class="p-2 font-mono">${d.ano_fiscal || '-'}</td>
                            <td class="p-2 font-bold">${rot[d.decisao] || d.decisao}</td>
                            <td class="p-2 text-right font-mono">${fmt(d.valor_remanescente)}</td>
                            <td class="p-2 uppercase font-bold">${escapeHtml(d.decidido_por) || '-'}</td>
                            <td class="p-2 text-gray-500">${escapeHtml(d.observacao) || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderSecaoReprovacaoDetalhe(p) {
    return `
        <div class="bg-white p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
            <h3 class="text-sm font-bold text-red-700 mb-3 uppercase tracking-wider">Histórico de Reprovação</h3>
            <p class="text-xs text-gray-600">Este projeto já foi reprovado <b>${p.qtd_reprovacoes}</b> vez(es). Última reprovação: por <b>${escapeHtml(p.ultima_reprovacao_por) || '-'}</b> em <b>${(p.ultima_reprovacao_em || '').split('T')[0] || '-'}</b>, na etapa <b>${p.ultima_reprovacao_etapa || '-'}</b>.</p>
        </div>
    `;
}

function renderSecaoAdhocDetalhe(p, tradeoffInfo) {
    const fmt = (v) => `R$ ${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
    if (!tradeoffInfo || tradeoffInfo.length === 0) {
        return `
            <div class="bg-amber-50 p-6 rounded-lg shadow-sm border border-amber-200 mb-6">
                <h3 class="text-sm font-bold text-amber-800 mb-2 uppercase tracking-wider">Origem Extraordinário</h3>
                <p class="text-xs text-amber-700">Projeto nasceu como Extraordinário, mas ainda não foi aprovado via trade-off (ou o registro não foi encontrado).</p>
            </div>
        `;
    }
    return tradeoffInfo.map((rodada, idx) => `
        <div class="bg-amber-50 p-6 rounded-lg shadow-sm border border-amber-200 mb-6">
            <h3 class="text-sm font-bold text-amber-800 mb-3 uppercase tracking-wider">Origem Extraordinário — Trade-off ${tradeoffInfo.length > 1 ? `(rodada ${idx + 1})` : ''}</h3>
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs mb-4">
                <div><span class="text-amber-600 font-bold uppercase block">Valor Aprovado</span><span class="font-bold text-amber-900">${fmt(rodada.valor_aprovado)}</span></div>
                <div><span class="text-amber-600 font-bold uppercase block">Liberado no Trade-off</span><span class="font-bold text-amber-900">${fmt(rodada.valor_liberado_tradeoff)}</span></div>
                <div><span class="text-amber-600 font-bold uppercase block">Saldo Resultante</span><span class="font-bold text-amber-900">${fmt(rodada.saldo_resultante)}</span></div>
                <div><span class="text-amber-600 font-bold uppercase block">Aprovado Por / Em</span><span class="font-bold text-amber-900">${escapeHtml(rodada.aprovado_por) || '-'} · ${(rodada.aprovado_em || '').split('T')[0] || '-'}</span></div>
            </div>
            <h4 class="text-xs font-bold text-amber-800 mb-2 uppercase">Projetos Afetados no Trade-off</h4>
            <table class="w-full text-left border-collapse text-xs">
                <thead><tr class="bg-white text-[10px] uppercase border-b border-amber-200">
                    <th class="p-2">Código</th><th class="p-2">Projeto</th><th class="p-2">Ação</th><th class="p-2 text-right">Saldo Liberado</th>
                </tr></thead>
                <tbody>
                    ${(rodada.projetos_afetados || []).length === 0
                        ? `<tr><td colspan="4" class="p-2 text-center text-amber-500">Nenhum projeto afetado registrado nesta rodada</td></tr>`
                        : rodada.projetos_afetados.map(pa => `
                            <tr class="border-b border-amber-100">
                                <td class="p-2 font-mono font-bold">${pa.codigo || '-'}</td>
                                <td class="p-2">${escapeHtml(pa.nome) || '-'}</td>
                                <td class="p-2">${pa.acao || '-'}</td>
                                <td class="p-2 text-right font-mono">${fmt(pa.saldo_liberado || pa.valor)}</td>
                            </tr>
                        `).join('')
                    }
                </tbody>
            </table>
        </div>
    `).join('');
}
