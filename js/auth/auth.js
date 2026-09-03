// =========================================================================
// auth/auth.js
// Login/logout com Supabase Auth (autenticação real).
//
// SUBSTITUI o login falso que existia até 10/08/2026 (ver
// Auditoria_Tecnica.md, item 2). Agora:
// - handleLogin valida e-mail/senha de verdade via supabase.auth.signInWithPassword.
// - A sessão persiste entre recarregamentos de página (checarSessaoAtiva,
//   chamada uma vez no carregamento — ver js/main.js).
// - currentUser é montado a partir do usuário autenticado + seu perfil em
//   perfis_usuarios (nome de exibição).
//
// ESCOPO DESTA ETAPA: login/logout/persistência de sessão apenas. RBAC
// (funções/papéis, permissões por etapa) é a PRÓXIMA etapa, que se
// apoia em cima desta — currentUser ainda não carrega "tipo"/função,
// porque essa tabela ainda não existe. Ver Especificacao_Workflow_v2.md,
// seção 9.
//
// RLS continua desligado nas tabelas do sistema (decisão registrada em
// GAPS_FUNCIONAIS.md) — ligar RLS de forma correta é o passo seguinte ao
// RBAC, não desta etapa.
// =========================================================================

async function handleLogin(e) {
    e.preventDefault();

    const email = document.getElementById('loginEmail').value.trim();
    const senha = document.getElementById('loginSenha').value;

    if (!email || !senha) {
        return alert('Por favor, informe e-mail e senha.');
    }

    const btnLogin = document.getElementById('btnLogin');
    if (btnLogin) { btnLogin.disabled = true; btnLogin.innerText = 'Entrando...'; }

    const { data, error } = await _supabase.auth.signInWithPassword({ email, password: senha });

    if (btnLogin) { btnLogin.disabled = false; btnLogin.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Acessar'; }

    if (error) {
        return alert('❌ Não foi possível entrar: ' + (error.message === 'Invalid login credentials' ? 'e-mail ou senha incorretos.' : error.message));
    }

    const usuarioAtivo = await montarSessaoUsuario(data.user);
    if (!usuarioAtivo) {
        await _supabase.auth.signOut();
        currentUser = null;
        return alert('⛔ Este usuário está inativo. Procure um administrador para reativar seu acesso.');
    }

    // Login digitado de propósito — limpa qualquer flag de recuperação
    // de senha esquecida por trás (ex.: uma recuperação abandonada antes
    // de terminar, em outra aba), pra não travar checarSessaoAtiva() de
    // outras abas indefinidamente.
    try { localStorage.removeItem(CHAVE_RECUPERACAO_SENHA_ATIVA); } catch (e) { /* ignorado */ }

    await entrarNoSistema();
}

// -------------------------------------------------------------------------
// NOVO (evolução — "esqueci a senha", 27/08/2026): fluxo de recuperação
// via e-mail, usando o mecanismo nativo do Supabase Auth. Dois passos:
// 1) aqui — pede o e-mail e chama resetPasswordForEmail, que dispara um
//    e-mail com um link de recuperação (o envio em si depende da
//    configuração de e-mail do projeto no painel do Supabase — Auth >
//    Email Templates/SMTP — fora do alcance do código do app).
// 2) js/main.js escuta onAuthStateChange logo no carregamento da página;
//    quando o usuário volta pelo link do e-mail, o Supabase já reconhece
//    a URL (token na hash) e dispara o evento PASSWORD_RECOVERY — aí
//    mostramos o modal de definir nova senha (abaixo).
// -------------------------------------------------------------------------
function abrirModalEsqueciSenha() {
    document.getElementById('esqueciSenhaEmailInput').value = document.getElementById('loginEmail').value || '';
    document.getElementById('modalEsqueciSenha').classList.remove('hidden');
}

function fecharModalEsqueciSenha() {
    document.getElementById('modalEsqueciSenha').classList.add('hidden');
}

async function enviarLinkRecuperacaoSenha(e) {
    e.preventDefault();
    const email = document.getElementById('esqueciSenhaEmailInput').value.trim().toLowerCase();
    if (!email) return alert('Informe o e-mail cadastrado.');

    const btn = document.getElementById('btnEnviarRecuperacaoSenha');
    if (btn) { btn.disabled = true; btn.innerText = 'Enviando...'; }

    const { error } = await _supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + window.location.pathname
    });

    if (btn) { btn.disabled = false; btn.innerText = 'Enviar Link de Recuperação'; }

    // Mensagem deliberadamente igual exista ou não o e-mail cadastrado —
    // evita que a tela de login sirva pra descobrir quais e-mails têm
    // conta no sistema (enumeração de usuários).
    if (error) console.error('Erro ao solicitar recuperação de senha:', error.message);

    fecharModalEsqueciSenha();
    alert('✅ Se houver uma conta com esse e-mail, um link de recuperação de senha foi enviado. Verifique também a caixa de spam.');
}

