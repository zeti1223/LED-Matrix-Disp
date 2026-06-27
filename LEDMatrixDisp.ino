#include <FastLED.h>

#define DATA_PIN    6
#define WIDTH       8
#define HEIGHT      8
#define NUM_LEDS    (WIDTH * HEIGHT)
#define LED_TYPE    WS2812B
#define COLOR_ORDER GRB

CRGB leds[NUM_LEDS];

uint8_t currentPattern = 0;
uint8_t brightness = 128;
uint8_t baseHue = 0;
uint16_t moveIndex = 0;
unsigned long lastUpdate = 0;
unsigned long interval = 50;
bool mirrorMode = false;

uint16_t XY(uint8_t x, uint8_t y) {
  if (mirrorMode) {
    x = WIDTH - 1 - x;
  }
  if (y % 2 == 0) {
    return y * WIDTH + x;
  } else {
    return y * WIDTH + (WIDTH - 1 - x);
  }
}

void setup() {
  Serial.begin(115200);
  FastLED.addLeds<LED_TYPE, DATA_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  FastLED.setBrightness(brightness);
  printHelp();
  setAllColor(CRGB::Black);
  FastLED.show();
}

void loop() {
  readSerialCommands();

  if (millis() - lastUpdate < interval) {
    return;
  }
  lastUpdate = millis();

  switch (currentPattern) {
    case 0:
      showStaticColor();
      break;
    case 1:
      showRainbow();
      break;
    case 2:
      showTheaterChase();
      break;
    case 3:
      showScanner();
      break;
    case 4:
      showColorWipe();
      break;
    default:
      showRainbow();
      break;
  }
  FastLED.show();
}

void setAllColor(const CRGB &color) {
  for (uint16_t i = 0; i < NUM_LEDS; i++) {
    leds[i] = color;
  }
}

void showStaticColor() {
  // Static color remains from last manual setting.
}

void showRainbow() {
  fill_rainbow(leds, NUM_LEDS, baseHue, 7);
  baseHue++;
}

void showTheaterChase() {
  fill_solid(leds, NUM_LEDS, CRGB::Black);
  for (uint16_t i = moveIndex; i < NUM_LEDS; i += 3) {
    leds[i] = CHSV((i * 10 + baseHue) & 255, 255, 255);
  }
  moveIndex = (moveIndex + 1) % 3;
  baseHue++;
}

void showScanner() {
  fill_solid(leds, NUM_LEDS, CRGB::Black);
  uint8_t position = moveIndex % (WIDTH * 2);
  uint8_t brightnessLevel = 255;
  for (uint8_t x = 0; x < WIDTH; x++) {
    for (uint8_t y = 0; y < HEIGHT; y++) {
      uint16_t index = XY(x, y);
      leds[index] = CRGB::Black;
    }
  }
  uint8_t scanX = position < WIDTH ? position : (WIDTH * 2 - 1 - position);
  for (uint8_t y = 0; y < HEIGHT; y++) {
    leds[XY(scanX, y)] = CHSV(baseHue, 255, brightnessLevel);
  }
  moveIndex = (moveIndex + 1) % (WIDTH * 2);
  if (position == 0 || position == WIDTH) {
    baseHue += 32;
  }
}

void showColorWipe() {
  uint16_t index = moveIndex % NUM_LEDS;
  uint8_t hue = (baseHue + index * 4) & 255;
  leds[index] = CHSV(hue, 255, 255);
  if (index == 0) {
    fill_solid(leds, NUM_LEDS, CRGB::Black);
  }
  moveIndex = (moveIndex + 1) % NUM_LEDS;
  if (moveIndex == 0) {
    baseHue += 20;
  }
}

void readSerialCommands() {
  while (Serial.available() > 0) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() == 0) {
      continue;
    }
    parseCommand(line);
  }
}

void parseCommand(const String &line) {
  char cmd = line.charAt(0);
  if (cmd == 'P' || cmd == 'p') {
    int value = line.substring(1).toInt();
    setPattern(value);
  } else if (cmd == 'C' || cmd == 'c') {
    int values[3] = {0, 0, 0};
    int index = 0;
    int start = 1;
    for (int i = 1; i <= line.length(); i++) {
      if (i == line.length() || line.charAt(i) == ' ') {
        if (index < 3) {
          values[index++] = line.substring(start, i).toInt();
        }
        start = i + 1;
      }
    }
    setColor(values[0], values[1], values[2]);
    currentPattern = 0;
  } else if (cmd == 'B' || cmd == 'b') {
    int value = line.substring(1).toInt();
    setBrightness(value);
  } else if (cmd == 'S' || cmd == 's') {
    printStatus();
  } else if (cmd == 'M' || cmd == 'm') {
    int value = line.substring(1).toInt();
    mirrorMode = (value != 0);
    Serial.print("Mirror mode: ");
    Serial.println(mirrorMode ? "ON" : "OFF");
  } else if (cmd == 'H' || cmd == 'h' || cmd == '?') {
    printHelp();
  } else {
    Serial.println("Ismeretlen parancs. Írj H vagy ? a segédlethez.");
  }
}

void setPattern(int pattern) {
  currentPattern = (pattern >= 0 && pattern <= 4) ? pattern : 0;
  moveIndex = 0;
  Serial.print("Minta beállítva: ");
  Serial.println(currentPattern);
}

void setColor(int r, int g, int b) {
  r = constrain(r, 0, 255);
  g = constrain(g, 0, 255);
  b = constrain(b, 0, 255);
  setAllColor(CRGB(r, g, b));
  FastLED.show();
  Serial.print("Szín beállítva: ");
  Serial.print(r);
  Serial.print(",");
  Serial.print(g);
  Serial.print(",");
  Serial.println(b);
}

void setBrightness(int value) {
  brightness = constrain(value, 0, 255);
  FastLED.setBrightness(brightness);
  Serial.print("Fényerő beállítva: ");
  Serial.println(brightness);
}

void printStatus() {
  Serial.println("--- LED Matrix státusz ---");
  Serial.print("Minta: ");
  Serial.println(currentPattern);
  Serial.print("Fényerő: ");
  Serial.println(brightness);
  Serial.print("Mirror: ");
  Serial.println(mirrorMode ? "ON" : "OFF");
  Serial.println("Parancsok: P, C, B, S, H");
}

void printHelp() {
  Serial.println("WS2812B LED Matrix vezérlés Arduino-val");
  Serial.println("Parancsok:");
  Serial.println("  P n   - minta választás (0: static, 1: rainbow, 2: theater, 3: scanner, 4: wipe)");
  Serial.println("  C r g b - RGB szín beállítása");
  Serial.println("  B v   - fényerő 0-255");
  Serial.println("  S     - státusz lekérdezése");
  Serial.println("  H/?   - segédlet");
  Serial.println("  M 0/1 - tükrözés kikapcsolása/bekapcsolása");
}
