-- 073: Private PDF attachments for existing service cases.
-- Historical reports remain documents; no maintenance, approval or QR state is changed.
-- Apply before deploying the frontend that uploads attachments.
BEGIN;

CREATE TABLE IF NOT EXISTS public.service_case_documents (
  id UUID PRIMARY KEY,
  service_case_id UUID NOT NULL REFERENCES public.service_cases(id) ON DELETE RESTRICT,
  title TEXT NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 200),
  file_name TEXT NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 255),
  storage_object_id UUID NOT NULL UNIQUE REFERENCES storage.objects(id) ON DELETE RESTRICT,
  storage_path TEXT NOT NULL UNIQUE,
  file_size BIGINT NOT NULL CHECK (file_size BETWEEN 1 AND 20971520),
  document_date DATE,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_case_documents_case
  ON public.service_case_documents (service_case_id, uploaded_at DESC);

ALTER TABLE public.service_case_documents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.service_case_documents FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.service_case_documents TO authenticated;

DROP POLICY IF EXISTS case_documents_select ON public.service_case_documents;
CREATE POLICY case_documents_select ON public.service_case_documents
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND active = true)
    -- This subquery uses service_cases RLS: technicians only see assigned cases.
    AND EXISTS (SELECT 1 FROM public.service_cases WHERE id = service_case_id)
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('service-case-documents', 'service-case-documents', false, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS case_documents_upload ON storage.objects;
CREATE POLICY case_documents_upload ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'service-case-documents'
    AND owner_id = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND active = true AND role IN ('admin', 'supervisor')
    )
    AND array_length(storage.foldername(name), 1) = 2
    AND (storage.foldername(name))[2] = auth.uid()::text
    AND storage.filename(name) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$'
    AND EXISTS (
      SELECT 1 FROM public.service_cases
      WHERE id::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS case_documents_download ON storage.objects;
CREATE POLICY case_documents_download ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'service-case-documents'
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND active = true)
    AND (
      EXISTS (
        SELECT 1 FROM public.service_case_documents
        WHERE storage_path = name
      )
      OR (
        -- Allow the uploader to reconcile/clean an upload not yet registered.
        owner_id = auth.uid()::text
        AND EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid() AND role IN ('admin', 'supervisor')
        )
      )
    )
  );

DROP POLICY IF EXISTS case_documents_cleanup ON storage.objects;
CREATE POLICY case_documents_cleanup ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'service-case-documents'
    AND owner_id = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND active = true AND role IN ('admin', 'supervisor')
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.service_case_documents WHERE storage_path = name
    )
  );
-- No UPDATE policy and no deletion of registered documents. The FK above also
-- protects against a cleanup DELETE that began before registration committed;
-- the RLS subquery alone could otherwise read an older transaction snapshot.

ALTER TABLE public.service_case_events
  DROP CONSTRAINT IF EXISTS service_case_events_event_type_check;
ALTER TABLE public.service_case_events
  ADD CONSTRAINT service_case_events_event_type_check CHECK (
    event_type IN (
      'case_created', 'case_updated', 'status_changed', 'assigned', 'case_unassigned',
      'closed', 'cancelled', 'case_reopened', 'case_reactivated',
      'production_numbering_activated', 'document_uploaded'
    )
  );

CREATE OR REPLACE FUNCTION public.register_service_case_document(
  p_document_id UUID,
  p_case_id UUID,
  p_file_name TEXT,
  p_title TEXT DEFAULT NULL,
  p_document_date DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_path TEXT;
  v_title TEXT;
  v_object storage.objects;
  v_document public.service_case_documents;
  v_file_size BIGINT;
BEGIN
  IF v_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = v_user_id AND active = true AND role IN ('admin', 'supervisor')
  ) THEN
    RAISE EXCEPTION 'Solo administradores y supervisores activos pueden adjuntar documentos.' USING ERRCODE = '42501';
  END IF;

  IF p_document_id IS NULL OR p_case_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.service_cases WHERE id = p_case_id
  ) THEN
    RAISE EXCEPTION 'El expediente no existe.' USING ERRCODE = '22023';
  END IF;

  IF p_file_name IS NULL OR char_length(p_file_name) NOT BETWEEN 1 AND 255
     OR p_file_name !~* '\.pdf$' OR p_file_name ~ '[[:cntrl:]/\\]' THEN
    RAISE EXCEPTION 'El nombre del archivo PDF no es válido.' USING ERRCODE = '22023';
  END IF;
  v_title := coalesce(nullif(btrim(p_title), ''), regexp_replace(p_file_name, '\.pdf$', '', 'i'));
  IF char_length(v_title) NOT BETWEEN 1 AND 200 THEN
    RAISE EXCEPTION 'El título debe tener entre 1 y 200 caracteres.' USING ERRCODE = '22023';
  END IF;

  v_path := p_case_id::text || '/' || v_user_id::text || '/' || p_document_id::text || '.pdf';
  -- Lock the object while registering its FK; cleanup cannot remove a committed
  -- attachment even if the cleanup statement started with an older snapshot.
  SELECT * INTO v_object FROM storage.objects
  WHERE bucket_id = 'service-case-documents' AND name = v_path
    AND owner_id = v_user_id::text
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró el PDF cargado para este expediente.' USING ERRCODE = '22023';
  END IF;
  IF v_object.metadata->>'mimetype' IS DISTINCT FROM 'application/pdf'
     OR coalesce(v_object.metadata->>'size', '') !~ '^[0-9]{1,12}$' THEN
    RAISE EXCEPTION 'El archivo cargado no es un PDF válido.' USING ERRCODE = '22023';
  END IF;
  v_file_size := (v_object.metadata->>'size')::BIGINT;
  IF v_file_size NOT BETWEEN 1 AND 20971520 THEN
    RAISE EXCEPTION 'El PDF debe tener contenido y no superar 20 MB.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_document FROM public.service_case_documents WHERE id = p_document_id;
  IF FOUND THEN
    IF v_document.storage_path IS DISTINCT FROM v_path THEN
      RAISE EXCEPTION 'El identificador del documento ya está en uso.' USING ERRCODE = '22023';
    END IF;
    RETURN to_jsonb(v_document);
  END IF;

  INSERT INTO public.service_case_documents (
    id, service_case_id, title, file_name, storage_object_id, storage_path, file_size, document_date, uploaded_by
  ) VALUES (
    p_document_id, p_case_id, v_title, p_file_name, v_object.id, v_path, v_file_size, p_document_date, v_user_id
  ) RETURNING * INTO v_document;

  INSERT INTO public.service_case_events (service_case_id, event_type, performed_by, details)
  VALUES (p_case_id, 'document_uploaded', v_user_id, jsonb_build_object(
    'document_id', p_document_id, 'file_name', p_file_name, 'title', v_title,
    'document_date', p_document_date, 'file_size', v_file_size
  ));
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, new_data)
  VALUES (v_user_id, 'create', 'service_case_documents', p_document_id, to_jsonb(v_document));

  RETURN to_jsonb(v_document);
END;
$$;

REVOKE ALL ON FUNCTION public.register_service_case_document(UUID, UUID, TEXT, TEXT, DATE) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_service_case_document(UUID, UUID, TEXT, TEXT, DATE) TO authenticated;

COMMIT;
