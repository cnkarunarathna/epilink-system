import { faker } from '@faker-js/faker';
import { District } from '../../entities/district.entity';

const SRI_LANKA_DISTRICTS = [
  { name: 'Colombo', lat: 6.9271, lng: 79.8612 },
  { name: 'Gampaha', lat: 7.0917, lng: 79.9997 },
  { name: 'Kalutara', lat: 6.5854, lng: 79.9607 },
  { name: 'Kandy', lat: 7.2906, lng: 80.6337 },
  { name: 'Matale', lat: 7.4675, lng: 80.6234 },
  { name: 'Galle', lat: 6.0535, lng: 80.2210 },
  { name: 'Matara', lat: 5.9549, lng: 80.5550 },
  { name: 'Jaffna', lat: 9.6615, lng: 80.0255 },
];

let districtIdCounter = 1;

export function createMockDistrict(overrides: Partial<District> = {}): District {
  const base = faker.helpers.arrayElement(SRI_LANKA_DISTRICTS);
  return {
    id: districtIdCounter++,
    name: base.name,
    latitude: base.lat,
    longitude: base.lng,
    created_at: faker.date.past(),
    cases: [],
    weather: [],
    ...overrides,
  } as District;
}

export function resetDistrictIdCounter(): void {
  districtIdCounter = 1;
}
