// =========================================================================
// workspace-projeto/documentos-projeto.js
// Compasso 2.0 — Release 2, aba Documentos do Workspace. Primeiro
// repositório de documentos NO NÍVEL DO PROJETO do Compasso (os anexos
// que já existiam — contratos_pendencias_anexos, ia_especificacoes_anexos
// — são todos de módulo/etapa específicos). Mesmo padrão de Storage +
// metadados de sql/2026-08-31 em diante (bucket privado + signed URL).
// =========================================================================

let _docProjetoCodigo = null;

async function renderDocumentosProjeto(projetoCodigo, wrapperElId) {
    _docProjetoCodigo = projetoCodigo;
    const wrapper = document.getElementById(wrapperElId);
    if (!wrapper) return;
    await _docRenderLista(wrapperElId);
}

async function _docRenderLista(wrapperElId) {
    const wrapper = document.getElementById(wrapperElId || 'wsDocumentosBody');
    if (!wrapper) return;
    wrapper.innerHTML = renderLoadingState();

    const { data: documentos } = await _supabase
        .from('project_documents')
        .select('*, project_document_versions(id, versao, storage_path, nome_original, tamanho_bytes, enviado_em)')
        .eq('projeto_codigo', _docProjetoCodigo)
        .order('criado_em', { ascending: false });

    const lista = documentos || [];
    const linhas = await Promise.all(lista.map(async d => {
        const versoes = (d.project_document_versions || []).sort((a, b) => b.versao - a.versao);
        const ultima = versoes[0];
        let link = '#';
        if (ultima) {
            const { data: assinado } = await _supabase.storage.from('projeto-documentos').createSignedUrl(ultima.storage_path, 300);
            if (assinado && assinado.signedUrl) link = assinado.signedUrl;
        }
        return `
        <div class="flex items-center justify-between p-3 border border-gray-100 rounded hover:bg-gray-50">
            <div class="min-w-0">
                <div class="text-sm font-bold text-gray-800 truncate">${escapeHtml(d.titulo)}</div>
                <div class="text-[10px] text-gray-400">Versão ${ultima ? ultima.versao : '-'} · ${ultima ? formatDateTime(ultima.enviado_em) : '-'}</div>
            </div>
            <div class="flex items-center gap-3 flex-shrink-0 ml-2">
                <a href="${link}" target="_blank" class="text-[11px] font-bold text-indigo-700 hover:text-indigo-900"><i class="fa-solid fa-download"></i> Baixar</a>
                <label class="text-[11px] font-bold text-gray-600 hover:text-gray-900 cursor-pointer">
                    <i class="fa-solid fa-upload"></i> Nova versão
                    <input type="file" class="hidden" onchange="docEnviarNovaVersao(${d.id}, this)">
                </label>
            </div>
        </div>`;
    }));

    wrapper.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <h4 class="text-xs font-black uppercase text-gray-500">Documentos do Projeto</h4>
            <label class="bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs px-3 py-1.5 rounded cursor-pointer">
                <i class="fa-solid fa-plus"></i> Novo Documento
                <input type="file" class="hidden" onchange="docCriarNovo(this)">
            </label>
        </div>
        <div class="space-y-2">
            ${linhas.length === 0 ? '<p class="text-xs text-gray-400 italic py-6 text-center">Nenhum documento ainda.</p>' : linhas.join('')}
        </div>
    `;
}

async function docCriarNovo(input) {
    const arquivo = input.files && input.files[0];
    if (!arquivo) return;
    const titulo = prompt('Título do documento:', arquivo.name);
    if (!titulo) { input.value = ''; return; }

    const { data: documento, error: erroDoc } = await _supabase.from('project_documents')
        .insert([{ projeto_codigo: _docProjetoCodigo, titulo, criado_por: currentUser.id }])
        .select().single();
    if (erroDoc) { input.value = ''; return alert('Erro ao criar documento: ' + erroDoc.message); }

    await _docUploadVersao(documento.id, arquivo, 1);
    input.value = '';
    await _docRenderLista();
}

async function docEnviarNovaVersao(documentoId, input) {
    const arquivo = input.files && input.files[0];
    if (!arquivo) return;
    const { data: versoes } = await _supabase.from('project_document_versions').select('versao').eq('document_id', documentoId).order('versao', { ascending: false }).limit(1);
    const novaVersao = versoes && versoes[0] ? versoes[0].versao + 1 : 1;
    await _docUploadVersao(documentoId, arquivo, novaVersao);
    input.value = '';
    await _docRenderLista();
}

async function _docUploadVersao(documentoId, arquivo, versao) {
    const storagePath = `${_docProjetoCodigo}/${documentoId}_v${versao}_${arquivo.name}`;
    const { error: erroUpload } = await _supabase.storage.from('projeto-documentos').upload(storagePath, arquivo);
    if (erroUpload) return alert('Erro ao subir o arquivo: ' + erroUpload.message);

    await _supabase.from('project_document_versions').insert([{
        document_id: documentoId, versao, storage_path: storagePath,
        nome_original: arquivo.name, tamanho_bytes: arquivo.size, enviado_por: currentUser.id
    }]);
}
