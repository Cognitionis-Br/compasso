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
    { titulo: 'Riscos e Ocorrências (RAID)', descricao: 'Todos os itens RAID dos projetos aos quais você tem acesso.', acao: 'relatorioExportarRaid' }
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
