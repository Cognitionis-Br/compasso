// =========================================================================
// ui/navigation.js
// Navegação entre abas/telas do sistema (switchTab) e abrir/fechar
// submenus do menu lateral (toggleSidebarMenu).
//
// switchTab despacha para as funções de render de cada tela (ex.:
// renderF1Formalizadas, renderDashboardMetrics, etc.) — a maioria delas
// ainda mora em app.js e algumas (formatCurrency, somarDiasUteis,
// calcularSaudeProjeto) já foram extraídas para js/utils/. Como tudo
// continua no mesmo escopo global de scripts clássicos, essas chamadas
// funcionam normalmente independente de onde cada função física está.
//
// Usada por praticamente todo onclick="switchTab(...)" do index.html —
// extração de alto uso, testar com atenção redobrada em todas as abas.
// =========================================================================
// NOVO 10/08/2026 (menu responsivo pro celular): abre/fecha o menu
// lateral em telas estreitas — em telas md+ (tablet/desktop) essas
// classes nem entram em jogo, o menu continua fixo como sempre foi.
function toggleSidebarMobile() {
    const menu = document.getElementById('sidebarMenu');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!menu || !backdrop) return;

    const estaAberto = !menu.classList.contains('-translate-x-full');
    if (estaAberto) {
        menu.classList.add('-translate-x-full');
        menu.classList.remove('translate-x-0');
        backdrop.classList.add('hidden');
    } else {
        menu.classList.remove('-translate-x-full');
        menu.classList.add('translate-x-0');
        backdrop.classList.remove('hidden');
    }
}

function fecharSidebarMobileSeAberto() {
    const menu = document.getElementById('sidebarMenu');
    const backdrop = document.getElementById('sidebarBackdrop');
    if (!menu || !backdrop) return;
    menu.classList.add('-translate-x-full');
    menu.classList.remove('translate-x-0');
    backdrop.classList.add('hidden');
}

// NOVO 10/08/2026 (bug reportado: abas escondidas sem jeito de acessar
// no desktop com mouse — rolagem horizontal sem barra visível não é
// descobrível): rola a nav de abas pelas setas clicáveis, em vez de
// depender só de rolagem invisível.
function rolarAbasVisao(direcao) {
    const nav = document.getElementById('navAbasVisao');
    if (!nav) return;
    nav.scrollBy({ left: direcao * 160, behavior: 'smooth' });
}

