import { DataSource } from 'typeorm';
import { District } from '../entities/district.entity';
import { DengueCase } from '../entities/dengue_case.entity';
import { WeatherData } from '../entities/weather_data.entity';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Backfill district names based on coordinates
 * Run this script to populate NULL district names in the database
 *
 * Usage:
 *   npx ts-node src/scripts/backfill-districts.ts
 */

// District mapping based on exact coordinates
const DISTRICT_COORDINATES = [
  { name: 'Matara', lat: 5.9549, lon: 80.555 },
  { name: 'Galle', lat: 6.0535, lon: 80.221 },
  { name: 'Hambanthota', lat: 6.1248, lon: 81.101 },
  { name: 'Kalutara', lat: 6.5854, lon: 79.9607 },
  { name: 'Ratnapura', lat: 6.7056, lon: 80.3847 },
  { name: 'Monaragala', lat: 6.871, lon: 81.3487 },
  { name: 'Colombo', lat: 6.9271, lon: 79.8612 },
  { name: 'NuwaraEliya', lat: 6.9497, lon: 80.7891 },
  { name: 'Badulla', lat: 6.9896, lon: 81.055 },
  { name: 'Gampaha', lat: 7.0917, lon: 79.9994 },
  { name: 'Kegalle', lat: 7.2513, lon: 80.3464 },
  { name: 'Kandy', lat: 7.2906, lon: 80.6337 },
  { name: 'Ampara', lat: 7.3018, lon: 81.682 },
  { name: 'Matale', lat: 7.4675, lon: 80.6234 },
  { name: 'Kurunegala', lat: 7.4863, lon: 80.3623 },
  { name: 'Batticaloa', lat: 7.731, lon: 81.6747 },
  { name: 'Polonnaruwa', lat: 7.9403, lon: 81.0188 },
  { name: 'Puttalam', lat: 8.04, lon: 79.839 },
  { name: 'Anuradhapura', lat: 8.3114, lon: 80.4037 },
  { name: 'Trincomalee', lat: 8.5779, lon: 81.2152 },
  { name: 'Vavuniya', lat: 8.7514, lon: 80.497 },
  { name: 'Mannar', lat: 8.977, lon: 79.9046 },
  { name: 'Mullaitivu', lat: 9.2671, lon: 80.8128 },
  { name: 'Kilinochchi', lat: 9.3951, lon: 80.3987 },
  { name: 'Jaffna', lat: 9.6615, lon: 80.0255 },
];

async function backfillDistrictNames() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.PGHOST,
    port: parseInt(process.env.PGPORT || '5432', 10),
    username: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    entities: [District, DengueCase, WeatherData],
    synchronize: false,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  try {
    await dataSource.initialize();
    console.log('Connected to database');

    const districtRepo = dataSource.getRepository(District);

    // Get all districts with NULL names using IsNull operator
    const nullDistricts = await districtRepo
      .createQueryBuilder('district')
      .where('district.name IS NULL')
      .getMany();
    console.log(`Found ${nullDistricts.length} districts with NULL names`);

    let updated = 0;
    for (const district of nullDistricts) {
      // Find matching name based on coordinates (with tolerance of 0.01)
      const match = DISTRICT_COORDINATES.find(
        (d) =>
          Math.abs(Number(district.latitude) - d.lat) < 0.01 &&
          Math.abs(Number(district.longitude) - d.lon) < 0.01,
      );

      if (match) {
        district.name = match.name;
        await districtRepo.save(district);
        console.log(
          `Updated district ${district.id}: ${match.name} (${district.latitude}, ${district.longitude})`,
        );
        updated++;
      } else {
        console.warn(
          `No match found for district ${district.id} at (${district.latitude}, ${district.longitude})`,
        );
      }
    }

    console.log(`\nSuccessfully updated ${updated} districts`);

    // Verify results
    const remainingNull = await districtRepo
      .createQueryBuilder('district')
      .where('district.name IS NULL')
      .getCount();
    console.log(`Remaining NULL districts: ${remainingNull}`);

    await dataSource.destroy();
  } catch (error) {
    console.error('Error backfilling districts:', error);
    process.exit(1);
  }
}

backfillDistrictNames();
