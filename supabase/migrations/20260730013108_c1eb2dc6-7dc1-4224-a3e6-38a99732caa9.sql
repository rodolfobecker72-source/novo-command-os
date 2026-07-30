CREATE POLICY "Users can upload own feedback images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'feedback-images' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can view own feedback images" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'feedback-images' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(), 'owner') OR public.has_role(auth.uid(), 'admin')));