function switchTab(tabId) {
    abaAtualId = tabId;

    fecharSidebarMobileSeAberto(); // fecha o menu sozinho no celular ao navegar

    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));

    // NOVO (Licenciamento de Módulos, 28/08/2026): bloqueia o carregamento
    // da view se o módulo dono dela (js/core/licenca.js, TAB_MODULO_MAP)
    // não estiver ativo — mesmo que o acesso seja forçado (URL, console,
    // etc.), sem depender só do menu já estar escondido.
    const moduloDaTela = moduloDoTab(tabId);
    if (moduloDaTela && !moduloAtivo(moduloDaTela)) {
        const nomeExibicao = document.getElementById('moduloBloqueadoNome');
        if (nomeExibicao) nomeExibicao.innerText = NOME_EXIBICAO_MODULO[moduloDaTela] || moduloDaTela;
        const bloqueado = document.getElementById('view-modulo-bloqueado');
        if (bloqueado) bloqueado.classList.remove('hidden');
        return;
    }

    const targetView = document.getElementById('view-' + tabId);
    if (targetView) targetView.classList.remove('hidden');

    document.querySelectorAll('.sidebar-link').forEach(el => {
        el.classList.remove('text-red-600', 'font-bold', 'border-red-600', 'bg-red-50');
        el.classList.add('text-gray-500', 'border-transparent');
    });

    const activeSidebarLink = document.getElementById('link-' + tabId);
    if (activeSidebarLink) {
        activeSidebarLink.classList.remove('text-gray-500', 'border-transparent');
        activeSidebarLink.classList.add('text-red-600', 'font-bold', 'border-red-600', 'bg-red-50');
    }

    document.querySelectorAll('.view-btn').forEach(el => {
        el.classList.remove('bg-gray-100', 'text-gray-900', 'border-b-2', 'border-red-600');
        el.classList.add('text-gray-500');
    });

    const activeViewBtn = document.getElementById('view-btn-' + tabId);
    if (activeViewBtn) {
        activeViewBtn.classList.remove('text-gray-500');
        activeViewBtn.classList.add('bg-gray-100', 'text-gray-900', 'border-b-2', 'border-red-600');
    }

    if (tabId === 'f1_formalizacao') { mudarAbaFormalizarDemanda('criar'); popularOpcoesAFDemanda(); popularTiposProjetoParaDemanda(); popularProdutosParaDemanda(); popularTiposReturnBenefitParaDemanda(); renderF1Formalizadas(); }
    if (tabId === 'f1_orcamento') { mudarAbaOrcamentarDemanda('a_planejar'); renderF1OrcamentoView(); }
    if (tabId === 'aprov_comite') renderAprovComiteView();
    if (tabId === 'aprov_orcamento_af') renderAprovOrcamentoAFView();
    if (tabId === 'req_planejamento') { mudarAbaGerarRequerimentos('a_planejar'); renderReqPlanejamentoView(); }
    if (tabId === 'req_aprov_ti') { mudarAbaAvaliarTI('a_planejar'); renderReqAprovTIView(); }
    if (tabId === 'req_aprov_negocio') { mudarAbaAvaliarNegocio('a_planejar'); renderReqAprovNegocioView(); }
    if (tabId === 'req_conclusao') renderReqConclusaoView();
    if (tabId === 'fase_technical') { mudarAbaGerarEspecificacao('a_planejar'); renderTechView(); }
    if (tabId === 'tech_conclusao') renderTechConclusaoView();
    if (tabId === 'tech_aval_negocio') { mudarAbaAvalEspecNegocio('a_planejar'); renderTechAvalNegocioView(); }
    if (tabId === 'fase_execution') { mudarAbaExecution('a_planejar'); renderExecutionView(); }
    if (tabId === 'fase_uat') { mudarAbaUAT('ratificar'); renderUatView(); }
    if (tabId === 'gestao_templates') { mudarAbaTemplates('incluir'); renderGestaoTemplatesView(); }
    if (tabId === 'gestao_fluxo_email') renderGestaoFluxoEmailView();
    if (tabId === 'fila_email') renderFilaEmailPendentes();
    if (tabId === 'planejamento_estrategico') { mudarAbaPlanejamentoEstrategico('pilares_criar'); renderPlanejamentoEstrategicoView(); }
    if (tabId === 'empresas_terceirizadas') { mudarAbaEmpresas('criar'); renderEmpresasTerceirizadasView(); }
    if (tabId === 'contratos_projeto') { mudarAbaContratos('criar'); renderContratosProjetoView(); }
    if (tabId === 'contratos_vinculos') renderContratosVinculosView();
    if (tabId === 'registro_valores_contrato') renderRegistroValoresView();
    if (tabId === 'relatorio_projetos_contratos') renderRelatorioProjetosContratosView();
    if (tabId === 'tipos_projeto') { mudarAbaTiposProjeto('criar'); renderTiposProjetoView(); }
    if (tabId === 'produtos') { mudarAbaProdutos('criar'); renderProdutosView(); }
    if (tabId === 'cargos') { mudarAbaCargos('criar'); renderCargosView(); }
    if (tabId === 'percentual_bloqueio_orcamento') renderPercentualBloqueioOrcamentoView();
    if (tabId === 'mudanca_orcamento') renderMudancaOrcamentoView();
    // AJUSTADO (papel Proprietário, 28/08/2026): restrita a ehProprietario
    // (mais forte que ehAdministrador) — mesma camada dupla de Ferramentas
    // de Dev (catálogo de atividades pra visibilidade do link + checagem
    // extra aqui pro conteúdo de verdade), só que com o papel mais
    // privilegiado. Um Administrador comum (sem eh_proprietario) cai no
    // "restrito" mesmo tendo acesso_irrestrito a tudo mais.
    if (tabId === 'licenciamento_modulos') {
        const restrito = document.getElementById('licenciamentoModulosRestrito');
        const conteudo = document.getElementById('licenciamentoModulosConteudo');
        if (ehProprietario) {
            if (restrito) restrito.classList.add('hidden');
            if (conteudo) conteudo.classList.remove('hidden');
            renderLicenciamentoModulosView();
        } else {
            if (restrito) restrito.classList.remove('hidden');
            if (conteudo) conteudo.classList.add('hidden');
        }
    }
    if (tabId === 'return_benefit') { mudarAbaReturnBenefit('criar'); renderReturnBenefitView(); }
    if (tabId === 'governanca') renderGovernancaView();
    if (tabId === 'retomar_hold') renderRetomarHoldView();
    if (tabId === 'conclusao_projeto') renderConclusaoProjetoView();
    if (tabId === 'fase_golive') { mudarAbaGoLive('ratificar'); renderGoliveView(); }
    if (tabId === 'projetos_adhoc') renderAdhocView();
    if (tabId === 'fechamento_af') renderFechamentoAfView();
    if (tabId === 'cronograma_evolucao') renderCronogramaEvolucaoView();
    if (tabId === 'usuarios') { mudarAbaUsuarios('criar'); renderUsuariosView(); }
    if (tabId === 'ano_fiscal') loadAnoFiscalConfig();
    if (tabId === 'ajuste_orcamento') renderAjusteOrcamentoView();
    if (tabId === 'areas') { mudarAbaAreas('criar'); loadAreas(); }
    if (tabId === 'pessoas_solicitantes') { mudarAbaPessoasSolicitantes('criar'); loadPessoasSolicitantes(); }
    if (tabId === 'portes') { mudarAbaPortes('criar'); loadPortes(); }
    if (tabId === 'responsaveis') { mudarAbaResponsaveis('criar'); loadResponsaveis(); }
    if (tabId === 'workflow_etapas') loadFasesEtapas();
    // AJUSTADO (segurança Fase 3, 2026-09-01): estas 3 telas SAÍRAM do
    // catálogo comum (não são mais concedíveis por função). Voltam a ser
    // hardcoded por papel — visíveis/acessíveis só para Administrador OU
    // Proprietário (Proprietário é superconjunto de Administrador).
    // Licenciamento de Módulos segue exclusivo de Proprietário (mais abaixo).
    const admOuProprietario = ehAdministrador || ehProprietario;
    if (tabId === 'funcoes_permissoes') {
        const restrito = document.getElementById('funcoesPermissoesRestrito');
        const conteudo = document.getElementById('funcoesPermissoesConteudo');
        if (admOuProprietario) {
            if (restrito) restrito.classList.add('hidden');
            if (conteudo) conteudo.classList.remove('hidden');
            mudarAbaFuncoes('criar');
            loadFuncoes();
        } else {
            if (restrito) restrito.classList.remove('hidden');
            if (conteudo) conteudo.classList.add('hidden');
        }
    }
    if (tabId === 'atribuicao_funcoes') {
        const restrito = document.getElementById('atribuicaoFuncoesRestrito');
        const conteudo = document.getElementById('atribuicaoFuncoesConteudo');
        if (admOuProprietario) {
            if (restrito) restrito.classList.add('hidden');
            if (conteudo) conteudo.classList.remove('hidden');
            loadFuncoes();
        } else {
            if (restrito) restrito.classList.remove('hidden');
            if (conteudo) conteudo.classList.add('hidden');
        }
    }
    if (tabId === 'restricao_area_atividades') {
        const restrito = document.getElementById('restricaoAreaAtividadesRestrito');
        const conteudo = document.getElementById('restricaoAreaAtividadesConteudo');
        if (admOuProprietario) {
            if (restrito) restrito.classList.add('hidden');
            if (conteudo) conteudo.classList.remove('hidden');
            renderRestricaoAreaAtividadesView();
        } else {
            if (restrito) restrito.classList.remove('hidden');
            if (conteudo) conteudo.classList.add('hidden');
        }
    }
    // MANTIDO deliberadamente admin-only (não segue o catálogo, mesmo que
    // uma função tenha "dev_tools" atribuído): ferramentas destrutivas
    // (limpar base, reset, criar projeto de teste) — camada extra de
    // segurança, tanto aqui (visibilidade) quanto dentro de cada ação em
    // js/dev-tools/*.js (que já re-checam ehAdministrador de novo).
    if (tabId === 'dev_tools') {
        const restrito = document.getElementById('devToolsRestrito');
        const conteudo = document.getElementById('devToolsConteudo');
        const conteudoLimpeza = document.getElementById('devToolsLimpezaConteudo');
        const conteudoLimpezaTotal = document.getElementById('devToolsLimpezaTotalConteudo');
        const conteudoCriarTeste = document.getElementById('devToolsCriarTesteConteudo');
        if (ehAdministrador) {
            if (restrito) restrito.classList.add('hidden');
            if (conteudo) conteudo.classList.remove('hidden');
            if (conteudoLimpeza) conteudoLimpeza.classList.remove('hidden');
            if (conteudoLimpezaTotal) conteudoLimpezaTotal.classList.remove('hidden');
            if (conteudoCriarTeste) conteudoCriarTeste.classList.remove('hidden');
            renderListaProjetosDevTools();
            if (typeof inicializarFormCriarTeste === 'function') inicializarFormCriarTeste();
        } else {
            if (restrito) restrito.classList.remove('hidden');
            if (conteudo) conteudo.classList.add('hidden');
            if (conteudoLimpeza) conteudoLimpeza.classList.add('hidden');
            if (conteudoLimpezaTotal) conteudoLimpezaTotal.classList.add('hidden');
            if (conteudoCriarTeste) conteudoCriarTeste.classList.add('hidden');
        }
    }
    if (tabId === 'prazos') loadFasesEtapas(); // já chama renderPrazosTable() no final, se existir (ver workflow-engine.js)
    if (tabId === 'dashboard') renderDashboardMetrics();
    if (tabId === 'consultas') renderConsultaProjetos();
    if (tabId === 'visao_orcamento') renderVisaoOrcamentoView();
    if (tabId === 'alertas_orcamento') renderAlertasOrcamentoView();
    if (tabId === 'roadmap') renderRoadmap();
}

function toggleSidebarMenu(menuId, iconId) {
    const menu = document.getElementById(menuId);
    const icon = document.getElementById(iconId);

    if (menu.classList.contains('open')) {
        menu.classList.remove('open');
        icon.classList.remove('rotate');
    } else {
        menu.classList.add('open');
        icon.classList.add('rotate');
    }
}
