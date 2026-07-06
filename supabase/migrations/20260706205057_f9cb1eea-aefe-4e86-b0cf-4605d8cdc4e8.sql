DROP POLICY "Authenticated users can insert records" ON public.records;
DROP POLICY "Authenticated users can update records" ON public.records;
DROP POLICY "Authenticated users can delete records" ON public.records;

CREATE POLICY "Authenticated users can insert records"
  ON public.records FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update records"
  ON public.records FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete records"
  ON public.records FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL);