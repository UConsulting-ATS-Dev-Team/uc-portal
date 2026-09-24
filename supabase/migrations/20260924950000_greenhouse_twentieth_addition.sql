-- Twentieth addition: one more Greenhouse company, Abnormal Security --
-- checked a cybersecurity/gaming batch after the Nineteenth addition's
-- proptech pass. Confirmed the live starting count via direct Postgres
-- query first (167 total approved company sources, matching the
-- Nineteenth addition's own closing figure).
--
-- Seven of nine candidates checked in this batch were already live
-- sources from earlier passes -- confirmed directly against the sources
-- table before spending any verification effort on them: Netskope,
-- Zscaler, Discord, Roblox, Epic Games, Twitch, Riot Games. Not
-- re-checked or re-added.
--
-- One identity rejection, same slug-squatting risk class every prior
-- addition has flagged: "orca" (Greenhouse) resolves but company_name
-- says "ORCA Service Technologies" -- a small UK IT support/sales
-- company based in Maidenhead (titles: "Business Development Manager -
-- Software Sales", "IT Support Apprentice"), not the real Orca Security
-- (cloud security unicorn). Excluded.
--
-- One real hit: **Abnormal Security** -- real, well-known AI-based
-- email/behavioral cybersecurity unicorn (~$5B+ valuation). Greenhouse
-- slug "abnormalsecurity", company_name "Abnormal" (the real firm's own
-- short brand form) verified. 84 postings, genuinely large and diverse:
-- "FedRamp Compliance Analyst", "Senior Cloud Security Engineer (AWS)",
-- "Software Engineer II - Identity Security Posture Management (ISPM)",
-- "Software Engineer - Behavioral Security Products", "Software Engineer
-- II - Message Security Detection" are all specific to Abnormal
-- Security's actual real product lines (behavioral/AI email security,
-- identity security posture management) -- not generic titles that could
-- belong to an unrelated company. 84 of 84 sampled titles survive the
-- relevance filter locally (checked against isLikelyNonCorporateRole()
-- in server/src/relevance.ts) -- a genuinely large, 100% white-collar
-- SaaS-company board; will be capped to 30 active.
--
-- Does not match a NAMED_COMPANY_RATES entry in
-- data/industryBaseRates.js -- falls through to that module's broader
-- industry-tier fallback.
--
-- Inherits Part 1's white-collar relevance filter and Part 2's
-- MAX_ACTIVE_JOBS_PER_COMPANY=30 cap automatically -- config-only, no
-- adapter code changes. Total company job-listing sources after this
-- addition: 168.
insert into sources (name, type, authorization_status, api_available, rate_limits, attribution_required, storage_restrictions, redistribution_restricted, notes, config)
values
  (
    'Abnormal Security (Greenhouse Job Board API)', 'employer_api', 'approved', true,
    'Polled once daily via pg_cron alongside every other Greenhouse company.',
    false,
    'Do not store full job description text -- same policy as every Greenhouse source in this app.',
    false,
    'Public, unauthenticated Job Board API at boards-api.greenhouse.io/v1/boards/abnormalsecurity/jobs. company_name verified to say "Abnormal" (the real firm''s own short brand form). Real, well-known AI-based email/behavioral cybersecurity unicorn (~$5B+ valuation). "FedRamp Compliance Analyst", "Software Engineer II - Identity Security Posture Management (ISPM)" titles are specific to Abnormal Security''s actual real product lines. 84 of 84 sampled titles survive the relevance filter locally; will be capped to 30 active.',
    '{"platform": "greenhouse", "slug": "abnormalsecurity", "company": "Abnormal"}'::jsonb
  );