// CORRIGIDO 27/08/2026 (bug reportado): quando o e-mail de recuperação é
// aberto com o sistema já com outra aba aberta no navegador (mesma
// origem), a sessão de recuperação que a aba "dona" do link estabelece é
// automaticamente compartilhada com QUALQUER outra aba/janela via
// localStorage — inclusive uma aba nova que, por causa de o link ter
// passado por um redirecionador de e-mail (observado com webmail da
// UOL), pode carregar sem o parâmetro de recuperação na própria URL. Essa
// aba "não dona" só enxerga "existe uma sessão válida" e entra no sistema
// normalmente pelo checarSessaoAtiva(), sem saber que é uma sessão de
// recuperação — daí o bug de abrir o sistema direto em vez de pedir a
// nova senha. A flag abaixo, gravada no localStorage (compartilhado entre
// abas da mesma origem, ao contrário de sessionStorage), resolve isso
// independente de qual aba processa o link primeiro: enquanto ela
// estiver marcada, NENHUMA aba entra no sistema — mesmo a que carregou
// sem o parâmetro na própria URL.
const CHAVE_RECUPERACAO_SENHA_ATIVA = 'Compasso_recuperacao_senha_ativa';
// CORRIGIDO 27/08/2026 (bug reportado — incidente em produção: a flag
// gravava só "1", sem expiração; uma recuperação abandonada no meio
// (aba fechada sem concluir nem cancelar) deixava a flag presa pra
// sempre, bloqueando o login normal de QUALQUER pessoa naquele
// navegador). Agora grava um timestamp em vez de "1" — passado esse
// tempo, a flag é tratada como vencida e limpa sozinha, mesmo que
// ninguém nunca clique em "Cancelar" ou termine a troca.
const JANELA_RECUPERACAO_SENHA_MS = 10 * 60 * 1000; // 10 minutos

// Lê a flag já checando validade — centraliza a regra (usada tanto no
// carregamento da página quanto em checarSessaoAtiva) e limpa sozinha
// qualquer valor vencido ou corrompido que encontrar pelo caminho.
function recuperacaoSenhaFlagAtiva() {
    try {
        const valor = localStorage.getItem(CHAVE_RECUPERACAO_SENHA_ATIVA);
        if (!valor) return false;
        const gravadoEm = Number(valor);
        if (!Number.isFinite(gravadoEm) || (Date.now() - gravadoEm) > JANELA_RECUPERACAO_SENHA_MS) {
            localStorage.removeItem(CHAVE_RECUPERACAO_SENHA_ATIVA);
            return false;
        }
        return true;
    } catch (e) {
        return false; // localStorage indisponível — segue sem a trava entre abas
    }
}

// NOVO (2026-09-01, bug reportado): quando o link de recuperação chega
// inválido/expirado — inclusive quando um PRÉ-SCAN de segurança do
// provedor de e-mail "abre" o link antes da pessoa clicar e consome o
// token de uso único — o Supabase redireciona pra cá com
// "#error=...&error_code=otp_expired&error_description=..." na hash.
// Sem tratar, a pessoa só via a tela de login com um hash estranho e
// nenhuma explicação. Retorna true se tratou um erro (pra pular o resto
// do fluxo de recuperação no boot).
function tratarErroLinkRecuperacaoSenha() {
    const hash = window.location.hash || '';
    if (hash.indexOf('error') === -1) return false;
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const code = params.get('error_code');
    const desc = params.get('error_description');
    if (!code && !desc && !params.get('error')) return false;

    // limpa a hash pra não reprocessar no F5
    history.replaceState(null, '', window.location.pathname + window.location.search);
    try { localStorage.removeItem(CHAVE_RECUPERACAO_SENHA_ATIVA); } catch (e) { /* ignorado */ }

    const descLegivel = desc ? decodeURIComponent(desc.replace(/\+/g, ' ')) : '';
    const expirado = code === 'otp_expired' || /expired|invalid/i.test(descLegivel);
    const msg = expirado
        ? 'O link de recuperação de senha expirou ou já foi usado.\n\n'
          + 'Isso também acontece quando o provedor de e-mail abre o link automaticamente '
          + '(verificação de segurança/antispam) antes de você clicar.\n\n'
          + 'Peça um novo link em "Esqueci minha senha" e abra assim que receber.'
        : 'Não foi possível validar o link de recuperação de senha'
          + (descLegivel ? ':\n\n' + descLegivel : '.')
          + '\n\nPeça um novo link em "Esqueci minha senha".';
    alert('⚠️ ' + msg);
    return true;
}

