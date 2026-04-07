-- Seed inicial: perfis Lucas, Gisele e Casal
-- Só insere se a tabela ainda estiver vazia para ser idempotente
INSERT INTO public.profiles (id, name, color, avatar_initials, created_at)
SELECT
  gen_random_uuid(), 'Lucas',  'blue',  'LC', now()
WHERE NOT EXISTS (SELECT 1 FROM public.profiles LIMIT 1);

INSERT INTO public.profiles (id, name, color, avatar_initials, created_at)
SELECT
  gen_random_uuid(), 'Gisele', 'green', 'GI', now() + interval '1 second'
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE name = 'Gisele');

INSERT INTO public.profiles (id, name, color, avatar_initials, created_at)
SELECT
  gen_random_uuid(), 'Casal',  'amber', '💑', now() + interval '2 seconds'
WHERE NOT EXISTS (SELECT 1 FROM public.profiles WHERE name = 'Casal');
