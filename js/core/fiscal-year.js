// =========================================================================
// core/fiscal-year.js
// Informações do Ano Fiscal vigente/próximo, calculadas a partir da data
// real (não mais fixas) — ver Especificacao_Workflow_v2.md, seção 5.
//
// CORRIGIDO 10/08/2026 — convenção de nomeação do AF: o Ano Fiscal leva o
// nome do ano-calendário em que cai o seu ÚLTIMO quarter (Q4), não o ano
// em que ele começa. Confirmado pelo usuário com o exemplo: abril/2026
// inicia o AF2027 (termina em março/2027, daí o nome); abril/2027 inicia
// o AF2028.
//
// Regra dos quarters:
//   Q1 = abril, maio, junho        -> pertence ao AF do ano-calendário SEGUINTE
//   Q2 = julho, agosto, setembro   -> pertence ao AF do ano-calendário SEGUINTE
//   Q3 = outubro, novembro, dez.   -> pertence ao AF do ano-calendário SEGUINTE
//   Q4 = janeiro, fevereiro, março -> pertence ao AF do PRÓPRIO ano-calendário
//        (ex.: AF2027 vai de abr/2026 até mar/2027; jan-mar/2027 = Q4 do AF2027,
//        e é esse ano de 2027 que dá nome ao AF inteiro)
//
// isOrcamentoGlobalFechado (mantida como estava) verifica se o orçamento
// do AF já foi fechado para novas demandas — ver
// js/approvals/orcamento-af.js.
// =========================================================================

function getInfoAnoFiscal(dataRef) {
    const hoje = dataRef ? new Date(dataRef) : new Date();
    const mes = hoje.getMonth() + 1; // getMonth() é 0-indexado
    const ano = hoje.getFullYear();

    let quarterAtual, anoFiscalCorrente;

    if (mes >= 4 && mes <= 6) {
        quarterAtual = 'Q1';
        anoFiscalCorrente = ano + 1;
    } else if (mes >= 7 && mes <= 9) {
        quarterAtual = 'Q2';
        anoFiscalCorrente = ano + 1;
    } else if (mes >= 10 && mes <= 12) {
        quarterAtual = 'Q3';
        anoFiscalCorrente = ano + 1;
    } else {
        // mes 1, 2 ou 3 — Q4, já no ano-calendário que dá nome ao AF
        quarterAtual = 'Q4';
        anoFiscalCorrente = ano;
    }

    return {
        quarterAtual,
        anoFiscalCorrente,
        afAtualStr: `AF${anoFiscalCorrente}`,
        proximoAFStr: `AF${anoFiscalCorrente + 1}`
    };
}

function isOrcamentoGlobalFechado() {
    return projectsData.some(p => p.etapa_atual && p.etapa_atual !== 'BUSINESS CASE');
}
