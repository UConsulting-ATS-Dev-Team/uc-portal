-- Ramp's Ashby addresses spell "San Fransisco". The location parser now corrects it on the way in; this fixes
-- the rows written before that (jobs.locations is only back-filled while it is NULL, so they would stay wrong).
update jobs
   set city = 'San Francisco'
 where city in ('San Fransisco', 'San Franciso');

update jobs
   set locations = array_replace(array_replace(locations, 'San Fransisco, CA', 'San Francisco, CA'), 'San Franciso, CA', 'San Francisco, CA')
 where locations && array['San Fransisco, CA', 'San Franciso, CA'];
