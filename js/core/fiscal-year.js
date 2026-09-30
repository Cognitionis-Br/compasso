// =========================================================================
// core/fiscal-year.js
// Informações do Ano Fiscal vigente/próximo.
//
// CONVENÇÃO DE NOMEAÇÃO: o Ano Fiscal leva o nome do ano-calendário em que
// cai o seu ÚLTIMO quarter (Q4). Ex. (período abril–março): abril/2026
// inicia o AF2027 (termina em março/2027, daí o nome).
//
// PERÍODO PARAMETRIZÁVEL (Feature 1.2 — 03/09/2026): o mês de início do AF
// vem de config_periodo_ano_fiscal via mesInicioAnoFiscal() (síncrono).
//
// R-FY-03 (Fase 2A — 30/09/2026): o AF ativo NUNCA é derivado de YEAR(date).
// carregarFiscalYears() preenche fiscalYearsCache no login; getInfoAnoFiscal()
// consulta o cache para afAtualStr e cai para o cálculo por data só quando
// o cache ainda está vazio (antes do login completar).
// =========================================================================

let fiscalYearsCache = [];

// Carregado no login (js/auth/auth.js) antes de qualquer render.
async function carregarFiscalYears() {
    const { data, error } = await _supabase
        .from('anos_fiscais_config')
        .select('*')
        .order('ano_fiscal');
    fiscalYearsCache = error ? [] : (data || []);
    return fiscalYearsCache;
}

// Retorna o FY com orçamento aprovado e ainda não encerrado (status OPEN).
// Null quando nenhum AF está nesse estado.
function getAFAberto() {
    if (fiscalYearsCache.length === 0) return null;
    return fiscalYearsCache.find(fy =>
        (fy.fy_status === 'OPEN') ||
        (fy.orcamento_fechado === true && !fy.ano_fiscal_fechado)
    ) || null;
}

// Retorna o FY em fase de recebimento de demandas (status PLANNING / BUDGETING).
function getAFEmPlanejamento() {
    if (fiscalYearsCache.length === 0) return null;
    return fiscalYearsCache.find(fy =>
        (fy.fy_status === 'PLANNING' || fy.fy_status === 'BUDGETING') ||
        (!fy.ano_fiscal_fechado && !fy.orcamento_fechado && fy.recebimento_demandas_aberto === true)
    ) || null;
}

// Retorna o registro fiscal_years/anos_fiscais_config para um código específico.
function getAFPorCodigo(codigo) {
    return fiscalYearsCache.find(fy => fy.ano_fiscal === codigo) || null;
}

function getInfoAnoFiscal(dataRef) {
    const hoje = dataRef ? new Date(dataRef) : new Date();
    const mes = hoje.getMonth() + 1;
    const ano = hoje.getFullYear();

    const mesInicio = (typeof mesInicioAnoFiscal === 'function') ? mesInicioAnoFiscal(dataRef) : 4;

    const offset = ((mes - mesInicio) % 12 + 12) % 12;
    const quarterAtual = 'Q' + (Math.floor(offset / 3) + 1);

    const startYear = (mes >= mesInicio) ? ano : ano - 1;
    const anoFiscalCorrente = (mesInicio === 1) ? startYear : startYear + 1;

    // R-FY-03: AF ativo vem do banco (cache), não da data, exceto quando:
    //   (a) dataRef é passado explicitamente — cálculo histórico para uma data;
    //   (b) cache ainda está vazio — fallback durante inicialização.
    let afAtualStr, proximoAFStr;
    if (!dataRef && fiscalYearsCache.length > 0) {
        const fyAberto = getAFAberto();
        if (fyAberto) {
            afAtualStr = fyAberto.ano_fiscal;
            const idx = fiscalYearsCache.findIndex(fy => fy.ano_fiscal === afAtualStr);
            const prox = fiscalYearsCache[idx + 1];
            proximoAFStr = prox ? prox.ano_fiscal : `AF${anoFiscalCorrente + 1}`;
        } else {
            // Nenhum AF em OPEN: usa cálculo por data como fallback
            afAtualStr = `AF${anoFiscalCorrente}`;
            proximoAFStr = `AF${anoFiscalCorrente + 1}`;
        }
    } else {
        afAtualStr = `AF${anoFiscalCorrente}`;
        proximoAFStr = `AF${anoFiscalCorrente + 1}`;
    }

    return { quarterAtual, anoFiscalCorrente, afAtualStr, proximoAFStr };
}

// Verifica se o orçamento do AF corrente está aprovado/fechado para novas demandas.
// R-FY-03: consulta o cache, não projectsData.
function isOrcamentoGlobalFechado() {
    if (fiscalYearsCache.length > 0) {
        return fiscalYearsCache.some(fy =>
            (fy.fy_status === 'OPEN') ||
            (fy.orcamento_fechado === true && !fy.ano_fiscal_fechado)
        );
    }
    // Fallback legado enquanto o cache não é carregado no login
    return projectsData.some(p => p.etapa_atual && p.etapa_atual !== 'BUSINESS CASE');
}
