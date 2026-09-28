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
// Recurso exclusivo do Compasso.
//
// Telas/abas que não aparecem no mapa abaixo são NÚCLEO (autenticação,
// perfis de acesso, cadastros base, dashboard) e nunca são bloqueadas —
// não têm registro em licenca_modulos, moduloAtivo() sempre libera.
// =========================================================================

let modulosLicenciados = {};

// NOVO (Fase 1 licenciamento — 03/09/2026): fonte única de verdade
// "tela -> módulo", carregada de modulo_funcao no boot. Enquanto a tabela
// não existir / não carregar, moduloDoTab() cai no TAB_MODULO_MAP
// hardcoded abaixo (que já reflete as mesmas decisões).
let moduloPorTab = {};

const NOME_EXIBICAO_MODULO = {
    WORKFLOW: 'Workflow de Projetos',
    EMAIL: 'Notificações por E-mail',
    FINANCEIRO: 'Financeiro & Contratos',
    PLANEJAMENTO_ESTRATEGICO: 'Planejamento Estratégico',
    // NOVO (Módulo de Construção de Requerimentos com IA, 23/09/2026).
    IA: 'Inteligência Artificial'
};

// Carregado no boot (js/auth/auth.js:entrarNoSistema), mesmo momento em
// que outros dados de configuração (funções, cargos, e-mail geral) já são
// carregados.
async function carregarLicenca() {
    const { data, error } = await _supabase.from('licenca_modulos')
        .select('modulo_codigo, ativo, status, valid_from, valid_until, contractual_limit');
    modulosLicenciados = {};
    if (!error && data) {
        data.forEach(m => { modulosLicenciados[m.modulo_codigo] = m; });
    }

    // NOVO (Fase 1 licenciamento): mapa tela -> módulo vindo do banco
    // (modulo_funcao). Se a tabela não existir ainda, moduloPorTab fica {}
    // e moduloDoTab() usa o TAB_MODULO_MAP hardcoded como fallback.
    const { data: mf, error: errMf } = await _supabase.from('modulo_funcao').select('activity_key, modulo');
    moduloPorTab = {};
    if (!errMf && mf) {
        mf.forEach(r => { moduloPorTab[r.activity_key] = r.modulo; });
    }
}

// codigo === null/undefined/'NUCLEO' -> sempre ativo (tela núcleo, sem
// módulo). Módulo sem registro na tabela também não bloqueia.
// V11: checa status + faixa de datas além do flag ativo.
function moduloAtivo(codigo) {
    if (!codigo || codigo === 'NUCLEO') return true;
    if (!(codigo in modulosLicenciados)) return true;
    return _entitlementAtivo(modulosLicenciados[codigo]);
}

// Retorna true somente se status=ACTIVE e hoje está dentro da faixa de datas.
// Retrocede para ativo bool caso a coluna status ainda não exista (antes do
// SQL da V11 rodar em produção).
function _entitlementAtivo(m) {
    if (!m) return true;
    const hoje = new Date().toISOString().split('T')[0];
    const status = m.status || (m.ativo === true ? 'ACTIVE' : 'SUSPENDED');
    if (status !== 'ACTIVE') return false;
    if (m.valid_from && hoje < m.valid_from) return false;
    if (m.valid_until && hoje > m.valid_until) return false;
    return true;
}

// Label de exibição do status efetivo de um entitlement.
function _entitlementStatusLabel(m) {
    if (!m) return 'ATIVO';
    const hoje = new Date().toISOString().split('T')[0];
    const status = m.status || (m.ativo === true ? 'ACTIVE' : 'SUSPENDED');
    if (status === 'SUSPENDED') return 'SUSPENSO';
    if (status === 'CANCELLED') return 'CANCELADO';
    if (m.valid_from && hoje < m.valid_from) return 'PENDENTE';
    if (m.valid_until && hoje > m.valid_until) return 'EXPIRADO';
    return 'ATIVO';
}

