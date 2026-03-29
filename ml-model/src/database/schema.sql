-- EpiLink ML Model Database Schema

-- Drop tables if they exist (for fresh setup)
DROP TABLE IF EXISTS district_metadata CASCADE;
DROP TABLE IF EXISTS weather_data CASCADE;
DROP TABLE IF EXISTS dengue_cases CASCADE;
DROP TABLE IF EXISTS districts CASCADE;

-- Districts table
CREATE TABLE districts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    latitude DECIMAL(10, 7) NOT NULL,
    longitude DECIMAL(10, 7) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dengue cases table
CREATE TABLE dengue_cases (
    id SERIAL PRIMARY KEY,
    district_id INTEGER REFERENCES districts(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    week INTEGER NOT NULL,
    cases INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(district_id, year, week)
);

-- Weather data table (enhanced with humidity and wind speed)
CREATE TABLE weather_data (
    id SERIAL PRIMARY KEY,
    district_id INTEGER REFERENCES districts(id) ON DELETE CASCADE,
    year INTEGER NOT NULL,
    week INTEGER NOT NULL,
    temperature_2m_mean DECIMAL(5, 2),
    precipitation_sum DECIMAL(7, 2),
    relative_humidity_mean DECIMAL(5, 2),
    wind_speed_max DECIMAL(5, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(district_id, year, week)
);

-- District metadata table (for population density and urbanization)
CREATE TABLE district_metadata (
    id SERIAL PRIMARY KEY,
    district_id INTEGER REFERENCES districts(id) ON DELETE CASCADE,
    population INTEGER,
    area_sq_km DECIMAL(10, 2),
    population_density DECIMAL(10, 2),
    urbanization_level VARCHAR(20) CHECK (urbanization_level IN ('high', 'medium', 'low')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(district_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_dengue_cases_district_year_week ON dengue_cases(district_id, year, week);
CREATE INDEX idx_weather_data_district_year_week ON weather_data(district_id, year, week);
CREATE INDEX idx_districts_name ON districts(name);

-- Insert district coordinates
INSERT INTO districts (name, latitude, longitude) VALUES
    ('Colombo', 6.9271, 79.8612),
    ('Gampaha', 7.0917, 79.9994),
    ('Kalutara', 6.5854, 79.9607),
    ('Kandy', 7.2906, 80.6337),
    ('Matale', 7.4675, 80.6234),
    ('NuwaraEliya', 6.9497, 80.7891),
    ('Galle', 6.0535, 80.2210),
    ('Matara', 5.9549, 80.5550),
    ('Hambanthota', 6.1248, 81.1010),
    ('Jaffna', 9.6615, 80.0255),
    ('Kilinochchi', 9.3951, 80.3987),
    ('Mannar', 8.9770, 79.9046),
    ('Vavuniya', 8.7514, 80.4970),
    ('Mullaitivu', 9.2671, 80.8128),
    ('Batticaloa', 7.7310, 81.6747),
    ('Ampara', 7.3018, 81.6820),
    ('Trincomalee', 8.5779, 81.2152),
    ('Kurunegala', 7.4863, 80.3623),
    ('Puttalam', 8.0400, 79.8390),
    ('Anuradhapura', 8.3114, 80.4037),
    ('Polonnaruwa', 7.9403, 81.0188),
    ('Badulla', 6.9896, 81.0550),
    ('Monaragala', 6.8710, 81.3487),
    ('Ratnapura', 6.7056, 80.3847),
    ('Kegalle', 7.2513, 80.3464);

-- Insert district metadata (population data from Sri Lanka Census 2022 estimates)
-- Population density calculated as population / area_sq_km
INSERT INTO district_metadata (district_id, population, area_sq_km, population_density, urbanization_level)
SELECT d.id, v.population, v.area_sq_km, 
       ROUND(v.population::numeric / v.area_sq_km::numeric, 2) as population_density,
       v.urbanization_level
FROM districts d
JOIN (VALUES
    ('Colombo', 2421000, 699, 'high'),
    ('Gampaha', 2304000, 1387, 'high'),
    ('Kalutara', 1262000, 1598, 'medium'),
    ('Kandy', 1369000, 1940, 'medium'),
    ('Matale', 496000, 1993, 'low'),
    ('NuwaraEliya', 737000, 1741, 'low'),
    ('Galle', 1063000, 1652, 'medium'),
    ('Matara', 826000, 1283, 'medium'),
    ('Hambanthota', 638000, 2609, 'low'),
    ('Jaffna', 614000, 1025, 'medium'),
    ('Kilinochchi', 143000, 1279, 'low'),
    ('Mannar', 105000, 1996, 'low'),
    ('Vavuniya', 172000, 1967, 'low'),
    ('Mullaitivu', 147000, 2617, 'low'),
    ('Batticaloa', 549000, 2854, 'low'),
    ('Ampara', 665000, 4415, 'low'),
    ('Trincomalee', 409000, 2727, 'low'),
    ('Kurunegala', 1618000, 4816, 'medium'),
    ('Puttalam', 788000, 3072, 'low'),
    ('Anuradhapura', 901000, 7179, 'low'),
    ('Polonnaruwa', 419000, 3293, 'low'),
    ('Badulla', 867000, 2861, 'low'),
    ('Monaragala', 478000, 5639, 'low'),
    ('Ratnapura', 1088000, 3275, 'medium'),
    ('Kegalle', 851000, 1693, 'medium')
) AS v(name, population, area_sq_km, urbanization_level)
ON d.name = v.name;
