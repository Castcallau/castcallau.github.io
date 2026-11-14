// Species knowledge base for NSW saltwater fishing.
// season: Jan..Dec rating 0 (rare) – 3 (peak)
// temp: preferred sea-surface temperature range (°C)
// tod: how active at dawn / day / dusk / night (0–1)
// tide: preferred tide state: 'rising' | 'falling' | 'change' | 'any'
// size/bag: GUIDE ONLY – rules change, always check NSW DPI before keeping fish.
window.FISH = window.FISH || {};
FISH.SPECIES = {
  bream: {
    name: 'Yellowfin Bream', sci: 'Acanthopagrus australis',
    season: [2,2,2,2,3,3,3,3,2,2,2,2], temp: [14, 26],
    tod: { dawn: 1, day: 0.55, dusk: 1, night: 0.85 }, tide: 'rising', whiteWater: true,
    habitat: 'Everywhere – oyster racks, wharves, rock walls, snags, washes.',
    baits: ['Peeled prawn', 'Live nippers (yabbies)', 'Mullet / tuna strip', 'Pilchard pieces', 'Bread (berley with it)'],
    lures: ['2–3" soft plastic grubs on 1/16–1/8oz jighead', 'Small deep-diving hardbody crankbaits', 'Surface poppers / walkers in summer'],
    rig: 'Running ball sinker (as light as possible) to a #1–1/0 hook on 6–8lb fluorocarbon. Unweighted baits drifted in a berley trail work best around structure.',
    size: '25 cm', bag: '20 (combined bream)',
    tips: 'Big bream spawn around river mouths and breakwalls in winter. Berley lightly and fish the first two hours of the run-in tide.'
  },
  flathead: {
    name: 'Dusky Flathead', sci: 'Platycephalus fuscus',
    season: [3,3,3,2,1,1,1,1,2,3,3,3], temp: [17, 27],
    tod: { dawn: 0.9, day: 0.85, dusk: 0.9, night: 0.4 }, tide: 'falling',
    habitat: 'Sand and mud flats, weed edges, drop-offs and channel edges in estuaries.',
    baits: ['Live poddy mullet', 'Whole prawn', 'Pilchard / whitebait', 'Fresh mullet strip'],
    lures: ['3–5" paddle-tail soft plastics hopped on the bottom', 'Blade / vibe lures', 'Shallow hardbodies over flats'],
    rig: 'Running sinker down to a swivel, 60 cm of 15–20lb leader (they have sharp gill plates) and a 1/0–3/0 long-shank hook.',
    size: '36 cm', bag: '10 (only 1 over 70 cm)',
    tips: 'Fish the last half of the run-out tide where bait drains off the flats. Drift or walk the edges – flathead ambush, so keep moving until you find them.'
  },
  whiting: {
    name: 'Sand Whiting', sci: 'Sillago ciliata',
    season: [3,3,3,2,1,0,0,0,1,2,3,3], temp: [19, 28],
    tod: { dawn: 0.75, day: 0.9, dusk: 0.9, night: 0.55 }, tide: 'rising',
    habitat: 'Shallow sand flats, beach gutters and channel edges.',
    baits: ['Beach worms', 'Bloodworms', 'Live nippers (yabbies)', 'Pipis', 'Peeled prawn'],
    lures: ['Small surface poppers / stickbaits (summer, hot flats)', 'Tiny worm-imitation soft plastics'],
    rig: 'Long-leader running sinker rig: small ball sinker, 1 m of 6lb leader, #4–#6 long-shank hook, a couple of red beads above the hook.',
    size: '27 cm', bag: '20',
    tips: 'Wade or drift the flats on the rising tide. Keep baits moving slowly – whiting love a slowly retrieved worm.'
  },
  tailor: {
    name: 'Tailor', sci: 'Pomatomus saltatrix',
    season: [1,1,2,3,3,3,3,2,2,1,1,1], temp: [16, 23],
    tod: { dawn: 1, day: 0.4, dusk: 1, night: 0.6 }, tide: 'rising', whiteWater: true,
    habitat: 'Beach gutters, rock washes, breakwall ends, harbour points.',
    baits: ['Pilchard on gang hooks', 'Garfish', 'Fresh bonito / mullet strip'],
    lures: ['20–40g metal slugs (fast retrieve)', 'Surface poppers', 'Shallow minnows'],
    rig: 'Ganged 3–4 × 3/0–4/0 hooks through a whole pilchard, 15–20lb line, little or no sinker in the wash.',
    size: '30 cm', bag: '10',
    tips: 'Classic dawn and dusk fish. Look for birds working baitfish. Bleed and ice them straight away – they spoil fast.'
  },
  salmon: {
    name: 'Australian Salmon', sci: 'Arripis trutta',
    season: [1,1,2,3,3,3,3,3,2,1,1,1], temp: [13, 20],
    tod: { dawn: 1, day: 0.75, dusk: 0.9, night: 0.3 }, tide: 'any', whiteWater: true,
    habitat: 'Surf beach gutters, rock platforms, harbour and estuary mouths.',
    baits: ['Pilchard on gang hooks', 'Beach worms', 'Peeled prawn', 'Bluebait'],
    lures: ['Metal slugs 20–60g', '3–5" soft plastic minnows', 'Poppers when schools are surface feeding'],
    rig: 'Gang hooks or a paternoster rig with a sinker on the bottom in the surf. 15–20lb line.',
    size: '30 cm', bag: '5',
    tips: 'Find the deep, darker gutter between sand banks. Schools move – cast metals ahead of surface-feeding schools.'
  },
  mulloway: {
    name: 'Mulloway (Jewfish)', sci: 'Argyrosomus japonicus',
    season: [3,3,3,3,2,2,1,1,2,2,3,3], temp: [17, 26],
    tod: { dawn: 0.75, day: 0.25, dusk: 0.9, night: 1 }, tide: 'change', moon: true,
    habitat: 'Deep holes in rivers, bridge pylons, breakwalls, beach gutters at night.',
    baits: ['Live mullet / yellowtail / squid', 'Fresh squid strips or heads', 'Fresh tailor / bonito fillet', 'Whole pilchard (fresh, not stale)'],
    lures: ['5–7" soft plastics on 3/8–1oz jigheads', 'Large vibes worked slowly at night'],
    rig: 'Running sinker or snelled two-hook rig (6/0–8/0) on 40–60lb leader. Leave the bail arm open or drag light for the run.',
    size: '70 cm', bag: '2',
    tips: 'Tide changes after dark around new and full moons are prime. Discoloured water after rain fires them up in the rivers.'
  },
  luderick: {
    name: 'Luderick (Blackfish)', sci: 'Girella tricuspidata',
    season: [1,1,2,3,3,3,3,3,2,2,1,1], temp: [14, 22],
    tod: { dawn: 0.8, day: 0.9, dusk: 0.75, night: 0.15 }, tide: 'any', whiteWater: true,
    habitat: 'Weed beds, breakwalls, rock washes, bridge pylons.',
    baits: ['Green weed (tidal ribbon weed)', 'Cabbage weed (on the rocks)', 'Squirt worms'],
    lures: ['Not a lure fish – weed or cabbage only'],
    rig: 'Stemmed float with split shot to sit the bait just above the weed, #8–#10 hook, 6lb line. Berley with chopped weed and sand.',
    size: '27 cm', bag: '20',
    tips: 'Collect weed from the same area you fish. Moving water along a wall with a slight wash is perfect.'
  },
  kingfish: {
    name: 'Yellowtail Kingfish', sci: 'Seriola lalandi',
    season: [3,3,3,3,2,1,1,1,1,2,3,3], temp: [17, 24],
    tod: { dawn: 1, day: 0.65, dusk: 0.85, night: 0.2 }, tide: 'change',
    habitat: 'Headlands, deep rock ledges, harbour markers, offshore reefs.',
    baits: ['Live squid', 'Live yellowtail (yakkas) or slimy mackerel', 'Strip baits on a downrigger'],
    lures: ['Surface stickbaits / poppers', 'Metal jigs 60–200g', '6–7" soft plastic jerkbaits'],
    rig: 'Livebait on a 6/0–8/0 circle hook, 40–60lb leader. Lock the drag – they head straight for the reef.',
    size: '65 cm', bag: '5',
    tips: 'Find bait schools and you find kings. Tide changes at dawn around headlands and markers are the go.'
  },
  snapper: {
    name: 'Snapper', sci: 'Chrysophrys auratus',
    season: [2,2,2,2,3,3,3,3,3,2,2,2], temp: [15, 22],
    tod: { dawn: 1, day: 0.5, dusk: 0.95, night: 0.6 }, tide: 'change',
    habitat: 'Inshore and offshore reefs, gravel beds, washy rocky headlands.',
    baits: ['Pilchard (unweighted floater)', 'Squid or cuttlefish strips', 'Fresh yakka / slimy mackerel fillet', 'Prawns'],
    lures: ['5–7" soft plastic jerk shads', 'Micro jigs / slow-pitch jigs', 'Vibes'],
    rig: 'Floater rig: two snelled 4/0–5/0 hooks with the smallest sinker you can get away with, drifted back in a berley trail.',
    size: '30 cm', bag: '10',
    tips: 'Low-light, a bit of swell and a falling barometer are perfect. Big reds move in close to the washes after a southerly blow.'
  },
  squid: {
    name: 'Squid (Southern Calamari)', sci: 'Sepioteuthis australis',
    season: [2,2,2,2,3,3,3,3,3,3,2,2], temp: [14, 22],
    tod: { dawn: 1, day: 0.6, dusk: 1, night: 0.8 }, tide: 'any',
    habitat: 'Clear water over weed beds and sand patches in harbours, bays and off rocks.',
    baits: ['Pilchard / mullet on a squid spike', 'Live yellowtail on a squid jag'],
    lures: ['Egi squid jigs 2.5–3.5 (natural colours by day, orange/pink at dusk)'],
    rig: 'Squid jig on a 1–1.5 m 10–15lb fluoro leader. Cast, let it sink, two sharp lifts and a long pause.',
    size: null, bag: null,
    tips: 'Clean, calm water is key – after heavy rain they go elsewhere. Great live bait for kingfish and mulloway.'
  },
  trevally: {
    name: 'Silver Trevally', sci: 'Pseudocaranx georgianus',
    season: [1,1,2,2,3,3,3,3,2,2,1,1], temp: [14, 22],
    tod: { dawn: 0.9, day: 0.7, dusk: 0.9, night: 0.5 }, tide: 'rising',
    habitat: 'Harbours, bays, wharves and deeper estuary channels.',
    baits: ['Peeled prawn', 'Pilchard pieces', 'Squid strips', 'Bread / tuna cubes in berley'],
    lures: ['Small soft plastics', 'Micro jigs', 'Small metal slices'],
    rig: 'Light running sinker or unweighted bait, #1–2/0 hook, 8–10lb leader. Berley keeps them around.',
    size: null, bag: null,
    tips: 'Soft mouths – go easy on the drag. A steady berley trail is the best way to bring a school in.'
  },
  drummer: {
    name: 'Black Drummer (Pig)', sci: 'Girella elevata',
    season: [2,2,2,3,3,3,3,3,3,2,2,2], temp: [14, 23],
    tod: { dawn: 1, day: 0.8, dusk: 0.85, night: 0.2 }, tide: 'any', whiteWater: true,
    habitat: 'Shallow rocky washes and gutters right at your feet on rock platforms.',
    baits: ['Cabbage weed', 'Bread', 'Peeled prawn', 'Cunjevoi'],
    lures: ['Bait only'],
    rig: 'Heavy and short: 20–30lb line, small ball sinker right on top of a 1/0–2/0 suicide hook. Hold on – they bury you in the reef.',
    size: null, bag: null,
    tips: 'Best when there is white water rolling through the wash. Only fish rocks you know, and wear a lifejacket.'
  },
  mahi: {
    name: 'Mahi Mahi (Dolphinfish)', sci: 'Coryphaena hippurus',
    season: [3,3,3,2,1,0,0,0,0,0,1,2], temp: [22, 29],
    tod: { dawn: 0.9, day: 0.9, dusk: 0.8, night: 0.1 }, tide: 'any',
    habitat: 'Offshore FADs, floating debris and warm East Australian Current eddies.',
    baits: ['Live yakkas / slimies', 'Pilchards or squid cubes'],
    lures: ['Skirted trolling lures', '4–6" soft plastics', 'Small poppers'],
    rig: 'Livebait on a 4/0–6/0 circle hook, 30–40lb leader. Keep one hooked fish in the water and the school stays.',
    size: '50 cm', bag: '10',
    tips: 'Check the water temperature charts – warm blue water above 22°C pushing close to the coast is what you want.'
  },
  mackerel: {
    name: 'Spotted & Spanish Mackerel', sci: 'Scomberomorus spp.',
    season: [2,3,3,3,2,1,0,0,0,0,0,1], temp: [22, 29], northOf: -31.2,
    tod: { dawn: 1, day: 0.7, dusk: 0.8, night: 0.1 }, tide: 'change',
    habitat: 'North Coast headlands, inshore reefs and bait schools (Coffs Harbour and north).',
    baits: ['Live slimy mackerel / yakka', 'Whole garfish or pilchard trolled slowly'],
    lures: ['Metal slugs 40–80g cranked fast', 'Bibbed minnows trolled', 'High-speed spinning'],
    rig: 'Short wire trace (they have razor teeth), 4/0–7/0 hooks or ganged rig.',
    size: null, bag: null,
    tips: 'A summer–autumn run that follows warm water south. Watch for bait balls and birds off the headlands.'
  },
  bonito: {
    name: 'Australian Bonito', sci: 'Sarda australis',
    season: [1,1,2,3,3,3,2,1,1,1,1,1], temp: [16, 22],
    tod: { dawn: 1, day: 0.6, dusk: 0.8, night: 0.1 }, tide: 'any',
    habitat: 'Off the rocks, harbour entrances and inshore reefs chasing bait.',
    baits: ['Whole pilchard', 'Live yakka'],
    lures: ['Metal slugs 20–40g', 'Small high-speed minnows'],
    rig: 'Spin gear with 15–20lb leader. Cast metals and retrieve as fast as you can.',
    size: null, bag: null,
    tips: 'Excellent fresh bait for mulloway and kingfish. Bleed them on capture.'
  },
  tigerflathead: {
    name: 'Tiger Flathead', sci: 'Neoplatycephalus richardsoni',
    season: [2,2,2,2,2,2,2,2,2,2,2,2], temp: [13, 21],
    tod: { dawn: 0.9, day: 0.95, dusk: 0.85, night: 0.3 }, tide: 'any',
    habitat: 'Offshore sand and mud grounds, roughly 30–80 m deep.',
    baits: ['Squid strips', 'Pilchard / mullet strips', 'Prawn'],
    lures: ['Soft plastics on heavy jigheads bounced on a drift'],
    rig: 'Two-hook paternoster rig, 2/0–4/0 hooks, sinker heavy enough to hold bottom on the drift.',
    size: null, bag: null,
    tips: 'Drift over sand edges near reef. Good fish for families on calm offshore days.'
  }
};
