# Regenerate the README animation

The renderer loads the project-root `ironman.glb` with Three.js `GLTFLoader`, centers it from the measured bounds of the central character meshes, and animates only its top-level group. Two detached meshes in the source sit tens of thousands of units below the figure; they remain in the scene but are excluded from camera framing. `renderAtTime(seconds)` derives the pose from the timestamp. The export contains 180 frames across exactly six seconds in an infinitely looping 800 × 600 animated WebP.

Requirements: Node.js, Python 3, Pillow with WebP support, and Playwright Chromium. From this directory, install the JavaScript dependencies and browser with `npm install` and `npx playwright install chromium`. Install Pillow with `python -m pip install Pillow`, then run `npm run render`. The result is written to `assets/ironman-hover.webp` and is embedded by `README.md`.

The uploaded asset is a full rigged figure in a T-pose, not a helmet-only model. It has a skin but no animation clips or embedded texture images; the renderer preserves all 127 meshes and nine materials and adds no geometry. Because the requested animation moves the model as one intact object, the figure's limbs remain in their source pose. The README animation uses the exact sentence supplied in the original request.
