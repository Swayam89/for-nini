# For Nini

A birthday present for Mridu: a scroll-driven 3D film with Blender-rendered set pieces, a live three.js layer of hearts, and our photos and videos.

## Open it

- Double-click `index.html`. It needs an internet connection, because GSAP, Lenis and three.js load from jsDelivr.
- Or serve it: `python3 -m http.server 8000`, then open http://localhost:8000/

Best on a laptop with a trackpad, scrolled slowly. It also works on a phone.

## The chapters

| # | Chapter | What happens |
|---|---|---|
| 01 | The present | A Blender (Cycles) film scrubbed by scroll: the lid lifts, sparks and hearts rise, and the camera dives into the light |
| 02 | Us, everywhere | The camera flies forward through a 3D corridor of polaroids (move the mouse for parallax, tap a photo to open it) |
| 03 | A small truth | A message that reads itself in, word by word, with 3D hearts drifting behind |
| 04 | Rang Ratri nights | A 3D carousel of the Navratri photos. Scroll turns it; drag to spin it with inertia |
| 05 | Up close | A zoom-through: each photo flies out of the dark and past the camera |
| 06 | Moving pictures | The five videos on layered 3D screens. Tap one to watch it with sound |
| 07 | A letter | A letter that rises out of the dark |
| 08 | Make a wish | A Blender film pushes in on a "Nini" cake. Tap "Blow out the candles" for smoke, confetti and a burst of hearts |

Tap anywhere (outside photos and buttons) to pop little hearts. Tap her name in the opening for more.

## Edit the words

All the text is in `index.html`: the statement (`#statement`), the letter (`#paper`), the polaroid captions (`figcaption`) and the final lines (`#cakeFinal`).

## Files

```
index.html          the page
css/style.css       the look
js/main.js          scroll choreography, film players, 3D tracks, ring, the wish, confetti
js/hearts.js        the live three.js hearts
assets/photos/      the 20 photos
assets/videos/      the 5 videos and their posters
assets/seq/gift/    120 Cycles frames of the gift opening
assets/seq/cake/    72 Cycles frames of the cake, plus cake_off/ (candles out)
blender/scenes.py   the Blender scenes (gift box, cake); blender/render_all.sh re-renders both
```

Re-render the films (Blender 4.2+ at /Applications/Blender.app): `sh blender/render_all.sh`. Set `Q=preview` for more samples.

Built with GSAP 3.13, Lenis 1.3, three.js r170 and Blender Cycles.
