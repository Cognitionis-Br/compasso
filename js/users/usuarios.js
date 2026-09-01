// =========================================================================
// users/usuarios.js
// Cadastro de Usuários (Especificacao_Workflow_v4.md, seção 4.4 — G3).
//
// A criação de usuário chama a Edge Function admin-create-user (ver
// supabase/functions/admin-create-user/index.ts) — precisa estar
// implantada (supabase functions deploy admin-create-user) antes desta
// tela funcionar de ponta a ponta. Sem isso, o botão "Criar Usuário"
// retorna erro de função não encontrada.
//
// Exclusão é sempre lógica (inativa perfis_usuarios.ativo) — não some do
// Supabase Auth, mas o login passa a bloquear usuários inativos (ver
// js/auth/auth.js).
// =========================================================================

// NOVO: alterna entre as 2 abas de Usuários & Perfis — mesmo padrão V2.
function mudarAbaUsuarios(aba) {
    ['criar', 'cadastrados'].forEach(a => {
        const btn = document.getElementById(`usuariosBtn-${a}`);
        const painel = document.getElementById(`usuariosPainel-${a}`);
        if (btn) btn.className = `usuarios-btn px-4 py-2 rounded-md text-sm font-bold border-2 ${a === aba ? 'bg-red-700 text-white border-red-700' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`;
        if (painel) painel.classList.toggle('hidden', a !== aba);
    });
    aplicarVisibilidadeSubAbas('usuarios', 'usuariosBtn');
}

async function renderUsuariosView() {
    const restrito = document.getElementById('usuariosRestrito');
    const conteudo = document.getElementById('usuariosConteudo');

    // AJUSTADO (Controle de acesso por atividade, Fase 4): deixou de ser
    // hardcoded "só ADMINISTRADOR" — segue o catálogo (tabId "usuarios").
    if (!usuarioTemAlgumaAtividadeDoTab('usuarios')) {
        if (restrito) restrito.classList.remove('hidden');
        if (conteudo) conteudo.classList.add('hidden');
        return;
    }
    if (restrito) restrito.classList.add('hidden');
    if (conteudo) conteudo.classList.remove('hidden');

    const { data, error } = await _supabase.from('perfis_usuarios').select('*').order('nome');

    // CORRIGIDO (item 10, novos ajustes — bug reportado: tabela ficava
    // vazia sem explicação nenhuma): o erro da consulta estava sendo
    // engolido silenciosamente (virava lista vazia, sem log nem aviso na
    // tela). Causa mais provável pra uma tabela que aparece vazia mesmo
    // com usuários existindo: RLS (Row Level Security) no Supabase
    // bloqueando a leitura de linhas que não são do próprio usuário
    // logado — muito comum em `perfis_usuarios`. Vale conferir a policy
    // de SELECT dessa tabela no Supabase.
    if (error) {
        console.error('Erro ao carregar perfis_usuarios:', error.message);
        usuariosData = [];
        const tbody = document.getElementById('tableUsuariosBody');
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-red-600 font-bold">⛔ Erro ao carregar usuários: ${error.message}<br><span class="text-[10px] font-normal text-gray-500">Verifique a policy de leitura (RLS) da tabela perfis_usuarios no Supabase.</span></td></tr>`;
        }
        return;
    }

    usuariosData = data || [];
    popularAreaSelectUsuario();
    await carregarCargosData(); // garante a lista mais atual, mesmo se Cargos nunca foi aberta nesta sessão
    popularCargoSelectUsuario();
    renderUsuariosTable();
}

function popularAreaSelectUsuario() {
    const sel = document.getElementById('usuarioAreaInput');
    if (!sel) return;
    const options = ['<option value="">-- Sem área definida --</option>'];
    areasAtivas().forEach(a => {
        const nomeUpper = (a.nome || '').toUpperCase();
        options.push(`<option value="${nomeUpper}">${nomeUpper}</option>`);
    });
    sel.innerHTML = options.join('');
}

// NOVO (evolução de RLS — cargos, 27/08/2026): cargo obrigatório no
// cadastro de usuário — mesmo padrão do select de Área acima.
function popularCargoSelectUsuario() {
    const sel = document.getElementById('usuarioCargoInput');
    if (!sel) return;
    const options = ['<option value="" selected disabled>-- Selecione --</option>']
        .concat(cargosAtivos().map(c => `<option value="${c.id}">${escapeHtml(c.nome)}</option>`));
    sel.innerHTML = options.join('');
}