// Chamada uma vez no carregamento da página (js/main.js) — reconhece o
// retorno pelo link de recuperação de senha e mostra o modal de definir
// nova senha, mesmo com o app ainda não "logado" no sentido normal
// (a sessão de recuperação não carrega perfil/menus).
function monitorarRecuperacaoSenha() {
    _supabase.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
            try { localStorage.setItem(CHAVE_RECUPERACAO_SENHA_ATIVA, String(Date.now())); } catch (e) { /* localStorage indisponível — segue sem a trava entre abas */ }

            // Limpa o token da barra de endereço agora que já foi
            // consumido — evita reprocessar o mesmo link (ou reabrir o
            // modal indevidamente) se a pessoa der refresh na página.
            history.replaceState(null, '', window.location.pathname + window.location.search);

            mostrarModalRecuperacaoSenha();
        }
    });

    // Defesa adicional pro caso da aba que NÃO processou o link
    // diretamente: se ela já tiver entrado no sistema (checarSessaoAtiva
    // rodou antes da flag acima ser gravada por outra aba — janela de
    // corrida bem pequena, mas existe) e essa flag aparecer depois via
    // evento "storage" (só dispara em ABAS DIFERENTES da que gravou, por
    // isso não conflita com a aba que já tratou o evento acima), desfaz
    // a entrada indevida e mostra o mesmo modal.
    window.addEventListener('storage', (ev) => {
        if (ev.key === CHAVE_RECUPERACAO_SENHA_ATIVA && ev.newValue) {
            mostrarModalRecuperacaoSenha();
        }
    });

    // CORRIGIDO 27/08/2026 (2ª parte do bug reportado): o evento "storage"
    // acima só avisa sobre uma MUDANÇA futura — se a aba "dona" do link já
    // tiver gravado a flag ANTES desta aba carregar (ordem bem comum: a
    // aba antiga, já aberta, processa o link mais rápido que esta aba nova
    // termina de carregar todos os scripts), o evento nunca dispara aqui,
    // porque pra esta aba a flag já "nasceu" com valor preenchido — nunca
    // houve uma mudança pra ela testemunhar. Sem esta checagem, a aba
    // nova ficava presa na tela de login comum (pedindo senha) em vez de
    // mostrar o modal de nova senha, mesmo com a flag corretamente ativa.
    if (recuperacaoSenhaFlagAtiva()) {
        mostrarModalRecuperacaoSenha();
    }
}

function mostrarModalRecuperacaoSenha() {
    document.getElementById('appContainer').classList.add('hidden');
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('novaSenhaRecuperacaoInput').value = '';
    document.getElementById('confirmaSenhaRecuperacaoInput').value = '';
    document.getElementById('modalDefinirNovaSenhaRecuperacao').classList.remove('hidden');
}

// NOVO (correção do incidente de flag presa, 27/08/2026): escape manual
// pro modal de recuperação — encerra a sessão de recuperação (se houver
// uma nesta aba), limpa a flag compartilhada e devolve pro login normal.
async function cancelarRecuperacaoSenha() {
    try { await _supabase.auth.signOut(); } catch (e) { /* sem sessão pra encerrar — segue normalmente */ }
    currentUser = null;
    try { localStorage.removeItem(CHAVE_RECUPERACAO_SENHA_ATIVA); } catch (e) { /* ignorado */ }
    document.getElementById('modalDefinirNovaSenhaRecuperacao').classList.add('hidden');
    document.getElementById('appContainer').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
}

