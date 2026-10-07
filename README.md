# Duo Swat

An interactive Three.js toy: a hand holds a foldable phone (modelled on the iPhone Duo's
published dimensions), a housefly buzzes around, and you snap the phone shut to catch it.

**Play:** https://erayyavuz.github.io/duo-swat/

- Move the mouse to aim, click (or Space) to snap shut. On touch screens, drag to aim and tap to snap.
- Catch the fly while it's between the two screens. Flies that land on the screen are easier, but they react to fast moves.

## How it's built

No build step: plain ES modules plus an import map for `three@0.170.0`.

| File | What it does |
| --- | --- |
| `src/phone.js` | Foldable phone geometry: 117.8 × 164.6 × 5.2 mm open, polished titanium frame, micro-blasted hinge cover, camera plateau, outer display with hole-punch camera, and the wedge hit test |
| `src/screens.js` | Canvas-drawn inner (Today View + Home Screen) and outer (lock screen) displays. Generic icons only |
| `src/hand.js` | Rigged WebXR hand with a manual FK grip pose, forearm and knit sleeve |
| `src/fly.js` | Housefly model (compound eyes, striped thorax, motion-blurred wings, jointed legs) and its flight, landing and escape behaviour |
| `src/audio.js` | WebAudio-synthesised buzz, snap, squish and hinge sounds |
| `src/trail.js` | Frame-accumulation motion blur, used during the snap |

Debug URL params: `?slow=0.25` (time scale), `?flycam=az,el,dist` (close-up camera on the fly).
`tools/` holds the headless screenshot, sequence and catch-rate scripts plus the Blender subdivision script.

## Credits

- Hand model: `generic-hand` from [@webxr-input-profiles/assets](https://github.com/immersive-web/webxr-input-profiles) (MIT, © 2019 Amazon), subdivided in Blender. See `assets/LICENSE-hand-model.md`.
- Environment: [Lebombo](https://polyhaven.com/a/lebombo) HDRI from Poly Haven (CC0).

Fan-made. Not affiliated with or endorsed by Apple. iPhone is a trademark of Apple Inc.
