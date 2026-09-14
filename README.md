# Zen Drive

Portrait-first iPhone Safari/PWA endless driving experience focused on physically believable motion rather than photorealism.

## Runtime architecture

`Road world-space geometry -> Vehicle bicycle physics -> Suspension/body -> Driver head spring -> Look-ahead camera -> WebGL renderer`

- LEFT/RIGHT progressive steering only. No DeviceOrientation / DeviceMotion code.
- Dynamic bicycle model with speed-dependent steering ratio, yaw inertia, slip and mild understeer.
- Continuous 3D road elevation/bank, hills, bridge and tunnel sections.
- WebGL2 road/scenery geometry, depth, perspective and fog with adaptive pixel ratio/scene density.
- Layered Web Audio engine/RPM/gear, transmission, wind, tire, road, suspension, rain and tunnel reverb.
- Mountain / Country / City / Coast, Day / Sunset / Night and Clear / Cloudy / Rain / Fog remain available.
