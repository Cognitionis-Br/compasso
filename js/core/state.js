// =========================================================================
// core/state.js
// Estado global do sistema — projetos, áreas, prazos e usuário logado.
//
// Script clássico (ainda não é ES Module): precisa ser carregado no
// index.html ANTES de app.js. As variáveis abaixo ficam visíveis e
// reatribuíveis pelos scripts carregados na sequência, pois compartilham
// o mesmo escopo léxico de topo de página.
//
// Quando modularizarmos de vez para ES Modules, isso vira um objeto
// `state` exportado (ex.: state.projectsData) e todo `app.js` precisa
// trocar as referências soltas por `state.x` — ver ARQUITETURA_ALVO.md,
// passo reservado para quando estivermos extraindo módulos com mais
// lógica de negócio.
// =========================================================================
let projectsData = [];
let areasData = [];
let pessoasSolicitantesData = [];
let portesData = [];
let prazosData = [];
// AJUSTADO (Fase 6 — padronização de telas/menus): responsaveisData (nome/
// e-mail digitados livremente) deu lugar a usuarioAtividadesData, que
// referencia perfis_usuarios já cadastrados. responsaveisLegadoData guarda
// a tabela antiga só pra calcular o relatório de e-mails não migrados.
let usuarioAtividadesData = [];
let responsaveisLegadoData = [];
let funcoesData = [];
let usuarioFuncoesData = [];
// NOVO (Controle de acesso por atividade, Fases 1-4): catálogo de todas as
// atividades do sistema (grupo/função/atividade/activity_key/restricao_
// área) e o vínculo função↔atividade — substituíram a antiga
// permissoesEtapaData (etapa×ação, retirada na Fase 4). Não confundir
// atividadesData com usuarioAtividadesData (Fase 6 — Responsáveis por
// Atividade, outra tabela, outro propósito).
let atividadesData = [];
let funcaoAtividadesData = [];
let usuariosData = [];
let anosFiscaisConfigData = [];
let abaAtualId = 'home';
let fasesEtapasData = [];
let slaEtapaPorteData = [];
let projetoEtapasData = [];
let currentUser = null;
// NOVO (chave geral de envio de e-mail): true até carregar de verdade de
// config_email_geral — evita bloquear disparo por causa de uma tela que
// ainda não passou por carregarConfigEmailGeral() nesta sessão.
let configEmailGeralAtivo = true;
// NOVO (evolução de RLS — cargos, 27/08/2026): catálogo de cargos usado
// como campo obrigatório em perfis_usuarios.cargo_id.
let cargosData = [];