function renderUsuariosTable() {
    const tbody = document.getElementById('tableUsuariosBody');
    if (!tbody) return;

    if (usuariosData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-gray-400 font-bold">Nenhum usuário cadastrado</td></tr>`;
        return;
    }

    tbody.innerHTML = usuariosData.map(u => {
        const inativo = u.ativo === false;
        const cargo = cargosData.find(c => c.id === u.cargo_id);
        return `
            <tr class="${inativo ? 'bg-gray-50 text-gray-400' : ''}">
                <td class="p-3 font-bold uppercase">${escapeHtml(u.nome) || '-'}</td>
                <td class="p-3">${escapeHtml(u.email) || '-'}</td>
                <td class="p-3 text-xs">${u.area || '-'}</td>
                <td class="p-3 text-xs">${cargo ? escapeHtml(cargo.nome) : '-'}</td>
                <td class="p-3">
                    ${inativo
                        ? `<span class="bg-gray-200 text-gray-500 font-bold px-2 py-0.5 rounded text-[10px]">INATIVO</span>`
                        : `<span class="bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded text-[10px]">ATIVO</span>`}
                    ${u.senha_provisoria ? `<span class="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[10px] ml-1">SENHA PROVISÓRIA</span>` : ''}
                </td>
                <td class="p-3 text-xs text-gray-500">${u.criado_por || '-'}</td>
                <td class="p-3 text-right space-x-2 whitespace-nowrap">
                    ${!inativo ? botaoSePodeAlterar('usuarios', `<button onclick="editarPerfilUsuario('${u.id}')" class="text-indigo-600 hover:text-indigo-800 text-xs font-bold"><i class="fa-solid fa-pen-to-square"></i> Editar</button>`) : ''}
                    ${inativo
                        ? botaoSePodeAlterar('usuarios', `<button onclick="reativarUsuario('${u.id}')" class="text-green-700 hover:text-green-900 text-xs font-bold"><i class="fa-solid fa-rotate-left"></i> Reativar</button>`)
                        : botaoSePodeDeletar('usuarios', `<button onclick="inativarUsuario('${u.id}')" class="text-red-600 hover:text-red-800 text-xs font-bold"><i class="fa-solid fa-user-slash"></i> Inativar</button>`)}
                </td>
            </tr>
        `;
    }).join('');
}

// NOVO 10/08/2026 (bug reportado: usuário criado/backfilled sem nome
// correto — ex.: contas criadas direto pelo painel do Supabase acabam
// com o nome igual ao e-mail — e não havia como corrigir isso pela
// tela). Edição simples de nome/área (não mexe em senha nem e-mail —
// isso continua exigindo a Edge Function, fora do escopo desta correção
// pontual).
// AJUSTADO (Controle de acesso por atividade, Fase 5): a área deixou de
// ser digitada livre via prompt() — agora vem de um select validado
// contra areas_solicitantes (mesmo padrão do cadastro de novo usuário,
// usuarioAreaInput), pra não quebrar o filtro de restrição de área por
// typo/inconsistência de maiúsculas.
function editarPerfilUsuario(id) {
    const u = usuariosData.find(x => x.id === id);
    if (!u) return;

    document.getElementById('editarPerfilIdHidden').value = id;
    document.getElementById('editarPerfilNomeInput').value = u.nome || '';

    const sel = document.getElementById('editarPerfilAreaSelect');
    if (sel) {
        const options = ['<option value="">-- Sem área definida --</option>'];
        areasAtivas().forEach(a => {
            const nomeUpper = (a.nome || '').toUpperCase();
            options.push(`<option value="${nomeUpper}">${nomeUpper}</option>`);
        });
        sel.innerHTML = options.join('');
        sel.value = u.area || '';
    }

    // NOVO (evolução de RLS — cargos, 27/08/2026): também editável aqui,
    // a pedido do usuário. Inclui o cargo atual mesmo que tenha sido
    // inativado depois, senão a edição "perderia" o valor ao salvar.
    const selCargo = document.getElementById('editarPerfilCargoSelect');
    if (selCargo) {
        const cargoAtual = cargosData.find(c => c.id === u.cargo_id);
        const listaCargos = cargoAtual && !cargoAtual.ativo ? cargosAtivos().concat([cargoAtual]) : cargosAtivos();
        selCargo.innerHTML = listaCargos.map(c => `<option value="${c.id}" ${c.id === u.cargo_id ? 'selected' : ''}>${escapeHtml(c.nome)}${!c.ativo ? ' (inativo)' : ''}</option>`).join('');
    }

    document.getElementById('modalEditarPerfilUsuario').classList.remove('hidden');
}

function fecharModalEditarPerfilUsuario() {
    document.getElementById('modalEditarPerfilUsuario').classList.add('hidden');
}

