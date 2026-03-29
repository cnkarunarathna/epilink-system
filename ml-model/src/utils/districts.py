"""
District Constants and Metadata for Sri Lanka

Contains district names, coordinates, and population data used across
both legacy and enhanced model implementations.
"""

from typing import Dict, Tuple

# All 25 districts of Sri Lanka
DISTRICTS = [
    "Colombo",
    "Gampaha",
    "Kalutara",
    "Kandy",
    "Matale",
    "NuwaraEliya",
    "Galle",
    "Matara",
    "Hambanthota",
    "Jaffna",
    "Kilinochchi",
    "Mannar",
    "Vavuniya",
    "Mullaitivu",
    "Batticaloa",
    "Ampara",
    "Trincomalee",
    "Kurunegala",
    "Puttalam",
    "Anuradhapura",
    "Polonnaruwa",
    "Badulla",
    "Monaragala",
    "Ratnapura",
    "Kegalle",
]

# District coordinates (latitude, longitude)
DISTRICT_COORDS: Dict[str, Tuple[float, float]] = {
    "Colombo": (6.9271, 79.8612),
    "Gampaha": (7.0917, 79.9994),
    "Kalutara": (6.5854, 79.9607),
    "Kandy": (7.2906, 80.6337),
    "Matale": (7.4675, 80.6234),
    "NuwaraEliya": (6.9497, 80.7891),
    "Galle": (6.0535, 80.2210),
    "Matara": (5.9549, 80.5550),
    "Hambanthota": (6.1248, 81.1010),
    "Jaffna": (9.6615, 80.0255),
    "Kilinochchi": (9.3951, 80.3987),
    "Mannar": (8.9770, 79.9046),
    "Vavuniya": (8.7514, 80.4970),
    "Mullaitivu": (9.2671, 80.8128),
    "Batticaloa": (7.7310, 81.6747),
    "Ampara": (7.3018, 81.6820),
    "Trincomalee": (8.5779, 81.2152),
    "Kurunegala": (7.4863, 80.3623),
    "Puttalam": (8.0400, 79.8390),
    "Anuradhapura": (8.3114, 80.4037),
    "Polonnaruwa": (7.9403, 81.0188),
    "Badulla": (6.9896, 81.0550),
    "Monaragala": (6.8710, 81.3487),
    "Ratnapura": (6.7056, 80.3847),
    "Kegalle": (7.2513, 80.3464),
}

# Population data (2022 estimates)
DISTRICT_POPULATION: Dict[str, int] = {
    "Colombo": 2421000,
    "Gampaha": 2324000,
    "Kalutara": 1266000,
    "Kandy": 1383000,
    "Matale": 510000,
    "NuwaraEliya": 737000,
    "Galle": 1074000,
    "Matara": 824000,
    "Hambanthota": 638000,
    "Jaffna": 614000,
    "Kilinochchi": 127000,
    "Mannar": 105000,
    "Vavuniya": 184000,
    "Mullaitivu": 101000,
    "Batticaloa": 558000,
    "Ampara": 727000,
    "Trincomalee": 421000,
    "Kurunegala": 1663000,
    "Puttalam": 803000,
    "Anuradhapura": 927000,
    "Polonnaruwa": 416000,
    "Badulla": 837000,
    "Monaragala": 479000,
    "Ratnapura": 1105000,
    "Kegalle": 848000,
}

# District area in km²
DISTRICT_AREA: Dict[str, int] = {
    "Colombo": 699,
    "Gampaha": 1387,
    "Kalutara": 1598,
    "Kandy": 1940,
    "Matale": 1993,
    "NuwaraEliya": 1741,
    "Galle": 1652,
    "Matara": 1283,
    "Hambanthota": 2609,
    "Jaffna": 1025,
    "Kilinochchi": 1205,
    "Mannar": 1996,
    "Vavuniya": 1967,
    "Mullaitivu": 2617,
    "Batticaloa": 2854,
    "Ampara": 4415,
    "Trincomalee": 2727,
    "Kurunegala": 4816,
    "Puttalam": 3072,
    "Anuradhapura": 7179,
    "Polonnaruwa": 3293,
    "Badulla": 2861,
    "Monaragala": 5639,
    "Ratnapura": 3275,
    "Kegalle": 1693,
}


def get_population_density(district: str) -> float:
    """Calculate population density (people per km²)."""
    if district in DISTRICT_POPULATION and district in DISTRICT_AREA:
        return DISTRICT_POPULATION[district] / DISTRICT_AREA[district]
    return 0.0


def get_district_coords(district: str) -> Tuple[float, float]:
    """Get coordinates for a district."""
    return DISTRICT_COORDS.get(district, (0.0, 0.0))
