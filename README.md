# Duo Swat

An interactive Three.js toy: a hand holds a foldable phone (modelled on the iPhone Duo's
published dimensions), a housefly buzzes around, and you snap the phone shut to catch it.

**Play:** https://erayyavuz.github.io/duo-swat/

- Move the mouse to aim, click (or Space) to snap shut. On touch screens, drag to aim and tap to snap.
- Catch the fly while it's between the two screens. Flies that land on the screen are easier, but they react to fast moves.
- Every fly you kill stays at the bottom of the screen.

## How it's built

No build step: plain ES modules plus an import map for `three@0.170.0`.

| File | What it does |
| --- | --- |
| `src/phone.js` | Foldable phone geometry: 117.8 × 164.6 × 5.2 mm open, polished titanium frame, micro-blasted hinge cover, pill camera plateau, outer display with hole-punch camera, a continuous inner display that bends through the crease, and the wedge hit test |
| `src/screens.js` | Inner Home Screen (landscape Duo layout, side Dock) and outer Lock Screen (condensed clock behind the mountains) on the official Duo wallpapers. Icons are drawn in code in the iOS style |
| `src/hand.js` | Slim female left hand (MakeHuman, CC0 skin) with long red almond nails, holding the phone from below like the real device; posed and baked in Blender (`tools/blender/pose_hand2.py`, grip search `search_left.py`, params `grip.json`) |
| `src/fly.js` | Housefly model (compound eyes, striped thorax, motion-blurred wings, jointed legs) and its flight, landing and escape behaviour |
| `src/audio.js` | WebAudio-synthesised buzz, snap, squish and hinge sounds |
| `src/trail.js` | Frame-accumulation motion blur, used during the snap |

Debug URL params: `?slow=0.25` (time scale), `?a=118` (freeze at a fold angle), `?flycam=az,el,dist` (close-up camera on the fly). `__app.game.manualDt` steps time manually (see `tools/step.mjs`).
`tools/` holds the headless screenshot, sequence and catch-rate scripts plus the Blender subdivision script.

## Credits

- Hand: MakeHuman base mesh and "young caucasian female" skin (CC0), generated with [MPFB2](https://static.makehumancommunity.org/mpfb.html) in Blender (`tools/blender/`).
- Wallpapers: Apple's iPhone Duo light wallpapers (as distributed by [iClarified](https://www.iclarified.com/102102/download-the-official-iphone-duo-wallpaper-here)); © Apple. `assets/wall-outer-fg.png` is a mountain cut-out made from it for the Lock Screen depth effect.
- Environment: [Lebombo](https://polyhaven.com/a/lebombo) HDRI from Poly Haven (CC0).

Fan-made. Not affiliated with or endorsed by Apple. iPhone is a trademark of Apple Inc.
