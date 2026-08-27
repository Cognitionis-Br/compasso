// =========================================================================
// config/bloqueio-orcamento.js
// NOVO (a pedido do usuário 27/08/2026): Percentual de Bloqueio de
// Orçamento — tela de configuração (1 linha só, mesmo modelo de
// config_email_geral) do percentual aceito de variação de horas/valor na
// conclusão de Requerimentos e de Technical. Usado por
// confirmarConclusaoFaseGenerica (js/requirements/requirements.js) pra
// decidir se bloqueia o projeto pra Mudança de Orçamento (Governança).
//
// Nasce com tudo NULL — sem bloqueio nenhum até o admin preencher aqui.
// =========================================================================

async function renderPercentualBloqueioOrcamentoView() {
    const { data, error } = await _supabase.from('config_bloqueio_orcamento').select('*').eq('id', 1).maybeSingle();
    const cfg = error || !data ? {} : data;

    const preencher = (id, valor) => {
        const el = document.getElementById(id);
        if (el) el.value = (valor === null || valor === undefined) ? '' : valor;
    };
    preencher('bloqueioReqPercentualHoras', cfg.req_percentual_horas);
    preencher('bloqueioReqPercentualValor', cfg.req_percentual_valor);
    preencher('bloqueioTechPercentualHoras', cfg.tech_percentual_horas);
    preencher('bloqueioTechPercentualValor', cfg.tech_percentual_valor);
}

async function salvarPercentualBloqueioOrcamento() {
    const lerPercentual = (id) => {
        const bruto = (document.getElementById(id).value || '').trim();
        return bruto === '' ? null : Number(bruto);
    };

    const campos = [
        ['Requerimentos — Horas', 'bloqueioReqPercentualHoras'],
        ['Requerimentos — Valor', 'bloqueioReqPercentualValor'],
        ['Technical — Horas', 'bloqueioTechPercentualHoras'],
        ['Technical — Valor', 'bloqueioTechPercentualValor']
    ];
    const valores = {};
    for (const [label, id] of campos) {
        const v = lerPercentual(id);
        if (v !== null && (isNaN(v) || v < 0)) {
            return alert(`Percentual inválido em "${label}" — informe um número positivo ou deixe em branco (sem bloqueio nesse campo).`);
        }
        valores[id] = v;
    }

    const payload = {
        req_percentual_horas: valores.bloqueioReqPercentualHoras,
        req_percentual_valor: valores.bloqueioReqPercentualValor,
        tech_percentual_horas: valores.bloqueioTechPercentualHoras,
        tech_percentual_valor: valores.bloqueioTechPercentualValor,
        atualizado_por: currentUser ? currentUser.nome : 'desconhecido',
        atualizado_em: new Date().toISOString()
    };

    const { error } = await _supabase.from('config_bloqueio_orcamento').update(payload).eq('id', 1);
    if (error) return alert('Erro ao salvar os percentuais: ' + error.message);

    alert('✅ Percentuais de bloqueio de orçamento salvos com sucesso!');
    await renderPercentualBloqueioOrcamentoView();
}
