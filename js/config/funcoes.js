// =========================================================================
// config/funcoes.js
// RBAC — Papéis (funções) e atribuição de papéis a usuários.
// Especificacao_Workflow_v2.md, seção 9.
//
// AJUSTADO (Controle de acesso por atividade, Fases 1-4, a pedido do
// usuário 26/08/2026): a matriz antiga de etapa×ação (permissoes_etapa, só
// 15 etapas, cobria pouco do sistema) foi substituída por um catálogo
// explícito de atividade (catalogo_atividades — uma linha por
// aba/sub-aba/botão do sistema inteiro, ~72 linhas) + funcao_atividades
// (o que cada função pode acessar). Funções com acesso_irrestrito=true
// (ADMINISTRADOR nasce assim) ignoram o catálogo por completo.
//
// IMPORTANTE — o que isto NÃO faz ainda: não há RLS no banco checando
// esta matriz (ver nota no topo de schema_rbac.sql). O que existe aqui é
// a camada de dados + administração + checagem client-side
// (usuarioTemAtividade), usada só para UX (esconder/desabilitar
// telas/botões). Alguém com acesso direto à API do Supabase ainda
// contorna isso — RLS de verdade é o próximo passo.
// =========================================================================

let atividadesUsuarioAtual = new Set(); // activity_key do catálogo -> usuário tem acesso (>= Consultar)
// NOVO (segurança Fase 2, 2026-09-01): CRUD por activity_key, OR entre todas
// as funções do usuário. Usado por usuarioPodeIncluir/Alterar/Deletar.
let crudUsuarioAtual = new Map(); // activity_key -> { c, i, a, d }
let funcoesUsuarioAtual = []; // nomes das funções do usuário logado
let ehAdministrador = false;
// NOVO (papel Proprietário, 28/08/2026): mais privilegiado que
// ehAdministrador — o único com acesso a Licenciamento de Módulos
// (js/core/licenca.js). Todo Proprietário também é Administrador
// (funcoes.acesso_irrestrito=true na função PROPRIETARIO), mas o
// contrário não vale: Administrador comum segue com as mesmas funções de
// sempre, MENOS licenciamento de módulos.
let ehProprietario = false;

