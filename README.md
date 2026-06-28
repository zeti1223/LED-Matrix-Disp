# LED Matrix Disp

This project contains WS2812B LED matrix control software for Arduino, plus a browser-based control panel for live control and preview.

## Contents

- `LEDMatrixDisp/LEDMatrixDisp.ino` - Arduino sketch for driving the LED matrix
- `web_ui/backend.py` - Flask + Socket.IO backend for the web UI
- `web_ui/static/` - Tailwind-based browser UI and preview logic

## Hardware

- Arduino-compatible board
- WS2812B LED strip or matrix
- Proper power supply (5V, sufficient current)
- Data line connected to the Arduino `DATA_PIN` pin (default: D6)

## Setup

1. Install the Arduino IDE.
2. Install the `FastLED` library using the Arduino Library Manager.
3. Open `LEDMatrixDisp/LEDMatrixDisp.ino` in the Arduino IDE.
4. Adjust `WIDTH`, `HEIGHT`, and `DATA_PIN` if you are using a different matrix.
5. Upload the sketch to the Arduino.
6. Make sure the board is connected over USB and available as a serial device.

## Arduino serial protocol

- `FRAME <len>` - send a raw RGB frame payload after the header
- `C r g b` - set the entire matrix to a static RGB color
- `H` or `?` - print the help text

The web UI renders animation patterns in the browser and streams them to the Arduino as raw RGB frames.

## Web UI

The browser UI is served by Flask and uses Tailwind via CDN. No front-end build step is required.

1. Create and activate the project virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate
```

2. Install the required Python packages:

```bash
pip install -r requirements.txt
```

3. Start the web backend:

```bash
python web_ui/backend.py
```

4. Open <http://localhost:5000> in your browser and use the controller.

## Web UI Features

- Serial port selection, connect, and disconnect controls
- Live preview of the selected pattern
- Static color, rainbow, theater chase, scanner, color wipe, pulse, and checker patterns
- RGB and hex color input modes
- Brightness and strobe controls
- Collapsible panels for a compact layout
