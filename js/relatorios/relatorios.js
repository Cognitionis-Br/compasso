// =========================================================================
// relatorios/relatorios.js
// Compasso 2.0 — Release 4, tela "Relatórios" do pacote. Catálogo simples
// — nenhum export aqui é recalculado do zero, cada botão só dispara a
// MESMA função de exportação CSV que já existia espalhada (Dashboard) ou
// deriva de uma consulta já usada em outra tela (Minhas Aprovações, RAID).
// Sem REPORT_DEFINITION/execução assíncrona — CSV síncrono, mesmo padrão
// de sempre (js/utils/csv-export.js).
// =========================================================================

const RELATORIOS_CATALOGO = [
    { titulo: 'Status Detalhado da Carteira', descricao: 'Farol, fase e financeiro de todos os projetos (mesmo export do Dashboard).', acao: 'relatorioExportarStatusDetalhado' },
    { titulo: 'Consolidação por Fase', descricao: 'Quantidade e orçado por fase da carteira (mesmo export do Dashboard).', acao: 'relatorioExportarConsolidacaoFases' },
    { titulo: 'Orçado × Realizado por Área', descricao: 'Mesmo export já disponível no Dashboard (funis de criação).', acao: 'relatorioExportarOrcadoRealizado' },
    { titulo: 'Minhas Aprovações', descricao: 'Lista de tudo que está pendente de aprovação pra você agora.', acao: 'relatorioExportarMinhasAprovacoes' },
    { titulo: 'Riscos e Ocorrências (RAID)', descricao: 'Todos os itens RAID dos projetos aos quais você tem acesso.', acao: 'relatorioExportarRaid' },
    // V14 — M13 Enhanced Reports
    { titulo: 'Tarefas da Carteira', descricao: 'Todas as tarefas dos projetos visíveis com status, prioridade e prazo.', acao: 'relatorioExportarTarefas' },
    { titulo: 'Gates e Aprovações', descricao: 'Histórico de gates (RAID crítico, orçamento, fase) com resultado e justificativa.', acao: 'relatorioExportarGates' },
    { titulo: 'Histórico de Licenciamento', descricao: 'Auditoria de todas as alterações de entitlements de módulos (desde V13).', acao: 'relatorioExportarHistoricoLicenca' },
    // V16 — M16 Audit Export
    { titulo: 'Auditoria de Projetos', descricao: 'Histórico completo de alterações em Business Cases e Projects (todas as páginas, não só a visão atual).', acao: 'relatorioExportarAuditoria' },
    // V19 — M12 FY closing decisions
    { titulo: 'Decisões de Fechamento AF', descricao: 'Histórico de todas as decisões de fechamento de Ano Fiscal por projeto (Carryover, Hold, Cancelar, Absorção).', acao: 'relatorioExportarDecisoesFechamentoAF' },
    // V20 — V8 Financial tracking exports
    { titulo: 'Medições de Custo', descricao: 'Registros periódicos de custo real por projeto (EAC / Financeiro Avançado).', acao: 'relatorioExportarMedicoes' },
    { titulo: 'Forecasts (EAC)', descricao: 'Histórico de revisões de Estimate at Completion por projeto.', acao: 'relatorioExportarForecasts' }
];

function renderRelatoriosView() {
    const wrapper = document.getElementById('relatoriosLista');
    if (!wrapper) return;
    wrapper.innerHTML = RELATORIOS_CATALOGO.map(r => `
        <div class="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
            <div class="min-w-0">
                <div class="text-sm font-bold text-gray-800">${escapeHtml(r.titulo)}</div>
                <div class="text-[11px] text-gray-400">${escapeHtml(r.descricao)}</div>
            </div>
            <button onclick="${r.acao}(this)" class="text-xs font-bold text-indigo-700 hover:text-indigo-900 flex-shrink-0 ml-3"><i class="fa-solid fa-file-csv"></i> Baixar CSV</button>
        </div>
    `).join('');
}

// Os 3 exports do Dashboard dependem de caches (_dashStatusCsvCache etc.)
// só preenchidos quando o Dashboard renderiza — chama renderDashboardMetrics()
// primeiro (escreve nos elementos ocultos da própria tela do Dashboard,
// sem efeito colateral visível aqui) pra garantir que o cache está fresco
// mesmo se o usuário nunca abriu o Dashboard nesta sessão.
async function _relatorioGarantirCacheDashboard() {
    if (typeof renderDashboardMetrics === 'function') await renderDashboardMetrics();
}

