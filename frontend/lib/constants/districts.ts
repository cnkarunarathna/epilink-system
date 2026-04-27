export interface DistrictMeta {
  id: number;
  name: string;
  code: string;
  province: string;
  population: number;
}

export const PROVINCES = [
  "Western",
  "Central",
  "Southern",
  "Northern",
  "Eastern",
  "North Western",
  "North Central",
  "Uva",
  "Sabaragamuwa",
] as const;

export const DISTRICTS: DistrictMeta[] = [
  // Western
  { id: 1, name: "Colombo", code: "COL", province: "Western", population: 2324349 },
  { id: 2, name: "Gampaha", code: "GAM", province: "Western", population: 2304833 },
  { id: 3, name: "Kalutara", code: "KAL", province: "Western", population: 1221948 },
  // Central
  { id: 4, name: "Kandy", code: "KAN", province: "Central", population: 1375382 },
  { id: 5, name: "Matale", code: "MTL", province: "Central", population: 489976 },
  { id: 6, name: "Nuwara Eliya", code: "NUE", province: "Central", population: 711644 },
  // Southern
  { id: 7, name: "Galle", code: "GAL", province: "Southern", population: 1063334 },
  { id: 8, name: "Matara", code: "MAT", province: "Southern", population: 814535 },
  { id: 9, name: "Hambantota", code: "HAM", province: "Southern", population: 599903 },
  // Northern
  { id: 10, name: "Jaffna", code: "JAF", province: "Northern", population: 583882 },
  { id: 11, name: "Kilinochchi", code: "KIL", province: "Northern", population: 113510 },
  { id: 12, name: "Mannar", code: "MAN", province: "Northern", population: 99051 },
  { id: 13, name: "Mullaitivu", code: "MUL", province: "Northern", population: 92238 },
  { id: 14, name: "Vavuniya", code: "VAV", province: "Northern", population: 172081 },
  // Eastern
  { id: 15, name: "Ampara", code: "AMP", province: "Eastern", population: 649402 },
  { id: 16, name: "Batticaloa", code: "BAT", province: "Eastern", population: 526567 },
  { id: 17, name: "Trincomalee", code: "TRI", province: "Eastern", population: 379541 },
  // North Western
  { id: 18, name: "Kurunegala", code: "KUR", province: "North Western", population: 1618465 },
  { id: 19, name: "Puttalam", code: "PUT", province: "North Western", population: 762396 },
  // North Central
  { id: 20, name: "Anuradhapura", code: "ANU", province: "North Central", population: 856232 },
  { id: 21, name: "Polonnaruwa", code: "POL", province: "North Central", population: 406088 },
  // Uva
  { id: 22, name: "Badulla", code: "BAD", province: "Uva", population: 895436 },
  { id: 23, name: "Monaragala", code: "MON", province: "Uva", population: 451058 },
  // Sabaragamuwa
  { id: 24, name: "Kegalle", code: "KEG", province: "Sabaragamuwa", population: 840648 },
  { id: 25, name: "Ratnapura", code: "RAT", province: "Sabaragamuwa", population: 1088007 },
];
