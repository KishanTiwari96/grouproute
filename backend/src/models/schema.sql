-- ==========================================================
-- GroupRoute Production Database Schema (PostgreSQL + PostGIS)
-- ==========================================================

-- Enable PostGIS extension for geographic calculations
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS postgis;

-- 1. Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    profile_image TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 2. Groups Table
CREATE TABLE IF NOT EXISTS groups (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    name VARCHAR(255) NOT NULL,
    invite_code VARCHAR(32) UNIQUE NOT NULL,
    created_by VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_groups_invite_code ON groups(invite_code);

-- 3. Group Members Table
CREATE TABLE IF NOT EXISTS group_members (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    group_id VARCHAR(64) REFERENCES groups(id) ON DELETE CASCADE,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(32) NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('OWNER', 'MEMBER')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);

-- 4. Trips Table
CREATE TABLE IF NOT EXISTS trips (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    group_id VARCHAR(64) REFERENCES groups(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    origin VARCHAR(255) NOT NULL,
    destination VARCHAR(255) NOT NULL,
    origin_lat DOUBLE PRECISION NOT NULL,
    origin_lng DOUBLE PRECISION NOT NULL,
    destination_lat DOUBLE PRECISION NOT NULL,
    destination_lng DOUBLE PRECISION NOT NULL,
    route_polyline TEXT DEFAULT '',
    distance VARCHAR(64) DEFAULT '',
    estimated_duration VARCHAR(64) DEFAULT '',
    status VARCHAR(32) NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED')),
    started_at TIMESTAMP WITH TIME ZONE,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trips_group ON trips(group_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);

-- 5. Trip Members Table
CREATE TABLE IF NOT EXISTS trip_members (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    trip_id VARCHAR(64) REFERENCES trips(id) ON DELETE CASCADE,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    location_sharing BOOLEAN NOT NULL DEFAULT FALSE,
    sharing_started_at TIMESTAMP WITH TIME ZONE,
    sharing_ended_at TIMESTAMP WITH TIME ZONE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(trip_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_members_trip ON trip_members(trip_id);

-- 6. Locations Table (Historical Raw Telemetry)
CREATE TABLE IF NOT EXISTS locations (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    trip_id VARCHAR(64) REFERENCES trips(id) ON DELETE CASCADE,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    accuracy DOUBLE PRECISION DEFAULT 10.0,
    speed DOUBLE PRECISION DEFAULT 0.0,
    heading DOUBLE PRECISION DEFAULT 0.0,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_locations_trip_user ON locations(trip_id, user_id);
CREATE INDEX IF NOT EXISTS idx_locations_recorded_at ON locations(recorded_at DESC);

-- 7. Stops Table
CREATE TABLE IF NOT EXISTS stops (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    trip_id VARCHAR(64) REFERENCES trips(id) ON DELETE CASCADE,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    location_name VARCHAR(255) DEFAULT 'Unknown Location',
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_stops_trip ON stops(trip_id);
CREATE INDEX IF NOT EXISTS idx_stops_user ON stops(user_id);

-- 8. Trip Events Table
CREATE TABLE IF NOT EXISTS trip_events (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    trip_id VARCHAR(64) REFERENCES trips(id) ON DELETE CASCADE,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    event_type VARCHAR(64) NOT NULL CHECK (event_type IN (
        'TRIP_STARTED',
        'TRIP_COMPLETED',
        'MEMBER_JOINED',
        'MEMBER_LEFT',
        'STOP_STARTED',
        'STOP_ENDED',
        'MEMBER_FELL_BEHIND',
        'GROUP_SPLIT',
        'MEMBER_REJOINED'
    )),
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_trip_events_trip ON trip_events(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_events_type ON trip_events(event_type);
CREATE INDEX IF NOT EXISTS idx_trip_events_created ON trip_events(created_at DESC);

-- 9. Trip Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(64) PRIMARY KEY DEFAULT uuid_generate_v4()::text,
    trip_id VARCHAR(64) REFERENCES trips(id) ON DELETE CASCADE,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    user_name VARCHAR(255) NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_trip ON chat_messages(trip_id, created_at);
