// =========================================================================
// email-gestao/fluxo-email.js
// Item 11 (relatório de melhorias): Gestão do Fluxo de E-mail — lista
// FIXA (email_fluxo, semeada via SQL) dos pontos de disparo do workflow.
// Todas nascem inativas. Só é possível ativar uma linha depois de
// cadastrar destinatário, remetente e selecionar um template ATIVO.
// =========================================================================

let emailFluxoCache = [];

// -------------------------------------------------------------------------
// NOVO (chave geral de envio de e-mail): liga/desliga que suplanta o
// "ativo" individual de cada linha de email_fluxo. Enquanto desligada,
// dispararEmailFluxo() nem enfileira e processarFilaEmailPendente() se
// recusa a enviar — ver js/email-gestao/disparo-fluxo.js e envio-email.js.
// -------------------------------------------------------------------------
async function carregarConfigEmailGeral() {
    const { data, error } = await _supabase.from('config_email_geral').select('*').eq('id', 1).maybeSingle();
    configEmailGeralAtivo = error || !data ? true : data.envio_ativo === true;
}

async function alternarEnvioEmailGeral(ativo) {
    if (!usuarioPodeAlterarTela('gestao_fluxo_email')) { alert('Você não tem permissão para alterar o fluxo de e-mail.'); return renderGestaoFluxoEmailView(); }
    if (!confirm(ativo
        ? 'Confirma LIGAR o envio de e-mail no sistema inteiro? As linhas do Fluxo marcadas como ativas voltam a enfileirar e a Fila de E-mail volta a poder ser processada.'
        : '⛔ Confirma DESLIGAR o envio de e-mail no sistema inteiro? Nenhum e-mail novo será enfileirado e a Fila de E-mail deixa de poder ser processada, mesmo com linhas do Fluxo ativas.')) {
        await renderGestaoFluxoEmailView(); // desmarca o switch visualmente
        return;
    }

    const payload = { envio_ativo: ativo, atualizado_por: currentUser ? currentUser.nome : 'desconhecido', atualizado_em: new Date().toISOString() };
    const { error } = await _supabase.from('config_email_geral').update(payload).eq('id', 1);
    if (error) {
        alert('Erro ao atualizar a chave geral: ' + error.message);
        await renderGestaoFluxoEmailView();
        return;
    }
    configEmailGeralAtivo = ativo;
    await renderGestaoFluxoEmailView();
}

