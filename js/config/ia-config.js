// =========================================================================
// config/ia-config.js
// Configuração de IA (Administração) — chave geral (liga/desliga) +
// modelo usado pelo Módulo de Construção de Requerimentos com IA
// (js/requirements/construcao-ia.js e netlify/functions/gerar-especificacao-ia.js).
// Mesmo padrão de chave geral já usado em config_email_geral (Gestão do
// Fluxo de E-mail).
//
// Atividade DELEGÁVEL (mesmo padrão de controle_orcamento): Administrador/
// Proprietário entram por bypass, sem grant inicial.
// =========================================================================

let iaConfigGeralCache = null;

async function carregarIaConfigGeral() {
    const { data } = await _supabase.from('ia_config_geral').select('*').eq('id', 1).maybeSingle();
    iaConfigGeralCache = data || { ativo: true, modelo: 'gpt-4o' };
    return iaConfigGeralCache;
}

function _podeVerIaConfig() {
    return (typeof ehAdministrador !== 'undefined' && ehAdministrador) ||
           (typeof ehProprietario !== 'undefined' && ehProprietario) ||
           (typeof usuarioTemAtividade === 'function' && usuarioTemAtividade('ia_config'));
}

const IA_MODELOS_DISPONIVEIS = [
    { valor: 'gpt-4o', rotulo: 'GPT-4o (rápido, recomendado)' },
    { valor: 'gpt-4o-mini', rotulo: 'GPT-4o mini (mais barato/rápido, menos profundo)' }
];

async function renderIaConfigView() {
    const restrito = document.getElementById('iaConfigRestrito');
    const conteudo = document.getElementById('iaConfigConteudo');
    const podeVer = _podeVerIaConfig();
    if (restrito) restrito.classList.toggle('hidden', podeVer);
    if (conteudo) conteudo.classList.toggle('hidden', !podeVer);
    if (!podeVer) return;

    await carregarIaConfigGeral();

    const chk = document.getElementById('iaConfigAtivoCheckbox');
    if (chk) chk.checked = iaConfigGeralCache.ativo === true;

    const sel = document.getElementById('iaConfigModeloSelect');
    if (sel) {
        sel.innerHTML = IA_MODELOS_DISPONIVEIS.map(m => `<option value="${m.valor}" ${m.valor === iaConfigGeralCache.modelo ? 'selected' : ''}>${escapeHtml(m.rotulo)}</option>`).join('');
    }
}

async function salvarIaConfig() {
    const podeAlterar = (typeof ehAdministrador !== 'undefined' && ehAdministrador) ||
                        (typeof ehProprietario !== 'undefined' && ehProprietario) ||
                        (typeof usuarioPodeAlterarTela === 'function' && usuarioPodeAlterarTela('ia_config'));
    if (!podeAlterar) return alert('Você não tem permissão para alterar a Configuração de IA.');

    const ativo = document.getElementById('iaConfigAtivoCheckbox').checked;
    const modelo = document.getElementById('iaConfigModeloSelect').value;

    const { error } = await _supabase.from('ia_config_geral').update({ ativo, modelo }).eq('id', 1);
    if (error) return alert('Erro ao salvar a Configuração de IA: ' + error.message);

    alert('✅ Configuração de IA salva.');
    await renderIaConfigView();
}
