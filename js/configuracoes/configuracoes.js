// =========================================================================
// configuracoes/configuracoes.js
// Compasso 2.0 — Release 4, tela "Configurações" do pacote. Zero lógica
// nova — só cards que levam pras ~6 telas de configuração hoje
// espalhadas em Administração/Proprietário. Cada tela original continua
// existindo e acessível pelo próprio link do menu; isto é só um atalho
// consolidado.
// =========================================================================

const CONFIGURACOES_CATALOGO = [
    { icone: 'fa-toggle-on', titulo: 'Licenciamento de Módulos', descricao: 'Ativar/desativar módulos comerciais do Compasso.', tab: 'licenciamento_modulos' },
    { icone: 'fa-calendar-days', titulo: 'Período do Ano Fiscal', descricao: 'Mês de início do Ano Fiscal.', tab: 'periodo_ano_fiscal' },
    { icone: 'fa-sliders', titulo: 'Controle Orçamentário', descricao: 'Modo de controle orçamentário e trade-off.', tab: 'controle_orcamento' },
    { icone: 'fa-percent', titulo: '% Bloqueio de Orçamento', descricao: 'Limite de variação que bloqueia um projeto automaticamente.', tab: 'percentual_bloqueio_orcamento' },
    { icone: 'fa-envelope-open-text', titulo: 'Templates de E-mail', descricao: 'Gestão do fluxo e dos modelos de e-mail do sistema.', tab: 'gestao_fluxo_email' },
    { icone: 'fa-wand-magic-sparkles', titulo: 'Configuração de IA', descricao: 'Chave geral e modelo do Módulo de Construção com IA.', tab: 'ia_config' }
];

function renderConfiguracoesView() {
    const wrapper = document.getElementById('configuracoesLista');
    if (!wrapper) return;
    wrapper.innerHTML = CONFIGURACOES_CATALOGO.map(c => `
        <div class="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 shadow-sm cursor-pointer hover:border-indigo-300" onclick="switchTab('${c.tab}')">
            <div class="flex items-center gap-3 min-w-0">
                <div class="w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center flex-shrink-0"><i class="fa-solid ${c.icone}"></i></div>
                <div class="min-w-0">
                    <div class="text-sm font-bold text-gray-800">${escapeHtml(c.titulo)}</div>
                    <div class="text-[11px] text-gray-400">${escapeHtml(c.descricao)}</div>
                </div>
            </div>
            <i class="fa-solid fa-chevron-right text-gray-300 flex-shrink-0 ml-2"></i>
        </div>
    `).join('');
}
