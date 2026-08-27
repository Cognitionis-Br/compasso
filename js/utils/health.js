// =========================================================================
// utils/health.js
// Calcula o "farol" de saúde de um projeto (Saudável / Atenção / Crítico /
// Hold / Inativo) com base no sub_status, etapa atual e SLA do porte.
//
// CORRIGIDO 10/08/2026 (G24): migrado de obterSlaPorte() (sistema antigo,
// parametros_prazos) para obterSlaPorNomeEtapa() (fonte única de verdade,
// sla_etapa_porte — ver config/prazos.js e core/workflow-engine.js).
// =========================================================================
function calcularSaudeProjeto(p, todasEtapasCache) {
    const sub = (p.sub_status || '').toUpperCase();
    if (sub === 'CANCELADO' || sub === 'REPROVADO') return { status: 'INATIVO', html: '<span class="px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-bold text-xs">⚪ Inativo</span>' };
    if (sub === 'HOLD') return { status: 'HOLD', html: '<span class="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-xs">🟡 Em Hold</span>' };

    // CORRIGIDO 10/08/2026 (bug reportado pelo usuário: etapa com prazo
    // vencido/hoje não aparecia como atrasada em nenhum dashboard): a
    // correção anterior restringiu a checagem só a Business
    // Case/Requerimentos, usando a data de entrada da FASE (não da
    // etapa específica) — isso deixava Technical/Execution/UAT/Go-Live
    // sem checagem NENHUMA, e não detectava atraso no cronograma
    // granular de cada etapa (data_termino_planejamento). Agora usa a
    // mesma lógica do Cronograma & Evolução (calcularAlertaEvolucao
    // sobre a etapa corrente de verdade), cobrindo TODAS as fases —
    // quando o cache de projeto_etapas é passado pelo chamador.
    if (todasEtapasCache && typeof obterEtapaCorrenteEProgresso === 'function') {
        const resultado = obterEtapaCorrenteEProgresso(p, todasEtapasCache);
        if (resultado && resultado.pe) {
            const alerta = calcularAlertaEvolucao(resultado.pe);
            if (alerta) {
                if (alerta.nivel === 'vermelho') return { status: 'CRITICO', html: '<span class="px-2 py-0.5 bg-red-100 text-red-800 rounded font-bold text-xs">🔴 Atrasado (Cronograma)</span>' };
                if (alerta.nivel === 'amarelo') return { status: 'ATENCAO', html: '<span class="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-xs">🟡 Atenção (Cronograma)</span>' };
                return { status: 'SAUDAVEL', html: '<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-xs">🟢 Saudável</span>' };
            }
        }
    }

    // Fallback: sem cronograma granular disponível ainda (etapa nem
    // chegou a ser planejada) — mantém a checagem baseada na data de
    // entrada da fase, só pra Business Case/Requerimentos ainda "A
    // Planejar".
    const etapa = (p.etapa_atual || 'BUSINESS CASE').toUpperCase();
    const sub2 = (p.sub_status || '').toUpperCase();
    if ((etapa === 'BUSINESS CASE' || etapa === 'REQUIREMENTS') && sub2 === 'A PLANEJAR') {
        const nomeEtapaSla = etapa === 'REQUIREMENTS' ? 'GERAR REQUERIMENTOS' : 'FORMALIZAÇÃO DEMANDA';
        const diasSla = obterSlaPorNomeEtapa(nomeEtapaSla, p.tamanho);
        const dtBase = p.data_solicitacao_req || p.data_solicitacao;
        if (dtBase) {
            const dtLimiteStr = somarDiasUteis(dtBase, diasSla);
            if (dtLimiteStr !== '-') {
                const hojeStr = new Date().toISOString().split('T')[0];
                if (hojeStr > dtLimiteStr) {
                    return { status: 'CRITICO', html: '<span class="px-2 py-0.5 bg-red-100 text-red-800 rounded font-bold text-xs">🔴 Atrasado (SLA Vencido)</span>' };
                } else {
                    const dHoje = new Date(hojeStr);
                    const dLim = new Date(dtLimiteStr);
                    const diffDays = Math.ceil((dLim - dHoje) / (1000 * 60 * 60 * 24));
                    if (diffDays <= 2) {
                        return { status: 'ATENCAO', html: '<span class="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-xs">🟡 Atenção (Próx. Vencimento)</span>' };
                    }
                }
            }
        }
    }

    return { status: 'SAUDAVEL', html: '<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-bold text-xs">🟢 Saudável</span>' };
}
