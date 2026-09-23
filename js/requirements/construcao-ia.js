// =========================================================================
// requirements/construcao-ia.js
// Módulo de Construção de Requerimentos com IA — adaptação do documento
// do usuário (Especificacao_Sistema_Orquestrador_IA.docx) pro Compasso.
// Escopo inicial: só a etapa "GERAR REQUERIMENTOS" (a etapa_nome fica
// gravada por linha, então reuso futuro noutra etapa não pede migração).
//
// Fluxo: confirmarPlanejamentoGenerico (generic-workflow-ui.js) chama
// _iaInicializarRascunho() assim que a etapa entra em execução — cria a
// linha ia_especificacoes com o template ativo pré-selecionado ("template
// inicial recebido no processo de execução dos requerimentos", a pedido
// do usuário). O botão "Construir com IA" (mesmo arquivo, condicional só
// pra esta etapa) abre o modal, deixa preencher os campos do template e
// chama netlify/functions/gerar-especificacao-ia.js, que fala com a
// OpenAI e devolve o Markdown gerado.
//
// Licenciamento: módulo comercial "IA" (moduloAtivo('IA')) — se
// desligado, o botão nem aparece. Não bloqueia a conclusão normal de
// "Gerar Requerimentos": é um acelerador opcional, não uma etapa própria.
// =========================================================================

let _iaEspecificacaoAtual = null; // linha ia_especificacoes carregada no modal aberto
let _iaTemplateAtual = null;

// -------------------------------------------------------------------------
// Criação do rascunho — chamada uma vez, no início da execução da etapa.
// Idempotente na prática: ia_especificacoes tem UNIQUE(projeto_codigo,
// etapa_nome), então só cria se ainda não existir.
// -------------------------------------------------------------------------
async function _iaInicializarRascunho(codigoProjeto, etapaNome) {
    if (typeof moduloAtivo === 'function' && !moduloAtivo('IA')) return;

    const { data: existente } = await _supabase
        .from('ia_especificacoes')
        .select('id')
        .eq('projeto_codigo', codigoProjeto)
        .eq('etapa_nome', etapaNome)
        .maybeSingle();
    if (existente) return;

    const { data: template } = await _supabase
        .from('ia_templates_prompt')
        .select('id')
        .eq('ativo', true)
        .order('id')
        .limit(1)
        .maybeSingle();

    const projeto = (typeof projectsData !== 'undefined' ? projectsData : []).find(p => p.codigo === codigoProjeto);

    await _supabase.from('ia_especificacoes').insert([{
        projeto_codigo: codigoProjeto,
        etapa_nome: etapaNome,
        template_id: template ? template.id : null,
        dados_entrada: projeto ? { nome_modulo: projeto.nome } : {},
        status: 'RASCUNHO',
        criado_por: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.nome : null
    }]);
}

// -------------------------------------------------------------------------
// Modal de construção
// -------------------------------------------------------------------------
async function abrirModuloConstrucaoIA(codigoProjeto) {
    const { data: esp, error } = await _supabase
        .from('ia_especificacoes')
        .select('*')
        .eq('projeto_codigo', codigoProjeto)
        .eq('etapa_nome', 'GERAR REQUERIMENTOS')
        .maybeSingle();
    if (error || !esp) {
        return alert('Não foi possível carregar o módulo de construção — tente planejar a etapa novamente antes de usar a IA.');
    }
    _iaEspecificacaoAtual = esp;

    const { data: templates } = await _supabase.from('ia_templates_prompt').select('*').eq('ativo', true).order('titulo');
    const listaTemplates = templates || [];
    _iaTemplateAtual = listaTemplates.find(t => t.id === esp.template_id) || listaTemplates[0] || null;

    document.getElementById('iaConstrucaoCodigoHidden').value = codigoProjeto;
    document.getElementById('iaConstrucaoProjetoNome').innerText = codigoProjeto;

    const selTpl = document.getElementById('iaConstrucaoTemplateSelect');
    selTpl.innerHTML = listaTemplates.map(t => `<option value="${t.id}" ${_iaTemplateAtual && t.id === _iaTemplateAtual.id ? 'selected' : ''}>${escapeHtml(t.titulo)}</option>`).join('')
        || '<option value="">Nenhum template ativo cadastrado</option>';

    _iaRenderFormulario();
    _iaRenderResultado();

    document.getElementById('modalConstrucaoIA').classList.remove('hidden');
}

function fecharModalConstrucaoIA() {
    document.getElementById('modalConstrucaoIA').classList.add('hidden');
    _iaEspecificacaoAtual = null;
    _iaTemplateAtual = null;
}

// Troca de template no seletor — re-renderiza o formulário com os campos
// do novo template, preservando os valores já digitados quando a chave
// bate (mesmo nome de campo em templates diferentes).
async function onMudarTemplateConstrucaoIA() {
    const id = Number(document.getElementById('iaConstrucaoTemplateSelect').value);
    const { data: t } = await _supabase.from('ia_templates_prompt').select('*').eq('id', id).maybeSingle();
    if (t) _iaTemplateAtual = t;
    _iaRenderFormulario();
}

