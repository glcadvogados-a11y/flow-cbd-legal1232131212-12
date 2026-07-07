UPDATE public.records AS r
SET
  data = jsonb_set(
    jsonb_set(
      r.data,
      '{periodoInicio}',
      to_jsonb(r.data ->> 'dataConclusao'),
      true
    ),
    '{periodoFim}',
    to_jsonb(
      to_char(
        (
          (r.data ->> 'dataConclusao')::date
          + make_interval(months => COALESCE(NULLIF(r.data ->> 'duracaoMeses', '')::int, 12))
        )::date,
        'YYYY-MM-DD'
      )
    ),
    true
  ),
  updated_at = now()
WHERE r.collection = 'cumprimentos'
  AND r.data ->> 'status' = 'concluido'
  AND COALESCE(r.data ->> 'dataConclusao', '') <> ''
  AND (
    r.data ->> 'periodoInicio' IS DISTINCT FROM r.data ->> 'dataConclusao'
    OR r.data ->> 'periodoFim' IS DISTINCT FROM to_char(
      (
        (r.data ->> 'dataConclusao')::date
        + make_interval(months => COALESCE(NULLIF(r.data ->> 'duracaoMeses', '')::int, 12))
      )::date,
      'YYYY-MM-DD'
    )
  );

UPDATE public.records AS f
SET
  data = jsonb_set(
    f.data,
    '{dataVencimento}',
    to_jsonb(
      to_char(
        (
          (c.data ->> 'dataConclusao')::date
          + make_interval(months => COALESCE(NULLIF(c.data ->> 'duracaoMeses', '')::int, 12))
        )::date,
        'YYYY-MM-DD'
      )
    ),
    true
  ),
  updated_at = now()
FROM public.records AS c
WHERE f.collection = 'fulfillments'
  AND c.collection = 'cumprimentos'
  AND f.data ->> 'cumprimentoId' = c.id
  AND c.data ->> 'status' = 'concluido'
  AND COALESCE(c.data ->> 'dataConclusao', '') <> ''
  AND f.data ->> 'dataVencimento' IS DISTINCT FROM to_char(
    (
      (c.data ->> 'dataConclusao')::date
      + make_interval(months => COALESCE(NULLIF(c.data ->> 'duracaoMeses', '')::int, 12))
    )::date,
    'YYYY-MM-DD'
  );