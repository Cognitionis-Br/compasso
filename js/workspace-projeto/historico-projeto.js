// =========================================================================
// workspace-projeto/historico-projeto.js
// Compasso 2.0 — Release 2, aba Histórico do Workspace. Não cria nenhuma
// tabela/view SQL nova — reaproveita as MESMAS consultas por domínio já
// usadas em js/projeto-detalhe/projeto-detalhe.js (log_decisoes_etapa,
// log_ratificacao_planejamento, log_alteracoes_horas,
// log_alteracao_vinculo_contrato, log_aprovacao_mudanca_orcamento,
// fechamento_af_decisoes, log_retomada_hold) + task_history (Release 1),
// e só normaliza tudo num timeline único ordenado por data.
// =========================================================================

async function renderHistoricoProjeto(projetoCodigo, wrapperElId) {
    const wrapper = document.getElementById(wrapperElId);
    if (!wrapper) return;
    wrapper.innerHTML = renderLoadingState();

    const [
        decisoesEtapa, ratificacoes, horas, vinculosContrato,
        mudancaOrcamento, fechamentoAF, retomadaHold, taskHistory
    ] = await Promise.all([
        _supabase.from('log_decisoes_etapa').select('*').eq('projeto_codigo', projetoCodigo),
        _supabase.from('log_ratificacao_planejamento').select('*').eq('projeto_codigo', projetoCodigo),
        _supabase.from('log_alteracoes_horas').select('*').eq('projeto_codigo', projetoCodigo),
        _supabase.from('log_alteracao_vinculo_contrato').select('*').eq('projeto_codigo', projetoCodigo),
        _supabase.from('log_aprovacao_mudanca_orcamento').select('*').eq('projeto_codigo', projetoCodigo),
        _supabase.from('fechamento_af_decisoes').select('*').eq('projeto_codigo', projetoCodigo),
        _supabase.from('log_retomada_hold').select('*').eq('projeto_codigo', projetoCodigo),
        _supabase.from('task_history').select('*, tasks!inner(titulo, projeto_codigo)').eq('tasks.projeto_codigo', projetoCodigo)
    ]);

    const eventos = [];

    (decisoesEtapa.data || []).forEach(d => eventos.push({
        data: d.decidido_em, icone: 'fa-gavel', cor: d.decisao === 'APROVADO' ? 'emerald' : 'danger',
        texto: `${escapeHtml(d.etapa)} — ${d.decisao}${d.motivo ? ': ' + escapeHtml(d.motivo) : ''}`, autor: d.decidido_por
    }));
    (ratificacoes.data || []).forEach(r => eventos.push({
        data: r.decidido_em, icone: 'fa-scale-balanced', cor: 'blue',
        texto: `Planejamento de ${escapeHtml(r.etapa || '')} ${r.decisao === 'RETIFICADO' ? 'retificado' : 'ratificado'}`, autor: r.decidido_por
    }));
    (horas.data || []).forEach(h => eventos.push({
        data: h.alterado_em, icone: 'fa-clock', cor: 'gray',
        texto: `Horas de ${escapeHtml(h.fase || '')} alteradas: ${h.horas_anterior != null ? h.horas_anterior + 'h → ' : ''}${h.horas_novo}h`, autor: h.alterado_por
    }));
    (vinculosContrato.data || []).forEach(v => eventos.push({
        data: v.alterado_em, icone: 'fa-file-contract', cor: 'purple',
        texto: `Vínculo de contrato ${(v.acao || '').toLowerCase()}${v.valor_novo != null ? ': ' + formatCurrency(v.valor_novo) : ''}`, autor: v.alterado_por
    }));
    (mudancaOrcamento.data || []).forEach(m => eventos.push({
        data: m.aprovado_em, icone: 'fa-triangle-exclamation', cor: 'danger',
        texto: `Mudança de orçamento aprovada (${escapeHtml(m.fase_bloqueada || '')}): ${formatCurrency(m.valor_referencia)} → ${formatCurrency(m.valor_novo)}`, autor: m.aprovado_por
    }));
    (fechamentoAF.data || []).forEach(f => eventos.push({
        data: f.decidido_em, icone: 'fa-calendar-check', cor: 'indigo',
        texto: `Fechamento AF ${escapeHtml(f.ano_fiscal || '')}: ${escapeHtml(f.decisao || '')}`, autor: f.decidido_por
    }));
    (retomadaHold.data || []).forEach(h => eventos.push({
        data: h.retomado_em, icone: 'fa-play', cor: 'emerald',
        texto: `Retomado de Hold em ${escapeHtml(h.etapa_atual || '')}`, autor: h.retomado_por
    }));
    (taskHistory.data || []).forEach(t => eventos.push({
        data: t.alterado_em, icone: 'fa-list-check', cor: 'amber',
        texto: `Tarefa "${escapeHtml((t.tasks && t.tasks.titulo) || '')}" — ${escapeHtml(t.campo)}: ${escapeHtml(t.de_valor || '-')} → ${escapeHtml(t.para_valor || '-')}`, autor: null
    }));

    eventos.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

    if (eventos.length === 0) {
        wrapper.innerHTML = '<p class="text-xs text-gray-400 italic py-8 text-center">Nenhum evento registrado ainda.</p>';
        return;
    }

    wrapper.innerHTML = `<div class="space-y-2">${eventos.map(e => `
        <div class="flex items-start gap-3 p-2.5 border border-gray-100 rounded">
            <div class="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 bg-${e.cor}-100 text-${e.cor}-700"><i class="fa-solid ${e.icone} text-[10px]"></i></div>
            <div class="min-w-0 flex-1">
                <div class="text-xs text-gray-700">${e.texto}</div>
                <div class="text-[10px] text-gray-400">${e.autor ? escapeHtml(e.autor) + ' · ' : ''}${e.data ? formatDateTime(e.data) : '-'}</div>
            </div>
        </div>
    `).join('')}</div>`;
}
