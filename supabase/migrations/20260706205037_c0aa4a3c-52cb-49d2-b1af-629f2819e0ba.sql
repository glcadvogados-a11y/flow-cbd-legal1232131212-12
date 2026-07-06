CREATE TABLE public.records (
  id text PRIMARY KEY,
  collection text NOT NULL,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX records_collection_idx ON public.records (collection);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.records TO authenticated;
GRANT ALL ON public.records TO service_role;

ALTER TABLE public.records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all records"
  ON public.records FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert records"
  ON public.records FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update records"
  ON public.records FOR UPDATE
  TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can delete records"
  ON public.records FOR DELETE
  TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public.records_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER records_updated_at
  BEFORE UPDATE ON public.records
  FOR EACH ROW EXECUTE FUNCTION public.records_touch_updated_at();