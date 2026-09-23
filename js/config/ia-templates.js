// =========================================================================
// config/ia-templates.js
// Gestão de Templates de IA (Administração) — CRUD dos prompts usados
// pelo Módulo de Construção de Requerimentos com IA
// (js/requirements/construcao-ia.js). Mesmo padrão system_prompt +
// user_prompt_template (com {{placeholders}}) do documento do usuário
// (Especificacao_Sistema_Orquestrador_IA.docx).
//
// campos_obrigatorios é editado como JSON bruto (array de
// {chave,rotulo,tipo}) — um form-builder visual fica pra uma v2, se
// fizer sentido depois de ver o uso real.
// =========================================================================

let iaTemplatesData = [];

function _podeVerIaTemplates() {
    return (typeof ehAdministrador !== 'undefined' && ehAdministrador) ||
           (typeof ehProprietario !== 'undefined' && ehProprietario) ||
           (typeof usuarioTemAtividade === 'function' && usuarioTemAtividade('ia_templates'));
}
function _podeAlterarIaTemplates() {
    return (typeof ehAdministrador !== 'undefined' && ehAdministrador) ||
           (typeof ehProprietario !== 'undefined' && ehProprietario) ||
           (typeof usuarioPodeAlterarTela === 'function' && usuarioPodeAlterarTela('ia_templates'));
}

async function renderIaTemplatesView() {
    const restrito = document.getElementById('iaTemplatesRestrito');
    const conteudo = document.getElementById('iaTemplatesConteudo');
    const podeVer = _podeVerIaTemplates();
    if (restrito) restrito.classList.toggle('hidden', podeVer);
    if (conteudo) conteudo.classList.toggle('hidden', !podeVer);
    if (!podeVer) return;

    const { data, error } = await _supabase.from('ia_templates_prompt').select('*').order('titulo');
    iaTemplatesData = error ? [] : (data || []);
    _renderIaTemplatesTable();
}

function _renderIaTemplatesTable() {
    const tbody = document.getElementById('iaTemplatesTableBody');
    if (!tbody) return;
    if (iaTemplatesData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-400 font-bold">Nenhum template cadastrado</td></tr>`;
        return;
    }
    tbody.innerHTML = iaTemplatesData.map(t => `
        <tr>
            <td class="p-3 font-semibold">${escapeHtml(t.titulo)}</td>
            <td class="p-3 text-xs text-gray-500">${(t.campos_obrigatorios || []).length} campo(s)</td>
            <td class="p-3 text-center">${t.ativo ? renderBadgeStatus('emerald', null, 'Ativo') : renderBadgeStatus('gray', null, 'Inativo')}</td>
            <td class="p-3 text-right space-x-2 whitespace-nowrap">
                ${botaoSePodeAlterar('ia_templates', `<button onclick="abrirModalIaTemplate(${t.id})" class="text-indigo-600 hover:text-indigo-800 text-xs font-bold"><i class="fa-solid fa-pen-to-square"></i> Editar</button>`)}
                ${botaoSePodeAlterar('ia_templates', `<button onclick="_alternarAtivoIaTemplate(${t.id}, ${!t.ativo})" class="text-gray-500 hover:text-gray-800 text-xs font-bold"><i class="fa-solid fa-power-off"></i></button>`)}
            </td>
        </tr>
    `).join('');
}

async function _alternarAtivoIaTemplate(id, novoValor) {
    if (!_podeAlterarIaTemplates()) return alert('Você não tem permissão para alterar templates de IA.');
    const { error } = await _supabase.from('ia_templates_prompt').update({ ativo: novoValor }).eq('id', id);
    if (error) return alert('Erro ao atualizar: ' + error.message);
    await renderIaTemplatesView();
}

function abrirModalIaTemplate(id) {
    const t = id ? iaTemplatesData.find(x => x.id === id) : null;
    document.getElementById('iaTemplateIdHidden').value = t ? t.id : '';
    document.getElementById('iaTemplateModalTitulo').innerText = t ? 'Editar Template de IA' : 'Novo Template de IA';
    document.getElementById('iaTemplateTituloInput').value = t ? t.titulo : '';
    document.getElementById('iaTemplateSystemInput').value = t ? t.system_prompt : '';
    document.getElementById('iaTemplateUserInput').value = t ? t.user_prompt_template : '';
    document.getElementById('iaTemplateCamposInput').value = t ? JSON.stringify(t.campos_obrigatorios, null, 2) : '[\n  {"chave": "nome_modulo", "rotulo": "Nome do Módulo", "tipo": "texto"}\n]';
    document.getElementById('modalIaTemplate').classList.remove('hidden');
}
function fecharModalIaTemplate() {
    document.getElementById('modalIaTemplate').classList.add('hidden');
}

async function salvarIaTemplate() {
    if (!_podeAlterarIaTemplates()) return alert('Você não tem permissão para alterar templates de IA.');

    const id = document.getElementById('iaTemplateIdHidden').value;
    const titulo = document.getElementById('iaTemplateTituloInput').value.trim();
    const system_prompt = document.getElementById('iaTemplateSystemInput').value.trim();
    const user_prompt_template = document.getElementById('iaTemplateUserInput').value.trim();
    const camposTexto = document.getElementById('iaTemplateCamposInput').value.trim();

    if (!titulo || !system_prompt || !user_prompt_template) {
        return alert('Preencha título, system prompt e user prompt template.');
    }
    let campos_obrigatorios;
    try {
        campos_obrigatorios = JSON.parse(camposTexto);
        if (!Array.isArray(campos_obrigatorios)) throw new Error('precisa ser um array');
    } catch (e) {
        return alert('Campos Obrigatórios: JSON inválido — ' + e.message);
    }

    const payload = { titulo, system_prompt, user_prompt_template, campos_obrigatorios };
    const { error } = id
        ? await _supabase.from('ia_templates_prompt').update(payload).eq('id', id)
        : await _supabase.from('ia_templates_prompt').insert([{ ...payload, criado_por: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.nome : null }]);
    if (error) return alert('Erro ao salvar template: ' + error.message);

    fecharModalIaTemplate();
    await renderIaTemplatesView();
}
