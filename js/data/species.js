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
  },

  // ---------------- Tropical north (QLD, NT, northern WA) ----------------
  barramundi: {
    name: 'Barramundi', sci: 'Lates calcarifer',
    season: [3,3,3,2,2,1,1,1,2,3,3,3], temp: [24, 32],
    tod: { dawn: 0.9, day: 0.5, dusk: 1, night: 0.8 }, tide: 'change', rain: true, moon: true,
    closures: [{ states: ['QLD'], months: [10, 11, 0], where: 'notdam', note: 'Queensland east coast barramundi closed season: 12 noon 1 Nov – 12 noon 1 Feb. Check QLD Fisheries rules.' }],
    habitat: 'Tidal rivers, creek mouths, mangrove snags, rock bars and floodplain run-offs across northern Australia.',
    baits: ['Live mullet', 'Live prawns', 'Live cherabin (freshwater prawns)'],
    lures: ['Shallow-diving hardbodies (gold and natural colours)', '4–6" paddle-tail soft plastics', 'Soft vibes worked along drop-offs'],
    rig: '30–50lb braid, 40–60lb leader, 4/0–6/0 hooks for live bait. Cast lures tight to snags and roll them slowly.',
    size: null, bag: null,
    tips: 'Fish the run-out tide where creeks and drains empty into the main river. ⚠️ Crocodile country – stay well back from the edge and never clean fish at the water.'
  },
  mangrovejack: {
    name: 'Mangrove Jack', sci: 'Lutjanus argentimaculatus',
    season: [3,3,3,2,1,0,0,0,1,2,3,3], temp: [24, 31],
    tod: { dawn: 0.9, day: 0.5, dusk: 1, night: 0.9 }, tide: 'change',
    habitat: 'Mangrove snags, rock walls, bridge pylons and rock bars in warm estuaries.',
    baits: ['Live mullet / herring', 'Live prawns', 'Fresh mullet or squid strips'],
    lures: ['Shallow hardbodies cast tight to snags', '3–4" soft plastic prawns and shads', 'Surface walkers at dawn and dusk'],
    rig: 'Heavy and short: 30–50lb leader, 3/0–5/0 hook, drag locked – they go straight back into the snag.',
    size: null, bag: null,
    tips: 'Hot, humid summer evenings before a storm are prime. Skip lures right into the shade of the snags.'
  },
  coraltrout: {
    name: 'Coral Trout', sci: 'Plectropomus leopardus',
    season: [2,2,2,3,3,3,3,3,3,3,2,2], temp: [22, 29],
    tod: { dawn: 1, day: 0.7, dusk: 0.9, night: 0.2 }, tide: 'change',
    habitat: 'Coral reefs, bommies and rubble edges on the Great Barrier Reef and Ningaloo.',
    baits: ['Whole pilchard', 'Live fusilier / hardiheads', 'Squid'],
    lures: ['5–7" soft plastics', 'Metal and slow-pitch jigs', 'Deep-diving minnows trolled along the reef edge'],
    rig: '50–80lb leader, 5/0–7/0 hook. Pull hard straight away or they bury you in the coral.',
    size: null, bag: null,
    tips: 'Reef fish spawning closures apply on the Great Barrier Reef some years, and marine park green zones are no-take. Check the zoning map.'
  },
  threadfin: {
    name: 'Threadfin Salmon', sci: 'Polydactylus macrochir / Eleutheronema tetradactylum',
    season: [3,3,3,2,2,2,2,2,2,3,3,3], temp: [24, 32],
    tod: { dawn: 0.9, day: 0.6, dusk: 0.9, night: 0.8 }, tide: 'change',
    habitat: 'Muddy tidal rivers, creek mouths and mud flats in the tropics – often with barra.',
    baits: ['Live prawns', 'Live mullet', 'Peeled prawn'],
    lures: ['Soft vibes', 'Paddle-tail soft plastics hopped on the bottom'],
    rig: '20–30lb braid, 30–40lb leader, 2/0–4/0 hook on a running sinker.',
    size: null, bag: null,
    tips: 'Look for bait flicking on the surface over the flats as the tide starts to run. ⚠️ Crocodiles live here too.'
  },
  queenfish: {
    name: 'Queenfish', sci: 'Scomberoides commersonnianus',
    season: [2,2,2,3,3,3,3,3,3,3,2,2], temp: [24, 31],
    tod: { dawn: 1, day: 0.8, dusk: 0.9, night: 0.2 }, tide: 'change',
    habitat: 'River mouths, headlands, flats and current lines in northern waters.',
    baits: ['Live herring / mullet', 'Whole garfish'],
    lures: ['Surface poppers and stickbaits', 'Metal slugs cranked fast', 'Soft plastic jerkbaits'],
    rig: '30–40lb leader, single 4/0–6/0 hooks. Fast retrieves get the strike.',
    size: null, bag: null,
    tips: 'Spectacular jumpers. Look for them busting up bait on the run-out tide at river mouths.'
  },

  // ---------------- Southern states (VIC, SA, WA, TAS) ----------------
  kgwhiting: {
    name: 'King George Whiting', sci: 'Sillaginodes punctatus',
    season: [3,3,3,3,2,2,1,1,2,2,3,3], temp: [14, 22],
    tod: { dawn: 0.8, day: 0.9, dusk: 0.8, night: 0.3 }, tide: 'rising',
    habitat: 'Sand patches between seagrass beds in bays and gulfs of VIC, SA and southern WA.',
    baits: ['Pipis', 'Squid strips', 'Mussel', 'Sandworm / bloodworm'],
    lures: ['Small soft plastics or blades hopped along the sand'],
    rig: 'Paternoster with two #4–#6 long-shank hooks and a little red tube or bead. Berley helps.',
    size: null, bag: null,
    tips: 'Anchor on the edge of a sand hole surrounded by weed and berley lightly on the rising tide.'
  },
  herring: {
    name: 'Australian Herring (Tommy Ruff)', sci: 'Arripis georgianus',
    season: [1,1,2,3,3,3,2,2,1,1,1,1], temp: [14, 22],
    tod: { dawn: 1, day: 0.7, dusk: 1, night: 0.2 }, tide: 'any',
    habitat: 'Jetties, beaches, rock groynes and estuary mouths in WA and SA.',
    baits: ['Maggots / wogs under a float', 'Prawn pieces', 'Squid strips', 'Berley (bread and pollard)'],
    lures: ['Small "herring poppers" with a trailing jig', 'Small metal slices'],
    rig: 'Light gear: small float, #10–#8 hook, 4–6lb line, steady berley trail.',
    size: null, bag: null,
    tips: 'Great fun for kids off jetties. The autumn run in WA brings big schools close to shore.'
  },
  blackbream: {
    name: 'Black Bream', sci: 'Acanthopagrus butcheri',
    season: [2,2,2,2,2,2,2,2,3,3,3,2], temp: [12, 24],
    tod: { dawn: 0.9, day: 0.6, dusk: 1, night: 0.9 }, tide: 'rising',
    habitat: 'Southern estuaries and rivers – snags, jetties, rock walls and weed edges (VIC, SA, WA, TAS).',
    baits: ['Sandworm / bloodworm', 'Spider crab', 'Peeled prawn', 'Mussel', 'Pod / spinyhead worm'],
    lures: ['Small soft plastic grubs', 'Small deep-diving crankbaits', 'Surface walkers in summer'],
    rig: 'Running ball sinker (as light as possible), #4–#1 hook, 6–8lb fluorocarbon leader.',
    size: null, bag: null,
    tips: 'Wary fish – go light, fish quietly and let them run with the bait before striking.'
  },
  dhufish: {
    name: 'WA Dhufish', sci: 'Glaucosoma hebraicum',
    season: [2,2,2,2,2,2,2,2,2,1,1,2], temp: [16, 23],
    tod: { dawn: 0.9, day: 0.9, dusk: 0.8, night: 0.4 }, tide: 'any',
    habitat: 'Offshore limestone reef and lumps off WA\'s west coast, often 20–60 m deep.',
    baits: ['Octopus', 'Squid', 'Fresh mulie (pilchard) or fish fillet'],
    lures: ['Heavy soft plastics', 'Slow-pitch jigs'],
    rig: 'Two-hook paternoster on 60–80lb leader, 6/0–8/0 hooks. Use a release weight for fish you return.',
    size: null, bag: null,
    tips: 'WA West Coast demersal rules (seasons, bag limits, licence) have changed recently. Always check the current rules before going.'
  },
  sandflathead: {
    name: 'Sand Flathead', sci: 'Platycephalus bassensis',
    season: [3,3,3,3,2,2,1,1,2,3,3,3], temp: [11, 21],
    tod: { dawn: 0.9, day: 0.9, dusk: 0.8, night: 0.3 }, tide: 'any',
    habitat: 'Sandy and muddy bottoms in bays, estuaries and inshore waters of VIC, TAS and SA.',
    baits: ['Squid strips', 'Pilchard pieces', 'Prawn', 'Fish fillet'],
    lures: ['Soft plastics bounced along the bottom on a drift'],
    rig: 'Paternoster with two #1–2/0 hooks, enough sinker to hold bottom while drifting.',
    size: null, bag: null,
    tips: 'The easiest fish in the south for families. Drift over sand in 5–20 m until you find a patch, then go back over it.'
  },
  garfish: {
    name: 'Garfish', sci: 'Hyporhamphus spp.',
    season: [2,2,3,3,3,2,2,2,2,2,2,2], temp: [14, 24],
    tod: { dawn: 0.9, day: 0.8, dusk: 0.8, night: 0.2 }, tide: 'any',
    habitat: 'Calm bays, jetties and weed beds just under the surface.',
    baits: ['Bread', 'Maggots', 'Tiny pieces of prawn', 'Silverfish'],
    lures: ['Not a lure fish'],
    rig: 'Tiny pencil float, #12–#10 hook, 3–4lb line and a fine bread berley.',
    size: null, bag: null,
    tips: 'Excellent eating and top bait for tailor, salmon and kingfish.'
  },

  // ---------------- Freshwater ----------------
  // closures: list of { states, months (0–11), where: 'all' | 'river', release: true = catch & release only }
  bass: {
    name: 'Australian Bass', sci: 'Macquaria novemaculeata', water: 'fresh',
    season: [3,3,3,2,1,1,1,1,2,3,3,3], temp: [16, 28],
    tod: { dawn: 1, day: 0.4, dusk: 1, night: 0.8 }, tide: 'any',
    closures: [{ states: ['NSW'], months: [5, 6, 7], where: 'river', release: true, note: 'NSW bass & estuary perch closed season in rivers and estuaries 1 Jun – 31 Aug: catch and release only (dams stay open). Check NSW DPI.' }],
    habitat: 'Snags, overhanging trees and rocky banks in coastal rivers; weed edges and points in stocked dams.',
    baits: ['Live shrimp', 'Crickets / cicadas', 'Scrub worms', 'Small live poddy mullet'],
    lures: ['Surface fizzers / poppers at dawn, dusk and night', 'Small spinnerbaits', 'Lipless crankbaits', '2–3" soft plastics'],
    rig: '6–10lb braid with a 10–12lb leader. Unweighted live bait cast tight to snags; lures pitched into cover.',
    size: null, bag: null,
    tips: 'Summer evenings with surface lures are magic. Cast right into the snag – bass live in the shade.'
  },
  goldenperch: {
    name: 'Golden Perch (Yellowbelly)', sci: 'Macquaria ambigua', water: 'fresh',
    season: [3,3,3,2,1,1,0,1,2,3,3,3], temp: [18, 28],
    tod: { dawn: 0.9, day: 0.6, dusk: 0.9, night: 0.6 }, tide: 'any', rain: true,
    habitat: 'Inland dams and rivers – drowned timber, rocky points and creek mouths.',
    baits: ['Live yabbies', 'Live shrimp', 'Scrub worms', 'Bardi grubs'],
    lures: ['Deep-diving hardbodies trolled or cast', 'Spinnerbaits', 'Lipless crankbaits / blades hopped near timber'],
    rig: 'Running ball sinker down to a #1–2/0 hook, 10–15lb line. Fish baits right on the bottom among timber.',
    size: '30 cm', bag: '5',
    tips: 'A warm spell and a rising river after rain switch them on. Work the edges of standing timber in 3–6 m.'
  },
  murraycod: {
    name: 'Murray Cod', sci: 'Maccullochella peelii', water: 'fresh',
    season: [3,3,3,3,2,1,1,1,0,0,0,2], temp: [14, 26],
    tod: { dawn: 0.9, day: 0.5, dusk: 1, night: 0.9 }, tide: 'any', rain: true, moon: true,
    closures: [{ states: ['NSW', 'VIC', 'ACT', 'SA'], months: [8, 9, 10], where: 'all', note: 'Murray cod closed season (spawning) from 1 Sep – around the end of Nov or Dec depending on the state: do not target them. Check your state\'s rules.' }],
    habitat: 'Big snags, undercut banks and deep holes in the Murray–Darling rivers and inland dams.',
    baits: ['Live yabbies', 'Bardi grubs', 'Big scrub worm bunches', 'Cheese / chicken (common local baits)'],
    lures: ['Large spinnerbaits', 'Big deep-diving hardbodies', 'Surface wake baits at night in summer', 'Swimbaits'],
    rig: 'Heavy gear: 30–50lb braid, 40–60lb leader, running sinker to a 4/0–8/0 hook or lures slow-rolled past snags.',
    size: '55–75 cm (slot)', bag: '2',
    tips: 'Dusk into dark around the biggest snag you can find. Handle with wet hands and support big fish horizontally.'
  },
  trout: {
    name: 'Trout (Rainbow & Brown)', sci: 'Oncorhynchus mykiss / Salmo trutta', water: 'fresh',
    season: [2,2,3,3,3,2,2,2,2,3,3,2], temp: [8, 18],
    tod: { dawn: 1, day: 0.5, dusk: 1, night: 0.4 }, tide: 'any',
    closures: [
      { states: ['NSW'], months: [5, 6, 7, 8], where: 'river', note: 'NSW trout rivers and streams close from the June long weekend to the October long weekend. Lakes stay open. Check NSW DPI.' },
      { states: ['VIC'], months: [5, 6, 7], where: 'river', note: 'Victorian trout rivers and streams close over winter (roughly June – early September). Lakes stay open. Check VFA rules.' },
      { states: ['TAS'], months: [4, 5, 6], where: 'all', note: 'Tasmanian trout season closes over winter for most waters (roughly May – early August); some lakes stay open. Check IFS rules.' }
    ],
    habitat: 'Cold Snowy Mountains and tableland lakes and streams – drop-offs, weed edges and river inflows.',
    baits: ['Scrub worms', 'Mudeyes under a float', 'PowerBait dough', 'Wood grubs'],
    lures: ['Tassie Devils (trolled or cast)', 'Small inline spinners', 'Small soft plastics / minnows', 'Flies: nymphs, woolly buggers, dry flies'],
    rig: '4–6lb line. Float rig with a mudeye, or a running sinker with a worm off the bottom. Troll Tassie Devils 1–2 km/h.',
    size: null, bag: null,
    tips: 'Low light, a light ripple and cold water are best. In summer go deeper or fish the dawn shallows.'
  },
  redfin: {
    name: 'Redfin (English Perch)', sci: 'Perca fluviatilis', water: 'fresh', pest: true,
    season: [2,2,3,3,2,1,1,1,2,3,3,2], temp: [12, 24],
    tod: { dawn: 0.9, day: 0.8, dusk: 0.9, night: 0.3 }, tide: 'any',
    habitat: 'Schools around weed beds, drowned timber and drop-offs in dams and slow rivers.',
    baits: ['Scrub worms', 'Small yabbies', 'Live shrimp'],
    lures: ['Small soft plastics', 'Inline spinners', 'Ice jigs / blades jigged vertically'],
    rig: 'Light gear, 4–6lb. Paternoster rig with worms, or small lures jigged straight down on a school.',
    size: 'No limit', bag: 'No limit',
    tips: 'Pest fish – do not release them back alive. Once you find a school, keep jigging the same spot.'
  },
  carp: {
    name: 'European Carp', sci: 'Cyprinus carpio', water: 'fresh', pest: true,
    season: [3,3,3,2,1,1,1,1,2,3,3,3], temp: [15, 28],
    tod: { dawn: 0.8, day: 0.8, dusk: 0.8, night: 0.5 }, tide: 'any',
    habitat: 'Almost every river and dam – muddy bays, shallow flats and slow water.',
    baits: ['Sweet corn', 'Bread / dough balls', 'Scrub worms'],
    lures: ['Not a lure fish'],
    rig: 'Running sinker or float rig, #6–#2 hook. Berley with corn or bread.',
    size: 'No limit', bag: 'No limit',
    tips: 'Pest fish – it is illegal to release them alive. Great fun for kids, and they help clean up the river.'
  }
};