async function renderGestaoFluxoEmailView() {
    await carregarConfigEmailGeral();
    const podeAlterarFluxo = usuarioPodeAlterarTela('gestao_fluxo_email'); // Fase 2b

    const [{ data: fluxoData, error: errorFluxo }, { data: templatesData }] = await Promise.all([
        _supabase.from('email_fluxo').select('*').order('id'),
        _supabase.from('email_templates').select('*').eq('ativo', true).order('assunto')
    ]);

    emailFluxoCache = errorFluxo ? [] : (fluxoData || []);
    const templatesAtivos = templatesData || [];

    const chaveGeralEl = document.getElementById('chaveGeralEmailContainer');
    if (chaveGeralEl) {
        chaveGeralEl.innerHTML = `
            <div class="flex items-center justify-between bg-white border-2 ${configEmailGeralAtivo ? 'border-green-200' : 'border-red-300'} rounded-lg p-4 shadow-sm mb-4">
                <div>
                    <div class="font-bold text-sm text-gray-800">Chave Geral de Envio de E-mail</div>
                    <div class="text-xs text-gray-500 mt-0.5">Suplanta o "Ativo" de cada linha abaixo — desligada aqui, nada é enfileirado nem enviado, mesmo com linhas ativas.</div>
                </div>
                <label class="inline-flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" ${configEmailGeralAtivo ? 'checked' : ''} ${podeAlterarFluxo ? '' : 'disabled'} onchange="alternarEnvioEmailGeral(this.checked)">
                    <span class="text-xs font-bold uppercase ${configEmailGeralAtivo ? 'text-green-700' : 'text-red-700'}">${configEmailGeralAtivo ? 'Ligada' : 'Desligada'}</span>
                </label>
            </div>
        `;
    }

    const tbody = document.getElementById('emailFluxoTableBody');
    if (!tbody) return;

    if (emailFluxoCache.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-400 font-bold">Nenhum ponto de disparo cadastrado</td></tr>`;
        return;
    }

    tbody.innerHTML = emailFluxoCache.map(f => {
        const opcoesTemplate = ['<option value="">-- Selecione --</option>']
            .concat(templatesAtivos.map(t => `<option value="${t.id}" ${t.id === f.template_id ? 'selected' : ''}>${escapeHtml(t.assunto)}</option>`))
            .join('');

        // NOVO (correção do bug de "ORÇAMENTAR DEMANDA" vs "REALIZAR
        // ORÇAMENTO"): mostra o nome da TELA (reconhecível no menu),
        // mesmo guardando o nome interno do motor no banco — só um
        // apelido de exibição, não muda o valor usado na consulta.
        const APELIDOS_ETAPA_EXIBICAO = { 'REALIZAR ORÇAMENTO': 'REALIZAR ORÇAMENTO (tela: Orçamentar Demanda)' };
        const etapaExibicao = APELIDOS_ETAPA_EXIBICAO[f.etapa] || f.etapa;

        return `
            <tr class="${!f.ativo ? 'opacity-60' : ''}">
                <td class="p-3 font-mono text-xs font-bold">${f.fase}</td>
                <td class="p-3 text-xs">${etapaExibicao}</td>
                <td class="p-3 text-xs">${f.quando_dispara}</td>
                <td class="p-3">
                    <select id="fluxoDestTipo_${f.id}" onchange="onChangeTipoDestinatarioFluxo(${f.id})" class="p-1 border border-gray-300 rounded text-[10px] bg-white mb-1 w-full">
                        <option value="RESPONSAVEL_TAREFA" ${f.tipo_destinatario !== 'EMAIL_FIXO' ? 'selected' : ''}>Responsável da tarefa</option>
                        <option value="EMAIL_FIXO" ${f.tipo_destinatario === 'EMAIL_FIXO' ? 'selected' : ''}>E-mail fixo</option>
                    </select>
                    <input type="email" id="fluxoDestFixo_${f.id}" value="${escapeHtml(f.email_destinatario_fixo || '')}" placeholder="e-mail fixo" class="p-1 border border-gray-300 rounded text-[10px] w-full ${f.tipo_destinatario === 'EMAIL_FIXO' ? '' : 'hidden'}">
                </td>
                <td class="p-3"><input type="email" id="fluxoRemetente_${f.id}" value="${escapeHtml(f.remetente || '')}" placeholder="remetente@empresa.com" class="p-1 border border-gray-300 rounded text-[10px] w-full"></td>
                <td class="p-3"><select id="fluxoTemplate_${f.id}" class="p-1 border border-gray-300 rounded text-[10px] bg-white w-full">${opcoesTemplate}</select></td>
                <td class="p-3 text-center">
                    <div class="flex flex-col items-center gap-1">
                        <label class="inline-flex items-center gap-1 cursor-pointer">
                            <input type="checkbox" ${f.ativo ? 'checked' : ''} ${podeAlterarFluxo ? '' : 'disabled'} onchange="onToggleAtivoFluxo(${f.id}, this.checked)">
                            <span class="text-[9px] font-bold uppercase ${f.ativo ? 'text-green-700' : 'text-gray-400'}">${f.ativo ? 'Ativo' : 'Inativo'}</span>
                        </label>
                        ${botaoSePodeAlterar('gestao_fluxo_email', `<button onclick="salvarConfigFluxo(${f.id})" class="text-indigo-600 hover:text-indigo-800 font-bold text-[9px] uppercase">Salvar dados</button>`)}
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function onChangeTipoDestinatarioFluxo(id) {
    const tipo = document.getElementById(`fluxoDestTipo_${id}`).value;
    document.getElementById(`fluxoDestFixo_${id}`).classList.toggle('hidden', tipo !== 'EMAIL_FIXO');
}

// Salva destinatário/remetente/template dessa linha (sem mexer no
// ativo/inativo — isso é feito pelo checkbox, com sua própria validação).
async function salvarConfigFluxo(id) {
    if (!usuarioPodeAlterarTela('gestao_fluxo_email')) return alert('Você não tem permissão para alterar o fluxo de e-mail.');
    const tipoDestinatario = document.getElementById(`fluxoDestTipo_${id}`).value;
    const emailFixo = document.getElementById(`fluxoDestFixo_${id}`).value.trim();
    const remetente = document.getElementById(`fluxoRemetente_${id}`).value.trim();
    const templateId = document.getElementById(`fluxoTemplate_${id}`).value;

    if (tipoDestinatario === 'EMAIL_FIXO' && !emailFixo) {
        return alert('Informe o e-mail fixo do destinatário!');
    }

    const payload = {
        tipo_destinatario: tipoDestinatario,
        email_destinatario_fixo: tipoDestinatario === 'EMAIL_FIXO' ? emailFixo : null,
        remetente: remetente || null,
        template_id: templateId ? Number(templateId) : null,
        atualizado_por: currentUser ? currentUser.nome : 'desconhecido',
        atualizado_em: new Date().toISOString()
    };

    const { error } = await _supabase.from('email_fluxo').update(payload).eq('id', id);
    if (error) return alert('Erro ao salvar: ' + error.message);

    const f = emailFluxoCache.find(x => x.id === id);
    if (f) Object.assign(f, payload);
    alert('✅ Dados salvos! Agora você já pode ativar esta linha, se quiser.');
}

// NOVO (item 11): só permite ativar se destinatário+remetente+template
// já estiverem cadastrados — regra central pedida no relatório de
// melhorias.
async function onToggleAtivoFluxo(id, marcarAtivo) {
    if (!usuarioPodeAlterarTela('gestao_fluxo_email')) { alert('Você não tem permissão para alterar o fluxo de e-mail.'); return renderGestaoFluxoEmailView(); }
    const f = emailFluxoCache.find(x => x.id === id);
    if (!f) return;

    if (marcarAtivo) {
        // Lê os valores ATUAIS da tela (podem não ter sido salvos ainda
        // via "Salvar dados") — exige que estejam preenchidos.
        const tipoDestinatario = document.getElementById(`fluxoDestTipo_${id}`).value;
        const emailFixo = document.getElementById(`fluxoDestFixo_${id}`).value.trim();
        const remetente = document.getElementById(`fluxoRemetente_${id}`).value.trim();
        const templateId = document.getElementById(`fluxoTemplate_${id}`).value;

        const destinatarioOk = tipoDestinatario === 'RESPONSAVEL_TAREFA' || !!emailFixo;
        if (!destinatarioOk || !remetente || !templateId) {
            alert('⛔ Só é possível ativar depois de cadastrar destinatário, remetente e template — clique em "Salvar dados" primeiro.');
            await renderGestaoFluxoEmailView(); // desmarca o checkbox visualmente
            return;
        }

        // Garante que os dados na tela estão salvos antes de ativar.
        await salvarConfigFluxo(id);
    }

    const { error } = await _supabase.from('email_fluxo').update({ ativo: marcarAtivo }).eq('id', id);
    if (error) {
        alert('Erro ao atualizar: ' + error.message);
        await renderGestaoFluxoEmailView();
        return;
    }
    f.ativo = marcarAtivo;
    await renderGestaoFluxoEmailView();
}
