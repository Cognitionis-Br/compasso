-- =========================================================================
-- 2026-08-28_papel_proprietario.sql
-- Compasso — SÓ Compasso, não roda contra a base do Compasso.
--
-- NOVO (a pedido do usuário): a figura de PROPRIETÁRIO — o único com
-- acesso total ao sistema, incluindo Licenciamento de Módulos.
-- ADMINISTRADOR mantém exatamente as mesmas funções de antes da
-- modularização (acesso_irrestrito continua valendo pra tudo, MENOS
-- Licenciamento de Módulos, que passa a exigir eh_proprietario=true
-- especificamente — ver js/config/funcoes.js/ehProprietario e o gate em
-- js/ui/navigation.js:switchTab).
--
-- Idempotente — pode rodar mais de uma vez sem erro. Não atribui a
-- função PROPRIETARIO a ninguém automaticamente — atribua manualmente
-- em Perfis de Acesso > Atribuição de Função aos Usuários pra quem for
-- o dono da conta.
-- =========================================================================

ALTER TABLE funcoes ADD COLUMN IF NOT EXISTS eh_proprietario BOOLEAN NOT NULL DEFAULT false;

INSERT INTO funcoes (nome, acesso_irrestrito, eh_proprietario)
SELECT 'PROPRIETARIO', true, true
WHERE NOT EXISTS (SELECT 1 FROM funcoes WHERE nome = 'PROPRIETARIO');

-- Se a função já existir por outro motivo, garante as duas flags corretas.
UPDATE funcoes SET acesso_irrestrito = true, eh_proprietario = true WHERE nome = 'PROPRIETARIO';

NOTIFY pgrst, 'reload schema';