async function relatorioExportarStatusDetalhado(btn) {
    await _relatorioComFeedback(btn, async () => {
        await _relatorioGarantirCacheDashboard();
        exportarStatusDetalhadoCSV();
    });
}

async function relatorioExportarConsolidacaoFases(btn) {
    await _relatorioComFeedback(btn, async () => {
        await _relatorioGarantirCacheDashboard();
        exportarConsolidacaoFasesCSV();
    });
}

async function relatorioExportarOrcadoRealizado(btn) {
    await _relatorioComFeedback(btn, async () => {
        await _relatorioGarantirCacheDashboard();
        exportarOrcadoRealizadoCSV();
    });
}

async function relatorioExportarMinhasAprovacoes(btn) {
    await _relatorioComFeedback(btn, async () => {
        const itens = await obterMinhasAprovacoes();
        exportarCSV(
            ['Código', 'Projeto', 'Origem'],
            itens.map(({ p, origem }) => [p.codigo, p.nome || '', origem]),
            'minhas_aprovacoes'
        );
    });
}

async function relatorioExportarRaid(btn) {
    await _relatorioComFeedback(btn, async () => {
        // Sem filtro explícito de projeto — RLS de raid_items
        // (fn_usuario_tem_acesso_projeto, Release 2/3) já devolve só o
        // que o usuário logado pode ver.
        const { data, error } = await _supabase.from('raid_items').select('*').order('criado_em', { ascending: false });
        if (error) return alert('Erro ao gerar o relatório: ' + error.message);
        exportarCSV(
            ['Projeto', 'Tipo', 'Título', 'Status', 'Impacto', 'Prazo'],
            (data || []).map(i => [i.projeto_codigo, i.tipo, i.titulo, i.status, i.impacto || '-', i.prazo || '-']),
            'raid_riscos_e_ocorrencias'
        );
    });
}

// ---- V14: M13 Enhanced Reports ------------------------------------------

async function relatorioExportarTarefas(btn) {
    await _relatorioComFeedback(btn, async () => {
        const { data, error } = await _supabase.from('tasks')
            .select('projeto_codigo, titulo, status, prioridade, prazo, assigned_user_id, criado_por')
            .order('prazo', { ascending: true, nullsFirst: false });
        if (error) return alert('Erro ao gerar o relatório: ' + error.message);
        exportarCSV(
            ['Projeto', 'Título', 'Status', 'Prioridade', 'Prazo', 'Responsável (ID)', 'Criado por'],
            (data || []).map(t => [
                t.projeto_codigo || '',
                t.titulo || '',
                t.status || '',
                t.prioridade || '',
                t.prazo || '',
                t.assigned_user_id || '',
                t.criado_por || ''
            ]),
            'tarefas_carteira'
        );
    });
}

async function relatorioExportarGates(btn) {
    await _relatorioComFeedback(btn, async () => {
        const { data, error } = await _supabase.from('gates')
            .select('projeto_codigo, tipo, severidade, resultado, criado_por, aprovado_em, justificativa')
            .order('criado_em', { ascending: false });
        if (error) return alert('Erro ao gerar o relatório: ' + error.message);
        exportarCSV(
            ['Projeto', 'Tipo', 'Severidade', 'Resultado', 'Criado por', 'Aprovado em', 'Justificativa'],
            (data || []).map(g => [
                g.projeto_codigo || '',
                g.tipo || '',
                g.severidade || '',
                g.resultado || '',
                g.criado_por || '',
                g.aprovado_em ? g.aprovado_em.split('T')[0] : '',
                g.justificativa || ''
            ]),
            'gates_aprovacoes'
        );
    });
}

async function relatorioExportarHistoricoLicenca(btn) {
    await _relatorioComFeedback(btn, async () => {
        const { data, error } = await _supabase.from('licenca_modulos_historico')
            .select('modulo_codigo, campo_alterado, valor_anterior, valor_novo, alterado_por, alterado_em')
            .order('alterado_em', { ascending: false });
        if (error) return alert('Erro ao gerar o relatório: ' + error.message);
        exportarCSV(
            ['Módulo', 'Campo', 'Valor Anterior', 'Valor Novo', 'Alterado por', 'Quando'],
            (data || []).map(h => [
                h.modulo_codigo || '',
                h.campo_alterado || '',
                h.valor_anterior != null ? h.valor_anterior : '',
                h.valor_novo != null ? h.valor_novo : '',
                h.alterado_por || '',
                h.alterado_em ? h.alterado_em.split('T')[0] : ''
            ]),
            'historico_licenciamento'
        );
    });
}

