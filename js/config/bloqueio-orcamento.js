// =========================================================================
// config/bloqueio-orcamento.js
// NOVO (a pedido do usuário 27/08/2026): Percentual de Bloqueio de
// Orçamento — tela de configuração (1 linha só, mesmo modelo de
// config_email_geral) do percentual aceito de variação de horas/valor na
// conclusão de Requerimentos e de Technical. Usado por
// confirmarConclusaoFaseGenerica (js/requirements/requirements.js) pra
// decidir se bloqueia o projeto pra Mudança de Orçamento (Governança).
//
// SIMPLIFICADO (Licenciamento de Módulos, 28/08/2026): eram 4 campos
// separados (req/tech × horas/valor) — viraram 1 parâmetro único
// (percentual_bloqueio_variacao), aplicado igual nas duas fases e nas
// duas dimensões. As 4 colunas antigas continuam na base (histórico), só
// deixaram de ser lidas/escritas por aqui. Esta tela só é alcançável
// quando o módulo FINANCEIRO está ativo (TAB_MODULO_MAP, js/core/licenca.js).
//
// Nasce NULL — sem bloqueio nenhum até o admin preencher aqui.
//
// AJUSTADO (a pedido do usuário): a tela salvava mas não mostrava o
// percentual vigente nem histórico de alteração. config_bloqueio_orcamento
// continua sendo 1 linha só (id=1, UPDATE — é o que
// confirmarConclusaoFaseGenerica lê em tempo real); o histórico vai pra
// log_percentual_bloqueio_orcamento (append-only, um INSERT por save),
// exibido no mesmo padrão de "Controle Orçamentário" (linha de log +
// tabela de histórico — js/config/controle-orcamento.js).
// =========================================================================

let bloqueioPercentualCache = null;

async function renderPercentualBloqueioOrcamentoView() {
    const { data, error } = await _supabase.from('config_bloqueio_orcamento').select('*').eq('id', 1).maybeSingle();
    const cfg = error || !data ? {} : data;
    bloqueioPercentualCache = (cfg.percentual_bloqueio_variacao === null || cfg.percentual_bloqueio_variacao === undefined) ? null : cfg.percentual_bloqueio_variacao;

    const el = document.getElementById('bloqueioPercentualVariacao');
    if (el) el.value = bloqueioPercentualCache === null ? '' : bloqueioPercentualCache;

    const elLog = document.getElementById('bloqueioPercentualLog');
    if (elLog) {
        const vigente = bloqueioPercentualCache === null ? 'sem bloqueio (em branco)' : `${bloqueioPercentualCache}%`;
        elLog.innerHTML = cfg.atualizado_em
            ? `Percentual vigente: <b>${vigente}</b> · última alteração por <b class="uppercase">${escapeHtml(cfg.atualizado_por || '-')}</b> em ${new Date(cfg.atualizado_em).toLocaleString('pt-BR')}.`
            : `Percentual vigente: <b>${vigente}</b> (nunca alterado).`;
    }

    await _renderHistoricoBloqueioOrcamento();
}

function _fmtPercentualBloqueio(v) {
    return (v === null || v === undefined) ? 'sem bloqueio' : `${v}%`;
}

async function _renderHistoricoBloqueioOrcamento() {
    const tbody = document.getElementById('bloqueioPercentualHistorico');
    if (!tbody) return;
    const { data, error } = await _supabase.from('log_percentual_bloqueio_orcamento').select('*').order('alterado_em', { ascending: false });
    const linhas = error ? [] : (data || []);
    tbody.innerHTML = linhas.length === 0
        ? `<tr><td colspan="3" class="p-2 text-center text-gray-400 font-bold">Sem alterações registradas.</td></tr>`
        : linhas.map(l => `
            <tr>
                <td class="p-2 font-bold">${_fmtPercentualBloqueio(l.percentual_novo)} <span class="text-gray-400 font-normal">(anterior: ${_fmtPercentualBloqueio(l.percentual_anterior)})</span></td>
                <td class="p-2 uppercase font-bold">${escapeHtml(l.alterado_por || '-')}</td>
                <td class="p-2">${l.alterado_em ? new Date(l.alterado_em).toLocaleString('pt-BR') : '-'}</td>
            </tr>`).join('');
}

async function salvarPercentualBloqueioOrcamento() {
    if (!usuarioPodeAlterarTela('percentual_bloqueio_orcamento')) return alert('Você não tem permissão para alterar o percentual de bloqueio.');
    const bruto = (document.getElementById('bloqueioPercentualVariacao').value || '').trim();
    const valor = bruto === '' ? null : Number(bruto);
    if (valor !== null && (isNaN(valor) || valor < 0)) {
        return alert('Percentual inválido — informe um número positivo ou deixe em branco (sem bloqueio).');
    }
    if (valor === bloqueioPercentualCache) {
        return alert('O percentual informado já é o vigente — nada a salvar.');
    }

    const percentualAnterior = bloqueioPercentualCache;
    const nomeUsuario = currentUser ? currentUser.nome : 'desconhecido';
    const payload = {
        percentual_bloqueio_variacao: valor,
        atualizado_por: nomeUsuario,
        atualizado_em: new Date().toISOString()
    };

    const { error } = await _supabase.from('config_bloqueio_orcamento').update(payload).eq('id', 1);
    if (error) return alert('Erro ao salvar o percentual: ' + error.message);

    const { error: errorLog } = await _supabase.from('log_percentual_bloqueio_orcamento').insert([{
        percentual_anterior: percentualAnterior,
        percentual_novo: valor,
        alterado_por: nomeUsuario
    }]);
    if (errorLog) console.error('Erro ao gravar log de percentual de bloqueio (valor já foi salvo):', errorLog.message);

    alert('✅ Percentual de bloqueio de orçamento salvo com sucesso!');
    await renderPercentualBloqueioOrcamentoView();
}
