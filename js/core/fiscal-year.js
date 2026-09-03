// =========================================================================
// core/fiscal-year.js
// Informações do Ano Fiscal vigente/próximo, calculadas a partir da data
// real — ver Especificacao_Workflow_v2.md, seção 5.
//
// CONVENÇÃO DE NOMEAÇÃO: o Ano Fiscal leva o nome do ano-calendário em que
// cai o seu ÚLTIMO quarter (Q4). Ex. (período abril–março): abril/2026
// inicia o AF2027 (termina em março/2027, daí o nome).
//
// PERÍODO PARAMETRIZÁVEL (Feature 1.2 — 03/09/2026): o mês de início do Ano
// Fiscal NÃO é mais fixo em abril — vem de config_periodo_ano_fiscal, via
// mesInicioAnoFiscal(dataRef) (js/config/periodo-ano-fiscal.js), COM
// VIGÊNCIA (datas anteriores à 1ª vigência continuam em abril). Com o mês
// de início = 4 esta função reproduz exatamente a regra antiga:
//   Q1 = mês de início + 0/1/2      -> (abr,mai,jun)
//   Q2 = mês de início + 3/4/5      -> (jul,ago,set)
//   Q3 = mês de início + 6/7/8      -> (out,nov,dez)
//   Q4 = mês de início + 9/10/11    -> (jan,fev,mar)
// O cache do período é carregado no login (js/auth/auth.js), então esta
// função continua SÍNCRONA.
//
// isOrcamentoGlobalFechado (mantida como estava) verifica se o orçamento
// do AF já foi fechado para novas demandas — ver
// js/approvals/orcamento-af.js.
// =========================================================================

function getInfoAnoFiscal(dataRef) {
    const hoje = dataRef ? new Date(dataRef) : new Date();
    const mes = hoje.getMonth() + 1; // getMonth() é 0-indexado
    const ano = hoje.getFullYear();

    const mesInicio = (typeof mesInicioAnoFiscal === 'function') ? mesInicioAnoFiscal(dataRef) : 4;

    // Offset 0..11 desde o início do Ano Fiscal -> quarter.
    const offset = ((mes - mesInicio) % 12 + 12) % 12;
    const quarterAtual = 'Q' + (Math.floor(offset / 3) + 1);

    // Ano-calendário em que o AF começou. Se ainda não chegamos ao mês de
    // início neste ano-calendário, o AF em curso começou no ano anterior.
    const startYear = (mes >= mesInicio) ? ano : ano - 1;
    // Nome = ano-calendário do último quarter. Só coincide com startYear
    // quando o AF não cruza a virada de ano (mês de início = janeiro).
    const anoFiscalCorrente = (mesInicio === 1) ? startYear : startYear + 1;

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
