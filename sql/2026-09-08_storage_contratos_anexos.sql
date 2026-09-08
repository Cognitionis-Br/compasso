-- =========================================================================
-- 2026-09-08_storage_contratos_anexos.sql   (Release 1)
-- Compasso — projeto Supabase fytynjjvzecljmgbtwec.
--
-- PRIMEIRO uso de Supabase Storage no produto (até aqui o único binário
-- era o logo da empresa, gravado como base64 em coluna). Bucket privado
-- para os anexos de Nota Fiscal / comprovante das pendências de contrato.
--
-- Leitura é sempre via signed URL de curta duração gerada pelo front
-- (_supabase.storage.from('contratos-anexos').createSignedUrl(path, 300)).
-- As políticas abaixo liberam o papel 'anon' (o app roda como anon;
-- controle real é no front, ver catalogo_atividades) — mesma filosofia
-- das tabelas com RLS desligado.
--
-- Caminho dos objetos: pendencias/<pendencia_id>/<uuid>-<nome>
--
-- Idempotente. Supabase → SQL Editor.
-- =========================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('contratos-anexos', 'contratos-anexos', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "contratos_anexos_anon_select" ON storage.objects;
DROP POLICY IF EXISTS "contratos_anexos_anon_insert" ON storage.objects;
DROP POLICY IF EXISTS "contratos_anexos_anon_update" ON storage.objects;
DROP POLICY IF EXISTS "contratos_anexos_anon_delete" ON storage.objects;

CREATE POLICY "contratos_anexos_anon_select" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'contratos-anexos');
CREATE POLICY "contratos_anexos_anon_insert" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'contratos-anexos');
CREATE POLICY "contratos_anexos_anon_update" ON storage.objects
  FOR UPDATE TO anon USING (bucket_id = 'contratos-anexos') WITH CHECK (bucket_id = 'contratos-anexos');
CREATE POLICY "contratos_anexos_anon_delete" ON storage.objects
  FOR DELETE TO anon USING (bucket_id = 'contratos-anexos');

-- Conferência:
--   SELECT id, public FROM storage.buckets WHERE id = 'contratos-anexos';
--   SELECT policyname FROM pg_policies WHERE tablename = 'objects' AND policyname LIKE 'contratos_anexos%';
-- =========================================================================
