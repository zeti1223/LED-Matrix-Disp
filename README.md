# LED Matrix Disp

This project contains WS2812B LED matrix control software for Arduino, plus a browser-based control panel for live control and preview using WebSerial API.

## Contents

- `LEDMatrixDisp/LEDMatrixDisp.ino` - Arduino sketch for driving the LED matrix
- `web_ui/static/` - Tailwind-based browser UI with WebSerial communication

## Hardware

- Arduino-compatible board
- WS2812B LED strip
- Proper power supply (5V, sufficient current)
- Data line connected to the Arduino `DATA_PIN` pin (for me it's D6)

## Setup

1. Install the Arduino IDE.
2. Install the `FastLED` library using the Arduino Library Manager.
3. Open `LEDMatrixDisp/LEDMatrixDisp.ino` in the Arduino IDE.
4. Adjust `WIDTH`, `HEIGHT`, and `DATA_PIN` if you are using a different matrix.
5. Upload the sketch to the Arduino.
6. Make sure the board is connected over USB.

The web UI renders animation patterns in the browser and streams them to the Arduino using WebSerial.

## Web UI

The browser UI uses WebSerial API for direct serial communication from the browser. No backend server is required.

**Important:** WebSerial requires HTTPS or localhost.

### Serving the Web UI

```bash
cd web_ui
npm install
npm start

# Then open http://localhost:8000 in your browser
```

**Important:** WebSerial API only works on `localhost` or HTTPS. If you use an IP address (e.g., `http://192.168.0.202:8000`), it will not work. For remote access, you need to set up HTTPS.

## Web UI Features

- WebSerial-based direct serial communication (no backend required)
- Serial port connection via browser
- Static color control with RGB and hex input modes
- Brightness control
- Animation system with localStorage persistence
- Animation Maker for creating custom animations
- Collapsible panels for a compact layout

## Credits

- Arduino code forked from: https://github.com/FonixPython/LEDMatrix/ 