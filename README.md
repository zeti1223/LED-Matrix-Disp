# LED Matrix Disp

This project contains WS2812B LED matrix control software for Arduino.

## Contents

- `LEDMatrixDisp.ino` - Arduino sketch for controlling the LED matrix
- `web_ui/` - Web UI backend and static frontend

## Hardware

- Arduino-compatible board
- WS2812B LED strip or matrix
- Proper power supply (5V, sufficient current)
- Data line connected to the Arduino `DATA_PIN` pin (default: D6)

## Setup

1. Install the Arduino IDE.
2. Install the `FastLED` library using the Arduino Library Manager.
3. Open the `LEDMatrixDisp.ino` file in the Arduino IDE.
4. Adjust `WIDTH`, `HEIGHT`, and `DATA_PIN` if you are using a different matrix.
5. Upload the sketch to the Arduino.

## Arduino commands

- `P n` - select pattern
  - `0` - static color
  - `1` - rainbow
  - `2` - theater chase
  - `3` - scanner
  - `4` - color wipe
- `C r g b` - set RGB color
- `B v` - set brightness (0-255)
- `S` - request status
- `H` - help
- `M 0/1` - mirror off/on

## PC control with Python (Web UI)

1. Install the required Python packages into the project virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

1. Start the web backend:

```bash
python web_ui/backend.py
```

1. Open your browser at <http://localhost:5000> and use the controller.
