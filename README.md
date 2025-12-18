# 251224_SnowflakeFractals

SnowflakeFractals explores generating snowflake-like fractal patterns, with goals of interactive rendering, parameter tweaking, and exportable imagery for generative art experiments. The current build ships a Three.js scene with an icy, transmissive snowflake, bloom postprocessing, and an on-canvas frosted control panel.

## Features
- Procedural snowflake generator with adjustable recursion depth, symmetry, branch angle/decay, and thickness decay
- MeshPhysicalMaterial “ice” look (transmission, clearcoat) with bloom + FXAA postprocessing and cold lighting
- OrbitControls for orbit/zoom/pan and optional auto-spin
- Frosted floating UI (lil-gui) for live tweaks; seed randomizer for reproducible variants
- Vite-based dev/build pipeline

## Getting Started
- Clone: `git clone https://github.com/ekimroyrp/251224_SnowflakeFractals.git`
- Install: `npm install`
- Dev server: `npm run dev` then open the printed local URL
- Build: `npm run build`; preview: `npm run preview`

## Controls
- Mouse: orbit (LMB drag), pan (RMB drag), zoom (wheel/pinch)
- Geometry: depth, symmetry, arm length/thickness, branch angle, decay, jitter
- Look: environment intensity, bloom amount
- Behavior: auto-rotate toggle, spin speed, seed entry, randomize seed button
