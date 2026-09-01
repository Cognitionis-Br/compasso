// =========================================================================
// config/ano-fiscal.js
// Painel de Gestão do Ano Fiscal: mostra o AF corrente, quarter atual e
// próximo AF (calculados por js/core/fiscal-year.js), e permite abrir o
// recebimento de demandas para o próximo AF — ação permitida somente
// durante o Q4 do AF corrente, conforme Especificacao_Workflow_v2.md,
// seção 5.
//
// NOTA DE ESCOPO: este módulo só controla a FLAG de abertura
// (anos_fiscais_config). Ele NÃO altera, nesta etapa, a lógica de qual AF
// uma nova demanda recebe em saveBusinessCase/atualizarCodigoProjetoAutomatico
// (que hoje sempre aponta para proximoAFStr) — isso fica registrado como
// gap a fechar numa etapa futura dedicada, para não mudar esse
// comportamento sem revisão própria.
// =========================================================================

async function loadAnoFiscalConfig() {
    const infoAF = getInfoAnoFiscal();
    const { data, error } = await _supabase
        .from('anos_fiscais_config')
        .select('*')
        .in('ano_fiscal', [infoAF.afAtualStr, infoAF.proximoAFStr]);

    anosFiscaisConfigData = error ? [] : (data || []);
    renderAnoFiscalPanel();
}

function statusAnoFiscal(afStr) {
    const row = anosFiscaisConfigData.find(r => r.ano_fiscal === afStr);
    return row ? row.recebimento_demandas_aberto : false;
}

function obterConfigAF(afStr) {
    return anosFiscaisConfigData.find(r => r.ano_fiscal === afStr) || null;
}

function renderStatusFechamentoAF(afStr) {
    const config = obterConfigAF(afStr);
    if (!config || !config.orcamento_fechado) return '';
    const data = config.fechado_em ? new Date(config.fechado_em).toLocaleDateString('pt-BR') : '-';
    return `<div class="text-[10px] text-gray-500 mt-1">🔒 Orçamento fechado por <b>${config.fechado_por}</b> em ${data}</div>`;
}

