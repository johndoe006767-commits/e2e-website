# Anatomy in place

A local, single-player anatomy game built with React, TypeScript and Vite.

## Run locally

Requires Node.js 22.12 or newer.

```sh
npm ci
npm start
```

Open http://127.0.0.1:5173. The game uses local assets and does not call external services during play. Internet is only needed for the first dependency installation.

For a production build:

```sh
npm run build
npm run preview
```

Open the address printed by Vite. The `dist` folder can also be served by any static HTTP server. Do not open index.html directly as a file.

## Rules and controls

- Place all 25 organ and muscle pieces to win. Paired organs and intestines count as one piece each.
- Unlimited time and attempts, with three contextual clues per round.
- Wrong drops inside the skeleton cost 0.5 points. Drops outside, clicks without a drag and cancelled drags do not. Scores may go below zero.
- Drag any unplaced organ toward a small white checkpoint. It previews a magnetic snap nearby. Only releasing the pointer commits a placement; moving away while held detaches the preview. Wrong placements deduct 0.5 points.
- Or select an organ and click/tap a location on the skeleton.
- Keyboard: Tab to an organ, Enter to select; Tab to the skeleton, arrows to aim, Shift+arrows for finer movement, Enter to place, Escape to cancel.
- Placed organs never intercept input. 
- Restart confirmation pauses the clock; cancelling resumes automatically.
- Restart reshuffles the organ collection and resets the round. Refreshing the page resets the game.
- Drag the skeleton left or right to rotate through 360 degrees around its vertical axis. Vertical movement never tilts the body. L/R now label screen sides as requested. With no organ selected, the keyboard left/right arrows rotate the body.

Desktop/tablet is best for fine positioning. Mobile uses one organ column on each side, with touch and tap controls.

## Implementation

`src/game.ts` contains organ locations, sizes and hints. `src/main.tsx` manages game state, separate rotation and organ-drag gestures, magnetic preview, and pointer capture. `src/body-scene.ts` owns the Three.js scene and projects anatomical checkpoints into screen coordinates as the body rotates. `src/style.css` contains the purple theme and responsive layouts.

Each successful match earns 5 points within 15 seconds, 4 within 25 seconds, 3 within 35 seconds, 2 within 60 seconds, or 1 after 60 seconds. The scoring window begins at Start game and resets only after a successful placement. Selecting a piece, taking a hint, or making an error does not reset it. Restart confirmation pauses scoring time. The end screen shows the accumulated score. The game starts only after clicking the button below the skeleton; browsing or rotating before starting does not use time.

Pointer movement updates the drag element directly, without continuous React renders. The Three.js canvas and DOM checkpoint layer do not intercept captured organ drags. Small magnetic hit areas use a 24px entry radius and a 36px detach radius to prevent flicker at the edge; closely overlapping targets prefer the matching organ. Moving away before releasing never commits the earlier preview.

Hovering over an organ starts a gentle vertical float and sway. Reduced-motion preferences disable this loop and animated return travel. Rotation follows horizontal input directly, with no automatic spinning or momentum. The background stays still.

## Assets and attribution

`public/assets/organs` contains the skeleton and 20 transparent PNG masters plus optimized WebP assets. The supplied atlas and geometry are preserved in `public/anatomy`; they supply the live Three.js skeleton and eight active original organ meshes. The other twelve active pieces use simplified solid procedural meshes in `src/anatomy-meshes.ts`, while their source trays retain the generated illustrations. Nine organs and the skeleton were rendered from e2e-draft1. The other eleven were generated with the built-in image-generation tool. Biceps, quadriceps, and calf muscles replace the thymus, adrenal glands, and appendix in the active collection. Hamstrings, triceps, and glutes replace the diaphragm, gallbladder, and spleen. Posterior muscles and kidneys have back-view checkpoints. Checkpoints show only on their assigned side and hidden checkpoints cannot accept drops. Every placed piece inherits body rotation and shares depth with the skeleton. Bones naturally hide internal parts; lungs sit behind ribs. Placing the brain makes cranial bones translucent; placing the tongue reveals it through the mouth-area bones. The view label is removed. Left Bicep, Right Hamstring, Left Quadriceps and Right Tricep use anatomical left/right placement. Their new illustrations use the built-in image-generation tool. Generation prompts are recorded in `docs/asset-prompts.md`.

The render helper is `scripts/render-anatomy.html`; with the dev server running, use `node scripts/render-anatomy.mjs` to recreate the original ten renders. It requires installed Google Chrome. `scripts/optimize-assets.mjs` trims transparent margins and downsamples organ sprites; skeleton dimensions are preserved. `scripts/web-assets.mjs` creates the lightweight WebP files used by the game.

See `licenses/ATTRIBUTION.md`, `licenses/HUMAN-ATLAS-LICENSE.txt`  for source attribution. This is a composite educational illustration with approximate placements, not a clinical model.

## Verification

With the dev server running and Google Chrome installed:

```sh
npm test
```

Browser tests cover all 25 drag placements, overlapping organs, error deductions, free cancellation, hints, tap placement, restart-confirmation pause, score tiers and unlimited play, restart, keyboard controls, responsive layout and missing assets.

Correct placements glow gold briefly and leave their source slot blank. Wrong placements shake and glow red at the drop location; reduced-motion mode keeps the color without shaking. Top and bottom page padding are both 16px.

Local refinement (September 26): 25 pieces, adding right shoulder, left forearm, right shin, right inner thigh and left jaw muscles. New tray images are rendered from their solid procedural meshes with `scripts/refine-renders.mjs`. Bone depth writing is enabled to prevent rear triangles overwriting front surfaces; depth is cleared after the skeleton for the educational anatomy overlay. Teal checkpoints have dark outlines. This update has not been published to Sites.

Placement depth update: removed the cutaway depth reset, so bones and all placed anatomy share a depth buffer. Left/Right display names are swapped as requested, without relocating targets. Starting or restarting a round requests browser fullscreen; Escape exits it. No separate fullscreen button remains. If fullscreen is unavailable or denied, play continues in the page. Sites remains unchanged.

Completion celebration: the named atlas bones are articulated at shoulders, elbows, wrists and finger joints in `src/skeleton-rig.ts`. The one-shot sequence moves from rest to double thumbs-up, then a raised-arm victory pose inspired by the provided references. The same scene, canvas and bone meshes transition from gameplay. Organs fade out over 0.9 seconds as the skull returns to solid bone; camera framing and the current yaw ease into the celebration over 1.2 seconds. The thumbs-up is held for five seconds; the final pose raises the entire screen-right arm 35 degrees above horizontal, with the hand aligned to the forearm and a slight left torso lean, and aims the skull toward the hand. Three waves of enlarged confetti and ribbons fall from above, replenish through twenty seconds, and fade out at twenty-five seconds; there are no sparks; replay cancels and resets everything. Reduced motion shows the settled victory pose without particles. The jaw/cheek piece is replaced by the original 3D spleen, keeping 25 pieces.
