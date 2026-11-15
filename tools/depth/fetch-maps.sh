#!/bin/bash
# Saves one depth image per spot (about 1.4 km square, 640 x 640, Web Mercator) from the NSW bathymetry service.
# Usage: ./fetch-maps.sh spots.txt ../../depthmaps   (spots.txt lines: id lat lon)
u="https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Marine/NSW_Bathymetry/MapServer/export"
out="$2"; mkdir -p "$out"
while read -r id lat lon; do
  [ -z "$id" ] && continue
  [ -s "$out/$id.png" ] && file "$out/$id.png" | grep -q PNG && continue
  bbox=$(awk -v la=$lat -v lo=$lon 'BEGIN{pi=3.141592653589793; R=20037508.34; x=lo*R/180; y=log(sin((90+la)*pi/360)/cos((90+la)*pi/360))/(pi/180)*R/180; h=700/cos(la*pi/180); printf "%.1f,%.1f,%.1f,%.1f", x-h, y-h, x+h, y+h}')
  for try in 1 2 3 4 5; do
    curl -s --max-time 90 -A "CastCall depth maps" -o "$out/$id.png" "$u?bbox=$bbox&bboxSR=3857&imageSR=3857&size=640,640&format=png32&transparent=true&layers=show:0&f=image"
    if file "$out/$id.png" | grep -q PNG; then echo "$id ok $bbox"; break; fi
    rm -f "$out/$id.png"; sleep $((try * 8))
  done
  [ -s "$out/$id.png" ] || echo "$id FAILED"
  sleep 2
done < "$1"
