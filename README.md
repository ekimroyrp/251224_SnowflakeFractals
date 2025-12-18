# 251224_SnowflakeFractals

SnowflakeFractals explores generating snowflake-like fractal patterns, with goals of interactive rendering, parameter tweaking, and exportable imagery for generative art experiments. The current build ships a Three.js scene with an icy, transmissive snowflake, bloom postprocessing, an environment-lit studio feel, and an on-canvas frosted control panel.

## Features
- Procedural snowflake generator with adjustable depth, symmetry, branch angle/decay, branch density/jitter, plate density, and tip scale
- MeshPhysicalMaterial “ice” look (transmission, clearcoat, IOR, attenuation) plus micro normal noise, HDR-like environment lighting, bloom, and FXAA
- Presets (Classic Hex, Needle Star, Chaotic Crystal) with seed randomization for reproducible variants
- OrbitControls for orbit/zoom/pan with optional auto-spin and camera reset
- Frosted floating UI (lil-gui) for live tweaks; Vite-based dev/build pipeline

## Getting Started
- Clone: `git clone https://github.com/ekimroyrp/251224_SnowflakeFractals.git`
- Install: `npm install`
- Dev server: `npm run dev` then open the printed local URL
- Build: `npm run build`; preview: `npm run preview`

## Controls
- Mouse: orbit (LMB drag), pan (RMB drag), zoom (wheel/pinch)
- Presets: choose a preset; randomize seed; reset camera
- Geometry: depth, symmetry, arm length/thickness, branch angle, branch decay, thickness decay, branch jitter, branch density, plate density, tip scale
- Look: environment intensity, bloom amount, surface noise strength
- Behavior: auto-rotate toggle, spin speed, seed entry, randomize seed button
