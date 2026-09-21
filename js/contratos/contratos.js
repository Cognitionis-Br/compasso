// =========================================================================
// contratos/contratos.js
// Item 6 (primeiro documento de melhorias): Empresas Terceirizadas +
// Contratos por Projeto. Só projetos já ALÉM do Business Case podem
// receber contrato (regra pedida explicitamente).
//
// PENDENTE PRA PRÓXIMA SESSÃO (combinado com o usuário): tela de
// Registro de Valores Realizados (por projeto ou por proposta, travando
// no valor total do contrato) e o Relatório de Projetos (orçamento
// previsto/pós-requerimentos/pós-technical + lista de propostas).
// =========================================================================

let empresasTerceirizadasCache = [];
let contratosProjetoCache = [];

// Abre um anexo do bucket contratos-anexos (NF de pagamento etc.) por
// signed URL de curta duração. Usado no Relatório de Projetos.
async function abrirAnexoContrato(path) {
    const { data, error } = await _supabase.storage.from('contratos-anexos').createSignedUrl(path, 300);
    if (error || !data) return alert('Não foi possível abrir o anexo: ' + (error ? error.message : 'link não gerado'));
    window.open(data.signedUrl, '_blank');
}

// NOVO (a pedido do usuário 25/08/2026 — padronização/segregação de
// atividades): 2 abas, mesmo padrão V2 de Usuários/Funções/Responsáveis.
function mudarAbaEmpresas(aba) {
    ['criar', 'cadastradas'].forEach(a => {
        const btn = document.getElementById(`empresasBtn-${a}`);
        const painel = document.getElementById(`empresasPainel-${a}`);
        if (btn) btn.className = `empresas-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    aplicarVisibilidadeSubAbas('empresas_terceirizadas', 'empresasBtn');
}

function mudarAbaContratos(aba) {
    ['criar', 'cadastrados'].forEach(a => {
        const btn = document.getElementById(`contratosBtn-${a}`);
        const painel = document.getElementById(`contratosPainel-${a}`);
        if (btn) btn.className = `contratos-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    aplicarVisibilidadeSubAbas('contratos_projeto', 'contratosBtn');
}

// -------------------------------------------------------------------------
// Empresas Terceirizadas
// -------------------------------------------------------------------------
// Referência fixa que o fornecedor usa no e-mail inicial de habilitação
// (o webhook reconhece por ela). Mantém em sincronia com
// INBOUND_CONTRATOS_HABILITACAO_REF de netlify/functions/receber-email-contratos.js.
const FORNECEDOR_REF_HABILITACAO = 'HABILITACAO-FORNECEDOR';

function _fornBadgeSimNao(v, variante) {
    if (!v) return '<span class="bg-gray-200 text-gray-500 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Não</span>';
    const cls = variante === 'aprovado'
        ? 'bg-indigo-100 text-indigo-800'
        : 'bg-green-100 text-green-800';
    return `<span class="${cls} font-bold px-2 py-0.5 rounded text-[10px] uppercase">Sim</span>`;
}

async function renderEmpresasTerceirizadasView() {
    const { data, error } = await _supabase.from('empresas_terceirizadas').select('*').order('codigo');
    empresasTerceirizadasCache = error ? [] : (data || []);

    const tbody = document.getElementById('empresasTerceirizadasTableBody');
    if (tbody) {
        tbody.innerHTML = empresasTerceirizadasCache.length === 0
            ? `<tr><td colspan="7" class="p-4 text-center text-gray-400 font-bold">Nenhum fornecedor cadastrado ainda</td></tr>`
            : empresasTerceirizadasCache.map(e => {
                const enviaPag = e.envia_pagamento_email === true;
                const aprovado = e.email_pagamento_aprovado === true;
                const podeAlterar = typeof usuarioPodeAlterarTela === 'function' && usuarioPodeAlterarTela('empresas_terceirizadas');
                const toggleA = podeAlterar
                    ? `<button onclick="alternarEnviaPagamentoEmail('${escapeJsAttr(e.codigo)}')" title="Alternar 'envia pagamentos por e-mail'">${_fornBadgeSimNao(enviaPag)}</button>`
                    : _fornBadgeSimNao(enviaPag);
                const acaoInstr = (enviaPag && !aprovado && e.email && podeAlterar)
                    ? `<button onclick="reenviarInstrucoesPagamento('${escapeJsAttr(e.codigo)}')" class="text-indigo-600 hover:text-indigo-800 font-bold text-[11px] ml-2" title="Reenviar instruções de habilitação"><i class="fa-solid fa-paper-plane"></i></button>`
                    : '';
                const editar = podeAlterar
                    ? `<button onclick="editarFornecedor('${escapeJsAttr(e.codigo)}')" class="text-gray-500 hover:text-gray-800 font-bold text-xs mr-1" title="Editar"><i class="fa-solid fa-pen"></i></button>`
                    : '';
                return `
                <tr class="${!e.ativo ? 'opacity-50' : ''}">
                    <td class="p-3 font-mono font-bold">${escapeHtml(e.codigo)}</td>
                    <td class="p-3 font-semibold">${escapeHtml(e.nome)}</td>
                    <td class="p-3">${escapeHtml(e.email || '—')}</td>
                    <td class="p-3 text-center">${toggleA}${acaoInstr}</td>
                    <td class="p-3 text-center">${_fornBadgeSimNao(aprovado, 'aprovado')}</td>
                    <td class="p-3 text-center">${e.ativo ? '<span class="bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Ativo</span>' : '<span class="bg-gray-200 text-gray-500 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Inativo</span>'}</td>
                    <td class="p-3 text-center whitespace-nowrap">${editar}${botaoSePodeAtivarInativar('empresas_terceirizadas', `<button onclick="alternarAtivoEmpresa('${escapeJsAttr(e.codigo)}')" class="text-amber-600 hover:text-amber-800 font-bold text-xs"><i class="fa-solid fa-power-off"></i></button>`)}</td>
                </tr>
            `;
            }).join('');
    }

    // Popula o select de empresa (só ativas) na tela de Contratos.
    const selectEmpresa = document.getElementById('contratoEmpresaSelect');
    if (selectEmpresa) {
        selectEmpresa.innerHTML = '<option value="">-- Selecione --</option>' +
            empresasTerceirizadasCache.filter(e => e.ativo).map(e => `<option value="${escapeHtml(e.codigo)}">${escapeHtml(e.codigo)} - ${escapeHtml(e.nome)}</option>`).join('');
    }
}

function _fornLimparForm() {
    document.getElementById('empresaCodigoInput').value = '';
    document.getElementById('empresaNomeInput').value = '';
    const em = document.getElementById('empresaEmailInput'); if (em) em.value = '';
    const ep = document.getElementById('empresaEnviaPagEmailInput'); if (ep) ep.value = 'nao';
    document.getElementById('empresaCodigoInput').readOnly = false;
    const lbl = document.getElementById('empresaSalvarLabel'); if (lbl) lbl.textContent = 'Cadastrar';
}

function editarFornecedor(codigo) {
    const e = empresasTerceirizadasCache.find(x => x.codigo === codigo);
    if (!e) return;
    document.getElementById('empresaCodigoInput').value = e.codigo;
    document.getElementById('empresaCodigoInput').readOnly = true;
    document.getElementById('empresaNomeInput').value = e.nome || '';
    const em = document.getElementById('empresaEmailInput'); if (em) em.value = e.email || '';
    const ep = document.getElementById('empresaEnviaPagEmailInput'); if (ep) ep.value = e.envia_pagamento_email ? 'sim' : 'nao';
    const lbl = document.getElementById('empresaSalvarLabel'); if (lbl) lbl.textContent = 'Salvar alterações';
    if (typeof mudarAbaEmpresas === 'function') mudarAbaEmpresas('criar');
}

async function salvarEmpresaTerceirizada() {
    const codigo = document.getElementById('empresaCodigoInput').value.trim().toUpperCase();
    const nome = document.getElementById('empresaNomeInput').value.trim();
    const email = (document.getElementById('empresaEmailInput') || {}).value ? document.getElementById('empresaEmailInput').value.trim() : '';
    const enviaPag = ((document.getElementById('empresaEnviaPagEmailInput') || {}).value || 'nao') === 'sim';
    const jaExiste = empresasTerceirizadasCache.find(e => e.codigo === codigo);

    if (!jaExiste && !usuarioPodeIncluirTela('empresas_terceirizadas')) return alert('Você não tem permissão para incluir fornecedores.');
    if (jaExiste && !usuarioPodeAlterarTela('empresas_terceirizadas')) return alert('Você não tem permissão para alterar fornecedores.');

    if (!codigo || !nome) return alert('Preencha o código e o nome do fornecedor!');
    if (codigo.length > 12) return alert('O código precisa ter no máximo 12 caracteres!');
    if (nome.length > 80) return alert('O nome precisa ter no máximo 80 caracteres!');
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return alert('E-mail de contato inválido.');
    if (enviaPag && !email) return alert('Para "Envia pagamentos por e-mail = Sim" é preciso informar o e-mail de contato do fornecedor.');

    const quem = currentUser ? currentUser.nome : 'desconhecido';
    let error;
    if (jaExiste) {
        ({ error } = await _supabase.from('empresas_terceirizadas')
            .update({ nome, email: email || null, envia_pagamento_email: enviaPag })
            .eq('codigo', codigo));
    } else {
        ({ error } = await _supabase.from('empresas_terceirizadas').insert([{
            codigo, nome, email: email || null, envia_pagamento_email: enviaPag,
            criado_por: quem, criado_em: new Date().toISOString()
        }]));
    }
    if (error) return alert('Erro ao salvar: ' + error.message);

    // liga A -> envia instruções de habilitação (uma vez), se ainda não aprovado
    let msg = jaExiste ? '✅ Fornecedor atualizado.' : '✅ Fornecedor cadastrado com sucesso!';
    if (enviaPag && email && !(jaExiste && jaExiste.email_pagamento_aprovado)) {
        const enviou = await _enviarInstrucoesPagamentoFornecedor({ codigo, nome, email });
        if (enviou) msg += '\n\n📧 Instruções de habilitação enfileiradas para ' + email + ' (processe a fila de e-mail).';
    }
    alert(msg);
    _fornLimparForm();
    await renderEmpresasTerceirizadasView();
}

// Monta e enfileira o e-mail "MODELO PADRÃO PARA ENVIO DE PAGAMENTOS E NOTA
// FISCAL" para o fornecedor. Usa o template do banco quando existe; senão,
// um texto mínimo. Marca email_pagamento_instrucoes_em.
async function _enviarInstrucoesPagamentoFornecedor(forn) {
    if (typeof enfileirarEmail !== 'function') { alert('Fila de e-mail indisponível — instruções não enviadas.'); return false; }
    let assunto = `[Compasso] MODELO PADRÃO PARA ENVIO DE PAGAMENTOS E NOTA FISCAL — ${forn.nome}`;
    let corpo = `Prezado(a) ${forn.nome},\n\nPara habilitar o envio de pagamentos por e-mail, mande um e-mail inicial ao canal de contratos com:\nReferência: ${FORNECEDOR_REF_HABILITACAO}\nTipo de Lançamento: Pagamento\nFornecedor: ${forn.codigo}\nContrato: <número do contrato>\nProjeto: <código ou nome>\nValor: R$ 0,10\nData de Referência: <dd/mm/aaaa>\n(anexe qualquer PDF/JPG/PNG como exemplo de NF)\n\nApós esse e-mail ser validado em Pendências de Contratos, seu cadastro fica liberado para pagamentos.\n\nÁrea de Governança`;
    try {
        const { data: tpl } = await _supabase.from('email_templates')
            .select('*').ilike('assunto', '[Compasso] MODELO PADRÃO PARA ENVIO DE PAGAMENTOS%').eq('ativo', true).maybeSingle();
        if (tpl && tpl.texto && tpl.texto.trim()) {
            const rep = s => String(s || '')
                .replaceAll('{{fornecedor}}', forn.nome)
                .replaceAll('{{codigo}}', forn.codigo)
                .replaceAll('{{ref_habilitacao}}', FORNECEDOR_REF_HABILITACAO);
            assunto = rep(tpl.assunto) || assunto;
            corpo = rep(tpl.texto);
        }
    } catch (_) { /* usa o texto mínimo */ }

    const { error } = await enfileirarEmail({
        destinatarioEmail: forn.email, destinatarioNome: forn.nome,
        assunto, corpo, contexto: { tipo: 'habilitacao_fornecedor', fornecedor: forn.codigo }
    });
    if (error) { alert('Não foi possível enfileirar as instruções: ' + error); return false; }
    await _supabase.from('empresas_terceirizadas').update({ email_pagamento_instrucoes_em: new Date().toISOString() }).eq('codigo', forn.codigo);
    return true;
}

async function reenviarInstrucoesPagamento(codigo) {
    if (!usuarioPodeAlterarTela('empresas_terceirizadas')) return alert('Você não tem permissão para alterar fornecedores.');
    const e = empresasTerceirizadasCache.find(x => x.codigo === codigo);
    if (!e) return;
    if (!e.email) return alert('Este fornecedor não tem e-mail de contato cadastrado.');
    if (!confirm(`Reenviar as instruções de habilitação para "${e.nome}" (${e.email})?`)) return;
    const ok = await _enviarInstrucoesPagamentoFornecedor({ codigo: e.codigo, nome: e.nome, email: e.email });
    if (ok) { alert('📧 Instruções reenfileiradas. Processe a fila de e-mail.'); await renderEmpresasTerceirizadasView(); }
}

async function alternarEnviaPagamentoEmail(codigo) {
    if (!usuarioPodeAlterarTela('empresas_terceirizadas')) return alert('Você não tem permissão para alterar fornecedores.');
    const e = empresasTerceirizadasCache.find(x => x.codigo === codigo);
    if (!e) return;
    const novo = !e.envia_pagamento_email;
    if (novo && !e.email) return alert('Cadastre o e-mail de contato do fornecedor antes de ligar "envia pagamentos por e-mail" (use o lápis para editar).');
    if (!confirm(`${novo ? 'Ligar' : 'Desligar'} "envia pagamentos por e-mail" para "${e.nome}"?`)) return;

    const { error } = await _supabase.from('empresas_terceirizadas').update({ envia_pagamento_email: novo }).eq('codigo', codigo);
    if (error) return alert('Erro ao atualizar: ' + error.message);

    if (novo && e.email && !e.email_pagamento_aprovado) {
        await _enviarInstrucoesPagamentoFornecedor({ codigo: e.codigo, nome: e.nome, email: e.email });
        alert('✅ Ligado. Instruções de habilitação enfileiradas para ' + e.email + '.');
    }
    await renderEmpresasTerceirizadasView();
}

async function alternarAtivoEmpresa(codigo) {
    const e = empresasTerceirizadasCache.find(x => x.codigo === codigo);
    if (!e) return;
    if (e.ativo && !usuarioPodeDeletarTela('empresas_terceirizadas')) return alert('Você não tem permissão para inativar fornecedores.');
    if (!e.ativo && !usuarioPodeAlterarTela('empresas_terceirizadas')) return alert('Você não tem permissão para reativar fornecedores.');
    if (!confirm(`Confirma ${e.ativo ? 'inativar' : 'reativar'} o fornecedor "${e.nome}"?`)) return;

    const { error } = await _supabase.from('empresas_terceirizadas').update({ ativo: !e.ativo }).eq('codigo', codigo);
    if (error) return alert('Erro ao atualizar: ' + error.message);
    await renderEmpresasTerceirizadasView();
}

// -------------------------------------------------------------------------
// Contratos Terceirizados (renomeada de "Contratos por Projeto" em
// 25/08/2026 — o vínculo com projeto(s) virou uma função própria numa
// fase futura, "Contratos por Projeto"; aqui só o cadastro do contrato
// em si, com status Ativo/Inativo).
// -------------------------------------------------------------------------
async function renderContratosProjetoView() {
    await renderEmpresasTerceirizadasView(); // garante o select de empresa populado
    if (typeof carregarAnosFiscaisLista === 'function') await carregarAnosFiscaisLista(); // p/ afEmAndamentoStr()
    atualizarPreviaNumeroContrato();

    const { data, error } = await _supabase.from('contratos_projeto').select('*').order('id', { ascending: false });
    contratosProjetoCache = error ? [] : (data || []);

    const tbody = document.getElementById('contratosProjetoTableBody');
    if (!tbody) return;

    if (contratosProjetoCache.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-400 font-bold">Nenhum contrato cadastrado ainda</td></tr>`;
        return;
    }

    tbody.innerHTML = contratosProjetoCache.map(c => {
        const empresa = empresasTerceirizadasCache.find(e => e.codigo === c.empresa_codigo);
        const ativo = (c.status || 'ATIVO') === 'ATIVO';
        return `
            <tr class="${ativo ? '' : 'opacity-50'}">
                <td class="p-3 text-xs">${escapeHtml(empresa ? empresa.nome : c.empresa_codigo)}</td>
                <td class="p-3 text-xs">${escapeHtml(c.numero_contrato)}</td>
                <td class="p-3 text-xs">${c.data_inicio}</td>
                <td class="p-3 text-right font-mono">R$ ${Number(c.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td class="p-3 text-right font-mono">R$ ${Number(c.valor_realizado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td class="p-3 text-center">${ativo ? '<span class="bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Ativo</span>' : '<span class="bg-gray-200 text-gray-500 font-bold px-2 py-0.5 rounded text-[10px] uppercase">Inativo</span>'}</td>
                <td class="p-3 text-center">${botaoSePodeAtivarInativar('contratos_projeto', `<button onclick="alternarStatusContrato(${c.id})" class="text-amber-600 hover:text-amber-800 font-bold text-xs"><i class="fa-solid fa-power-off"></i></button>`)}</td>
            </tr>
        `;
    }).join('');
}

async function alternarStatusContrato(id) {
    if (!usuarioPodeAlterarTela('contratos_projeto') && !usuarioPodeDeletarTela('contratos_projeto')) return alert('Você não tem permissão para alterar o status de contratos.');
    const c = contratosProjetoCache.find(x => x.id === id);
    if (!c) return;
    const novoStatus = (c.status || 'ATIVO') === 'ATIVO' ? 'INATIVO' : 'ATIVO';
    if (!confirm(`Confirma ${novoStatus === 'INATIVO' ? 'inativar' : 'reativar'} o contrato "${c.numero_contrato}"?`)) return;

    const { error } = await _supabase.from('contratos_projeto').update({ status: novoStatus }).eq('id', id);
    if (error) return alert('Erro ao atualizar: ' + error.message);
    await renderContratosProjetoView();
}

// AF usado na numeração automática do contrato = o Ano Fiscal em
// andamento (o que foi aberto); fallback: o AF corrente pela data.
function _afNumeroContrato() {
    let af = (typeof afEmAndamentoStr === 'function') ? afEmAndamentoStr() : null;
    if (!af && typeof getInfoAnoFiscal === 'function') af = getInfoAnoFiscal().afAtualStr;
    return af || null;
}

// Monta o número do contrato: <EMPRESA><YYYY><MM><NNNN>.
function _montarNumeroContrato(empresaCodigo, af, mesMM, seq) {
    const yyyy = String(af || '').replace(/\D/g, '');   // AF2027 -> 2027
    return `${String(empresaCodigo || '').toUpperCase()}${yyyy}${mesMM}${String(seq).padStart(4, '0')}`;
}

// Prévia (sem consumir sequência) — só leitura do contador do AF.
async function atualizarPreviaNumeroContrato() {
    const campo = document.getElementById('contratoNumeroInput');
    if (!campo) return;
    const empresaCodigo = (document.getElementById('contratoEmpresaSelect') || {}).value || '';
    const af = _afNumeroContrato();
    if (!empresaCodigo || !af) { campo.value = ''; return; }
    const mesMM = String(new Date().getMonth() + 1).padStart(2, '0');
    const { data: cont } = await _supabase.from('contadores_contrato_af').select('ultimo_numero').eq('ano_fiscal', af).maybeSingle();
    const proximo = (cont ? cont.ultimo_numero : 0) + 1;
    campo.value = _montarNumeroContrato(empresaCodigo, af, mesMM, proximo) + '  (prévia)';
}

async function salvarContratoProjeto() {
    if (!usuarioPodeIncluirTela('contratos_projeto')) return alert('Você não tem permissão para incluir contratos.');
    const empresaCodigo = document.getElementById('contratoEmpresaSelect').value;
    const dataInicio = document.getElementById('contratoDataInicioInput').value;
    const dataEncerramento = document.getElementById('contratoDataEncerramentoInput').value;
    const qtdHoras = document.getElementById('contratoQtdHorasInput').value;
    const valorHora = document.getElementById('contratoValorHoraInput').value;
    const valorTotal = document.getElementById('contratoValorTotalInput').value;
    const observacao = document.getElementById('contratoObservacaoInput').value.trim();

    // O número NÃO é mais digitado — é gerado no formato
    // <EMPRESA><YYYY><MM><NNNN> (ver _montarNumeroContrato / RPC
    // proximo_numero_contrato). Campos obrigatórios: empresa, data início,
    // valor total.
    if (!empresaCodigo || !dataInicio || !valorTotal) {
        return alert('Preencha Empresa, Data de Início e Valor Total (os demais campos são opcionais)!');
    }

    const af = _afNumeroContrato();
    if (!af) return alert('Não foi possível determinar o Ano Fiscal para numerar o contrato. Abra/configure o Ano Fiscal antes.');
    const mesMM = String(new Date().getMonth() + 1).padStart(2, '0');

    // sequência definitiva, atômica, só agora no salvamento
    const { data: seq, error: errSeq } = await _supabase.rpc('proximo_numero_contrato', { p_ano_fiscal: af });
    if (errSeq) return alert('Erro ao gerar o número do contrato: ' + errSeq.message);
    const numeroContrato = _montarNumeroContrato(empresaCodigo, af, mesMM, seq);

    const { error } = await _supabase.from('contratos_projeto').insert([{
        empresa_codigo: empresaCodigo,
        numero_contrato: numeroContrato,
        ano_fiscal: af,
        mes_registro: mesMM,
        numero_sequencial: seq,
        data_inicio: dataInicio,
        quantidade_horas: qtdHoras ? Number(qtdHoras) : null,
        valor_hora: valorHora ? Number(valorHora) : null,
        valor_total: Number(valorTotal),
        data_encerramento: dataEncerramento || null,
        observacao: observacao || null,
        criado_por: currentUser ? currentUser.nome : 'desconhecido',
        criado_em: new Date().toISOString()
    }]);
    if (error) return alert('Erro ao salvar o contrato: ' + error.message);

    alert(`✅ Contrato salvo — número gerado: ${numeroContrato}`);
    ['contratoEmpresaSelect', 'contratoDataInicioInput', 'contratoDataEncerramentoInput', 'contratoQtdHorasInput', 'contratoValorHoraInput', 'contratoValorTotalInput', 'contratoObservacaoInput'].forEach(id => {
        document.getElementById(id).value = '';
    });
    await renderContratosProjetoView();
}

// -------------------------------------------------------------------------
// Registro de Valores Realizados — REESCRITO no Release 1: pagamento por
// Nota Fiscal com rateio entre os projetos vinculados ao contrato. O
// formulário (compartilhado com "Pendências > Lançar Manual") e o ponto
// de entrada renderRegistroValoresView() vivem em js/contratos/pagamento-nf.js.
// -------------------------------------------------------------------------

// -------------------------------------------------------------------------
// Reconciliação com projetos.realizado (a pedido do usuário 26/08/2026):
// os valores registrados aqui (por vínculo/projeto) precisam compor o
// valor realizado de cada projeto — é o campo que o Dashboard, Consultas
// etc. de fato leem (projetos.realizado), não contratos_vinculos_projeto
// diretamente. Soma o valor gasto legado (projeto_etapas.valor_gasto_
// execucao — G17/Execution) com a soma de todos os vínculos do projeto,
// pra não perder nem sobrescrever nenhuma das duas origens.
// -------------------------------------------------------------------------
async function recalcularRealizadoProjeto(projetoCodigo) {
    const { data: etapasData } = await _supabase.from('projeto_etapas').select('valor_gasto_execucao').eq('projeto_codigo', projetoCodigo);
    const realizadoLegado = (etapasData || []).reduce((acc, e) => acc + (Number(e.valor_gasto_execucao) || 0), 0);

    const { data: vinculosData } = await _supabase.from('contratos_vinculos_projeto').select('valor_realizado').eq('projeto_codigo', projetoCodigo);
    const realizadoNovo = (vinculosData || []).reduce((acc, v) => acc + (Number(v.valor_realizado) || 0), 0);

    const totalRealizado = realizadoLegado + realizadoNovo;

    const { error } = await _supabase.from('projetos').update({ realizado: totalRealizado }).eq('codigo', projetoCodigo);
    if (error) {
        console.error('Erro ao recalcular o valor realizado do projeto:', error.message);
        return;
    }

    const proj = (projectsData || []).find(p => p.codigo === projetoCodigo);
    if (proj) proj.realizado = totalRealizado;
}

// -------------------------------------------------------------------------
// Relatório de Projetos — orçamento em cada fase + propostas do projeto.
// -------------------------------------------------------------------------
// NOVO: lista simples (Código, Nome, Fase Atual, Status, Valor Orçado,
// Valor Realizado), clicável — abre o zoom individual com cabeçalho
// completo do projeto + Propostas + Pagamentos de cada proposta.
async function renderRelatorioProjetosContratosView() {
    const tbody = document.getElementById('relatorioProjetosContratosTableBody');
    if (!tbody) return;

    // NOVO (Controle de acesso por atividade, Fase 5): restrição de área.
    const lista = filtrarProjetosPorArea([...(projectsData || [])], 'relatorio_projetos_contratos').sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', 'pt-BR'));

    if (lista.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-400 font-bold">Nenhum projeto cadastrado</td></tr>`;
        return;
    }

    tbody.innerHTML = lista.map(p => {
        const valorOrcado = Number(p.val_tech) || Number(p.val_req) || Number(p.val_bc) || Number(p.previsto) || 0;
        const valorRealizado = Number(p.realizado) || 0;
        return `
            <tr class="cursor-pointer hover:bg-gray-50" onclick="abrirZoomRelatorioProjeto('${escapeJsAttr(p.codigo)}')">
                <td class="p-3 font-mono font-bold text-red-700">${p.codigo}</td>
                <td class="p-3 font-semibold">${escapeHtml(p.nome)}</td>
                <td class="p-3">${p.etapa_atual || 'BUSINESS CASE'}</td>
                <td class="p-3">${p.sub_status || '-'}</td>
                <td class="p-3 text-right font-mono">R$ ${valorOrcado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td class="p-3 text-right font-mono">R$ ${valorRealizado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            </tr>
        `;
    }).join('');
}

// -------------------------------------------------------------------------
// Zoom individual — cabeçalho completo do projeto (mesmo padrão do
// Detalhamento do Projeto) + Contratos Vinculados (Fase 7: lê pelo
// vínculo N:N — contratos_vinculos_projeto — em vez do antigo
// contratos_projeto.projeto_codigo direto, que deixou de ser preenchido
// desde a Fase 2) + Pagamentos de cada vínculo (contratos_pagamentos).
// -------------------------------------------------------------------------
async function abrirZoomRelatorioProjeto(codigo) {
    const p = projectsData.find(x => x.codigo === codigo);
    if (!p) return;

    const conteudo = document.getElementById('zoomRelatorioConteudo');
    conteudo.innerHTML = `<div class="p-8 text-center text-gray-400 font-bold">Carregando...</div>`;
    document.getElementById('modalZoomRelatorioProjeto').classList.remove('hidden');

    // Lookups de Tipo de Projeto, Pilar e Iniciativa Estratégica — mesmo
    // padrão usado no Detalhamento do Projeto.
    let tipoProjetoTexto = '-', pilarTexto = '-', iniciativaTexto = '-';
    if (p.tipo_projeto_id) {
        const { data: tp } = await _supabase.from('tipos_projeto').select('*').eq('id', p.tipo_projeto_id).maybeSingle();
        if (tp) tipoProjetoTexto = `${tp.codigo} - ${tp.descricao}`;
    }
    if (p.pilar_estrategico_id) {
        const { data: pilar } = await _supabase.from('pilares_estrategicos').select('*').eq('id', p.pilar_estrategico_id).maybeSingle();
        if (pilar) pilarTexto = pilar.nome;
    }
    if (p.iniciativa_estrategica_id) {
        const { data: ini } = await _supabase.from('iniciativas_estrategicas').select('*').eq('id', p.iniciativa_estrategica_id).maybeSingle();
        if (ini) iniciativaTexto = ini.nome;
    }

    // NOVO (Key Results / Benefit Results): mesmo padrão do Detalhamento do
    // Projeto — exibidos logo após a linha de Pilar/Iniciativa Estratégica.
    const { data: beneficiosData } = await _supabase.from('projeto_benefit_results').select('*, tipos_return_benefit(nome)').eq('projeto_codigo', codigo);
    const beneficiosDoProjeto = beneficiosData || [];

    // Empresas (pra exibir nome, não só código) + contratos vinculados ao
    // projeto via o vínculo N:N (Fase 3/4) — contratos_projeto deixou de
    // ter projeto_codigo obrigatório desde a Fase 2, então a fonte agora
    // é contratos_vinculos_projeto, não mais o contrato direto.
    const { data: empresasData } = await _supabase.from('empresas_terceirizadas').select('*');
    const empresas = empresasData || [];
    const { data: vinculosData } = await _supabase.from('contratos_vinculos_projeto').select('*').eq('projeto_codigo', codigo);
    const vinculos = vinculosData || [];

    let contratosPorId = {};
    if (vinculos.length > 0) {
        const { data: contratosData } = await _supabase.from('contratos_projeto').select('*').in('id', vinculos.map(v => v.contrato_id));
        (contratosData || []).forEach(c => { contratosPorId[c.id] = c; });
    }

    // Pagamentos (itens de rateio) de TODOS os vínculos do projeto, com o
    // cabeçalho da NF junto (data / quem / nº NF).
    let pagamentosPorVinculo = {};
    if (vinculos.length > 0) {
        const { data: itensData } = await _supabase.from('contratos_pagamento_itens').select('*').in('vinculo_id', vinculos.map(v => v.id));
        const itens = itensData || [];
        let cabPorId = {}, anexosPorPag = {};
        if (itens.length > 0) {
            const pagIds = [...new Set(itens.map(i => i.pagamento_id))];
            const [{ data: cabsData }, { data: anexData }] = await Promise.all([
                _supabase.from('contratos_pagamentos').select('*').in('id', pagIds),
                _supabase.from('contratos_pagamentos_anexos').select('*').in('pagamento_id', pagIds)
            ]);
            (cabsData || []).forEach(c => { cabPorId[c.id] = c; });
            (anexData || []).forEach(a => { (anexosPorPag[a.pagamento_id] = anexosPorPag[a.pagamento_id] || []).push(a); });
        }
        itens.forEach(i => {
            const cab = cabPorId[i.pagamento_id] || {};
            const linha = { valor_pago: i.valor, registrado_em: cab.registrado_em, registrado_por: cab.registrado_por, numero_nf: cab.numero_nf, valor_total_nf: cab.valor_total_nf, anexos: anexosPorPag[i.pagamento_id] || [] };
            (pagamentosPorVinculo[i.vinculo_id] = pagamentosPorVinculo[i.vinculo_id] || []).push(linha);
        });
    }

    const fmt = formatCurrency;

    conteudo.innerHTML = `
        <div class="bg-gray-50 rounded-lg p-4 mb-4 space-y-1">
            <div class="font-mono font-bold text-red-700 text-lg">${p.codigo}</div>
            <div class="text-lg font-bold text-gray-800">${escapeHtml(p.nome)}</div>
            <div class="text-xs text-gray-500">Área Solicitante: <b>${p.area || '-'}</b> · Porte: <b>${p.tamanho || '-'}</b> (${horasAtuaisDoProjeto(p)}h) · Qualificação: <b>${(p.tipo_qualificacao || '-').toUpperCase()}</b> · Ano Fiscal: <b>${p.ano_fiscal || '-'}</b></div>
            <div class="text-xs text-gray-500">Solicitante: <b>${escapeHtml(p.pessoa_solicitante) || '-'}</b> · Formalizado em: <b>${p.data_solicitacao || '-'}</b></div>
            <div class="text-xs text-gray-500">Tipo de Projeto: <b>${escapeHtml(tipoProjetoTexto)}</b></div>
            <div class="text-xs text-gray-500">Pilar Estratégico: <b>${escapeHtml(pilarTexto)}</b> · Iniciativa Estratégica: <b>${escapeHtml(iniciativaTexto)}</b></div>
            <div class="text-xs text-gray-500 mt-1">Objetivo: <b>${escapeHtml(p.objetivo) || '-'}</b></div>
            <div class="text-xs text-gray-500 mt-1">Key Results: <b>${escapeHtml(p.key_results) || '-'}</b></div>
            <div class="text-xs text-gray-600 mt-2 bg-white rounded p-2">
                <b class="text-gray-500 uppercase text-[10px] block mb-1">Benefit Results</b>
                ${beneficiosDoProjeto.length === 0
                    ? '<div class="italic text-gray-400">Nenhum Benefit Result cadastrado</div>'
                    : beneficiosDoProjeto.map(b => `
                        <div>${escapeHtml((b.tipos_return_benefit || {}).nome) || '-'}${b.metrica ? ` — <b>${escapeHtml(b.metrica)}</b>: R$ ${Number(b.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : ''}</div>
                    `).join('')}
            </div>
            ${p.descricao_projeto ? `<div class="text-xs text-gray-600 mt-2 bg-white rounded p-2"><b class="text-gray-500 uppercase text-[10px] block">Descrição do Projeto</b>${escapeHtml(p.descricao_projeto)}</div>` : ''}
        </div>

        <h4 class="font-bold text-gray-800 text-sm mb-2 uppercase tracking-wider border-b pb-1">Contratos Vinculados</h4>
        ${vinculos.length === 0
            ? `<p class="text-xs text-gray-400 italic mb-4">Nenhum contrato vinculado a este projeto.</p>`
            : vinculos.map(v => {
                const c = contratosPorId[v.contrato_id];
                const empresa = c ? empresas.find(e => e.codigo === c.empresa_codigo) : null;
                const pagamentos = pagamentosPorVinculo[v.id] || [];
                return `
                    <div class="border border-gray-200 rounded-lg mb-3 overflow-hidden">
                        <table class="w-full text-left border-collapse text-xs">
                            <thead><tr class="bg-gray-50 text-gray-600 font-semibold uppercase">
                                <th class="p-2">Contrato</th><th class="p-2">Empresa</th>
                                <th class="p-2 text-right">Valor Alocado a Este Projeto</th><th class="p-2">Vigência do Contrato</th>
                                <th class="p-2 text-right">Realizado Neste Projeto</th>
                            </tr></thead>
                            <tbody>
                                <tr class="border-t">
                                    <td class="p-2 font-mono font-bold">${escapeHtml(c ? c.numero_contrato : '-')}</td>
                                    <td class="p-2">${escapeHtml(empresa ? empresa.nome : (c ? c.empresa_codigo : '-'))}</td>
                                    <td class="p-2 text-right font-mono">${fmt(v.valor_vinculo)}</td>
                                    <td class="p-2">${c ? (c.data_inicio || '-') + (c.data_encerramento ? ' a ' + c.data_encerramento : '') : '-'}</td>
                                    <td class="p-2 text-right font-mono">${fmt(v.valor_realizado)}</td>
                                </tr>
                            </tbody>
                        </table>
                        <div class="bg-gray-50 px-3 py-2 border-t">
                            <p class="text-[10px] font-bold uppercase text-gray-500 mb-1">Pagamentos deste Vínculo</p>
                            ${pagamentos.length === 0
                                ? `<p class="text-[11px] text-gray-400 italic">Nenhum pagamento registrado ainda.</p>`
                                : `<table class="w-full text-left text-[11px]">
                                    <thead><tr class="text-gray-500 uppercase text-[9px]"><th class="py-1">Data</th><th class="py-1">NF</th><th class="py-1 text-right">Rateio p/ este projeto</th><th class="py-1">Quem Autorizou</th><th class="py-1">Nota Fiscal</th></tr></thead>
                                    <tbody>
                                        ${pagamentos.map(pg => `
                                            <tr class="border-t border-gray-200">
                                                <td class="py-1">${pg.registrado_em ? new Date(pg.registrado_em).toLocaleString('pt-BR') : '-'}</td>
                                                <td class="py-1">${escapeHtml(pg.numero_nf || '-')}</td>
                                                <td class="py-1 text-right font-mono">${fmt(pg.valor_pago)}</td>
                                                <td class="py-1 uppercase">${escapeHtml(pg.registrado_por) || '-'}</td>
                                                <td class="py-1">${(pg.anexos && pg.anexos.length)
                                                    ? pg.anexos.map(a => `<button onclick="abrirAnexoContrato('${escapeJsAttr(a.storage_path)}')" class="text-indigo-600 hover:underline font-bold">${a.classificacao === 'NOTA_FISCAL' ? '📄 Ver NF' : '📎 ' + escapeHtml(a.nome_original || 'anexo')}</button>`).join(' · ')
                                                    : '<span class="text-gray-400">sem anexo</span>'}</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>`}
                        </div>
                    </div>
                `;
            }).join('')
        }
    `;
}

function fecharModalZoomRelatorioProjeto() {
    document.getElementById('modalZoomRelatorioProjeto').classList.add('hidden');
}
