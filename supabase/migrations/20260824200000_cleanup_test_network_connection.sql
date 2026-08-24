-- Removes a test row created while verifying the network_connections sync
-- (requestCoffeeChat/toggleSavedConnection) end-to-end -- the app itself
-- never deletes rows from this table (no delete grant exists, on purpose),
-- so this cleanup runs as a migration rather than through the client.
delete from network_connections where person_id = '4ae8beae-4fc4-4c9f-ac79-af55695b00e3';