function _iaRenderFormulario() {
    const wrapper = document.getElementById('iaConstrucaoFormulario');
    if (!wrapper) return;
    if (!_iaTemplateAtual) {
        wrapper.innerHTML = '<p class="text-xs text-gray-400 italic">Nenhum template ativo — cadastre um em Administração → Gestão de Templates de IA.</p>';
        return;
    }
    const campos = _iaTemplateAtual.campos_obrigatorios || [];
    const dadosAtuais = (_iaEspecificacaoAtual && _iaEspecificacaoAtual.dados_entrada) || {};
    wrapper.innerHTML = campos.map(c => `
        <div class="mb-3">
            <label class="block text-[10px] font-bold uppercase mb-1 text-gray-600">${escapeHtml(c.rotulo || c.chave)}</label>
            ${c.tipo === 'textarea'
                ? `<textarea id="iaCampo_${escapeHtml(c.chave)}" rows="4" class="w-full p-2 border border-gray-300 rounded text-sm">${escapeHtml(dadosAtuais[c.chave] || '')}</textarea>`
                : `<input type="text" id="iaCampo_${escapeHtml(c.chave)}" value="${escapeHtml(dadosAtuais[c.chave] || '')}" class="w-full p-2 border border-gray-300 rounded text-sm">`}
        </div>
    `).join('');
}

function _iaColetarDadosFormulario() {
    const campos = (_iaTemplateAtual && _iaTemplateAtual.campos_obrigatorios) || [];
    const dados = {};
    campos.forEach(c => {
        const el = document.getElementById(`iaCampo_${c.chave}`);
        dados[c.chave] = el ? el.value.trim() : '';
    });
    return dados;
}

function _iaRenderResultado() {
    const wrapper = document.getElementById('iaConstrucaoResultado');
    if (!wrapper) return;
    const esp = _iaEspecificacaoAtual;
    if (!esp || !esp.resultado_ia) {
        wrapper.innerHTML = '<p class="text-xs text-gray-400 italic py-4 text-center">Nenhum resultado gerado ainda.</p>';
        return;
    }
    const html = (typeof marked !== 'undefined' && marked.parse) ? marked.parse(esp.resultado_ia) : `<pre class="whitespace-pre-wrap">${escapeHtml(esp.resultado_ia)}</pre>`;
    wrapper.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <span class="text-[10px] font-bold uppercase text-gray-400">Versão ${esp.versao || 1} · ${formatDateTime(esp.atualizado_em || esp.criado_em)}</span>
            <button onclick="_iaCopiarResultado()" class="text-[10px] font-bold text-indigo-700 hover:text-indigo-900"><i class="fa-solid fa-copy"></i> Copiar Markdown</button>
        </div>
        <div class="prose prose-sm max-w-none border border-gray-200 rounded p-4 bg-gray-50">${html}</div>
    `;
    // Mermaid re-renderiza os blocos ```mermaid que o marked já deixou
    // como <pre><code class="language-mermaid">...
    if (typeof mermaid !== 'undefined') {
        wrapper.querySelectorAll('code.language-mermaid').forEach(bloco => {
            const div = document.createElement('div');
            div.className = 'mermaid';
            div.textContent = bloco.textContent;
            bloco.parentElement.replaceWith(div);
        });
        try { mermaid.run({ nodes: wrapper.querySelectorAll('.mermaid') }); } catch (e) { /* diagrama malformado — deixa o texto bruto */ }
    }
}

function _iaCopiarResultado() {
    if (!_iaEspecificacaoAtual || !_iaEspecificacaoAtual.resultado_ia) return;
    navigator.clipboard.writeText(_iaEspecificacaoAtual.resultado_ia)
        .then(() => alert('Markdown copiado.'))
        .catch(() => alert('Não foi possível copiar automaticamente — selecione o texto manualmente.'));
}

// -------------------------------------------------------------------------
// Gerar — salva os dados do formulário + template escolhido, chama a
// function, e recarrega o resultado.
// -------------------------------------------------------------------------
async function gerarComIA() {
    if (!_iaEspecificacaoAtual) return;
    if (!_iaTemplateAtual) return alert('Selecione um template.');

    const dados = _iaColetarDadosFormulario();
    const camposFaltando = (_iaTemplateAtual.campos_obrigatorios || []).filter(c => !dados[c.chave]);
    if (camposFaltando.length > 0) {
        return alert(`Preencha: ${camposFaltando.map(c => c.rotulo || c.chave).join(', ')}.`);
    }

    const btn = document.getElementById('iaConstrucaoBtnGerar');
    const textoOriginal = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gerando… pode levar até 1 minuto';

    const { error: erroSalvar } = await _supabase.from('ia_especificacoes')
        .update({ template_id: _iaTemplateAtual.id, dados_entrada: dados })
        .eq('id', _iaEspecificacaoAtual.id);
    if (erroSalvar) {
        btn.disabled = false; btn.innerHTML = textoOriginal;
        return alert('Erro ao salvar os dados do formulário: ' + erroSalvar.message);
    }

    let resposta;
    try {
        resposta = await fetch('/.netlify/functions/gerar-especificacao-ia', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ especificacaoId: _iaEspecificacaoAtual.id })
        });
    } catch (e) {
        btn.disabled = false; btn.innerHTML = textoOriginal;
        return alert('Não foi possível contatar o serviço de IA. Isso é esperado se o sistema estiver rodando localmente sem "netlify dev" — só funciona quando publicado no Netlify.');
    }

    let corpo;
    try { corpo = await resposta.json(); } catch (e) { corpo = { sucesso: false, erro: `Resposta inesperada (status ${resposta.status}).` }; }

    btn.disabled = false;
    btn.innerHTML = textoOriginal;

    if (!corpo.sucesso) {
        alert('⛔ ' + (corpo.erro || 'Falha ao gerar a especificação.'));
    }

    const { data: espAtualizada } = await _supabase.from('ia_especificacoes').select('*').eq('id', _iaEspecificacaoAtual.id).maybeSingle();
    if (espAtualizada) _iaEspecificacaoAtual = espAtualizada;
    _iaRenderResultado();
}
