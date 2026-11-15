# Depth grids (Depth & structure feature)

`js/data/depth-grids.js` holds a 9 x 9 grid of seabed depths (110 m apart) around each NSW saltwater spot,
read from the NSW Government bathymetry service (2018 marine LiDAR + multibeam). The app uses it to find
deep holes and drop-offs instantly. Pins are sampled live in the browser instead.

To refresh or add spots (Git Bash):

1. Add the spot to `spots.txt` as `id lat lon` (same id as in js/data/locations.js).
2. Build the grid points:
   awk 'BEGIN{N=9;S=110;pi=3.141592653589793} {dla=S/111320; dlo=S/(111320*cos($2*pi/180)); for(i=0;i<N;i++) for(j=0;j<N;j++) printf "%s %d %d %.6f %.6f\n",$1,i,j,$2+(i-(N-1)/2)*dla,$3+(j-(N-1)/2)*dlo}' spots.txt > points.txt
3. Read the depths (be gentle on the server):  xargs -P 8 -L 1 ./probe.sh < points.txt > depths.txt
4. Write the data file:  ./assemble.sh depths.txt ../../js/data/depth-grids.js

The service names the value field either "Pixel Value" or "Stretch.Pixel Value" – probe.sh accepts both.
