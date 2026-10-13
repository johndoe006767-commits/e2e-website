# Generated assets

Created with the built-in image-generation tool. Sources are retained in the tool’s generated-images directory; project copies are in `public/assets/organs/`. Transparent PNG masters and optimized WebP sprites are included.

## Shared specification

Use case: scientific-educational. One standalone game sprite. Polished anatomically recognizable 3D medical teaching model, smooth softly glossy clay-like material, subtle organic surface detail, orthographic anterior view. Center the entire object with transparent margin. Soft studio light from upper left. Genuine transparent alpha. No text, labels, scenery, pedestal, cast shadow, border, watermark or other organs.

## Subjects

- **bladder**: urinary bladder with two short ureter entries and short urethra, soft coral pink.
- **gallbladder**: pear-shaped gallbladder with short cystic duct, soft sage green.
- **thyroid**: butterfly-shaped thyroid gland, two lobes joined by narrow isthmus, coral rose.
- **trachea**: human trachea with cartilage rings and the two short main bronchi at its base, pale blue ivory.
- **esophagus**: human esophagus alone, long gently curved muscular tube from throat to stomach, no attached stomach, warm pink.
- **diaphragm**: human diaphragm muscle, broad shallow double dome viewed from front, red-pink muscle and pale central tendon.
- **adrenals**: pair of human adrenal glands, one triangular and one crescent, separated horizontally, golden peach, no kidneys.
- **eyes**: pair of human eyeballs with blue-gray irises facing forward, separated horizontally, short optic nerves barely visible behind.
- **tongue**: human tongue organ, realistic muscular rounded broad tongue viewed from front and slightly above, rose pink.
- **appendix**: human vermiform appendix alone, small narrow curved worm-shaped tube with a slightly wider base, peach pink.
- **thymus**: human thymus gland, two elongated lobulated lobes joined side by side, soft dusty pink.

## Background

Abstract 16:9 texture. Rich plum purple and violet cover most of the image. Small amounts of charcoal dissolve near the corners. Softly distorted, smoke-like ink marbling with low contrast, no hard boundaries, no text, no stars or neon. Center gently lighter. Saved as `public/assets/purple-atmosphere.png` with optimized WebP for gameplay.

## Processing

Technical processing: transparent margins trimmed, organs downsampled, alpha preserved, WebP versions created. No runtime image-generation requests.



## Muscle additions
Built-in image generation, three individual transparent sprites. Saved as PNG and WebP in `public/assets/organs/{biceps,quadriceps,calves}`. Technical processing trims transparent margins and resizes to 512px.

Shared prompt: Use case: scientific-educational. Create a transparent-background anatomical game sprite: [subject]. Single centered vertical specimen, no bones, no skin, no surrounding body, no text. Polished soft 3D educational render, coral pink muscle fibers with gentle striations, ivory tendon tips, soft studio highlights. Entire specimen visible with small margin, true alpha transparency.

Subjects:
- Biceps: one isolated biceps brachii muscle, elongated tapered upper arm muscle with two short proximal tendon heads and one distal pale tendon.
- Quadriceps: one isolated quadriceps femoris muscle group, four bundled front-thigh muscle bellies merging into a pale patellar tendon at bottom.
- Calves: one isolated calf muscle group viewed posteriorly, two rounded gastrocnemius heads at top tapering down to a long pale Achilles tendon.

Anatomy references: [Cleveland Clinic quadriceps](https://my.clevelandclinic.org/health/body/22816-quad-muscles), [calf muscles](https://my.clevelandclinic.org/health/body/21662-calf-muscle). Simplified educational illustrations, not clinical models.


## Posterior muscle additions
Built-in image generation, individual transparent PNG sprites, optimized WebP versions saved in `public/assets/organs/hamstrings`, `public/assets/organs/triceps`, and `public/assets/organs/glutes`.

Prompt template: Use case: scientific-educational. Create a transparent-background anatomical game sprite: [subject]. Single centered specimen, no bones, no skin, no surrounding body, no text or labels. Polished soft 3D educational render, coral pink muscle fibers with gentle striations, ivory tendon tips, soft studio highlights, matching friendly anatomical game assets. Entire specimen visible with small margin, true alpha transparency, no shadow outside silhouette. Save output for [id].

Subjects:
- hamstrings: one isolated hamstring muscle group from one thigh, posterior view, three long parallel muscle bellies with pale tendon attachments, anatomically recognizable biceps femoris, semitendinosus and semimembranosus.
- triceps: one isolated triceps brachii muscle from one upper arm, posterior view, three muscle heads converging into a single short pale distal tendon.
- glutes: paired gluteal muscles in posterior view, rounded fan-shaped left and right gluteus maximus with visible diagonal muscle fibers, symmetrical pair as one isolated anatomical specimen.

References: [hamstrings](https://my.clevelandclinic.org/health/body/21904-hamstring-muscles), [arm muscles](https://my.clevelandclinic.org/health/body/22312-arm-muscles), [glutes](https://my.clevelandclinic.org/health/body/gluteal-muscles-glutes). These are simplified sprite illustrations attached to 3D anchors.