async function salvarEdicaoPerfilUsuario() {
    if (!usuarioPodeAlterarTela('usuarios')) return alert('Você não tem permissão para alterar usuários.');
    const id = document.getElementById('editarPerfilIdHidden').value;
    const novoNome = document.getElementById('editarPerfilNomeInput').value.trim();
    const novaArea = document.getElementById('editarPerfilAreaSelect').value;
    const novoCargoId = document.getElementById('editarPerfilCargoSelect').value;

    if (!novoNome) return alert('O nome não pode ficar vazio!');
    if (!novoCargoId) return alert('O cargo é obrigatório!');

    const { error } = await _supabase.from('perfis_usuarios').update({
        nome: novoNome.toUpperCase(),
        area: novaArea || null,
        cargo_id: Number(novoCargoId)
    }).eq('id', id);

    if (error) return alert('Erro ao atualizar perfil: ' + error.message);
    fecharModalEditarPerfilUsuario();
    await renderUsuariosView();
}

function gerarSenhaAleatoria() {
    const senha = Math.random().toString(36).slice(-8) + 'Aa1!';
    document.getElementById('usuarioSenhaInput').value = senha;
}

// CORRIGIDO 10/08/2026: bug real encontrado em teste — senha digitada
// manualmente (sem o botão "Gerar") podia carregar espaço em branco
// acidental no início/fim, criando a conta com uma senha "suja" que
// nunca batia com o que a pessoa depois digitava pra logar (sem o
// espaço). A senha gerada automaticamente nunca sofria disso, por isso
// só falhava no caminho manual — .trim() em todos os campos de senha
// resolve.
async function saveNovoUsuario(e) {
    e.preventDefault();
    if (!usuarioPodeIncluirTela('usuarios')) return alert('Você não tem permissão para incluir usuários.');

    const nome = document.getElementById('usuarioNomeInput').value.trim().toUpperCase();
    const email = document.getElementById('usuarioEmailInput').value.trim().toLowerCase();
    const area = document.getElementById('usuarioAreaInput').value;
    const cargoId = document.getElementById('usuarioCargoInput').value;
    const senha_provisoria = document.getElementById('usuarioSenhaInput').value.trim();

    if (!nome || !email || !senha_provisoria) {
        return alert('Preencha nome, e-mail e senha provisória!');
    }
    if (!cargoId) {
        return alert('O cargo é obrigatório!');
    }
    if (senha_provisoria.length < 6) {
        return alert('A senha provisória precisa ter pelo menos 6 caracteres!');
    }

    const { data, error } = await _supabase.functions.invoke('admin-create-user', {
        body: { nome, email, area, senha_provisoria }
    });

    if (error) {
        // CORRIGIDO 10/08/2026 (bug reportado): a SDK do Supabase só
        // devolve uma mensagem genérica em error.message quando a Edge
        // Function retorna status != 2xx — o motivo real vem no corpo da
        // resposta, acessível via error.context.
        let mensagemDetalhada = error.message;
        if (error.context && typeof error.context.json === 'function') {
            try {
                const corpo = await error.context.json();
                if (corpo && corpo.error) mensagemDetalhada = corpo.error;
            } catch (e2) { /* corpo não era JSON — mantém a mensagem genérica */ }
        }
        return alert('Erro ao criar usuário: ' + mensagemDetalhada);
    }
    if (data && data.error) {
        return alert('Erro ao criar usuário: ' + data.error);
    }

    // NOVO (evolução de RLS — cargos, 27/08/2026): a Edge Function
    // (admin-create-user) ainda não conhece o campo cargo_id — em vez de
    // reimplantar a função só por isso, completa com um UPDATE direto
    // (DML simples, mesmo padrão já usado em salvarEdicaoPerfilUsuario).
    if (data && data.usuario_id) {
        const { error: errorCargo } = await _supabase.from('perfis_usuarios').update({ cargo_id: Number(cargoId) }).eq('id', data.usuario_id);
        if (errorCargo) {
            alert(`⚠️ Usuário criado, mas houve erro ao gravar o cargo: ${errorCargo.message}\n\nAbra "Editar" na lista de Usuários Cadastrados e defina o cargo manualmente.`);
        }
    }

    alert(`✅ Usuário criado com sucesso!\n\nSenha provisória: ${senha_provisoria}\n\nEle(a) precisará trocá-la no primeiro acesso. Agora vá em Administração → Funções e Permissões para atribuir as funções corretas.`);

    document.getElementById('usuarioNomeInput').value = '';
    document.getElementById('usuarioEmailInput').value = '';
    document.getElementById('usuarioSenhaInput').value = '';
    await renderUsuariosView();
}

