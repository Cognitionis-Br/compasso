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
// =========================================================================

async function renderPercentualBloqueioOrcamentoView() {
    const { data, error } = await _supabase.from('config_bloqueio_orcamento').select('*').eq('id', 1).maybeSingle();
    const cfg = error || !data ? {} : data;

    const el = document.getElementById('bloqueioPercentualVariacao');
    if (el) el.value = (cfg.percentual_bloqueio_variacao === null || cfg.percentual_bloqueio_variacao === undefined) ? '' : cfg.percentual_bloqueio_variacao;
}

async function salvarPercentualBloqueioOrcamento() {
    const bruto = (document.getElementById('bloqueioPercentualVariacao').value || '').trim();
    const valor = bruto === '' ? null : Number(bruto);
    if (valor !== null && (isNaN(valor) || valor < 0)) {
        return alert('Percentual inválido — informe um número positivo ou deixe em branco (sem bloqueio).');
    }

    const payload = {
        percentual_bloqueio_variacao: valor,
        atualizado_por: currentUser ? currentUser.nome : 'desconhecido',
        atualizado_em: new Date().toISOString()
    };

    const { error } = await _supabase.from('config_bloqueio_orcamento').update(payload).eq('id', 1);
    if (error) return alert('Erro ao salvar o percentual: ' + error.message);

    alert('✅ Percentual de bloqueio de orçamento salvo com sucesso!');
    await renderPercentualBloqueioOrcamentoView();
}