async function confirmarNovaSenhaRecuperacao() {
    const novaSenha = document.getElementById('novaSenhaRecuperacaoInput').value.trim();
    const confirmaSenha = document.getElementById('confirmaSenhaRecuperacaoInput').value.trim();

    if (!novaSenha || novaSenha.length < 6) {
        return alert('A nova senha precisa ter pelo menos 6 caracteres!');
    }
    if (novaSenha !== confirmaSenha) {
        return alert('As senhas não coincidem!');
    }

    const { error } = await _supabase.auth.updateUser({ password: novaSenha });
    if (error) return alert('Erro ao definir a nova senha: ' + error.message);

    const { data: { user } } = await _supabase.auth.getUser();
    if (user) {
        const { error: errorPerfil } = await _supabase.from('perfis_usuarios').update({ senha_provisoria: false }).eq('id', user.id);
        if (errorPerfil) console.error('Senha redefinida, mas houve erro ao atualizar a flag de senha provisória:', errorPerfil.message);
    }

    // Encerra a sessão de recuperação (de propósito restrita) e devolve
    // pra tela de login normal, pra entrar de novo já com a senha nova.
    await _supabase.auth.signOut();
    currentUser = null;
    try { localStorage.removeItem(CHAVE_RECUPERACAO_SENHA_ATIVA); } catch (e) { /* ignorado */ }
    document.getElementById('modalDefinirNovaSenhaRecuperacao').classList.add('hidden');
    document.getElementById('appContainer').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');
    alert('✅ Senha redefinida com sucesso! Faça login com a nova senha.');
}

async function montarSessaoUsuario(authUser) {
    let nomeExibicao = authUser.email;

    const { data: perfil, error } = await _supabase
        .from('perfis_usuarios')
        .select('nome, ativo, senha_provisoria, area')
        .eq('id', authUser.id)
        .maybeSingle();

    if (!error && perfil && perfil.nome) {
        nomeExibicao = perfil.nome;
    }

    // Usuário inativado (G3, exclusão lógica) — não deve conseguir entrar,
    // mesmo com a sessão do Supabase Auth ainda tecnicamente válida.
    if (perfil && perfil.ativo === false) {
        currentUser = null;
        return false;
    }

    currentUser = {
        id: authUser.id,
        email: authUser.email,
        nome: nomeExibicao,
        senhaProvisoria: !!(perfil && perfil.senha_provisoria),
        area: perfil ? (perfil.area || null) : null // G18: usado pro filtro de acesso do Roadmap por área
    };
    return true;
}

// Preenche nome, função(ões) e as iniciais do avatar no cabeçalho, a
// partir do usuário realmente logado — antes vinha tudo fixo em HTML.
function atualizarCabecalhoUsuario() {
    if (!currentUser) return;

    const elNome = document.getElementById('userInfoName');
    if (elNome) elNome.innerText = currentUser.nome || currentUser.email;

    const elRole = document.getElementById('userInfoRole');
    if (elRole) {
        const funcoesTexto = (typeof funcoesUsuarioAtual !== 'undefined' && funcoesUsuarioAtual.length > 0)
            ? funcoesUsuarioAtual.join(', ')
            : 'Sem função atribuída';
        elRole.innerText = `Perfil: ${funcoesTexto}`;
    }

    const elAvatar = document.getElementById('userInfoAvatar');
    if (elAvatar) {
        const nomeParaIniciais = currentUser.nome || currentUser.email || '??';
        const partes = nomeParaIniciais.trim().split(/\s+/);
        const iniciais = partes.length >= 2
            ? (partes[0][0] + partes[partes.length - 1][0])
            : nomeParaIniciais.substring(0, 2);
        elAvatar.innerText = iniciais.toUpperCase();
    }
}

