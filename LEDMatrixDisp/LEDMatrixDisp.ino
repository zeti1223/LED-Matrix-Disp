#include <FastLED.h>

#define DATA_PIN    6
#define WIDTH       8
#define HEIGHT      8
#define NUM_LEDS    (WIDTH * HEIGHT)
#define LED_TYPE    WS2812B
#define COLOR_ORDER GRB

CRGB leds[NUM_LEDS];

const int FRAME_BUFFER_SIZE = NUM_LEDS * 3;
uint8_t frameBuffer[FRAME_BUFFER_SIZE];
int remainingFrameBytes = 0;
int frameIndex = 0;
String commandLine = "";

void setup() {
  Serial.begin(115200);
  FastLED.addLeds<LED_TYPE, DATA_PIN, COLOR_ORDER>(leds, NUM_LEDS);
  FastLED.setBrightness(255);
  printHelp();
  setAllColor(CRGB::Black);
  FastLED.show();
}

void loop() {
  readSerialCommands();
}

void setAllColor(const CRGB &color) {
  for (uint16_t i = 0; i < NUM_LEDS; i++) {
    leds[i] = color;
  }
}

void readSerialCommands() {
  // Priority: read raw frame bytes if waiting
  if (remainingFrameBytes > 0) {
    int availableBytes = Serial.available();
    int toRead = min(availableBytes, remainingFrameBytes);
    int count = Serial.readBytes(frameBuffer + frameIndex, toRead);
    frameIndex += count;
    remainingFrameBytes -= count;

    if (remainingFrameBytes == 0) {
      applyFrame();
      frameIndex = 0;
    }
    return;  // Exit here - do NOT process text commands during frame read
  }

  // Text command processing
  while (Serial.available() > 0) {
    char c = Serial.read();
    if (c == '\r') {
      continue;
    }
    if (c == '\n') {
      if (commandLine.length() > 0) {
        commandLine.trim();
        if (commandLine.length() > 0) {
          parseCommand(commandLine);
        }
        commandLine = "";
      }
    } else {
      commandLine += c;
    }
  }
}

void applyFrame() {
  for (uint16_t i = 0; i < NUM_LEDS; i++) {
    int base = i * 3;
    leds[i] = CRGB(frameBuffer[base], frameBuffer[base + 1], frameBuffer[base + 2]);
  }
  FastLED.show();
}

void parseCommand(const String &line) {
  if (line.startsWith("FRAME")) {
    int len = line.substring(5).toInt();
    if (len <= 0 || len > FRAME_BUFFER_SIZE) {
      Serial.println("Invalid frame size");
      return;
    }
    remainingFrameBytes = len;
    frameIndex = 0;
    return;
  }

  char cmd = line.charAt(0);
  if (cmd == 'C' || cmd == 'c') {
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
    setAllColor(CRGB(constrain(values[0], 0, 255), constrain(values[1], 0, 255), constrain(values[2], 0, 255)));
    FastLED.show();
  } else if (cmd == 'H' || cmd == 'h' || cmd == '?') {
    printHelp();
  }
}

void printHelp() {
  Serial.println("WS2812B LED Matrix renderer");
  Serial.println("Commands:");
  Serial.println("  FRAME <len> - send raw RGB frame payload after header");
  Serial.println("  C r g b   - set static color frame");
  Serial.println("  H/?       - help");
}