// Fallback / documentação do mapa tela -> módulo. A VERDADE em runtime é a
// tabela modulo_funcao (carregada em moduloPorTab por carregarLicenca);
// este objeto só é consultado quando a tela não está lá (tabela ausente,
// primeiro boot antes do SQL, ou tabId novo ainda não seedado).
// Mantido em sincronia com sql/2026-09-03_modulo_funcao.sql.
// Um tabId ausente deste mapa E de modulo_funcao é NÚCLEO — sempre disponível.
const TAB_MODULO_MAP = {
    // NÚCLEO = ausente daqui de propósito: ano_fiscal, periodo_ano_fiscal,
    // usuarios, funcoes_permissoes, atribuicao_funcoes,
    // restricao_area_atividades, responsaveis, licenciamento_modulos,
    // dev_tools, areas, produtos, pessoas_solicitantes, portes,
    // tipos_projeto, return_benefit, cargos, dashboard, consultas.

    // WORKFLOW — esteira de projetos + config do motor de fases.
    fechamento_af: 'WORKFLOW',
    f1_formalizacao: 'WORKFLOW',
    f1_orcamento: 'WORKFLOW',
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
    workflow_etapas: 'WORKFLOW',      // realocado de NÚCLEO (Fase 1)
    prazos: 'WORKFLOW',              // realocado de NÚCLEO (Fase 1)
    // Etapas de aprovação do Business Case + trava de variação de orçamento
    // são passos do WORKFLOW desenhado (aprovação de projeto pelo Comitê,
    // fechamento do orçamento do AF). Realocados de FINANCEIRO 08/09/2026 —
    // sem FINANCEIRO licenciado o projeto travava sem saída no BC.
    aprov_comite: 'WORKFLOW',
    aprov_orcamento_af: 'WORKFLOW',
    percentual_bloqueio_orcamento: 'WORKFLOW',
    mudanca_orcamento: 'WORKFLOW',
    troca_responsavel_atividade: 'WORKFLOW', // perfil OPERADOR — reatribuição de responsável de atividade

    // EMAIL — templates, fluxo, fila, e a régua de cobrança de ajustes.
    gestao_templates: 'EMAIL',
    gestao_fluxo_email: 'EMAIL',
    fila_email: 'EMAIL',
    governanca: 'EMAIL',

    // FINANCEIRO — Contratos & Terceiros, Visão de Orçamento, e as funções
    // de orçamento que NÃO são passo obrigatório do workflow (Ajuste,
    // Controle, Validação de Trade-off, Autorização de Demanda
    // Extraordinária). As aprovações do Business Case e a trava de
    // variação ficam no WORKFLOW (acima).
    ajuste_orcamento: 'FINANCEIRO',       // realocado de WORKFLOW (Fase 1)
    validacao_tradeoff: 'FINANCEIRO',     // realocado de WORKFLOW (Fase 1)
    controle_orcamento: 'FINANCEIRO',     // realocado de NÚCLEO (Fase 1)
    projetos_adhoc: 'FINANCEIRO',         // realocado de WORKFLOW (Fase 1)
    empresas_terceirizadas: 'FINANCEIRO',
    contratos_projeto: 'FINANCEIRO',
    contratos_vinculos: 'FINANCEIRO',
    registro_valores_contrato: 'FINANCEIRO',
    relatorio_projetos_contratos: 'FINANCEIRO',
    visao_orcamento: 'FINANCEIRO',
    alertas_orcamento: 'FINANCEIRO',
    contratos_pendencias: 'FINANCEIRO',   // Release 1 — staging + aprovação de pagamentos/propostas
    pagamentos_pendentes_nf: 'FINANCEIRO', // NOVO 2026-09-16 — cobrança de NF pendente

    // PLANEJAMENTO_ESTRATEGICO
    planejamento_estrategico: 'PLANEJAMENTO_ESTRATEGICO',

    // IA — NOVO (Módulo de Construção de Requerimentos com IA,
    // 23/09/2026). construcao_ia_requerimentos NÃO entra aqui de
    // propósito: não é uma tab própria (fica embutido em Gerar
    // Requerimentos), o gate é feito via moduloAtivo('IA') direto no JS
    // (ver js/phases/generic-workflow-ui.js).
    ia_templates: 'IA',
    ia_config: 'IA'
};

function moduloDoTab(tabId) {
    // 1) tabela modulo_funcao (verdade em runtime); 'NUCLEO' -> null (sem gate).
    if (tabId in moduloPorTab) {
        const m = moduloPorTab[tabId];
        return (!m || m === 'NUCLEO') ? null : m;
    }
    // 2) fallback hardcoded; ausente = NÚCLEO.
    return TAB_MODULO_MAP[tabId] || null;
}

// -------------------------------------------------------------------------
// Tela "Licenciamento de Módulos" (Administração, restrita a ADMINISTRADOR
// — ver switchTab em js/ui/navigation.js). Lê ao vivo (não usa o cache de
// modulosLicenciados) pra sempre mostrar o estado real do banco, mesmo
// código do padrão já usado em config_email_geral/config_bloqueio_orcamento.
// -------------------------------------------------------------------------
const ORDEM_EXIBICAO_MODULO = ['WORKFLOW', 'EMAIL', 'FINANCEIRO', 'PLANEJAMENTO_ESTRATEGICO', 'IA'];

