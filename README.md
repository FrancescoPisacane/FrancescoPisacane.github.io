# Personal site

Static site (HTML, CSS, JS), no build step.

## Before publishing
- `index.html`: replace `YOUR_EMAIL@example.com`, `YOUR-HANDLE`, `YOUR-USERNAME`; add your surname to the title and nav if you want.
- `assets/`: add `cv.pdf` and optional photos named `drone.jpg`, `real-estate.jpg`, `photography.jpg`, `hiking.jpg`, `arduino.jpg`. Missing photos fall back to a soft gradient.

## Publish on GitHub Pages
1. Create a repo named `<your-username>.github.io`.
2. Upload all these files to the repo root (keep `.nojekyll`).
3. Settings → Pages → Deploy from a branch → `main` / root.
4. The site goes live at `https://<your-username>.github.io`.
