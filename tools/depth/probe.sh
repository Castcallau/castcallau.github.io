#!/bin/bash
# args: id i j lat lon  -> prints "id i j depth" (depth in m, negative = below MSL; NA = no data)
u="https://mapprod3.environment.nsw.gov.au/arcgis/rest/services/Marine/NSW_Bathymetry/MapServer/identify"
ext=$(awk -v la=$4 -v lo=$5 'BEGIN{printf "%.5f,%.5f,%.5f,%.5f", lo-0.005, la-0.005, lo+0.005, la+0.005}')
for try in 1 2 3; do
  r=$(curl -s --max-time 20 -A "CastCall depth survey" "$u?geometry=$5,$4&geometryType=esriGeometryPoint&sr=4326&layers=all:0&tolerance=0&mapExtent=$ext&imageDisplay=400,400,96&returnGeometry=false&f=json")
  v=$(printf '%s' "$r" | grep -o 'Pixel Value" *: *"[^"]*"' | head -1 | sed 's/.*:"\(.*\)"/\1/')
  if [ -n "$r" ] && printf '%s' "$r" | grep -q '"results"'; then break; fi; sleep 1
done
case "$v" in ""|NoData) v=NA;; esac
echo "$1 $2 $3 $v"
