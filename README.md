# Tesla Rubric

A browser-based evaluation rubric for scoring used Tesla vehicles (focused on Model X). Enter criteria and point values, then score a vehicle to get a total and a verdict (Excellent Deal, Good Buy, Acceptable, Questionable, Avoid).

## Features

- **Evaluate vehicle** — Fill in price, odometer, seating, wheels, Autopilot hardware, FSD, tow hitch, warranty, etc. Points are summed and color-coded by tier.
- **VIN-based hardware guess** — Enter a VIN to estimate Autopilot hardware from model year and, for 2023 Model X, from serial number (HW4 from ~Feb 2023 onward). Apply the result to the Autopilot Hardware field.
- **Editable rubric** — Edit criteria, labels, and point values or add/remove criteria in the Edit Rubric tab.

## Run locally

**npm:**

```bash
npm install
npm run dev
```

**Bun:**

```bash
bun install
bun run dev
```

Open the URL shown (e.g. <http://localhost:5173>).

## Build

**npm:**

```bash
npm run build
npm run preview
```

**Bun:**

```bash
bun run build
bun run preview
```

Output is in `dist/`. Use the preview command to serve the built app locally.

## Single source of truth

The **only** source of truth for the scoring rubric is **`public/rubric.json`**. The app loads criteria and score bands from this file on startup (`GET /rubric.json`). The batch scoring script (`bun run score`) also reads `public/rubric.json`. To change criteria, point values, or score bands, edit `rubric.json`; the app and script will use the updated definition when loaded. (In-app edits in the "Edit Rubric" tab only affect the current session and are not persisted to the file.)

## Programmatic / LLM access

The rubric is exposed in a machine-readable form so scripts or LLMs can evaluate vehicles in bulk.

### Rubric spec (JSON)

When the app is served (e.g. `npm run dev` or `bun run dev`), the full rubric is available at:

**`GET /rubric.json`**

Example: `http://localhost:5173/rubric.json`

The response includes:

- **`criteria`** — Each criterion (id, type, options, thresholds, basePrice, etc.).
- **`scoreBands`** — Verdict tiers: `minScore`, `label`, `color` (e.g. `minScore: 30` → "Excellent Deal").
- **`scoringAlgorithm`** — Text rules for each criterion type (select, boolean, conditional_boolean, price, range_score) and the input schema.

Use this URL in prompts or tools so an LLM can load the rubric and compute scores for many vehicles.

### Input shape for one vehicle

A vehicle is a **selections** object: keys = criterion `id`, values = string (for select, price, range_score) or boolean (for boolean / conditional_boolean). Omit criteria to leave them unset (no points).

```json
{
  "price": "45000",
  "odometer": "35000",
  "wheels": "20",
  "seats": "6",
  "tow_hitch": true,
  "hardware": "hw4",
  "fsd": true,
  "warranty": false
}
```

### Batch scoring script

A small script scores one or more vehicles using `public/rubric.json`:

```bash
# From stdin (JSON array of { selections, id? })
echo '[{"id":"v1","selections":{"price":45000,"odometer":35000,"hardware":"hw4"}}]' | bun run score

# From file (bun or npm)
bun run score vehicles.json
npm run score vehicles.json

# Include per-criterion breakdown
bun run score vehicles.json --details
```

Output is JSON: `{ id?, total, label, color [, details] }` per vehicle. Use this in pipelines or have an LLM call it to evaluate listings en masse.

## Search pre-owned inventory

To search for vehicles that match your preferences (e.g. Model X, 6 seats, HW4, tow package):

**[Tesla Roamer — Pre-owned inventory (Model X, 6-7 seats, HW4, tow package)](https://teslaroamer.com/inventory/pre-owned?autopilot_hardware[]=HW4&model[]=mx&seating[]=6&seating[]=7&sort=price_asc&tow_package=1)**

Adjust filters on that page as needed.
