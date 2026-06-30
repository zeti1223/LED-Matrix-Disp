#include <FastLED.h>

#define LED_PIN 6
#define MAX_FRAMES 10

#define X 8
#define Y 8
#define NUM_LEDS 64

CRGB leds[NUM_LEDS];

byte displayMode = 0;
byte effectMode = 6;
int nextFrameDelay = 100;
char animationBuffer[MAX_FRAMES][NUM_LEDS];
int animationFrameCount = 0;
bool animationIsPlaying = false;
int animationCurrentFrame = 0;
CRGB effectColor = CRGB(0,0,0);
CRGB staticColor = CRGB(0,0,0);
int rainbowStartingHue = 0;

unsigned long lastUpdateTime = 0;

int snakeCurrentLed = 0;
int pulseCurrentBrightness = 0;
bool pulseFadingUp = true;
int scannerCurrentRow = 0;

const int SERIAL_BUFFER_SIZE = 128;
char serialBuffer[SERIAL_BUFFER_SIZE];
int serialBufferIndex = 0;


void setup() {
    Serial.begin(9600);
    FastLED.addLeds<WS2812, LED_PIN, GRB>(leds, NUM_LEDS).setCorrection(TypicalLEDStrip);
    playBootAnimation();
}

void playBootAnimation() {
    for (int i = 0; i < NUM_LEDS; i++) {
        fadeToBlackBy(leds, NUM_LEDS, 40);
        leds[i] = CRGB(0, 255, 0);
        FastLED.show();
        delay(15);
    }

    fill_solid(leds, NUM_LEDS, CRGB(0, 255, 0));
    FastLED.show();
    delay(500);

    fill_solid(leds, NUM_LEDS, CRGB(0, 0, 0));
    FastLED.show();
    delay(300);
}

void convertAnimationFrameBuffer(int frameIndex){
    for (int i = 0; i<NUM_LEDS; i++){
        switch (animationBuffer[frameIndex][i]){
            case '0':
                leds[i] = CRGB(0,0,0);
                break;
            case '1':
                leds[i] = CRGB(255,0,0);
                break;
            case '2':
                leds[i] = CRGB(0,255,0);
                break;
            case '3':
                leds[i] = CRGB(0,0,255);
                break;
            case '4':
                leds[i] = CRGB(255,255,0);
                break;
            case '5':
                leds[i] = CRGB(255,0,255);
                break;
            case '6':
                leds[i] = CRGB(0,255,255);
                break;
            case '7':
                leds[i] = CRGB(255,255,255);
                break;
        }
    }
}

int coordinatesToLedAddress(int x, int y) {
    if (y % 2 == 0) {
        return y * X + x;
    } else {
        return y * X + (X - 1 - x);
    }
}

void resetEffectState() {
    snakeCurrentLed = 0;
    pulseCurrentBrightness = 0;
    pulseFadingUp = true;
    scannerCurrentRow = 0;
    lastUpdateTime = millis();
}

void resetAnimationState() {
    animationCurrentFrame = 0;
    lastUpdateTime = millis();
}

void runSnakeStep() {
    fadeToBlackBy(leds, NUM_LEDS, 40);
    leds[snakeCurrentLed] = effectColor;
    FastLED.show();
    
    snakeCurrentLed++;
    if (snakeCurrentLed >= NUM_LEDS) {
        snakeCurrentLed = 0;
    }
}

void runPulseStep() {
    fill_solid(leds, NUM_LEDS, CRGB(
        (effectColor.r * pulseCurrentBrightness) / 100,
        (effectColor.g * pulseCurrentBrightness) / 100,
        (effectColor.b * pulseCurrentBrightness) / 100
    ));
    FastLED.show();
    
    if (pulseFadingUp) {
        pulseCurrentBrightness++;
        if (pulseCurrentBrightness >= 100) {
            pulseFadingUp = false;
        }
    } else {
        pulseCurrentBrightness--;
        if (pulseCurrentBrightness <= 0) {
            pulseFadingUp = true;
        }
    }
}

void runScannerStep() {
    int prevRow = (scannerCurrentRow == 0) ? (Y - 1) : (scannerCurrentRow - 1);
    for (int x = 0; x < X; x++) {
        leds[coordinatesToLedAddress(x, prevRow)] = CRGB(0, 0, 0);
    }
    
    for (int x = 0; x < X; x++) {
        leds[coordinatesToLedAddress(x, scannerCurrentRow)] = effectColor;
    }
    FastLED.show();
    
    scannerCurrentRow++;
    if (scannerCurrentRow >= Y) {
        scannerCurrentRow = 0;
    }
}

void rainbowEffect(){
    for (int y=0;y<Y;y++){
        for (int x=0;x<X;x++){
            leds[coordinatesToLedAddress(x,y)]=CHSV(rainbowStartingHue + ((x+y)*10), 255, 255);
        }
    }
}

void applyCheckerEffect(){
    for (int y=0;y<Y;y++){
        for (int x=0;x<X;x++){
            if ((((x%2) == 0)&&((y%2) != 0) || ((x%2) != 0)&&((y%2) == 0))&&((rainbowStartingHue%2)==0)){
                leds[coordinatesToLedAddress(x,y)]=effectColor;
            }
            if ((((x%2) == 0)&&((y%2) == 0) || ((x%2) != 0)&&((y%2) != 0))&&((rainbowStartingHue%2) != 0)){ 
                leds[coordinatesToLedAddress(x,y)]=effectColor;
            }
        }
    }
}

