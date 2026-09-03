// =========================================================================
// core/licenca.js
// NOVO (Licenciamento de Módulos, 28/08/2026): liga/desliga por módulo
// comercial — WORKFLOW, EMAIL, FINANCEIRO, PLANEJAMENTO_ESTRATEGICO —
// conforme o plano contratado pela empresa. Módulo desativado esconde os
// itens de menu correspondentes (ver TAB_MODULO_MAP + aplicarVisibilidadeMenu,
// js/config/funcoes.js) E bloqueia o carregamento da tela em switchTab
// (js/ui/navigation.js), mesmo se o acesso for forçado por URL/console —
// as duas pontas usam o mesmo TAB_MODULO_MAP daqui, pra nunca ficar uma
// sem a outra.
//
// Só Compasso — este arquivo não existe/não é usado no Compasso.
//
// Telas/abas que não aparecem no mapa abaixo são NÚCLEO (autenticação,
// perfis de acesso, cadastros base, dashboard) e nunca são bloqueadas —
// não têm registro em licenca_modulos, moduloAtivo() sempre libera.
// =========================================================================

let modulosLicenciados = {};

const NOME_EXIBICAO_MODULO = {
    WORKFLOW: 'Workflow de Projetos',
    EMAIL: 'Notificações por E-mail',
    FINANCEIRO: 'Financeiro & Contratos',
    PLANEJAMENTO_ESTRATEGICO: 'Planejamento Estratégico'
};

// Carregado no boot (js/auth/auth.js:entrarNoSistema), mesmo momento em
// que outros dados de configuração (funções, cargos, e-mail geral) já são
// carregados.
async function carregarLicenca() {
    const { data, error } = await _supabase.from('licenca_modulos').select('modulo_codigo, ativo');
    modulosLicenciados = {};
    if (!error && data) {
        data.forEach(m => { modulosLicenciados[m.modulo_codigo] = m.ativo === true; });
    }
}

// codigo === null/undefined/'NUCLEO' -> sempre ativo (tela núcleo, sem
// módulo). Módulo sem registro na tabela (nunca deveria acontecer depois
// da carga inicial, mas por segurança) também não bloqueia.
function moduloAtivo(codigo) {
    if (!codigo || codigo === 'NUCLEO') return true;
    if (!(codigo in modulosLicenciados)) return true;
    return modulosLicenciados[codigo] === true;
}

// Fonte única de verdade tabId -> módulo responsável. Usado por
// aplicarVisibilidadeMenu() (esconde link-<tabId>/view-btn-<tabId>) e por
// switchTab() (bloqueia o carregamento da view). Um tabId ausente daqui é
// NÚCLEO — sempre disponível.
const TAB_MODULO_MAP = {
    // WORKFLOW — Business Case, Requerimentos, Technical, Execution/UAT/
    // Go-Live, Fiscal Year, Roadmap e Demandas Extraordinárias.
    ano_fiscal: 'WORKFLOW',
    ajuste_orcamento: 'WORKFLOW',
    validacao_tradeoff: 'WORKFLOW', // NOVO (Feature 1.1 — 03/09/2026): fila de validação de trade-off fora de escopo (grupo Ano Fiscal)
    fechamento_af: 'WORKFLOW',
    f1_formalizacao: 'WORKFLOW',
    f1_orcamento: 'WORKFLOW',
    projetos_adhoc: 'WORKFLOW',
    req_planejamento: 'WORKFLOW',
    req_aprov_negocio: 'WORKFLOW',
    req_aprov_ti: 'WORKFLOW',
    req_conclusao: 'WORKFLOW',
    fase_technical: 'WORKFLOW',
    tech_aval_negocio: 'WORKFLOW',
    tech_conclusao: 'WORKFLOW',
    fase_execution: 'WORKFLOW',
    fase_uat: 'WORKFLOW',
    fase_golive: 'WORKFLOW',
    conclusao_projeto: 'WORKFLOW',
    retomar_hold: 'WORKFLOW',
    roadmap: 'WORKFLOW',
    cronograma_evolucao: 'WORKFLOW',

    // EMAIL — templates, fluxo, fila, e a régua de cobrança de ajustes
    // (que funciona disparando e-mail).
    gestao_templates: 'EMAIL',
    gestao_fluxo_email: 'EMAIL',
    fila_email: 'EMAIL',
    governanca: 'EMAIL',

    // FINANCEIRO — Contratos & Terceiros inteiro, Visão de Orçamento,
    // Aprovar Orçamento por Projeto/Fiscal Year, e a Mudança de Orçamento.
    empresas_terceirizadas: 'FINANCEIRO',
    contratos_projeto: 'FINANCEIRO',
    contratos_vinculos: 'FINANCEIRO',
    registro_valores_contrato: 'FINANCEIRO',
    relatorio_projetos_contratos: 'FINANCEIRO',
    visao_orcamento: 'FINANCEIRO',
    alertas_orcamento: 'FINANCEIRO',
    aprov_comite: 'FINANCEIRO',
    aprov_orcamento_af: 'FINANCEIRO',
    percentual_bloqueio_orcamento: 'FINANCEIRO',
    mudanca_orcamento: 'FINANCEIRO',

    // PLANEJAMENTO_ESTRATEGICO
    planejamento_estrategico: 'PLANEJAMENTO_ESTRATEGICO'
};

