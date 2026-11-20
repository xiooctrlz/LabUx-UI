# THE CIRCLE — interactive experience

São Paulo, 2050. A speculative social experience told as an interactive web journey.
Built with Vite, three.js and GSAP.

## Run it

```powershell
npm install
npm run dev
```

Open http://localhost:5173. The first click on **Discover what's waiting for you** starts the music
(browsers block audio until the visitor interacts with the page).

`npm run build` creates a static version in `dist/`. Serve it with `npm run preview`.

**Rehearsal shortcut:** add `?scene=<name>` to the URL to jump to a scene:
`landing`, `form`, `rejection`, `invitation`, `decision`, `peephole`, `garden`, `final`.

## Flow

| # | Scene | File |
|---|-------|------|
| 01 | Landing: logo and one button | `src/scenes/landing.js` |
| 02 | Selection form (prefilled answers lead to acceptance) | `src/scenes/form.js` |
| – | Rejection: "Your path ends here. For now." | `src/scenes/rejection.js` |
| 03–04 | Knock → box on the table → open → pin → letter → UV flashlight | `src/scenes/invitation.js`, `src/three/invitationObjects.js` |
| 05 | "Are you ready to find us?" | `src/scenes/decision.js` |
| 06 | Peephole + password (`123`) | `src/scenes/peephole.js`, `src/components/eyes.js` |
| 07 | The garden + the Keeper | `src/scenes/garden.js`, `src/three/gardenWorld.js`, `src/three/keeper.js` |
| 08 | Final screen + restart | `src/scenes/final.js` |

## Phones and performance

- Every scene adapts to portrait phones. The 3D scenes widen the lens and reframe the box, letter and garden
  instead of cropping them. Touch drags work for the pin and the flashlight.
- Phones and low-power machines get a lighter garden (`src/core/device.js` decides): less grass and
  fewer leaves, no bloom, smaller shadows, and only the male body.
- The garden merges its furniture into a few meshes and draws the bulb halos as one point cloud. It renders
  at a pixel ratio of at most 1.25 and refreshes shadows every other frame.

## Things you may want to change

- **Selection criteria, questions, default answers, password:** `src/config/selection.js`
  (`isEligible()` holds the rule).
- **Music volume / sound effects:** `src/core/audio.js`.
- **Fade timing:** `TIMING` in `src/core/curtain.js`.
- **Colours and fonts:** the variables at the top of `src/style.css`.

## Asset map

Everything the site uses lives in `public/`. The design source files (Illustrator, Blender, FBX) are not
part of this repository: the files below were exported from them.

| Scene | File in `public/` | Exported from |
|-------|-------------------|---------------|
| all | `fonts/Satoshi-*.otf`, `fonts/CoveredByYourGrace-Regular.ttf` | the fonts used in the .ai files |
| all | `images/logo-lockup.png`, `images/logo-symbol.png` | `elementos de la experiencia.ai`, artboard 6 |
| all | `images/pin-badge.png` (favicon) | artboard 3 |
| all | `audio/musica-fondo.mp3` | original audio |
| rejection | `images/fainted-body.png`, `images/fainted-head.png` | artboard 4 (head split off so it can spin) |
| 03 | `audio/door-knoc.mp3` | original audio |
| 03–04 | `models/the-box.glb` | `the-box.blend` with `carta-15.jpg` on the lid (lid hinge kept) |
| 04 | `images/pin-face.png` | `pin-16.png`, cropped to the disc |
| 04 | `images/letter-cover.jpg` | artboard 1, the outside of the folded letter |
| 04 | `images/letter-base.jpg` + `images/letter-uv.png` | artboard 2. The pink "UV ink" lines (password and address) were split into their own layer |
| 07 | `models/body-male.glb`, `models/body-female.glb` | `Lowpoly-Base.fbx`, `FEMALE.fbx`: smoothed, rigged and tagged with clothing zones in Blender |
| 07 | `images/keeper-head.png` | artboard 6 |
| 07 | `audio/open-door.mp3`, `audio/welcome.mp3` | original audio |

The peephole eyes are redrawn as SVG from artboard 5 so the pupils and eyelids can move.
The garden, table, flashlight, pin body and Keeper body are modelled in code.

### Notes

- The letter is a US-letter sheet folded once in half. Closed, it shows artboard 1; it opens along the fold.
- The inside of the box and the lid are lined with a gathered velvet cushion (generated in code) that sinks
  around the letter, the pin and the flashlight: `buildVelvetPad()` in `src/three/invitationObjects.js`.
- The model's own letter, pin and flashlight meshes were simple stand-ins, so they are hidden and replaced by
  detailed interactive versions placed in the same box.
- People and the Keeper use the provided bodies. Clothes are painted per body zone in `src/three/humans.js`
  (colours, which zones are hidden, poses). The Keeper (`src/three/keeper.js`) wears a suit, and its head
  is the logo.
