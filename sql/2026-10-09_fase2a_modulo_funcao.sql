-- ============================================================
-- 2026-10-09_fase2a_modulo_funcao.sql
-- Compasso — Fase 2A: registrar VIS-FY-01 e VIS-FY-02/04/05
-- na tabela modulo_funcao como funcionalidades NUCLEO.
--
-- Idempotente (ON CONFLICT DO NOTHING).
-- ============================================================

INSERT INTO modulo_funcao (modulo, funcao, descricao)
VALUES
    ('NUCLEO', 'fy_lista',     'Exercícios Fiscais — lista e gestão (VIS-FY-01)'),
    ('NUCLEO', 'fy_workspace', 'Exercício Fiscal — workspace (VIS-FY-02/04/05)')
ON CONFLICT (modulo, funcao) DO NOTHING;
