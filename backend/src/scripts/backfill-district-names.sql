-- Backfill district names based on exact coordinates from the database
-- This maps the existing district records to their proper names

-- Show current state
SELECT id, name, latitude, longitude FROM districts ORDER BY latitude;

-- Update district names based on exact coordinates
-- Using precise coordinate matching with small tolerance (±0.01)

UPDATE districts SET name = 'Matara' WHERE ABS(latitude - 5.9549) < 0.01 AND ABS(longitude - 80.555) < 0.01 AND name IS NULL;
UPDATE districts SET name = 'Galle' WHERE ABS(latitude - 6.0535) < 0.01 AND ABS(longitude - 80.221) < 0.01 AND name IS NULL;
UPDATE districts SET name = 'Hambanthota' WHERE ABS(latitude - 6.1248) < 0.01 AND ABS(longitude - 81.101) < 0.01 AND name IS NULL;
UPDATE districts SET name = 'Kalutara' WHERE ABS(latitude - 6.5854) < 0.01 AND ABS(longitude - 79.9607) < 0.01 AND name IS NULL;
UPDATE districts SET name = 'Ratnapura' WHERE ABS(latitude - 6.7056) < 0.01 AND ABS(longitude - 80.3847) < 0.01 AND name IS NULL;
UPDATE districts SET name = 'Monaragala' WHERE ABS(latitude - 6.871) < 0.01 AND ABS(longitude - 81.3487) < 0.01 AND name IS NULL;
UPDATE districts SET name = 'Colombo' WHERE ABS(latitude - 6.9271) < 0.01 AND ABS(longitude - 79.8612) < 0.01 AND name IS NULL;
UPDATE districts SET name = 'NuwaraEliya' WHERE ABS(latitude - 6.9497) < 0.01 AND ABS(longitude - 80.7891) < 0.01 AND name IS NULL;
UPDATE districts SET name = 'Badulla' WHERE ABS(latitude - 6.9896) < 0.01 AND ABS(longitude - 81.055) < 0.01 AND name IS NULL;
UPDATE districts SET name = 'Gampaha' WHERE ABS(latitude - 7.0917) < 0.01 AND ABS(longitude - 79.9994) < 0.01 AND name IS NULL;
UPDATE districts SET name = 'Kegalle' WHERE ABS(latitude - 7.2513) < 0.01 AND ABS(longitude - 80.3464) < 0.01 AND name IS NULL;
UPDATE districts SET name = 'Kandy' WHERE ABS(latitude - 7.2906) < 0.01 AND ABS(longitude - 80.6337) < 0.01 AND name IS NULL;
UPDATE districts SET name = 'Ampara' WHERE ABS(latitude - 7.3018) < 0.01 AND ABS(longitude - 81.682) < 0.01 AND name IS NULL;
UPDATE districts SET name = 'Matale' WHERE ABS(latitude - 7.4675) < 0.01 AND ABS(longitude - 80.6234) < 0.01 AND name IS NULL;
UPDATE districts SET name = 'Kurunegala' WHERE ABS(latitude - 7.4863) < 0.01 AND ABS(longitude - 80.3623) < 0.01 AND name IS NULL;
UPDATE districts SET name = 'Batticaloa' WHERE ABS(latitude - 7.731) < 0.01 AND ABS(longitude - 81.6747) < 0.01 AND name IS NULL;
UPDATE districts SET name = 'Polonnaruwa' WHERE ABS(latitude - 7.9403) < 0.01 AND ABS(longitude - 81.0188) < 0.01 AND name IS NULL;
UPDATE districts SET name = 'Puttalam' WHERE ABS(latitude - 8.04) < 0.01 AND ABS(longitude - 79.839) < 0.01 AND name IS NULL;
UPDATE districts SET name = 'Anuradhapura' WHERE ABS(latitude - 8.3114) < 0.01 AND ABS(longitude - 80.4037) < 0.01 AND name IS NULL;
UPDATE districts SET name = 'Trincomalee' WHERE ABS(latitude - 8.5779) < 0.01 AND ABS(longitude - 81.2152) < 0.01 AND name IS NULL;
UPDATE districts SET name = 'Vavuniya' WHERE ABS(latitude - 8.7514) < 0.01 AND ABS(longitude - 80.497) < 0.01 AND name IS NULL;
UPDATE districts SET name = 'Mannar' WHERE ABS(latitude - 8.977) < 0.01 AND ABS(longitude - 79.9046) < 0.01 AND name IS NULL;
UPDATE districts SET name = 'Mullaitivu' WHERE ABS(latitude - 9.2671) < 0.01 AND ABS(longitude - 80.8128) < 0.01 AND name IS NULL;
UPDATE districts SET name = 'Kilinochchi' WHERE ABS(latitude - 9.3951) < 0.01 AND ABS(longitude - 80.3987) < 0.01 AND name IS NULL;
UPDATE districts SET name = 'Jaffna' WHERE ABS(latitude - 9.6615) < 0.01 AND ABS(longitude - 80.0255) < 0.01 AND name IS NULL;

-- Verify the update
SELECT id, name, latitude, longitude FROM districts ORDER BY name;
