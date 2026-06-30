# LED Matrix Disp

This project contains WS2812B LED matrix control software for Arduino, plus a browser-based control panel for live control and preview using WebSerial API.

## Contents

- `LEDMatrixDisp/LEDMatrixDisp.ino` - Arduino sketch for driving the LED matrix
- `web_ui/static/` - Tailwind-based browser UI with WebSerial communication

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
6. Make sure the board is connected over USB.

## Arduino serial protocol

- `f r g b` - set the entire matrix to a static RGB color
- `sb brightness` - set brightness (0-255)
- `sm mode` - set display mode (0=static, 1=preview, 2=animation)
- `o x y r g b` - set individual LED at position (x,y) to RGB color
- `d` - display update (trigger refresh)
- `as count` - set animation frame count
- `af index data` - set animation frame at index with color data
- `aw delay` - set animation delay in milliseconds
- `ap` - toggle animation play/pause

The web UI renders animation patterns in the browser and streams them to the Arduino using WebSerial.

## Web UI

The browser UI uses WebSerial API for direct serial communication from the browser. No backend server is required.

**Important:** WebSerial only works in Chromium-based browsers (Chrome, Edge, Opera) and requires HTTPS or localhost.

### Using the Web UI

1. Open `web_ui/static/index.html` in a Chromium-based browser (Chrome, Edge, Opera).
2. Click "Connect" to select and connect to your Arduino's serial port.
3. Use the controls to set colors, brightness, and send animations.
4. Use the Animation Maker (`animation-maker.html`) to create custom animations.

### Serving the Web UI (Optional)

If you want to serve the web UI locally:

```bash
# Using npm (recommended)
cd web_ui
npm install
npm start

# Or using Python 3
cd web_ui/static
python -m http.server 8000

# Then open http://localhost:8000 in your browser
```

**Important:** WebSerial API only works on `localhost` or HTTPS. If you use an IP address (e.g., `http://192.168.0.202:8000`), it will not work. For remote access, you need to set up HTTPS.

## Web UI Features

- WebSerial-based direct serial communication (no backend required)
- Serial port connection via browser
- Live preview of the selected pattern
- Static color control with RGB and hex input modes
- Brightness control
- Animation system with localStorage persistence
- Animation Maker for creating custom animations
- Collapsible panels for a compact layout

## Credits

- Arduino code from: https://github.com/FonixPython/LEDMatrix/ 