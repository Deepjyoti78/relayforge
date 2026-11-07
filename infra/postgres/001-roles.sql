-- LOCAL DEVELOPMENT ONLY. Production must provision unique passwords externally.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;

CREATE ROLE relayforge_api LOGIN PASSWORD 'relayforge_api_local'
    NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
CREATE ROLE relayforge_worker LOGIN PASSWORD 'relayforge_worker_local'
    NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;

GRANT USAGE ON SCHEMA public TO relayforge_api, relayforge_worker;
