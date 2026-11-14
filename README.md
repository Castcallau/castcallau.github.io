# CastCall – Australian Fishing Forecast

Ranks 110+ saltwater and freshwater spots across every Australian state (land-based and boat/kayak) by how good the fishing should be, hour by hour, for the next 2 weeks.
You can pin any spot on the map for an exact rundown. Also has fishing alerts (browser notifications + calendar reminders) and a catch log that saves the conditions with every fish.
Live site: https://lapennaa07-dotcom.github.io/tideline-nsw/

## Run it
- **Easiest:** double-click `index.html`.
- **If the forecast won't load** (some school/work networks block it): right-click `serve.ps1` → *Run with PowerShell*, then open http://localhost:8080. The local server can fetch the data for the page.

## What the score uses
| Factor | Why it matters |
|---|---|
| Tide | Moving water around the turn; rising tide in estuaries |
| Light | Dawn/dusk bite windows, overcast days |
| Wind | Speed plus onshore direction and how exposed each spot is |
| Swell | White-water wash on rocks/beaches; safety caps for rocks and offshore |
| Barometer | Slowly falling pressure = fish feeding |
| Rain / storms | Heavy rain and thunderstorms knock the score down |
| Moon | Phase plus approximate solunar periods |
| Species | Season, sea temperature, preferred tide and time of day for each fish at that spot |

Data: [Open-Meteo](https://open-meteo.com) weather + marine APIs (free, no key). Tides are modelled, so check BOM tide tables for exact times.

## Edit the data
- Spots: `js/data/locations.js` (add your own marks: lat/lon, facing direction, exposure, species).
- Fish, baits, rigs, seasons: `js/data/species.js`.
- Scoring weights: `js/scoring.js`.

Size and bag limits are a guide only. Always check the current NSW DPI rules.
