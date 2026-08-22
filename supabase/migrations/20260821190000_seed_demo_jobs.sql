-- Seeds the 10 jobs from data/mockJobs.js into the real jobs table, so
-- there's real data to build and test real search against (Stage 2).
-- Deliberately NOT a 1:1 copy -- several mock fields describe things the
-- real schema doesn't store on a job record at all, by design:
--   - matchScore, whyLowerMatch: computed per-member at query time, never
--     stored on the job itself (that's what server/src/match.ts is for)
--   - ucConnections, pastCycleApplicants, pastCycleOffers: come from the
--     CRM boundary (Part 3.6), which stays mocked until a real CRM read
--     API exists -- storing them here would be fabricating UC-intelligence
--     data outside its actual source
--   - ucPosted, referralAvailable, companySize, logoInitials: prototype/
--     display concepts with no equivalent column in this schema
-- application_url is a placeholder (example.com) for every row -- the
-- mock data never had real employer URLs either ("Apply" has no real
-- destination in the prototype, per CLAUDE.md), so this isn't a regression,
-- just made explicit instead of silently absent.
-- posted_date is computed against the mock data's own stated "today"
-- (2026-08-18, per mockJobs.js's file comment), not the real current date,
-- so the postedDaysAgo values translate consistently.

insert into jobs (
  company, title, employment_type, application_url, city, remote_type,
  salary_min, salary_max, compensation_type, compensation_text,
  posted_date, application_deadline, graduation_years, relevant_industries,
  classification_method
) values
  ('Bain & Company', 'Associate Consultant Intern', 'internship', 'https://example.com/careers/bain-consulting-intern', 'Chicago', 'in_person', 45, 45, 'hourly', '$45/hr', '2026-08-15', '2026-09-12', array[2027,2028], array['Management consulting'], 'source_stated'),
  ('McKinsey & Company', 'Business Analyst Intern', 'internship', 'https://example.com/careers/mckinsey-generalist-intern', 'New York', 'in_person', 48, 48, 'hourly', '$48/hr', '2026-08-12', '2026-08-29', array[2027,2028], array['Management consulting'], 'source_stated'),
  ('Deloitte', 'Human Capital Consulting Intern', 'internship', 'https://example.com/careers/deloitte-human-capital', 'Chicago', 'hybrid', 38, 38, 'hourly', '$38/hr', '2026-08-17', '2026-09-20', array[2026,2027,2028], array['Management consulting'], 'source_stated'),
  ('Stripe', 'Strategy & Ops Intern', 'internship', 'https://example.com/careers/stripe-strategy-ops', 'San Francisco', 'in_person', 52, 52, 'hourly', '$52/hr', '2026-08-09', '2026-08-25', array[2027], array['Tech / product strategy'], 'source_stated'),
  ('Goldman Sachs', 'IBD Summer Analyst', 'internship', 'https://example.com/careers/goldman-ibd-summer', 'New York', 'in_person', 50, 50, 'hourly', '$50/hr', '2026-08-06', '2026-08-21', array[2027], array['Investment banking'], 'source_stated'),
  ('BCG', 'Summer Associate', 'internship', 'https://example.com/careers/bcg-summer-associate', 'Los Angeles', 'in_person', 46, 46, 'hourly', '$46/hr', '2026-08-14', '2026-10-03', array[2027,2028], array['Management consulting'], 'source_stated'),
  ('EY-Parthenon', 'Strategy Spring Week', 'externship', 'https://example.com/careers/ey-parthenon-spring-week', 'Chicago', 'in_person', 30, 30, 'hourly', '$30/hr', '2026-08-16', '2026-09-05', array[2028,2029], array['Management consulting'], 'source_stated'),
  ('Accenture', 'Strategy & Consulting Analyst', 'full_time', 'https://example.com/careers/accenture-strategy-fulltime', null, 'remote', null, null, 'salary', '$70k/yr', '2026-08-03', '2026-12-01', array[2026], array['Management consulting'], 'source_stated'),
  ('Goldman Sachs', 'Asset Management Analyst', 'full_time', 'https://example.com/careers/goldman-am-fulltime', 'New York', 'in_person', null, null, 'salary', '$85k/yr', '2026-07-29', '2026-08-19', array[2026], array['Investment banking'], 'source_stated'),
  ('Stripe', 'Business Operations Associate', 'full_time', 'https://example.com/careers/stripe-rolling-ops', null, 'remote', null, null, 'salary', '$80k/yr', '2026-08-11', null, array[2026,2027], array['Tech / product strategy'], 'source_stated');
