-- Seed data. Course TITLES are from the current site. Everything marked
-- [PLACEHOLDER] (descriptions, categories, levels, page counts, single-course
-- prices, slugs) must be checked against finaisolutions.co before go-live.
-- Single-course price_cents is NULL until confirmed => course shows
-- "Price to be confirmed" and cannot be bought on its own (bundles still work).

insert into public.levels (name, sort_order) values
  ('Beginner', 1), ('Intermediate', 2), ('Advanced', 3)
on conflict (name) do nothing;

-- [PLACEHOLDER] categories — inferred from course titles, replace with the live site's categories.
insert into public.categories (slug, name, description, sort_order) values
  ('ai-foundations',       'AI Foundations',        '[PLACEHOLDER] category description', 1),
  ('business-strategy',    'Business & Strategy',   '[PLACEHOLDER] category description', 2),
  ('technical-ai',         'Technical AI',          '[PLACEHOLDER] category description', 3),
  ('creative-ai',          'Creative AI',           '[PLACEHOLDER] category description', 4),
  ('industry-applications','Industry Applications', '[PLACEHOLDER] category description', 5)
on conflict (slug) do nothing;

with c(slug, title, cat, lvl, sort) as (values
  ('ai-automation-playbook',               'AI Automation Playbook',                'business-strategy',     'Intermediate', 1),
  ('ai-for-business-strategy',             'AI for Business Strategy',              'business-strategy',     'Intermediate', 2),
  ('ai-for-healthcare-innovation',         'AI for Healthcare Innovation',          'industry-applications', 'Intermediate', 3),
  ('ai-fundamentals-the-complete-guide',   'AI Fundamentals: The Complete Guide',   'ai-foundations',        'Beginner',     4),
  ('ai-product-management',                'AI Product Management',                 'business-strategy',     'Intermediate', 5),
  ('ai-powered-marketing',                 'AI-Powered Marketing',                  'business-strategy',     'Beginner',     6),
  ('computer-vision-handbook',             'Computer Vision Handbook',              'technical-ai',          'Advanced',     7),
  ('creative-ai-art-music-design',         'Creative AI: Art, Music & Design',      'creative-ai',           'Beginner',     8),
  ('data-science-with-python-ai',          'Data Science with Python & AI',         'technical-ai',          'Intermediate', 9),
  ('deep-learning-architecture',           'Deep Learning Architecture',            'technical-ai',          'Advanced',     10),
  ('generative-ai-from-gpt-to-diffusion',  'Generative AI: From GPT to Diffusion',  'technical-ai',          'Intermediate', 11),
  ('machine-learning-decoded',             'Machine Learning Decoded',              'ai-foundations',        'Beginner',     12),
  ('natural-language-processing',          'Natural Language Processing',           'technical-ai',          'Advanced',     13),
  ('prompt-engineering-mastery',           'Prompt Engineering Mastery',            'ai-foundations',        'Beginner',     14),
  ('robotics-ai-integration',              'Robotics & AI Integration',             'industry-applications', 'Advanced',     15),
  ('the-ethics-of-artificial-intelligence','The Ethics of Artificial Intelligence', 'ai-foundations',        'Beginner',     16)
)
insert into public.courses (slug, title, short_description, description, category_id, level_id, page_count, price_cents, sort_order)
select c.slug, c.title,
       '[PLACEHOLDER] One-sentence summary of ' || c.title || '.',
       '[PLACEHOLDER] Full description of ' || c.title || ' — copy from the live product page.',
       (select id from public.categories where slug = c.cat),
       (select id from public.levels where name = c.lvl),
       null,   -- [PLACEHOLDER] page count
       null,   -- [PLACEHOLDER] single-course price
       c.sort
from c
on conflict (slug) do nothing;

-- Bundles. Course selection is a starting point — edit in /admin/offers.
insert into public.offers (slug, name, description, price_cents, visibility, sort_order) values
  ('starter',      'Starter',      '3 courses of your AI library.',  25000,  'public', 1),
  ('professional', 'Professional', '5 courses of your AI library.',  40000,  'public', 2),
  ('enterprise',   'Enterprise',   '7 courses of your AI library.',  100000, 'public', 3),
  ('complete',     'Complete',     '15 courses of your AI library.', 150000, 'public', 4)
on conflict (slug) do nothing;

insert into public.offer_courses (offer_id, course_id)
select o.id, c.id
from public.offers o
join lateral (
  select id from public.courses order by sort_order
  limit case o.slug when 'starter' then 3 when 'professional' then 5 when 'enterprise' then 7 when 'complete' then 15 end
) c on true
where o.slug in ('starter','professional','enterprise','complete')
on conflict do nothing;