async function entrarNoSistema() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appContainer').classList.remove('hidden');

    // NOVO (Feature 1.2 — 03/09/2026): o período do Ano Fiscal (mês de
    // início) é parametrizável — carrega o cache ANTES do primeiro
    // getInfoAnoFiscal(), que passou a consultá-lo. Feature 1.1: cache do
    // modo de controle orçamentário (usado no trade-off da Extraordinária).
    if (typeof carregarConfigPeriodoAF === 'function') await carregarConfigPeriodoAF();
    if (typeof carregarConfigControleOrcamento === 'function') await carregarConfigControleOrcamento();

    const infoAF = getInfoAnoFiscal();
    const sidebarInfo = document.getElementById('sidebarInfoAF');
    // CORRIGIDO 10/08/2026 (a pedido do usuário): rótulo "AF" trocado por
    // "FY" só na exibição — o valor interno (afAtualStr, usado em
    // consultas e geração de código de projeto) continua "AF2027" etc.,
    // sem mudança nenhuma, só a etiqueta visual muda.
    if (sidebarInfo) sidebarInfo.innerText = `FY Atual: ${infoAF.afAtualStr.replace('AF', 'FY')} (${infoAF.quarterAtual})`;

    await carregarPermissoesUsuarioAtual();
    await carregarLicenca(); // NOVO (Licenciamento de Módulos, 28/08/2026): precisa estar pronto antes de aplicarVisibilidadeMenu(), que já consulta moduloAtivo()
    if (typeof carregarAnosFiscaisLista === 'function') await carregarAnosFiscaisLista(); // NOVO (2026-09-02): seletor de AF (Dashboard/Roadmap/Financeiro/Consulta) vem da tabela anos_fiscais_config, não da data
    aplicarVisibilidadeMenu();
    await carregarConfigEmailGeral();
    atualizarCabecalhoUsuario(); // CORRIGIDO 10/08/2026 (bug reportado): nome/perfil do cabeçalho vinham fixos ("Administrador"/"ADM"), nunca refletiam o usuário logado de verdade
    await loadAreas();
    await carregarCargosData(); // NOVO (evolução de RLS — cargos, 27/08/2026): precisa estar pronto antes de qualquer tela de Usuários/Cadastro
    await loadPortes(); // G25/G26: precisa vir ANTES de loadFasesEtapas() — renderPrazosTable() (disparada por loadFasesEtapas) já depende de portesData estar pronto
    await loadFasesEtapas(); // substituiu loadPrazos() no G24 — SLA agora vem de fases_etapas/sla_etapa_porte
    await loadResponsaveis(); // CORRIGIDO 10/08/2026: faltava carregar aqui — sem isso, o modal de Planejamento (Realizar Orçamento, Requerimentos etc.) ficava sem responsáveis pra escolher até a pessoa visitar a aba de Administração
    await loadPessoasSolicitantes(); // mesmo cuidado — Nova Demanda depende disso desde já
    await loadProjects();
    await atualizarCodigoProjetoAutomatico();

    switchTab('home');

    // G3: senha provisória — força a troca antes de liberar o uso normal
    // do sistema (o modal fica por cima de tudo, bloqueando interação com
    // o resto da tela até ser preenchido).
    if (currentUser && currentUser.senhaProvisoria) {
        abrirModalTrocaSenhaObrigatoria();
    }
}

// Chamada uma vez, no carregamento da página (js/main.js), para permitir
// que uma sessão já ativa (ex.: usuário deu F5) reentre sem pedir login
// de novo — o Supabase persiste o token de sessão no navegador.
async function checarSessaoAtiva() {
    // CORRIGIDO 27/08/2026: ver comentário em CHAVE_RECUPERACAO_SENHA_ATIVA
    // (acima) — nunca entra no sistema enquanto uma recuperação de senha
    // estiver em andamento em QUALQUER aba desta origem, mesmo que a
    // sessão encontrada abaixo seja tecnicamente válida.
    if (recuperacaoSenhaFlagAtiva()) return;

    const { data } = await _supabase.auth.getSession();
    if (data && data.session && data.session.user) {
        const usuarioAtivo = await montarSessaoUsuario(data.session.user);
        if (!usuarioAtivo) {
            await _supabase.auth.signOut();
            return;
        }
        await entrarNoSistema();
    }
}

async function handleLogout() {
    await _supabase.auth.signOut();
    currentUser = null;
    document.getElementById('appContainer').classList.add('hidden');
    document.getElementById('loginScreen').classList.remove('hidden');

    const loginForm = document.getElementById('loginEmail');
    if (loginForm) loginForm.value = '';
    const loginSenhaEl = document.getElementById('loginSenha');
    if (loginSenhaEl) loginSenhaEl.value = '';
}
