/**
 * The Kosovo map's geometry: generated from Natural Earth (border, 1:10m),
 * AWS Terrarium elevation (zoom 10) and OSM rivers, Web Mercator.
 * public/visit/kosovo-illustrated.webp is drawn in the same 1324×1463 space,
 * so a point's position on the image is project(lon, lat) / [W, H].
 */
export const MAP_W = 1324;
export const MAP_H = 1463;
const Z = 10;
const X0 = 145628;
const Y0 = 96032;
const WORLD = 256 * 2 ** Z;

export function project(lon: number, lat: number): [number, number] {
  const s = Math.sin((lat * Math.PI) / 180);
  return [((lon + 180) / 360) * WORLD - X0, (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * WORLD - Y0];
}
