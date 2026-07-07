UPDATE public.records AS r
SET
  data = (r.data - 'periodoInicio' - 'periodoFim'),
  updated_at = now()
WHERE r.collection = 'cumprimentos'
  AND (
    r.data ->> 'status' IS DISTINCT FROM 'concluido'
    OR COALESCE(r.data ->> 'dataConclusao', '') = ''
  )
  AND (
    r.data ? 'periodoInicio'
    OR r.data ? 'periodoFim'
  );