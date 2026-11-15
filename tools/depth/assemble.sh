#!/bin/bash
# depths.txt lines: "id i j depth|NA"  ->  js/data/depth-grids.js
in="$1"; out="$2"
awk 'BEGIN{N=9}
{ id=$1; k=$2*N+$3; v=$4; if (v=="NA") v="null"; else v=sprintf("%.1f", v); val[id,k]=v; ids[id]=1 }
END{
  print "// Seabed depth grids around each NSW saltwater spot (9 x 9 points, 110 m apart, rows south -> north)."
  print "// Sampled from the NSW Government bathymetry (2018 marine LiDAR + multibeam). Metres; negative = below sea level."
  print "window.FISH = window.FISH || {};"
  print "FISH.DEPTH_GRIDS = { meta: { n: 9, step: 110 }, spots: {"
  n=0; for (id in ids) n++; c=0
  for (id in ids) { c++; line="  " id ": ["; wet=0
    for (k=0;k<N*N;k++){ v=((id,k) in val)? val[id,k] : "null"; line=line (k?",":"") v; if (v!="null" && v+0 < -0.3) wet++ }
    line=line "]" (c<n?",":""); if (wet>=6) print line; else print "  " id ": null," "  // no survey coverage here"
  }
  print "} };"
}' "$in" > "$out"
