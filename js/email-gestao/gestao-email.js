// =========================================================================
// email-gestao/gestao-email.js
// Item 11 (relatório de melhorias): Gestão de Templates — reescrito.
// Template agora é só Assunto + Texto (reutilizável); quem decide QUANDO
// e PRA QUEM enviar é a linha correspondente em Gestão do Fluxo de
// E-mail (fluxo-email.js), não o template em si.
//
// A chave geral de envio (liga/desliga tudo) saiu — cada linha do Fluxo
// agora tem seu próprio "ativo", mais granular.
// =========================================================================

let emailTemplatesCache = [];

function mudarAbaTemplates(aba) {
    ['incluir', 'cadastrados'].forEach(a => {
        const btn = document.getElementById(`templatesBtn-${a}`);
        const painel = document.getElementById(`templatesPainel-${a}`);
        if (btn) btn.className = `templates-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    aplicarVisibilidadeSubAbas('gestao_templates', 'templatesBtn');
}

async function renderGestaoTemplatesView() {
    // NOVO (item 11): ordem ASC de assunto, conforme pedido.
    const { data, error } = await _supabase.from('email_templates').select('*').order('assunto');
    emailTemplatesCache = error ? [] : (data || []);

    const tbody = document.getElementById('emailTemplatesTableBody');
    if (!tbody) return;

    if (emailTemplatesCache.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-gray-400 font-bold">Nenhum template cadastrado ainda</td></tr>`;
        return;
    }

    tbody.innerHTML = emailTemplatesCache.map(t => `
        <tr class="${!t.ativo ? 'opacity-50' : ''}">
            <td class="p-3 font-bold">${escapeHtml(t.assunto)}</td>
            <td class="p-3 text-gray-500 text-xs">${escapeHtml((t.texto || '').slice(0, 80))}${(t.texto || '').length > 80 ? '…' : ''}</td>
            <td class="p-3 text-center">${t.eh_template_governanca ? '<span class="bg-indigo-100 text-indigo-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Governança</span>' : '-'}</td>
            <td class="p-3 text-center">${t.ativo ? '<span class="bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Ativo</span>' : '<span class="bg-gray-200 text-gray-500 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Inativo</span>'}</td>
            <td class="p-3 text-center space-x-2">
                <button onclick="editarTemplateEmail(${t.id})" class="text-indigo-600 hover:text-indigo-800 font-bold"><i class="fa-solid fa-pen-to-square"></i></button>
                <button onclick="alternarAtivoTemplateEmail(${t.id})" class="text-amber-600 hover:text-amber-800 font-bold"><i class="fa-solid fa-power-off"></i></button>
            </td>
        </tr>
    `).join('');
}

function limparFormTemplateEmail() {
    document.getElementById('templateIdHidden').value = '';
    document.getElementById('templateAssuntoInput').value = '';
    document.getElementById('templateTextoInput').value = '';
    const checkGovernanca = document.getElementById('templateGovernancaCheck');
    if (checkGovernanca) checkGovernanca.checked = false;
}

function editarTemplateEmail(id) {
    const t = emailTemplatesCache.find(x => x.id === id);
    if (!t) return;
    document.getElementById('templateIdHidden').value = t.id;
    document.getElementById('templateAssuntoInput').value = t.assunto;
    document.getElementById('templateTextoInput').value = t.texto;
    const checkGovernancaEdit = document.getElementById('templateGovernancaCheck');
    if (checkGovernancaEdit) checkGovernancaEdit.checked = t.eh_template_governanca === true;
    mudarAbaTemplates('incluir');
}

async function salvarTemplateEmail() {
    const id = document.getElementById('templateIdHidden').value;
    const assunto = document.getElementById('templateAssuntoInput').value.trim();
    const texto = document.getElementById('templateTextoInput').value.trim();
    const checkGovernancaSalvar = document.getElementById('templateGovernancaCheck');
    const ehGovernanca = checkGovernancaSalvar ? checkGovernancaSalvar.checked : false;

    if (!assunto || !texto) {
        return alert('Preencha o assunto e o texto do e-mail!');
    }

    const agora = new Date().toISOString();
    const quem = currentUser ? currentUser.nome : 'desconhecido';
    const payload = { assunto, texto, eh_template_governanca: ehGovernanca, atualizado_por: quem, atualizado_em: agora };

    let error;
    if (id) {
        ({ error } = await _supabase.from('email_templates').update(payload).eq('id', id));
    } else {
        payload.criado_por = quem;
        payload.criado_em = agora;
        ({ error } = await _supabase.from('email_templates').insert([payload]));
    }
    if (error) return alert('Erro ao salvar o template: ' + error.message);

    alert('✅ Template salvo com sucesso!');
    limparFormTemplateEmail();
    mudarAbaTemplates('cadastrados');
    await renderGestaoTemplatesView();
}

async function alternarAtivoTemplateEmail(id) {
    const t = emailTemplatesCache.find(x => x.id === id);
    if (!t) return;
    if (!confirm(`Confirma ${t.ativo ? 'inativar' : 'reativar'} o template "${t.assunto}"?${t.ativo ? ' Fluxos que usam esse template pra enviar deixarão de conseguir disparar até você trocar o template deles.' : ''}`)) return;

    const { error } = await _supabase.from('email_templates').update({ ativo: !t.ativo }).eq('id', id);
    if (error) return alert('Erro ao atualizar: ' + error.message);
    await renderGestaoTemplatesView();
}

// -------------------------------------------------------------------------
// Fila de E-mail — item 13 (relatório de melhorias): colunas e
// ordenação ajustadas. Data de Geração DESC (mais recente primeiro),
// Etapa ASC, Quando Disparou ASC — como critério de desempate, nessa
// ordem.
// -------------------------------------------------------------------------
async function renderFilaEmailPendentes() {
    const tbody = document.getElementById('filaEmailPendentesTableBody');
    if (!tbody) return;

    // NOVO (chave geral de envio de e-mail): avisa aqui também, já que
    // "Enviar Fila" fica nesta tela.
    await carregarConfigEmailGeral();
    const avisoEl = document.getElementById('avisoChaveGeralEmailFila');
    if (avisoEl) avisoEl.classList.toggle('hidden', configEmailGeralAtivo);

    const { data, error } = await _supabase.from('emails_pendentes').select('*').limit(500);
    let fila = error ? [] : (data || []);

    fila.sort((a, b) => {
        const dataA = a.created_at || '', dataB = b.created_at || '';
        if (dataA !== dataB) return dataB.localeCompare(dataA); // desc
        const etapaA = (a.contexto && a.contexto.etapa) || '', etapaB = (b.contexto && b.contexto.etapa) || '';
        if (etapaA !== etapaB) return etapaA.localeCompare(etapaB, 'pt-BR'); // asc
        const quandoA = (a.contexto && a.contexto.quando_dispara) || '', quandoB = (b.contexto && b.contexto.quando_dispara) || '';
        return quandoA.localeCompare(quandoB, 'pt-BR'); // asc
    });

    if (fila.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400 font-bold">Nenhum e-mail gerado ainda</td></tr>`;
        return;
    }

    tbody.innerHTML = fila.map(e => {
        const ctx = e.contexto || {};
        return `
            <tr>
                <td class="p-3 text-xs">${e.created_at ? new Date(e.created_at).toLocaleString('pt-BR') : '-'}</td>
                <td class="p-3 text-xs">${ctx.etapa || '-'}</td>
                <td class="p-3 text-xs">${ctx.quando_dispara || '-'}</td>
                <td class="p-3 text-xs">${e.destinatario_nome ? escapeHtml(e.destinatario_nome) + ' — ' : ''}${escapeHtml(e.destinatario_email)}</td>
                <td class="p-3 text-xs font-semibold">${escapeHtml(e.assunto)}</td>
                <td class="p-3 text-center">
                    ${e.enviado
                        ? '<span class="bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded text-[10px]">Enviado</span>'
                        : (e.erro_ultima_tentativa
                            ? `<span class="bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded text-[10px]" title="${escapeHtml(e.erro_ultima_tentativa)}">Falhou (${e.tentativas || 1}x)</span>`
                            : '<span class="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[10px]">Aguardando</span>')}
                </td>
            </tr>
        `;
    }).join('');
}

// Monta o e-mail final a partir de um template + projeto — usado tanto
// pela Governança quanto por futuros disparos automáticos.
function montarEmailPorTemplate(template, projeto, dadosExtras) {
    dadosExtras = dadosExtras || {};
    let corpoFinal = template.texto;
    Object.keys(dadosExtras).forEach(chave => {
        corpoFinal = corpoFinal.replaceAll(`{{${chave}}}`, dadosExtras[chave]);
    });
    if (projeto) {
        corpoFinal += `\n\n---\nProjeto: ${projeto.codigo} - ${projeto.nome}`;
    }
    return { assunto: template.assunto, corpo: corpoFinal };
}