function moduloDoTab(tabId) {
    return TAB_MODULO_MAP[tabId] || null;
}

// -------------------------------------------------------------------------
// Tela "Licenciamento de Módulos" (Administração, restrita a ADMINISTRADOR
// — ver switchTab em js/ui/navigation.js). Lê ao vivo (não usa o cache de
// modulosLicenciados) pra sempre mostrar o estado real do banco, mesmo
// código do padrão já usado em config_email_geral/config_bloqueio_orcamento.
// -------------------------------------------------------------------------
const ORDEM_EXIBICAO_MODULO = ['WORKFLOW', 'EMAIL', 'FINANCEIRO', 'PLANEJAMENTO_ESTRATEGICO'];

async function renderLicenciamentoModulosView() {
    const lista = document.getElementById('licenciamentoModulosLista');
    if (!lista) return;

    const { data, error } = await _supabase.from('licenca_modulos').select('*');
    if (error) {
        lista.innerHTML = `<p class="text-sm text-red-600">Erro ao carregar módulos: ${escapeHtml(error.message)}</p>`;
        return;
    }
    const porCodigo = {};
    (data || []).forEach(m => { porCodigo[m.modulo_codigo] = m; });

    lista.innerHTML = ORDEM_EXIBICAO_MODULO.map(codigo => {
        const m = porCodigo[codigo] || { modulo_codigo: codigo, nome_exibicao: NOME_EXIBICAO_MODULO[codigo] || codigo, ativo: true };
        const ativo = m.ativo === true;
        return `
            <div class="flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
                <div>
                    <p class="font-bold text-sm text-gray-800">${escapeHtml(m.nome_exibicao)}</p>
                    <p class="text-[11px] text-gray-400 uppercase tracking-wider">${escapeHtml(m.modulo_codigo)}</p>
                </div>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" class="sr-only peer" ${ativo ? 'checked' : ''} onchange="alternarModuloLicenciado('${escapeJsAttr(m.modulo_codigo)}', this.checked)">
                    <div class="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-green-600 transition-colors"></div>
                    <div class="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-5"></div>
                </label>
            </div>
        `;
    }).join('');
}

// EMAIL e FINANCEIRO dependem de projetos avançando pelo WORKFLOW pra
// fazer sentido de verdade (disparo de e-mail por etapa concluída,
// bloqueio de variação na conclusão de fase) — não é uma trava rígida
// (o admin pode confirmar mesmo assim), só um aviso.
async function alternarModuloLicenciado(codigo, novoValor) {
    if (novoValor && codigo !== 'WORKFLOW') {
        const { data } = await _supabase.from('licenca_modulos').select('ativo').eq('modulo_codigo', 'WORKFLOW').maybeSingle();
        if (data && data.ativo !== true) {
            if (!confirm(`⚠️ O módulo Workflow de Projetos está desativado. ${NOME_EXIBICAO_MODULO[codigo] || codigo} depende dele pra funcionar por completo (ex.: disparos ligados ao avanço de fase). Ativar mesmo assim?`)) {
                return renderLicenciamentoModulosView();
            }
        }
    }
    if (!novoValor && codigo === 'WORKFLOW') {
        const { data } = await _supabase.from('licenca_modulos').select('modulo_codigo, ativo').in('modulo_codigo', ['EMAIL', 'FINANCEIRO']);
        const dependentesAtivos = (data || []).filter(m => m.ativo === true).map(m => NOME_EXIBICAO_MODULO[m.modulo_codigo] || m.modulo_codigo);
        if (dependentesAtivos.length > 0) {
            if (!confirm(`⚠️ ${dependentesAtivos.join(' e ')} ${dependentesAtivos.length > 1 ? 'dependem' : 'depende'} do Workflow de Projetos pra funcionar por completo. Desativar o Workflow mesmo assim?`)) {
                return renderLicenciamentoModulosView();
            }
        }
    }

    const { error } = await _supabase.from('licenca_modulos').update({
        ativo: novoValor,
        atualizado_por: currentUser ? currentUser.nome : 'desconhecido',
        atualizado_em: new Date().toISOString()
    }).eq('modulo_codigo', codigo);
    if (error) { alert('Erro ao salvar: ' + error.message); return renderLicenciamentoModulosView(); }

    // Atualiza o cache local imediatamente — pra esta sessão já refletir
    // a mudança sem precisar relogar (outras sessões abertas só veem no
    // próximo login, já que não há realtime aqui).
    await carregarLicenca();
    aplicarVisibilidadeMenu();
    await renderLicenciamentoModulosView();
}