function renderAnoFiscalPanel() {
    const container = document.getElementById('painelGestaoAnoFiscal');
    if (!container) return;

    const infoAF = getInfoAnoFiscal();
    const proximoAberto = statusAnoFiscal(infoAF.proximoAFStr);
    // AJUSTADO (item 3, Fase 1): não é mais restrito ao Q4 — agora
    // permitido sempre que o AF corrente já estiver com o orçamento
    // fechado (não é permitido ter dois AFs "na mesma situação" ao
    // mesmo tempo — um aberto pra novas demandas enquanto o outro
    // ainda está em construção).
    const configAtualAF = obterConfigAF(infoAF.afAtualStr);
    const afAtualFechado = configAtualAF ? configAtualAF.orcamento_fechado === true : false;
    const podeAbrir = afAtualFechado && !proximoAberto;

    // BOOTSTRAP (2026-09-01): depois de "Limpar Base Completamente" a
    // tabela anos_fiscais_config fica vazia — não existe linha nem pro AF
    // corrente. Sem isso, nenhuma tela que lê AF (Formalizar Demanda,
    // Pilar Estratégico, etc.) tem o que listar, e o botão de "abrir
    // próximo AF" fica travado (exige o corrente fechado). Aqui a tela
    // deixa inicializar o AF corrente do zero.
    if (!configAtualAF) {
        container.innerHTML = `
            <div class="bg-amber-50 border-2 border-amber-300 rounded-lg p-4">
                <h4 class="text-sm font-bold text-amber-800 mb-1"><i class="fa-solid fa-triangle-exclamation"></i> Nenhum Ano Fiscal configurado</h4>
                <p class="text-xs text-amber-700 mb-3">
                    O Ano Fiscal corrente (<b>${infoAF.afAtualStr}</b>) ainda não existe em <code>anos_fiscais_config</code>
                    — normal logo após uma limpeza total de base. Inicialize-o para liberar o recebimento de demandas
                    e as telas que dependem de Ano Fiscal (Formalizar Demanda, Pilar Estratégico, etc.).
                </p>
                <button onclick="inicializarAnoFiscalCorrente()"
                    class="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded text-xs transition">
                    <i class="fa-solid fa-calendar-plus"></i> Inicializar ${infoAF.afAtualStr} (aberto para demandas)
                </button>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm">
            <div class="bg-gray-50 border border-gray-200 rounded p-3">
                <div class="text-[10px] font-bold uppercase text-gray-500">Ano Fiscal Corrente</div>
                <div class="font-bold text-lg text-gray-800">${infoAF.afAtualStr}</div>
                <div class="text-xs text-gray-500">Quarter atual: <b>${infoAF.quarterAtual}</b></div>
                ${renderStatusFechamentoAF(infoAF.afAtualStr)}
            </div>
            <div class="bg-gray-50 border border-gray-200 rounded p-3">
                <div class="text-[10px] font-bold uppercase text-gray-500">Próximo Ano Fiscal</div>
                <div class="font-bold text-lg text-gray-800">${infoAF.proximoAFStr}</div>
                <div class="text-xs mt-1">
                    ${proximoAberto
                        ? '<span class="bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded">🟢 Aberto para demandas</span>'
                        : '<span class="bg-gray-200 text-gray-600 font-bold px-2 py-0.5 rounded">⚪ Ainda fechado</span>'}
                </div>
                ${renderStatusFechamentoAF(infoAF.proximoAFStr)}
            </div>
            <div class="bg-gray-50 border border-gray-200 rounded p-3 flex items-center justify-center">
                <button
                    onclick="abrirRecebimentoProximoAF()"
                    ${podeAbrir ? '' : 'disabled'}
                    class="w-full font-bold py-2 px-3 rounded text-xs transition ${podeAbrir ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}"
                    title="${!afAtualFechado ? `O orçamento do ${infoAF.afAtualStr} precisa estar fechado antes de abrir o próximo AF` : (proximoAberto ? 'Já está aberto' : '')}"
                >
                    <i class="fa-solid fa-calendar-check"></i> Abrir Recebimento de Demandas para ${infoAF.proximoAFStr}
                </button>
            </div>
        </div>
        ${!afAtualFechado && !proximoAberto
            ? `<p class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2"><i class="fa-solid fa-circle-info"></i> A abertura do próximo Ano Fiscal só é permitida depois que o orçamento do ${infoAF.afAtualStr} estiver fechado — não é permitido ter dois Anos Fiscais abertos ao mesmo tempo.</p>`
            : ''}
    `;
}

// Consulta qual Ano Fiscal está com recebimento de demandas aberto agora
// (Especificacao_Workflow_v4.md, seção 3 — G10, corrigido 10/08/2026).
// Usada por saveBusinessCase/atualizarCodigoProjetoAutomatico
// (js/projects/core.js) para direcionar demandas normais (não Extraordinário)
// para o AF correto, em vez de sempre assumir "o próximo".
// CORRIGIDO (bug reportado pelo usuário — item 1: com o AF em andamento
// fechado e o próximo já aberto, só aparecia o fechado): a consulta não
// excluía AFs com orcamento_fechado=true nem tinha ordenação — se dado
// antigo (de antes da correção anterior) ainda tiver
// recebimento_demandas_aberto=true tanto no AF fechado quanto no novo,
// a consulta sem ORDER BY podia devolver o AF errado (o fechado) de
// forma não-determinística. Agora exclui explicitamente qualquer AF já
// fechado, e ordena pelo mais recente como desempate.
async function obterAFAbertoParaDemandas() {
    const { data, error } = await _supabase
        .from('anos_fiscais_config')
        .select('ano_fiscal, orcamento_fechado')
        .eq('recebimento_demandas_aberto', true)
        .order('ano_fiscal', { ascending: false });

    if (error || !data) return null;
    const valido = data.find(r => r.orcamento_fechado !== true);
    return valido ? valido.ano_fiscal : null;
}

// BOOTSTRAP (2026-09-01): cria a linha do AF corrente em anos_fiscais_config
// quando ela não existe (base recém-limpada). Estado inicial = aberto para
// demandas, orçamento não fechado — o mesmo que limparBaseSomenteAF2027 já
// deixava pro AF preservado.
async function inicializarAnoFiscalCorrente() {
    if (!usuarioPodeAlterarTela('ano_fiscal') && !usuarioPodeIncluirTela('ano_fiscal')) {
        return alert('Você não tem permissão para inicializar o Ano Fiscal.');
    }
    const infoAF = getInfoAnoFiscal();
    if (!confirm(`Inicializar o Ano Fiscal ${infoAF.afAtualStr}?\n\nEle nasce ABERTO para recebimento de demandas normais, com o orçamento ainda em construção (não fechado).`)) {
        return;
    }
    const { error } = await _supabase.from('anos_fiscais_config').upsert({
        ano_fiscal: infoAF.afAtualStr,
        recebimento_demandas_aberto: true,
        orcamento_fechado: false,
        aberto_por: currentUser ? currentUser.nome : null,
        aberto_em: new Date().toISOString()
    }, { onConflict: 'ano_fiscal' });
    if (error) return alert('Erro ao inicializar o Ano Fiscal: ' + error.message);

    alert(`✅ ${infoAF.afAtualStr} inicializado e aberto para demandas.`);
    await loadAnoFiscalConfig();
}

async function abrirRecebimentoProximoAF() {
    if (!usuarioPodeAlterarTela('ano_fiscal') && !usuarioPodeIncluirTela('ano_fiscal')) return alert('Você não tem permissão para abrir/gerir o Ano Fiscal.');
    const infoAF = getInfoAnoFiscal();

    // AJUSTADO (item 3, Fase 1): a regra de "só no Q4" deixou de
    // existir — confere de novo aqui, no momento de confirmar, se o AF
    // corrente já está com o orçamento fechado (mesma regra do painel,
    // reconferida por segurança).
    const { data: configAtual } = await _supabase.from('anos_fiscais_config').select('orcamento_fechado').eq('ano_fiscal', infoAF.afAtualStr).maybeSingle();
    if (!configAtual || !configAtual.orcamento_fechado) {
        return alert(`⛔ O orçamento do ${infoAF.afAtualStr} precisa estar fechado antes de abrir o próximo Ano Fiscal — não é permitido ter dois Anos Fiscais abertos ao mesmo tempo.`);
    }
    if (statusAnoFiscal(infoAF.proximoAFStr)) {
        return alert(`O ${infoAF.proximoAFStr} já está aberto para recebimento de demandas.`);
    }
    if (!confirm(`Confirma a abertura do ${infoAF.proximoAFStr} para recebimento de novas demandas?`)) {
        return;
    }

    const payload = {
        ano_fiscal: infoAF.proximoAFStr,
        recebimento_demandas_aberto: true,
        aberto_por: currentUser ? currentUser.nome : null,
        aberto_em: new Date().toISOString()
    };

    const { error } = await _supabase.from('anos_fiscais_config').upsert(payload);
    if (error) return alert('Erro ao abrir o Ano Fiscal: ' + error.message);

    alert(`✅ ${infoAF.proximoAFStr} aberto para recebimento de demandas!`);
    await loadAnoFiscalConfig();
}
