-- =========================================================================
-- 2026-09-08_storage_contratos_anexos.sql   (Release 1)
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- PRIMEIRO uso de Supabase Storage no produto. Bucket privado para os
-- anexos de Nota Fiscal / comprovante das pendências de contrato.
-- Leitura via signed URL de curta duração gerada pelo front
-- (_supabase.storage.from('contratos-anexos').createSignedUrl(path, 300)).
--
-- O app roda com a publishable key (papel efetivo: anon). storage.objects
-- tem RLS ligado — sem policy permissiva o upload é barrado com
-- "Permissão negada no Storage". As policies abaixo usam TO public (cobre
-- anon E authenticated) — mesma filosofia das tabelas com RLS desligado
-- (o controle real é no front: catalogo_atividades contratos_pendencias:*).
--
-- >>> Se o CREATE POLICY der "must be owner of table objects", crie pela
--     UI: Storage -> bucket contratos-anexos -> Policies -> New policy ->
--     "For full customization", uma por operação (SELECT/INSERT/UPDATE/
--     DELETE) com a expressão  bucket_id = 'contratos-anexos'  e o alvo
--     "anon" (ou "Defaults to all (public)"). <<<
--
-- Caminho dos objetos: pendencias/<pendencia_id>/<uuid>-<nome>
-- Idempotente. Supabase -> SQL Editor.
-- =========================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('contratos-anexos', 'contratos-anexos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "contratos_anexos_anon_select" ON storage.objects;
DROP POLICY IF EXISTS "contratos_anexos_anon_insert" ON storage.objects;
DROP POLICY IF EXISTS "contratos_anexos_anon_update" ON storage.objects;
DROP POLICY IF EXISTS "contratos_anexos_anon_delete" ON storage.objects;
DROP POLICY IF EXISTS "contratos_anexos_all_select" ON storage.objects;
DROP POLICY IF EXISTS "contratos_anexos_all_insert" ON storage.objects;
DROP POLICY IF EXISTS "contratos_anexos_all_update" ON storage.objects;
DROP POLICY IF EXISTS "contratos_anexos_all_delete" ON storage.objects;

CREATE POLICY "contratos_anexos_all_select" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'contratos-anexos');
CREATE POLICY "contratos_anexos_all_insert" ON storage.objects
  FOR INSERT TO public WITH CHECK (bucket_id = 'contratos-anexos');
CREATE POLICY "contratos_anexos_all_update" ON storage.objects
  FOR UPDATE TO public USING (bucket_id = 'contratos-anexos') WITH CHECK (bucket_id = 'contratos-anexos');
CREATE POLICY "contratos_anexos_all_delete" ON storage.objects
  FOR DELETE TO public USING (bucket_id = 'contratos-anexos');

-- Conferência:
--   SELECT id, public FROM storage.buckets WHERE id = 'contratos-anexos';
--   SELECT policyname, cmd, roles FROM pg_policies
--   WHERE tablename = 'objects' AND policyname LIKE 'contratos_anexos%';
-- =========================================================================