void rainbowFill(){
    fill_solid(leds,NUM_LEDS,CHSV(rainbowStartingHue, 255, 255));
}

void runRainbowStep() {
    rainbowEffect();
    FastLED.show();
    rainbowStartingHue++;
}

void runRainbowCheckerStep() {
    rainbowEffect();
    applyCheckerEffect();
    FastLED.show();
    rainbowStartingHue++;
}

void runRainbowFillStep() {
    rainbowFill();
    FastLED.show();
    rainbowStartingHue++;
}

void runStaticColorStep() {
    fill_solid(leds, NUM_LEDS, staticColor);
    FastLED.show();
}

void renderEffectsStep(){
    switch (effectMode){
        case 0:
            runRainbowStep();
            break;
        case 1:
            runRainbowCheckerStep();
            break;
        case 2:
            runScannerStep();
            break;
        case 3:
            runPulseStep();
            break;
        case 4:
            runSnakeStep();
            break;
        case 5:
            runRainbowFillStep();
            break;
        case 6:
            runStaticColorStep();
            break;
    }
}

void parseCommand(char* buf) {
    char* cmd = strtok(buf, " ");
    if (!cmd) return;

    char* a   = strtok(NULL, " ");
    char* b   = strtok(NULL, " ");
    char* c   = strtok(NULL, " ");
    char* d   = strtok(NULL, " ");
    char* e   = strtok(NULL, " ");

    int ia = a ? atoi(a) : 0;
    int ib = b ? atoi(b) : 0;
    int ic = c ? atoi(c) : 0;
    int id = d ? atoi(d) : 0;
    int ie = e ? atoi(e) : 0;

    switch (cmd[0]){
        case 's':
            switch (cmd[1]){
                case 'm':
                    displayMode = ia;
                    resetEffectState();
                    resetAnimationState();
                    break;
                case 's':
                    switch (cmd[2]){
                        case 'h':
                            break;
                        case 'f':
                            break;
                    }
                    break;
                case 'b':
                    FastLED.setBrightness(ia);
                    break;
            }
            break;
        case 'f':
            staticColor = CRGB(ia,ib,ic);
            fill_solid(leds, NUM_LEDS, staticColor);
            break;
        case 'o':{
            if (ia >= 0 && ia < X && ib >= 0 && ib < Y) {
                int address = coordinatesToLedAddress(ia,ib);
                leds[address] = CRGB(ic,id,ie);
            }
            break;
        }
        case 'e':
            switch (cmd[1]){
                case 'm':
                    effectMode = ia;
                    resetEffectState();
                    break;
                case 's':
                    nextFrameDelay = ia;
                    break;
                case 'c':
                    effectColor = CRGB(ia,ib,ic);
                    break;
            }
            break;
        case 'a':
            switch (cmd[1]){
                case 's':
                    if (ia <= MAX_FRAMES){
                        animationFrameCount = ia;
                    }
                    break;
                case 'f':
                    if (b && ia >= 0 && ia < MAX_FRAMES) {
                        int len = strlen(b);
                        if (len > NUM_LEDS) len = NUM_LEDS;
                        memcpy(animationBuffer[ia], b, len);
                        if (len < NUM_LEDS) {
                            memset(animationBuffer[ia] + len, '0', NUM_LEDS - len);
                        }
                    }
                    break;
                case 'w':
                    nextFrameDelay = ia;
                    break;
                case 'p':
                    animationIsPlaying = !animationIsPlaying;
                    break;
            }
            break;
        case 'd':
            FastLED.show();
            break;
    }
}

void checkSerial() {
    while (Serial.available() > 0) {
        char c = Serial.read();
        if (c == '\n' || c == '\r') {
            if (serialBufferIndex > 0) {
                serialBuffer[serialBufferIndex] = '\0';
                parseCommand(serialBuffer);
                serialBufferIndex = 0;
            }
        } else {
            if (serialBufferIndex < SERIAL_BUFFER_SIZE - 1) {
                serialBuffer[serialBufferIndex++] = c;
            }
        }
    }
}

void loop() {
    checkSerial();

    unsigned long currentTime = millis();

    if (displayMode == 2 && animationIsPlaying) {
        if (currentTime - lastUpdateTime >= (unsigned long)nextFrameDelay) {
            lastUpdateTime = currentTime;
            convertAnimationFrameBuffer(animationCurrentFrame);
            FastLED.show();
            animationCurrentFrame++;
            if (animationCurrentFrame >= animationFrameCount) {
                animationCurrentFrame = 0;
            }
        }
    }
    else if (displayMode == 1) {
        unsigned long currentDelay = nextFrameDelay;
        if (effectMode == 3) {
            if (pulseFadingUp) {
                currentDelay = min(100, nextFrameDelay);
            } else {
                currentDelay = min(30, nextFrameDelay);
            }
        }

        if (currentTime - lastUpdateTime >= currentDelay) {
            lastUpdateTime = currentTime;
            renderEffectsStep();
        }
    }
}