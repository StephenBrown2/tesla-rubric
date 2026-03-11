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

Open the URL shown (e.g. http://localhost:5173).

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

## Search pre-owned inventory

To search for vehicles that match your preferences (e.g. Model X, 6 seats, HW4, tow package):

**[Tesla Roamer — Pre-owned inventory (Model X, 6-7 seats, HW4, tow package)](https://teslaroamer.com/inventory/pre-owned?autopilot_hardware[]=HW4&model[]=mx&seating[]=6&seating[]=7&sort=price_asc&tow_package=1)**

Adjust filters on that page as needed.
