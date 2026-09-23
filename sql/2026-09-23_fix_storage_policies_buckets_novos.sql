-- =========================================================================
-- 2026-09-23_fix_storage_policies_buckets_novos.sql
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- CORREÇÃO: os 3 buckets privados criados nesta sessão
-- (ia-documentos-gerados, task-anexos, projeto-documentos) foram criados
-- SEM as policies de storage.objects — só o INSERT INTO storage.buckets,
-- faltou o CREATE POLICY. Sem policy, todo upload/download direto do
-- navegador (não via Netlify Function com service key) é barrado com
-- "new row violates row-level security policy" (INSERT) ou link de
-- download não assina (SELECT).
--
-- Mesmo padrão já usado em contratos-anexos
-- (sql/2026-09-08_storage_contratos_anexos.sql): TO public (cobre anon E
-- authenticated) — o controle de acesso real de quem PODE alcançar cada
-- storage_path já é feito na tabela de metadados (RLS de
-- task_attachments/project_document_versions/ia_especificacoes_anexos),
-- não no Storage em si.
--
-- >>> Se o CREATE POLICY der "must be owner of table objects", crie pela
--     UI: Storage -> bucket -> Policies -> New policy -> "For full
--     customization", uma por operação, expressão bucket_id = '<nome>',
--     alvo "Defaults to all (public)". <<<
--
-- Idempotente. Supabase -> SQL Editor.
-- =========================================================================

DO $$
DECLARE
    bucket TEXT;
BEGIN
    FOREACH bucket IN ARRAY ARRAY['ia-documentos-gerados', 'task-anexos', 'projeto-documentos']
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', bucket || '_all_select');
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', bucket || '_all_insert');
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', bucket || '_all_update');
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', bucket || '_all_delete');

        EXECUTE format('CREATE POLICY %I ON storage.objects FOR SELECT TO public USING (bucket_id = %L)', bucket || '_all_select', bucket);
        EXECUTE format('CREATE POLICY %I ON storage.objects FOR INSERT TO public WITH CHECK (bucket_id = %L)', bucket || '_all_insert', bucket);
        EXECUTE format('CREATE POLICY %I ON storage.objects FOR UPDATE TO public USING (bucket_id = %L) WITH CHECK (bucket_id = %L)', bucket || '_all_update', bucket, bucket);
        EXECUTE format('CREATE POLICY %I ON storage.objects FOR DELETE TO public USING (bucket_id = %L)', bucket || '_all_delete', bucket);
    END LOOP;
END $$;

-- Conferência:
--   SELECT policyname, cmd, roles FROM pg_policies
--   WHERE tablename = 'objects'
--   AND policyname LIKE ANY (ARRAY['ia-documentos-gerados%', 'task-anexos%', 'projeto-documentos%']);
-- =========================================================================
