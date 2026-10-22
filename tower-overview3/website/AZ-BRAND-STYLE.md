# AstraZeneca brand style: tower-overview3

Measured from the 14 corporate images in `ppt material/`. Confirm the palette hex values against the brand portal.

## Palette
Mulberry #830051 · Lime #C4D600 · Navy #003865 · Gold #F0AB00 · Magenta #D0006F · Purple #3C1053 · Light Blue #68D2DF · Graphite #3F4444 · Platinum #9DB0AC

The brand pairs each light colour with a darker one:
- light blue and lime organs use navy for shadows;
- gold uses mulberry;
- magenta and mulberry use purple.

## Page
- **Background:** a radial gradient. Centre #F4F6F5 (≈ #F7F8F8 at the very centre), #ECEFEE at 60 % of the radius, #DEE4E3 at the edge, #D3DBDA in the corners.
- **Lab photo:** stays behind the gradient at about 18 % opacity, desaturated. Its opacity is set in `style.css` (`body::after`).
- **Text and accents:**
  - Text is Graphite #3F4444; muted text is #59605F.
  - The accent is Mulberry.
  - Never use lime, gold or light blue for text. It fails contrast on the light page.

## Organs: "glass + plexus" (Picture1–5)
- **One colour per organ.** Organs are translucent glass: light where the surface faces you, saturated in the middle, and dark shadow colour at the rims and in internal "ink" streaks. Highlights are white.
- **Shader:** `models.js` (`glassMaterials`). The colours come from the table in `organs.js` (`towerColors`); edit a row to re-map a tower.
- **Plexus (`plexus.js`):**
  - 1 px lines in the organ colour at 50 %, with dots in the shadow colour.
  - It covers only part of the organ, then dissolves into dust beyond the surface.
- **Heart:** gold glass with a mulberry core and a dense plexus.
- **Vessels:** gold line bundles that turn mulberry near the heart.

## Dark starry nebula (nebula.js)
A faint dark purple/navy nebula with a starfield sits over the whole stage, based on the silhouette imagery (Picture6–14). It adds contrast while the light page and lab photo still show through.
- Opacity: `NEBULA_OPACITY` (0.35) inside a soft oval behind the body (or behind the zoomed organ), `NEBULA_OPACITY_PAGE` (0.15) for the rest of the page; both at the top of `nebula.js`. Stars are drawn at full strength regardless.
- The overview cards are dark glass with light text; the page text is darkened to stay readable.

## Kept dark on purpose
The telemetry HUD and the modal keep their own dark style. Their focus ring, border and hover colours are scoped back in `style.css`.

## Stills for slides
Open the page with `?still=<organ>`, e.g. `?still=lungs`, `?still=brain` or `?still=intestines`. This shows the organ framed as in the zoomed view with the UI hidden.

Use `?sep=0` for the assembled body and `?sep=1` for the separated view.

For high resolution, take a browser screenshot at 2× device scale. `scripts/qa/shoot.mjs` does this with `--query still=lungs --sizes 1920x1080`.

## O2C process map journey (journey.js, journey.css)
When the intestines (O2C) are zoomed in, scrolling down leads to the manager's O2C process map (`D2P_O2C_Process_Map_v15_AI_suggested (1).html` at the repo root). It is laid out as one horizontal track: scrolling down moves it sideways, from phase 1 to phase 6, then Handoffs.
- The geometry is the manager's own. `node scripts/o2c-map/extract.mjs` runs that page's renderer headlessly and writes `dist/data/maps/o2c.json`. Every box, diamond, pill and arrow therefore sits where the original puts it, and only the skin is ours. Re-run the extractor whenever the manager's file changes; `--check` asserts the counts.
- Skin:
  - gold phase headers, which turn blue in the AI view;
  - white glass step boxes, with the execution colour on the left edge and number badge;
  - purple decision diamonds;
  - mulberry triggers;
  - gold output documents;
  - partner pills in each tower's own colour, and platinum for outside parties.
- The As-Is / AI suggested switch "heals" the map: the gold sweep moves left to right, changed steps re-colour, red "!" becomes green "✔", and AI nodes fade in. Under reduced motion the swap is instant. The AI view adds three stations: AI opportunities, the pain-point register and related TPIs.
- Every step, decision and card opens a detail card on click or Enter. Esc closes it.
- **Condition skin (sick → healed).** The journey sits on a dark night sky. The As-Is map is the organ unwell:
  - mulberry/magenta glass panels with a fever glow, and a header gradient from mulberry to gold carrying an irregular heartbeat trace;
  - steps with an untreated pain point throb with a red halo;
  - flow pulses are slow and uneven in red, and rework loops show in red.

  The AI suggested map is the organ healed:
  - navy/light-blue glass fades in phase by phase, and the heartbeat steadies;
  - steps changed by AI glow light blue, and changes that address a pain point glow lime;
  - the flow runs steady and bright.

  Content is identical in both. Only the classes `ai-on` and `healed` (set in `paint()`) and the CSS block "Condition skin" in `journey.css` drive the look.
- Tunables are at the top of `journey.js`: `MIN_SCALE` (0.85; a station never shrinks below this, and taller ones dip down as you scroll), `GAIN` (travel per scroll pixel) and `GAP` (space between stations).

## QA
`node scripts/qa/shoot.mjs --out qa-out/<name>` captures screenshots at six sizes. It also records draw calls and frame times, and checks that the process cards don't overlap the HUD. Journey states: `--states journey:SOC-01,journey-ai:ai-opps` (a station id or progress 0–1); add `--click "<node id>" --click-state <state>` to open a detail card.

Overview at the time of the restyle: about 74 draw calls (was ~1,362), 60 fps on an AMD Radeon 740M.
