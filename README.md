# StallWala — 3D Street Food Tycoon

A full 3D street-food stall you can walk around, cook at, upgrade, and run forever.

रात का बाज़ार, अपना स्टॉल, भूखे ग्राहक — पकाओ, परोसो, सजाओ। खेल कभी खत्म नहीं होता।

## Play

Open `index.html` with a local server (modules need HTTP):

```bash
npm start
```

Then visit the printed address. Drag to orbit the stall, scroll to zoom.

## Controls

| Input | Action |
| --- | --- |
| Drag | Orbit camera |
| Scroll | Zoom |
| WASD | Move camera |
| Click recipe / 1–9 | Cook |
| Click customer / Space | Serve |
| Click jars then a burner | Cook from ingredients |
| Esc | Pause |
| C | Reset camera |
| F | Fullscreen |

## Features

- Hand-built 3D stall, bazaar, lights, weather, day/night
- 17 recipes, stock, burners, combos, tips, special guests
- Shop: upgrades, decor, staff, achievements
- English + हिन्दी
- Save in the browser, no game-over

## Stack

Three.js (vendored in `lib/`), vanilla JS, no build step.