async function renderLicenciamentoModulosView() {
    const lista = document.getElementById('licenciamentoModulosLista');
    if (!lista) return;

    const { data, error } = await _supabase.from('licenca_modulos').select('*');
    if (error) {
        lista.innerHTML = `<p class="text-sm text-danger-600">Erro ao carregar módulos: ${escapeHtml(error.message)}</p>`;
        return;
    }
    const porCodigo = {};
    (data || []).forEach(m => { porCodigo[m.modulo_codigo] = m; });

    const BADGE_CLS = {
        'ATIVO':     'bg-green-100 text-green-800',
        'SUSPENSO':  'bg-amber-100 text-amber-800',
        'EXPIRADO':  'bg-red-100 text-red-800',
        'PENDENTE':  'bg-blue-100 text-blue-800',
        'CANCELADO': 'bg-gray-100 text-gray-600'
    };

    lista.innerHTML = ORDEM_EXIBICAO_MODULO.map(codigo => {
        const m = porCodigo[codigo] || { modulo_codigo: codigo, nome_exibicao: NOME_EXIBICAO_MODULO[codigo] || codigo, ativo: true, status: 'ACTIVE' };
        const ativo = _entitlementAtivo(m);
        const statusLabel = _entitlementStatusLabel(m);
        const badgeCls = BADGE_CLS[statusLabel] || BADGE_CLS['ATIVO'];
        const partes = [
            m.valid_from ? `desde ${formatDate(m.valid_from)}` : null,
            m.valid_until ? `vence ${formatDate(m.valid_until)}` : null,
            m.contractual_limit != null ? `lim.: ${m.contractual_limit}` : null
        ].filter(Boolean);
        const dataInfo = partes.join(' • ');
        return `
            <div class="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                <div class="flex items-start justify-between p-4 gap-4">
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <p class="font-bold text-sm text-gray-800">${escapeHtml(m.nome_exibicao || NOME_EXIBICAO_MODULO[codigo] || codigo)}</p>
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${badgeCls}">${escapeHtml(statusLabel)}</span>
                        </div>
                        <p class="text-[11px] text-gray-400 uppercase tracking-wider mt-0.5">${escapeHtml(m.modulo_codigo)}</p>
                        ${dataInfo ? `<p class="text-[11px] text-gray-500 mt-1">${escapeHtml(dataInfo)}</p>` : ''}
                    </div>
                    <div class="flex items-center gap-3 shrink-0">
                        <button onclick="toggleEntitlementEdit('${escapeJsAttr(codigo)}')" class="text-[11px] text-indigo-600 hover:underline font-medium">editar</button>
                        <label class="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" class="sr-only peer" ${ativo ? 'checked' : ''} onchange="alternarModuloLicenciado('${escapeJsAttr(m.modulo_codigo)}', this.checked)">
                            <div class="w-11 h-6 bg-gray-300 rounded-full peer peer-checked:bg-green-600 transition-colors"></div>
                            <div class="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-5"></div>
                        </label>
                    </div>
                </div>
                <div id="entitlementEdit_${escapeHtml(codigo)}" class="hidden border-t border-gray-100 p-4 bg-gray-50">
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                        <div>
                            <label class="block text-[10px] font-bold uppercase text-gray-600 mb-1">Início da Vigência</label>
                            <input type="date" id="ef_from_${escapeHtml(codigo)}" value="${m.valid_from ? String(m.valid_from).split('T')[0] : ''}" class="w-full p-2 border border-gray-300 rounded text-xs">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold uppercase text-gray-600 mb-1">Fim da Vigência</label>
                            <input type="date" id="ef_until_${escapeHtml(codigo)}" value="${m.valid_until ? String(m.valid_until).split('T')[0] : ''}" class="w-full p-2 border border-gray-300 rounded text-xs">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold uppercase text-gray-600 mb-1">Limite contratual <span class="font-normal normal-case text-gray-400">(opcional)</span></label>
                            <input type="number" id="ef_limit_${escapeHtml(codigo)}" value="${m.contractual_limit != null ? m.contractual_limit : ''}" min="0" placeholder="ilimitado" class="w-full p-2 border border-gray-300 rounded text-xs">
                        </div>
                    </div>
                    <div class="flex justify-end gap-2">
                        <button onclick="toggleEntitlementEdit('${escapeJsAttr(codigo)}')" class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-xs font-bold text-gray-700">Cancelar</button>
                        <button onclick="salvarEntitlementDatas('${escapeJsAttr(codigo)}')" class="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-800 text-white rounded text-xs font-bold">Salvar</button>
                    </div>
                </div>
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
        status: novoValor ? 'ACTIVE' : 'SUSPENDED',
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

// ---- funções de edição inline de entitlement (V11) -------------------------

function toggleEntitlementEdit(codigo) {
    const el = document.getElementById('entitlementEdit_' + codigo);
    if (el) el.classList.toggle('hidden');
}

async function salvarEntitlementDatas(codigo) {
    const fromEl = document.getElementById('ef_from_' + codigo);
    const untilEl = document.getElementById('ef_until_' + codigo);
    const limitEl = document.getElementById('ef_limit_' + codigo);
    if (!fromEl || !untilEl || !limitEl) return;

    const valid_from = fromEl.value || null;
    const valid_until = untilEl.value || null;
    const contractual_limit = limitEl.value !== '' ? parseInt(limitEl.value, 10) : null;

    if (valid_from && valid_until && valid_from > valid_until) {
        alert('A data de início deve ser anterior ao fim da vigência.');
        return;
    }

    const { error } = await _supabase.from('licenca_modulos').update({
        valid_from,
        valid_until,
        contractual_limit,
        atualizado_por: currentUser ? currentUser.nome : 'desconhecido',
        atualizado_em: new Date().toISOString()
    }).eq('modulo_codigo', codigo);

    if (error) { alert('Erro ao salvar: ' + error.message); return; }

    await carregarLicenca();
    aplicarVisibilidadeMenu();
    await renderLicenciamentoModulosView();
}