async function inativarUsuario(id) {
    if (!usuarioPodeDeletarTela('usuarios')) return alert('Você não tem permissão para inativar usuários.');
    if (!confirm('Deseja realmente inativar este usuário? Ele perderá acesso ao sistema no próximo login.')) return;

    const { error } = await _supabase.from('perfis_usuarios').update({
        ativo: false,
        excluido_por: currentUser ? currentUser.nome : 'desconhecido',
        excluido_em: new Date().toISOString()
    }).eq('id', id);

    if (error) return alert('Erro ao inativar usuário: ' + error.message);
    await renderUsuariosView();
}

async function reativarUsuario(id) {
    if (!usuarioPodeAlterarTela('usuarios')) return alert('Você não tem permissão para reativar usuários.');
    if (!confirm('Deseja reativar este usuário?')) return;

    const { error } = await _supabase.from('perfis_usuarios').update({
        ativo: true,
        excluido_por: null,
        excluido_em: null
    }).eq('id', id);

    if (error) return alert('Erro ao reativar usuário: ' + error.message);
    await renderUsuariosView();
}

// -------------------------------------------------------------------------
// Troca de senha obrigatória no primeiro acesso (senha provisória).
// Chamada a partir de js/auth/auth.js logo após o login, se
// perfis_usuarios.senha_provisoria === true.
// -------------------------------------------------------------------------
function abrirModalTrocaSenhaObrigatoria() {
    document.getElementById('trocaSenhaNovaInput').value = '';
    document.getElementById('trocaSenhaConfirmaInput').value = '';
    document.getElementById('modalTrocaSenhaObrigatoria').classList.remove('hidden');
}

async function confirmarTrocaSenhaObrigatoria() {
    const novaSenha = document.getElementById('trocaSenhaNovaInput').value.trim();
    const confirmaSenha = document.getElementById('trocaSenhaConfirmaInput').value.trim();

    if (!novaSenha || novaSenha.length < 6) {
        return alert('A nova senha precisa ter pelo menos 6 caracteres!');
    }
    if (novaSenha !== confirmaSenha) {
        return alert('As senhas não coincidem!');
    }

    const { error: errorSenha } = await _supabase.auth.updateUser({ password: novaSenha });
    if (errorSenha) return alert('Erro ao trocar senha: ' + errorSenha.message);

    const { data: { user } } = await _supabase.auth.getUser();
    if (user) {
        const { error: errorPerfil } = await _supabase.from('perfis_usuarios').update({ senha_provisoria: false }).eq('id', user.id);
        if (errorPerfil) console.error('Senha trocada, mas houve erro ao atualizar a flag de senha provisória:', errorPerfil.message);
    }

    alert('✅ Senha alterada com sucesso!');
    document.getElementById('modalTrocaSenhaObrigatoria').classList.add('hidden');
}

// -------------------------------------------------------------------------
// NOVO (evolução — "pedido de troca de senha", 27/08/2026): igual à troca
// obrigatória acima, mas voluntária — acessível a qualquer momento pelo
// usuário já logado (botão no cabeçalho, ver index.html), com opção de
// cancelar. Não mexe em senha_provisoria (só a troca do primeiro acesso
// usa essa flag).
// -------------------------------------------------------------------------
function abrirModalTrocaSenhaVoluntaria() {
    document.getElementById('trocaSenhaVoluntariaNovaInput').value = '';
    document.getElementById('trocaSenhaVoluntariaConfirmaInput').value = '';
    document.getElementById('modalTrocaSenhaVoluntaria').classList.remove('hidden');
}

function fecharModalTrocaSenhaVoluntaria() {
    document.getElementById('modalTrocaSenhaVoluntaria').classList.add('hidden');
}

async function confirmarTrocaSenhaVoluntaria() {
    const novaSenha = document.getElementById('trocaSenhaVoluntariaNovaInput').value.trim();
    const confirmaSenha = document.getElementById('trocaSenhaVoluntariaConfirmaInput').value.trim();

    if (!novaSenha || novaSenha.length < 6) {
        return alert('A nova senha precisa ter pelo menos 6 caracteres!');
    }
    if (novaSenha !== confirmaSenha) {
        return alert('As senhas não coincidem!');
    }

    const { error } = await _supabase.auth.updateUser({ password: novaSenha });
    if (error) return alert('Erro ao trocar senha: ' + error.message);

    alert('✅ Senha alterada com sucesso!');
    fecharModalTrocaSenhaVoluntaria();
}
