# 251224_SnowflakeFractals

SnowflakeFractals is a Three.js icy snowflake generator with orbit/zoom/pan, frosted on-canvas controls, snowfall, bloom, physics shatter, and one-click screenshots. Branches and spikes are instanced for performance, with separate randomization, spin, and snowfall toggles.

## Features
- Procedural snowflake builder: Depth, Symmetry, Length, Thickness, Angle, Decay, Falloff, Jitter, Density, Plate, Tip
- Spikes (tracers): Density, Scale, Length, Offset, Taper, Flip, plus dedicated randomize
- Look: Bloom, Noise, Spin (toggle) + Speed, Snowfall (toggle), Shatter (toggle), Take Screenshot
- Shatter mode includes the hub and freezes after a set time for stability; dual snowfields for layered snowfall
- Instanced rendering for branches/spikes; GitHub Pages-ready build with relative assets

## Getting Started
- Clone: `git clone https://github.com/ekimroyrp/251224_SnowflakeFractals.git`
- Install: `npm install`
- Dev server: `npm run dev` (open the printed URL)
- Build: `npm run build`; preview: `npm run preview`

## Controls
- Mouse: orbit (LMB drag), pan (RMB drag), zoom (wheel/pinch)
- Branches: Depth, Symmetry, Length, Thickness, Angle, Decay, Falloff, Jitter, Density, Plate, Tip; Randomize Branches
- Spikes: Density, Scale, Length, Offset, Taper, Flip; Randomize Spikes
- Visualization: Bloom, Noise, Spin (toggle) + Speed, Snowfall (toggle), Shatter (toggle), Take Screenshot

## Deployment
- Build locally for Pages: `npm run build -- --base ./` (outputs to `dist/`)
- Publish to GitHub Pages: create/push a `gh-pages` branch containing the `dist` contents (mirroring this repo’s `gh-pages` branch/worktree flow)
- Live demo: https://ekimroyrp.github.io/251224_SnowflakeFractals/
