-- Seeds industries/job_functions so the tables aren't empty once this is
-- applied. industries matches the existing frontend's data/careerOptions.js
-- INDUSTRIES list exactly, so the real backend and the current mock-data
-- prototype agree on the same vocabulary from day one. job_functions matches
-- the occupation categories server/src/taxonomy/occupationTaxonomy.ts's
-- stub already classifies jobs into (Part 10).

insert into industries (name, sort_order) values
  ('Management consulting', 0),
  ('Investment banking', 1),
  ('Tech / product strategy', 2),
  ('Private equity', 3),
  ('Marketing & brand strategy', 4),
  ('Nonprofit / public sector', 5),
  ('Healthcare', 6),
  ('Real estate', 7),
  ('Still figuring it out', 8);

insert into job_functions (name, sort_order) values
  ('Consulting', 0),
  ('Investment Banking', 1),
  ('Product Management', 2),
  ('Software Engineering', 3),
  ('Marketing', 4),
  ('Operations', 5);