// NOVO: alterna entre as 2 abas de Funções e Permissões.
function mudarAbaFuncoes(aba) {
    ['criar', 'cadastradas'].forEach(a => {
        const btn = document.getElementById(`funcoesBtn-${a}`);
        const painel = document.getElementById(`funcoesPainel-${a}`);
        if (btn) btn.className = `funcoes-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    aplicarVisibilidadeSubAbas('funcoes_permissoes', 'funcoesBtn');
}

async function loadFuncoes() {
    // AJUSTADO (Controle de acesso por atividade, Fases 2 e 4): a criação/
    // gestão de funções usa catalogo_atividades + funcao_atividades — a
    // matriz antiga (permissoes_etapa) parou de ser lida a partir da Fase
    // 4, depois de migrados os últimos pontos que ainda dependiam dela. A
    // tabela em si não foi apagada do banco (fica como histórico).
    const [funcoesRes, atividadesRes, funcaoAtividadesRes, usuarioFuncoesRes, usuariosRes] = await Promise.all([
        _supabase.from('funcoes').select('*').order('nome'),
        _supabase.from('catalogo_atividades').select('*').order('ordem'),
        _supabase.from('funcao_atividades').select('*'),
        _supabase.from('usuario_funcoes').select('*'),
        _supabase.from('perfis_usuarios').select('*').order('nome')
    ]);

    funcoesData = funcoesRes.data || [];
    atividadesData = atividadesRes.data || [];
    funcaoAtividadesData = funcaoAtividadesRes.data || [];
    usuarioFuncoesData = usuarioFuncoesRes.data || [];
    usuariosData = usuariosRes.data || [];

    renderFuncoesTable();
    renderMatrizPermissoesFormulario(); // matriz vazia (nova função) por padrão
    renderUsuariosFuncoesTable();
}

// Só funções ATIVAS podem ser atribuídas a usuários — a matriz de
// atribuição (renderUsuariosFuncoesTable) e o cadastro de novos vínculos
// não devem oferecer funções inativas.
function funcoesAtivas() {
    return funcoesData.filter(f => f.ativo !== false);
}

function renderFuncoesTable() {
    const tbody = document.getElementById('tableFuncoesBody');
    if (!tbody) return;

    if (funcoesData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-gray-400 font-bold">Nenhuma função cadastrada</td></tr>`;
        return;
    }

    tbody.innerHTML = funcoesData.map(f => {
        const inativa = f.ativo === false;
        return `
            <tr class="${inativa ? 'bg-gray-50 text-gray-400' : ''}">
                <td class="p-3 font-bold uppercase">${escapeHtml(f.nome)}</td>
                <td class="p-3 ${inativa ? '' : 'text-gray-600'}">${escapeHtml(f.descricao) || '-'}</td>
                <td class="p-3">
                    ${inativa
                        ? `<span class="bg-gray-200 text-gray-500 font-bold px-2 py-0.5 rounded text-[10px]">INATIVA</span>`
                        : `<span class="bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded text-[10px]">ATIVA</span>`}
                    ${f.acesso_irrestrito ? `<span class="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[10px] ml-1">ACESSO IRRESTRITO</span>` : ''}
                    ${f.eh_proprietario ? `<span class="bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded text-[10px] ml-1">PROPRIETÁRIO</span>` : ''}
                </td>
                <td class="p-3 text-right space-x-2 whitespace-nowrap">
                    ${inativa
                        ? `<button onclick="reativarFuncao(${f.id})" class="text-green-700 hover:text-green-900 text-xs font-bold"><i class="fa-solid fa-rotate-left"></i> Reativar</button>`
                        : `<button onclick="editFuncao(${f.id})" class="text-indigo-600 hover:text-indigo-800 text-xs font-bold"><i class="fa-solid fa-pen-to-square"></i> Editar</button>
                           <button onclick="deleteFuncao(${f.id})" class="text-red-600 hover:text-red-800 text-xs font-bold"><i class="fa-solid fa-trash"></i> Excluir</button>`}
                </td>
            </tr>
        `;
    }).join('');
}

// AJUSTADO (Controle de acesso por atividade, Fase 2): a matriz
// etapa×ação virou um checklist de atividades do catálogo
// (catalogo_atividades), agrupado por Grupo de Funções → Função.
// AJUSTADO (segurança Fase 2, 2026-09-01): cada atividade passa a ter 4
// checkboxes — Consultar / Incluir / Alterar / Deletar — persistidos em
// funcao_atividades.pode_*.
// `jaMarcadas` aceita:
//   Map<atividade_id, {c,i,a,d}>  (fluxo de editar função)
//   Set<atividade_id>             (compat — presença = só Consultar)
function renderMatrizPermissoesFormulario(jaMarcadas) {
    const container = document.getElementById('funcaoMatrizPermissoesContainer');
    if (!container) return;

    const permsDe = (id) => {
        if (jaMarcadas instanceof Map) return jaMarcadas.get(id) || null;
        if (jaMarcadas instanceof Set) return jaMarcadas.has(id) ? { c: true } : null;
        return null;
    };

    // Agrupa mantendo a ordem de chegada (já vem ordenado por `ordem` do
    // catálogo) — Map preserva ordem de inserção das chaves em JS.
    // (Fase 1 de segurança: colunas grupo_funcao/funcao renomeadas para
    // grupo/subgrupo; lê as duas formas por segurança.)
    const porGrupo = new Map();
    atividadesData.forEach(a => {
        const g = a.grupo ?? a.grupo_funcao;
        const s = a.subgrupo ?? a.funcao;
        if (!porGrupo.has(g)) porGrupo.set(g, new Map());
        const porFuncao = porGrupo.get(g);
        if (!porFuncao.has(s)) porFuncao.set(s, []);
        porFuncao.get(s).push(a);
    });

    const cb = (aid, campo, on) =>
        `<td class="text-center px-1"><input type="checkbox" class="funcao-form-ativ-checkbox" data-atividade-id="${aid}" data-campo="${campo}" ${on ? 'checked' : ''}></td>`;

    const blocosGrupo = Array.from(porGrupo.entries()).map(([grupo, porFuncao]) => {
        const blocosFuncao = Array.from(porFuncao.entries()).map(([funcaoNome, atividades]) => {
            const linhas = atividades.map(a => {
                const p = permsDe(a.id) || {};
                return `<tr class="border-t border-gray-100">
                    <td class="py-1 pr-2">${a.atividade}</td>
                    ${cb(a.id, 'pode_consultar', !!p.c)}
                    ${cb(a.id, 'pode_incluir', !!p.i)}
                    ${cb(a.id, 'pode_alterar', !!p.a)}
                    ${cb(a.id, 'pode_deletar', !!p.d)}
                </tr>`;
            }).join('');
            return `
                <div class="mb-2">
                    <div class="text-[11px] font-bold text-gray-600 uppercase mb-1">${funcaoNome}</div>
                    <table class="w-full text-xs">
                        <thead><tr class="text-[9px] uppercase text-gray-400">
                            <th class="text-left font-semibold pb-1">Atividade</th>
                            <th class="px-1 pb-1">Consultar</th><th class="px-1 pb-1">Incluir</th><th class="px-1 pb-1">Alterar</th><th class="px-1 pb-1">Deletar</th>
                        </tr></thead>
                        <tbody>${linhas}</tbody>
                    </table>
                </div>
            `;
        }).join('');
        return `
            <div class="border border-gray-200 rounded mb-2">
                <div class="bg-gray-100 px-3 py-1.5 font-bold text-[11px] uppercase text-gray-700">${grupo}</div>
                <div class="p-3">${blocosFuncao}</div>
            </div>
        `;
    }).join('');

    container.innerHTML = `<div class="max-h-[500px] overflow-y-auto">${blocosGrupo}</div>`;
}

function editFuncao(id) {
    const funcao = funcoesData.find(f => f.id === id);
    if (!funcao) return;

    document.getElementById('funcaoIdInput').value = funcao.id;
    document.getElementById('funcaoNomeInput').value = funcao.nome;
    document.getElementById('funcaoDescricaoInput').value = funcao.descricao || '';
    const inputIrrestrito = document.getElementById('funcaoAcessoIrrestritoInput');
    if (inputIrrestrito) inputIrrestrito.checked = funcao.acesso_irrestrito === true;
    const inputProprietario = document.getElementById('funcaoEhProprietarioInput');
    if (inputProprietario) inputProprietario.checked = funcao.eh_proprietario === true;

    const marcadas = new Map();
    funcaoAtividadesData.filter(fa => fa.funcao_id === id).forEach(fa => {
        marcadas.set(fa.atividade_id, {
            c: fa.pode_consultar !== false,
            i: fa.pode_incluir === true,
            a: fa.pode_alterar === true,
            d: fa.pode_deletar === true
        });
    });
    renderMatrizPermissoesFormulario(marcadas);

    document.getElementById('btnSalvarFuncao').innerText = 'Atualizar Função';
    // CORRIGIDO (bug reportado: clicar em Editar em "Funções Cadastradas"
    // preenchia o formulário mas não mostrava nada, porque a aba "Cadastrar
    // Nova Função" continuava escondida) — troca pra aba do formulário,
    // mesmo padrão já usado em editarAtividadesResponsavel (Responsáveis).
    mudarAbaFuncoes('criar');
    document.getElementById('funcoesPermissoesConteudo').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function limparFormularioFuncao() {
    document.getElementById('funcaoIdInput').value = '';
    document.getElementById('funcaoNomeInput').value = '';
    document.getElementById('funcaoDescricaoInput').value = '';
    const inputIrrestrito = document.getElementById('funcaoAcessoIrrestritoInput');
    if (inputIrrestrito) inputIrrestrito.checked = false;
    const inputProprietario = document.getElementById('funcaoEhProprietarioInput');
    if (inputProprietario) inputProprietario.checked = false;
    document.getElementById('btnSalvarFuncao').innerText = 'Salvar Função';
    renderMatrizPermissoesFormulario();
}

async function saveFuncao(e) {
    e.preventDefault();
    const id = document.getElementById('funcaoIdInput').value;
    const nome = document.getElementById('funcaoNomeInput').value.trim().toUpperCase();
    const descricao = document.getElementById('funcaoDescricaoInput').value.trim();
    const inputIrrestrito = document.getElementById('funcaoAcessoIrrestritoInput');
    const inputProprietario = document.getElementById('funcaoEhProprietarioInput');
    const ehProprietarioForm = inputProprietario ? inputProprietario.checked : false;
    // Proprietário sempre implica Acesso Irrestrito — reforçado aqui (não só
    // no onchange do checkbox no HTML) pra não depender só do JS do formulário.
    const acessoIrrestrito = ehProprietarioForm || (inputIrrestrito ? inputIrrestrito.checked : false);

    if (!nome) return alert('Informe o nome da função!');

    // AJUSTADO (segurança Fase 2): junta os 4 checkboxes por atividade.
    const porAtiv = new Map(); // atividade_id -> {pode_consultar, pode_incluir, pode_alterar, pode_deletar}
    document.querySelectorAll('.funcao-form-ativ-checkbox').forEach(c => {
        if (!c.checked) return;
        const aid = Number(c.getAttribute('data-atividade-id'));
        if (!porAtiv.has(aid)) porAtiv.set(aid, { pode_consultar: false, pode_incluir: false, pode_alterar: false, pode_deletar: false });
        porAtiv.get(aid)[c.getAttribute('data-campo')] = true;
    });
    // Incluir / Alterar / Deletar implicam Consultar.
    for (const p of porAtiv.values()) {
        if (p.pode_incluir || p.pode_alterar || p.pode_deletar) p.pode_consultar = true;
    }
    const atividadeIdsMarcadas = [...porAtiv.keys()];

    // Regra da especificação (seção 4.3): toda função precisa de pelo
    // menos uma permissão — bloqueia o cadastro/atualização até isso,
    // A NÃO SER que seja acesso irrestrito (ignora o catálogo por
    // definição, não faz sentido exigir atividades marcadas também).
    if (atividadeIdsMarcadas.length === 0 && !acessoIrrestrito) {
        return alert('⚠️ Selecione pelo menos uma atividade (ao menos "Consultar") para esta função antes de salvar (ou marque Acesso Irrestrito)!');
    }

    let funcaoId = id ? Number(id) : null;

    if (funcaoId) {
        const { error } = await _supabase.from('funcoes').update({ nome, descricao, acesso_irrestrito: acessoIrrestrito, eh_proprietario: ehProprietarioForm }).eq('id', funcaoId);
        if (error) return alert('Erro ao atualizar função: ' + error.message);
    } else {
        const { data, error } = await _supabase.from('funcoes').insert([{ nome, descricao, acesso_irrestrito: acessoIrrestrito, eh_proprietario: ehProprietarioForm }]).select();
        if (error) return alert('Erro ao cadastrar função: ' + error.message);
        funcaoId = data && data[0] ? data[0].id : null;
        if (!funcaoId) return alert('Função criada, mas não foi possível obter o ID para salvar as atividades. Recarregue e edite a função para ajustar as atividades.');
    }

    // Substitui as atividades da função pelas marcadas agora no formulário
    // (Fase 2 — Controle de acesso por atividade: catalogo_atividades +
    // funcao_atividades, no lugar de permissoes_etapa).
    const { error: delError } = await _supabase.from('funcao_atividades').delete().eq('funcao_id', funcaoId);
    if (delError) return alert('Função salva, mas houve erro ao atualizar atividades: ' + delError.message);

    if (atividadeIdsMarcadas.length > 0) {
        const paraInserir = [...porAtiv.entries()].map(([atividade_id, p]) => ({ funcao_id: funcaoId, atividade_id, ...p }));
        const { error: insError } = await _supabase.from('funcao_atividades').insert(paraInserir);
        if (insError) return alert('Função salva, mas houve erro ao salvar atividades: ' + insError.message);
    }

    alert(id ? '✅ FUNÇÃO ATUALIZADA COM SUCESSO!' : '✅ FUNÇÃO CADASTRADA COM SUCESSO!');
    limparFormularioFuncao();
    await loadFuncoes();

    // Se a função editada for de algum usuário logado (inclui o próprio),
    // o cache de permissões dele fica desatualizado até o próximo login —
    // mesmo cuidado já existe em salvarFuncoesUsuario para o próprio caso.
    if (currentUser) {
        await carregarPermissoesUsuarioAtual();
        aplicarVisibilidadeMenu();
    }
}

// Exclusão lógica (soft-delete): bloqueia se algum usuário ainda tiver a
// função atribuída, senão inativa e loga quem/quando.
async function deleteFuncao(id) {
    const emUsoPor = usuarioFuncoesData.filter(uf => uf.funcao_id === id);
    if (emUsoPor.length > 0) {
        return alert(
            `⛔ Não é possível excluir esta função: ${emUsoPor.length} usuário(s) ainda ` +
            `estão com ela atribuída. Remova a atribuição desses usuários primeiro (seção ` +
            `"Atribuição de Funções aos Usuários" abaixo).`
        );
    }

    if (!confirm('Deseja realmente inativar esta função? Ela deixará de poder ser atribuída a novos usuários.')) return;

    const { error } = await _supabase.from('funcoes').update({
        ativo: false,
        excluido_por: currentUser ? currentUser.nome : 'desconhecido',
        excluido_em: new Date().toISOString()
    }).eq('id', id);

    if (error) return alert('Erro ao inativar função: ' + error.message);
    await loadFuncoes();
}

async function reativarFuncao(id) {
    if (!confirm('Deseja reativar esta função?')) return;
    const { error } = await _supabase.from('funcoes').update({
        ativo: true,
        excluido_por: null,
        excluido_em: null
    }).eq('id', id);
    if (error) return alert('Erro ao reativar função: ' + error.message);
    await loadFuncoes();
}

function toggleMatrizPermissoes(funcaoId) {
    // Mantida por compatibilidade — não é mais usada pelo fluxo principal
    // (a matriz agora vive no formulário via editFuncao), mas outras
    // partes do código podem referenciar esta função.
    const row = document.getElementById(`matrizPermissoes_${funcaoId}`);
    if (row) row.classList.toggle('hidden');
}

function renderUsuariosFuncoesTable() {
    const tbody = document.getElementById('tableUsuariosFuncoesBody');
    if (!tbody) return;

    if (usuariosData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" class="p-4 text-center text-gray-400 font-bold">Nenhum usuário cadastrado (faça login ao menos uma vez com cada conta para aparecer aqui)</td></tr>`;
        return;
    }

    tbody.innerHTML = usuariosData.map(u => {
        const funcoesDoUsuario = new Set(
            usuarioFuncoesData.filter(uf => uf.usuario_id === u.id).map(uf => uf.funcao_id)
        );
        const checkboxes = funcoesAtivas().map(f => `
            <label class="inline-flex items-center gap-1 mr-3 mb-1 cursor-pointer">
                <input type="checkbox" class="usuario-funcao-checkbox" data-usuario="${u.id}" data-funcao="${f.id}" ${funcoesDoUsuario.has(f.id) ? 'checked' : ''}>
                <span class="text-[10px] font-bold uppercase">${escapeHtml(f.nome)}</span>
            </label>
        `).join('');

        return `
            <tr>
                <td class="p-3">
                    <div class="font-bold">${escapeHtml(u.nome)}</div>
                    <div class="text-xs text-gray-500">${escapeHtml(u.email)}</div>
                </td>
                <td class="p-3">
                    <div class="flex flex-wrap items-center">${checkboxes || '<span class="text-gray-400 italic text-xs">Nenhuma função cadastrada ainda</span>'}</div>
                    ${funcoesAtivas().length > 0 ? `<button onclick="salvarFuncoesUsuario('${u.id}')" class="mt-1 bg-gray-700 hover:bg-gray-900 text-white font-bold text-[10px] px-2 py-1 rounded">Salvar</button>` : ''}
                </td>
            </tr>
        `;
    }).join('');
}

async function salvarFuncoesUsuario(usuarioId) {
    const checkboxes = document.querySelectorAll(`.usuario-funcao-checkbox[data-usuario="${usuarioId}"]`);
    const marcadas = Array.from(checkboxes).filter(c => c.checked).map(c => ({
        usuario_id: usuarioId,
        funcao_id: Number(c.getAttribute('data-funcao'))
    }));

    const { error: delError } = await _supabase.from('usuario_funcoes').delete().eq('usuario_id', usuarioId);
    if (delError) return alert('Erro ao atualizar funções do usuário: ' + delError.message);

    if (marcadas.length > 0) {
        const { error: insError } = await _supabase.from('usuario_funcoes').insert(marcadas);
        if (insError) return alert('Erro ao salvar funções do usuário: ' + insError.message);
    }

    alert('✅ Funções do usuário atualizadas!');
    await loadFuncoes();

    // Se o usuário editado for o próprio usuário logado, recarrega o cache de
    // permissões dele E força um novo render da aba atualmente visível —
    // sem isso, telas já abertas antes da troca continuam mostrando botões
    // da permissão antiga até o usuário navegar manualmente.
    if (currentUser && currentUser.id === usuarioId) {
        await carregarPermissoesUsuarioAtual();
        switchTab(abaAtualId);
    }
}

// -------------------------------------------------------------------------
// Cache de permissões do usuário logado — chamado uma vez após o login
// (js/auth/auth.js). Usado só para UX (esconder/desabilitar botões);
// não é uma garantia de segurança (ver nota no topo do arquivo).
// -------------------------------------------------------------------------
async function carregarPermissoesUsuarioAtual() {
    atividadesUsuarioAtual = new Set();
    crudUsuarioAtual = new Map();
    funcoesUsuarioAtual = [];
    ehAdministrador = false;
    ehProprietario = false;

    // NOVO (Fase 4): garante que atividadesData (o catálogo inteiro) esteja
    // carregado pra qualquer usuário logado, não só quando visita a tela
    // de Funções e Permissões — aplicarVisibilidadeMenu/SubAbas dependem
    // dele pra saber quais tabIds/sub-abas existem.
    if (atividadesData.length === 0) {
        const { data: catalogo } = await _supabase.from('catalogo_atividades').select('*').order('ordem');
        atividadesData = catalogo || [];
    }

    if (!currentUser || !currentUser.id) return;

    const { data: minhasFuncoes, error: errFuncoes } = await _supabase
        .from('usuario_funcoes')
        .select('funcao_id, funcoes(nome, acesso_irrestrito, eh_proprietario)')
        .eq('usuario_id', currentUser.id);

    if (errFuncoes || !minhasFuncoes) return;

    const funcaoIds = minhasFuncoes.map(mf => mf.funcao_id);
    funcoesUsuarioAtual = minhasFuncoes.map(mf => mf.funcoes ? mf.funcoes.nome : null).filter(Boolean);
    // AJUSTADO (Controle de acesso por atividade, Fase 2): ehAdministrador
    // passa a vir de funcoes.acesso_irrestrito (qualquer função marcada
    // assim, não só a chamada "ADMINISTRADOR") — o nome continua valendo
    // como fallback de segurança, caso a flag não tenha sido marcada.
    ehAdministrador = minhasFuncoes.some(mf => mf.funcoes && mf.funcoes.acesso_irrestrito === true) || funcoesUsuarioAtual.includes('ADMINISTRADOR');
    // NOVO (papel Proprietário, 28/08/2026): mesmo padrão acima, mas pra
    // eh_proprietario — nome 'PROPRIETARIO' como fallback de segurança,
    // igual já valia pra ADMINISTRADOR.
    ehProprietario = minhasFuncoes.some(mf => mf.funcoes && mf.funcoes.eh_proprietario === true) || funcoesUsuarioAtual.includes('PROPRIETARIO');

    if (funcaoIds.length === 0) return;

    // Catálogo de atividades da(s) função(ões) do usuário — usado por
    // usuarioTemAtividade e pela visibilidade de menu/sub-abas.
    // AJUSTADO (segurança Fase 2): também traz as 4 flags CRUD e faz OR
    // entre as funções do usuário em crudUsuarioAtual.
    const { data: minhasAtividades, error: errAtiv } = await _supabase
        .from('funcao_atividades')
        .select('pode_consultar, pode_incluir, pode_alterar, pode_deletar, catalogo_atividades(activity_key)')
        .in('funcao_id', funcaoIds);

    if (!errAtiv && minhasAtividades) {
        minhasAtividades.forEach(fa => {
            const key = fa.catalogo_atividades && fa.catalogo_atividades.activity_key;
            if (!key) return;
            if (fa.pode_consultar !== false) atividadesUsuarioAtual.add(key);
            const cur = crudUsuarioAtual.get(key) || { c: false, i: false, a: false, d: false };
            cur.c = cur.c || fa.pode_consultar !== false;
            cur.i = cur.i || fa.pode_incluir === true;
            cur.a = cur.a || fa.pode_alterar === true;
            cur.d = cur.d || fa.pode_deletar === true;
            crudUsuarioAtual.set(key, cur);
        });
    }
}

// Função de checagem a ser usada pelas telas (UX apenas — ver nota acima).
// ADMINISTRADOR/qualquer função com acesso_irrestrito sempre tem acesso
// total, sem precisar de linhas explícitas em funcao_atividades.
function usuarioTemAtividade(activityKey) {
    if (ehAdministrador) return true;
    return atividadesUsuarioAtual.has(activityKey);
}

// Helper para telas que geram HTML de botão de ação via template string
// (a maioria das listas do sistema): retorna o HTML do botão só se o
// usuário logado tiver a atividade pedida, senão retorna vazio.
function botaoSeTemAtividade(activityKey, htmlBotao) {
    return usuarioTemAtividade(activityKey) ? htmlBotao : '';
}

// NOVO (segurança Fase 2): checagens CRUD por atividade. Admin/irrestrito
// sempre true. Ainda NÃO plugadas nos botões das telas — os consumidores
// (Incluir/Editar/Excluir de cada lista) migram numa etapa seguinte;
// por ora `usuarioTemAtividade` (>= Consultar) continua governando tudo.
function usuarioPodeIncluir(activityKey) {
    if (ehAdministrador) return true;
    const p = crudUsuarioAtual.get(activityKey);
    return !!(p && p.i);
}
function usuarioPodeAlterar(activityKey) {
    if (ehAdministrador) return true;
    const p = crudUsuarioAtual.get(activityKey);
    return !!(p && p.a);
}
function usuarioPodeDeletar(activityKey) {
    if (ehAdministrador) return true;
    const p = crudUsuarioAtual.get(activityKey);
    return !!(p && p.d);
}

// -------------------------------------------------------------------------
// Restrição de Área por Atividade (Fase 3, item 2 do pedido) — consulta o
// catálogo agrupado por Grupo→Função, só permite alterar o campo
// restricao_area (o catálogo em si — grupo/função/atividade — é fixo,
// definido pelas telas reais do sistema, não editável aqui).
// -------------------------------------------------------------------------
async function renderRestricaoAreaAtividadesView() {
    const { data, error } = await _supabase.from('catalogo_atividades').select('*').order('ordem');
    atividadesData = error ? [] : (data || []);

    const container = document.getElementById('restricaoAreaAtividadesLista');
    if (!container) return;

    const porGrupo = new Map();
    atividadesData.forEach(a => {
        const g = a.grupo ?? a.grupo_funcao; // ver nota Fase 1 em renderMatrizPermissoesFormulario
        if (!porGrupo.has(g)) porGrupo.set(g, []);
        porGrupo.get(g).push(a);
    });

    container.innerHTML = Array.from(porGrupo.entries()).map(([grupo, atividades]) => `
        <div class="border border-gray-200 rounded mb-2">
            <div class="bg-gray-100 px-3 py-1.5 font-bold text-[11px] uppercase text-gray-700">${grupo}</div>
            <table class="w-full text-left border-collapse text-xs">
                <tbody class="divide-y divide-gray-100">
                    ${atividades.map(a => `
                        <tr>
                            <td class="p-2 w-1/3 text-gray-600 font-semibold">${a.subgrupo ?? a.funcao}</td>
                            <td class="p-2 w-1/3">${a.atividade}</td>
                            <td class="p-2 text-center">
                                <label class="inline-flex items-center gap-1.5 cursor-pointer">
                                    <input type="checkbox" onchange="alternarRestricaoAreaAtividade(${a.id}, this.checked)" ${a.restricao_area ? 'checked' : ''}>
                                    <span class="text-[10px] font-bold ${a.restricao_area ? 'text-amber-700' : 'text-gray-400'}">${a.restricao_area ? 'SIM' : 'NÃO'}</span>
                                </label>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `).join('');
}

async function alternarRestricaoAreaAtividade(atividadeId, valor) {
    const { error } = await _supabase.from('catalogo_atividades').update({ restricao_area: valor }).eq('id', atividadeId);
    if (error) {
        alert('Erro ao atualizar a restrição de área: ' + error.message);
        await renderRestricaoAreaAtividadesView(); // desfaz visualmente se a gravação falhou
        return;
    }
    const atividade = atividadesData.find(a => a.id === atividadeId);
    if (atividade) atividade.restricao_area = valor;
    await renderRestricaoAreaAtividadesView();
}

// -------------------------------------------------------------------------
// Restrição de área nos dados (Controle de acesso por atividade, Fase 5) —
// generaliza filtrarProjetosPorAcessoRoadmap (js/roadmap/roadmap.js, único
// lugar que já fazia isso) pra qualquer tela de manutenção/consulta.
// Bypassa admin/irrestrito e usuários da área Tecnologia da Informação
// (nunca sofrem restrição, em nenhuma atividade); pra todo o resto, só
// filtra de fato se a atividade em questão tiver restricao_area = true no
// catálogo — com o valor padrão (false) em tudo, isso não muda nada até
// um admin marcar alguma atividade como restrita (tela "Restrição de Área
// por Atividade").
// -------------------------------------------------------------------------
const AREA_TI_NOME = 'TECNOLOGIA DA INFORMAÇÃO';

function usuarioEhDaAreaTI() {
    return !!(currentUser && (currentUser.area || '').trim().toUpperCase() === AREA_TI_NOME);
}

function filtrarProjetosPorArea(lista, activityKey) {
    if (ehAdministrador || usuarioEhDaAreaTI()) return lista;
    const atividade = atividadesData.find(a => a.activity_key === activityKey);
    if (!atividade || !atividade.restricao_area) return lista;
    if (!currentUser || !currentUser.area) return []; // sem área definida, sem bypass -> não vê nada, por segurança
    return lista.filter(p => (p.area || '').toUpperCase() === currentUser.area.toUpperCase());
}

// -------------------------------------------------------------------------
// Motor de visibilidade de menu/sub-abas (Controle de acesso por
// atividade, Fase 4) — substitui MAPA_ABA_ETAPAS/ABAS_SOMENTE_ADMIN, que
// hardcodavam manualmente quais tabs existiam e qual regra cada uma
// seguia (14 tabs com etapa, ~10 hardcoded "só admin", o resto sempre
// visível). Agora tudo vem do catálogo — nenhuma lista hardcoded: o
// próprio catalogo_atividades já sabe quais tabIds existem (o prefixo
// antes de ":" em cada activity_key) e cada tab só aparece se o usuário
// tiver pelo menos uma atividade dela (ou for admin/irrestrito).
// -------------------------------------------------------------------------
function tabIdsDoCatalogo() {
    return [...new Set(atividadesData.map(a => a.activity_key.split(':')[0]))];
}

function usuarioTemAlgumaAtividadeDoTab(tabId) {
    if (ehAdministrador) return true;
    return atividadesData.some(a => a.activity_key.split(':')[0] === tabId && atividadesUsuarioAtual.has(a.activity_key));
}

function aplicarVisibilidadeMenu() {
    tabIdsDoCatalogo().forEach(tabId => {
        // NOVO (Licenciamento de Módulos, 28/08/2026): visibilidade agora
        // depende de DUAS checagens independentes — RBAC (o de sempre) E
        // o módulo dono da tela estar licenciado/ativo (js/core/licenca.js).
        // Falhar qualquer uma das duas esconde o item — sem módulo não
        // adianta ter a atividade, e vice-versa.
        const temAcesso = usuarioTemAlgumaAtividadeDoTab(tabId) && moduloAtivo(moduloDoTab(tabId));
        const link = document.getElementById(`link-${tabId}`);
        if (link) link.classList.toggle('hidden', !temAcesso);
        // Abas da barra superior (Dashboard, Consultas, Roadmap etc.) usam
        // o padrão view-btn-<tabId> em vez de link-<tabId>.
        const viewBtn = document.getElementById(`view-btn-${tabId}`);
        if (viewBtn) viewBtn.classList.toggle('hidden', !temAcesso);
    });

    // NOVO (papel Proprietário, 28/08/2026): o grupo inteiro do menu
    // lateral (não só o link de dentro) só aparece pra quem é Proprietário
    // — diferente do padrão de Ferramentas de Dev, onde o grupo em si
    // fica sempre visível e só o link some.
    const grupoProprietario = document.getElementById('grupo-proprietario');
    if (grupoProprietario) grupoProprietario.classList.toggle('hidden', !ehProprietario);

    // NOVO (segurança Fase 3, 2026-09-01): estas 3 telas saíram do catálogo
    // comum — não passam mais por tabIdsDoCatalogo() acima. Visibilidade
    // hardcoded por papel: Administrador OU Proprietário. (Licenciamento de
    // Módulos fica dentro de #grupo-proprietario, já tratado acima.)
    const admOuProprietario = ehAdministrador || ehProprietario;
    ['funcoes_permissoes', 'atribuicao_funcoes', 'restricao_area_atividades'].forEach(tabId => {
        const link = document.getElementById(`link-${tabId}`);
        if (link) link.classList.toggle('hidden', !admOuProprietario);
    });
}

// NOVO (Fase 4): esconde, dentro de uma tela de 2+ sub-abas já visível, os
// botões de sub-aba que o usuário não tem — e se a sub-aba atualmente
// ativa não é uma delas, troca automaticamente pra primeira permitida
// (sem isso, o painel continuaria mostrado mesmo com o botão escondido).
// Chamada no fim de cada mudarAba<Tela>(...) — mesmo padrão repetido nas
// ~17 telas de 2+ abas do sistema.
function aplicarVisibilidadeSubAbas(tabId, prefixoBotao) {
    if (ehAdministrador) return;

    const subatividades = atividadesData.filter(a => a.activity_key.startsWith(tabId + ':'));
    if (subatividades.length === 0) return;

    const prefixoPainel = prefixoBotao.replace(/Btn$/, 'Painel');

    subatividades.forEach(a => {
        const chave = a.activity_key.split(':')[1];
        const btn = document.getElementById(`${prefixoBotao}-${chave}`);
        if (btn) btn.classList.toggle('hidden', !atividadesUsuarioAtual.has(a.activity_key));
    });

    const painelAtivo = subatividades.find(a => {
        const chave = a.activity_key.split(':')[1];
        const painel = document.getElementById(`${prefixoPainel}-${chave}`);
        return painel && !painel.classList.contains('hidden');
    });
    const painelAtivoPermitido = painelAtivo && atividadesUsuarioAtual.has(painelAtivo.activity_key);

    if (!painelAtivoPermitido) {
        const primeiraPermitida = subatividades.find(a => atividadesUsuarioAtual.has(a.activity_key));
        if (primeiraPermitida) {
            const chaveAlvo = primeiraPermitida.activity_key.split(':')[1];
            subatividades.forEach(a => {
                const chave = a.activity_key.split(':')[1];
                const painel = document.getElementById(`${prefixoPainel}-${chave}`);
                if (painel) painel.classList.toggle('hidden', chave !== chaveAlvo);
            });
        }
    }
}