// ---- V20: V8 Financial Tracking exports ----------------------------------

async function relatorioExportarMedicoes(btn) {
    await _relatorioComFeedback(btn, async () => {
        const { data, error } = await _supabase.from('medicoes')
            .select('projeto_codigo, periodo, valor, descricao, criado_por, criado_em')
            .order('criado_em', { ascending: false });
        if (error) return alert('Erro ao gerar o relatório: ' + error.message);
        exportarCSV(
            ['Projeto', 'Período', 'Valor', 'Descrição', 'Registrado por', 'Quando'],
            (data || []).map(m => [
                m.projeto_codigo || '',
                m.periodo || '',
                m.valor != null ? m.valor : '',
                m.descricao || '',
                m.criado_por || '',
                m.criado_em ? m.criado_em.replace('T', ' ').substring(0, 19) : ''
            ]),
            'medicoes_custo'
        );
    });
}

async function relatorioExportarForecasts(btn) {
    await _relatorioComFeedback(btn, async () => {
        const { data, error } = await _supabase.from('forecasts')
            .select('projeto_codigo, valor_eac, premissa, criado_por, criado_em')
            .order('criado_em', { ascending: false });
        if (error) return alert('Erro ao gerar o relatório: ' + error.message);
        exportarCSV(
            ['Projeto', 'EAC (R$)', 'Premissa', 'Registrado por', 'Quando'],
            (data || []).map(f => [
                f.projeto_codigo || '',
                f.valor_eac != null ? f.valor_eac : '',
                f.premissa || '',
                f.criado_por || '',
                f.criado_em ? f.criado_em.replace('T', ' ').substring(0, 19) : ''
            ]),
            'forecasts_eac'
        );
    });
}

// ---- V19: M12 FY Closing Decisions export --------------------------------

async function relatorioExportarDecisoesFechamentoAF(btn) {
    await _relatorioComFeedback(btn, async () => {
        const { data, error } = await _supabase.from('fechamento_af_decisoes')
            .select('ano_fiscal, projeto_codigo, decisao, valor_remanescente, observacao, decidido_por, decidido_em')
            .order('decidido_em', { ascending: false });
        if (error) return alert('Erro ao gerar o relatório: ' + error.message);
        exportarCSV(
            ['Ano Fiscal', 'Projeto', 'Decisão', 'Orç. Remanescente', 'Observação', 'Decidido por', 'Quando'],
            (data || []).map(d => [
                d.ano_fiscal || '',
                d.projeto_codigo || '',
                d.decisao || '',
                d.valor_remanescente != null ? d.valor_remanescente : '',
                d.observacao || '',
                d.decidido_por || '',
                d.decidido_em ? d.decidido_em.replace('T', ' ').substring(0, 19) : ''
            ]),
            'decisoes_fechamento_af'
        );
    });
}

// ---- V16: M16 Audit Export -----------------------------------------------

async function relatorioExportarAuditoria(btn) {
    await _relatorioComFeedback(btn, async () => {
        // Exporta audit_events completo (sem limite de página), ao contrário
        // de auditExportarCSV em auditoria.js que lê só a página renderizada.
        const { data, error } = await _supabase.from('audit_events')
            .select('criado_em, entidade, entidade_id, acao, campo, valor_anterior, valor_novo, usuario, origem')
            .order('criado_em', { ascending: false });
        if (error) return alert('Erro ao gerar o relatório: ' + error.message);
        exportarCSV(
            ['Data/Hora', 'Entidade', 'Projeto/ID', 'Ação', 'Campo', 'Anterior', 'Novo', 'Usuário', 'Origem'],
            (data || []).map(ev => [
                ev.criado_em ? ev.criado_em.replace('T', ' ').substring(0, 19) : '',
                ev.entidade || '',
                ev.entidade_id || '',
                ev.acao || '',
                ev.campo || '',
                ev.valor_anterior != null ? ev.valor_anterior : '',
                ev.valor_novo != null ? ev.valor_novo : '',
                ev.usuario || '',
                ev.origem || ''
            ]),
            'auditoria_projetos'
        );
    });
}

// -------------------------------------------------------------------------

async function _relatorioComFeedback(btn, fn) {
    const textoOriginal = btn ? btn.innerHTML : '';
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando...'; }
    try {
        await fn();
    } catch (e) {
        alert('Erro ao gerar o relatório: ' + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = textoOriginal; }
    }
}
