# Command Reference Guide

## `s` — Effect Mode Configuration

### `sm` — Device Mode

Sets the primary operating mode of the device.

* `0`: Single frame mode
* `1`: Effect mode
* `2`: Animation mode
* `3`: Text mode

### `sb <value>` — LED Brightness

Sets the overall brightness of the LED strip.

* **Range:** `0`–`255`

### `ss <ms>` — Global Speed

Sets the system speed/delay in milliseconds.

---

## Buffer Controls

### `f <r> <g> <b>` — Solid Fill

Fills the entire buffer with a single solid RGB color.

### `o <x> <y> <r> <g> <b>` — Offset / Pixel Manipulation

Changes the color of specific selected pixels in the buffer at the given coordinates.

### `d` — Display Buffer

Displays the current buffer.

## `e` — Effect Mode Configuration

*Configures behavior when Mode is set to Effect (`sm 1`).*

* ### `em <effect_id>` — Select Effect

* `0`: Rainbow (starts from the corner)
* `1`: Checker (line-by-line, alternating between custom color and rainbow)
* `2`: Scammer
* `3`: Pulse
* `4`: Snake (uses custom color)
* `5`: Rainbow fill

* ### `es <ms>` — Effect Speed

Sets the animation speed for the active effect in milliseconds.

* ### `ec <r> <g> <b>` — Effect Color

Sets a custom RGB color utilized by specific effects (like Snake or Checker).

---

## `a` — Animation Mode Configuration

*Configures behavior when Mode is set to Animation (`sm 2`). Only supports 8-color mode.*

* ### `as <frame_count>` — Sequence Length

Defines the total number of frames in the animation sequence. **Maximum: 20 frames.**

* ### `af <frame_index> <pixel_count>` — Frame Buffer Fill

Sets or targets a specific frame's buffer, indexed starting from `0`.

* ### `ap` — Play Animation

Starts playback of the configured animation sequence.

* ### `ac <palette_index> <r> <g> <b>` — Custom Palette

Builds a custom color palette. Maps an RGB color to an index.

* **Palette Index Range:** `1`–`9` (Out of 10 total available slots)

---

## `t` — Text Mode Configuration

*Configures behavior when Mode is set to Text (`sm 3`).*

* ### `ts <text>` — Set Text

Sets the text string to display. Use an underscore (`_`) to represent spaces.

* ### `tc <color_mode>` — Text Color Mode

* `0`: Solid color (inherits from the configured effect color `ec`)
* `1`: Rainbow color mode
