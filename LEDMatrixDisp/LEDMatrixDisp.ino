#include <avr/pgmspace.h>
#include <FastLED.h>

#define LED_PIN 6
#define MAX_FRAMES 20

#define X 8
#define Y 8
#define NUM_LEDS 64



CRGB leds[NUM_LEDS];


// Modes
byte displayMode = 0;
byte effectMode = 0;

// Effect Properties
int nextFrameDelay = 100;
int rainbowStartingHue = 0;
char text[64];
uint8_t animationBuffer[MAX_FRAMES][NUM_LEDS/2];
int animationFrameCount = 0;
CRGB effectColor = CRGB(0,0,0);
int textColor = 0;


// State Variables
int textXOffset = 0;
int animationCurrentFrame = 0;
bool animationIsPlaying = false;
int effectIndex1 = 0;


CRGB palette[10] = {
    CRGB::Black,
    CRGB::Red,
    CRGB::Green,
    CRGB::Blue,
    CRGB::Yellow,
    CRGB::Magenta,
    CRGB::Cyan,
    CRGB::White,
    CRGB(255,128,64),
    CRGB(64,128,255),
};


const byte fontArray[][7] PROGMEM = {
    // A
    {0b01110,
    0b10001,
    0b10001,
    0b11111,
    0b10001,
    0b10001,
    0b10001},

    // B
    {0b11110,
    0b10001,
    0b10001,
    0b11110,
    0b10001,
    0b10001,
    0b11110},

    // C
    {0b01111,
    0b10000,
    0b10000,
    0b10000,
    0b10000,
    0b10000,
    0b01111},

    // D
    {0b11110,
    0b10001,
    0b10001,
    0b10001,
    0b10001,
    0b10001,
    0b11110},

    // E
    {0b11111,
    0b10000,
    0b10000,
    0b11110,
    0b10000,
    0b10000,
    0b11111},

    // F
    {0b11111,
    0b10000,
    0b10000,
    0b11110,
    0b10000,
    0b10000,
    0b10000},

    // G
    {0b01111,
    0b10000,
    0b10000,
    0b10111,
    0b10001,
    0b10001,
    0b01111},

    // H
    {0b10001,
    0b10001,
    0b10001,
    0b11111,
    0b10001,
    0b10001,
    0b10001},

    // I
    {0b01110,
    0b00100,
    0b00100,
    0b00100,
    0b00100,
    0b00100,
    0b01110},

    // J
    {0b00111,
    0b00010,
    0b00010,
    0b00010,
    0b10010,
    0b10010,
    0b01100},

    // K
    {0b10001,
    0b10010,
    0b10100,
    0b11000,
    0b10100,
    0b10010,
    0b10001},

    // L
    {0b10000,
    0b10000,
    0b10000,
    0b10000,
    0b10000,
    0b10000,
    0b11111},

    // M
    {0b10001,
    0b11011,
    0b10101,
    0b10101,
    0b10001,
    0b10001,
    0b10001},

    // N
    {0b10001,
    0b11001,
    0b10101,
    0b10011,
    0b10001,
    0b10001,
    0b10001},

    // O
    {0b01110,
    0b10001,
    0b10001,
    0b10001,
    0b10001,
    0b10001,
    0b01110},

    // P
    {0b11110,
    0b10001,
    0b10001,
    0b11110,
    0b10000,
    0b10000,
    0b10000},

    // Q
    {0b01110,
    0b10001,
    0b10001,
    0b10001,
    0b10101,
    0b10010,
    0b01101},

    // R
    {0b11110,
    0b10001,
    0b10001,
    0b11110,
    0b10100,
    0b10010,
    0b10001},

    // S
    {0b01111,
    0b10000,
    0b10000,
    0b01110,
    0b00001,
    0b00001,
    0b11110},

    // T
    {0b11111,
    0b00100,
    0b00100,
    0b00100,
    0b00100,
    0b00100,
    0b00100},

    // U
    {0b10001,
    0b10001,
    0b10001,
    0b10001,
    0b10001,
    0b10001,
    0b01110},

    // V
    {0b10001,
    0b10001,
    0b10001,
    0b10001,
    0b10001,
    0b01010,
    0b00100},

    // W
    {0b10001,
    0b10001,
    0b10001,
    0b10101,
    0b10101,
    0b10101,
    0b01010},

    // X
    {0b10001,
    0b10001,
    0b01010,
    0b00100,
    0b01010,
    0b10001,
    0b10001},

    // Y
    {0b10001,
    0b10001,
    0b01010,
    0b00100,
    0b00100,
    0b00100,
    0b00100},

    // Z
    {0b11111,
    0b00001,
    0b00010,
    0b00100,
    0b01000,
    0b10000,
    0b11111},

    {0b00000,
    0b00000,
    0b00000,
    0b00000,
    0b00000,
    0b00000,
    0b00000},
    {0b01110,0b10001,0b10011,0b10101,0b11001,0b10001,0b01110}, // 0
    {0b00100,0b01100,0b00100,0b00100,0b00100,0b00100,0b01110}, // 1
    {0b01110,0b10001,0b00001,0b00010,0b00100,0b01000,0b11111}, // 2
    {0b11110,0b00001,0b00001,0b01110,0b00001,0b00001,0b11110}, // 3
    {0b00010,0b00110,0b01010,0b10010,0b11111,0b00010,0b00010}, // 4
    {0b11111,0b10000,0b10000,0b11110,0b00001,0b00001,0b11110}, // 5
    {0b01110,0b10000,0b10000,0b11110,0b10001,0b10001,0b01110}, // 6
    {0b11111,0b00001,0b00010,0b00100,0b01000,0b01000,0b01000}, // 7
    {0b01110,0b10001,0b10001,0b01110,0b10001,0b10001,0b01110}, // 8
    {0b01110,0b10001,0b10001,0b01111,0b00001,0b00001,0b01110}  // 9
};


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

void setup() {
    Serial.begin(9600);
    FastLED.addLeds<WS2812, LED_PIN, GRB>(leds, NUM_LEDS).setCorrection(TypicalLEDStrip);
    playBootAnimation();
}

void setPixelInAnimationBuffer(uint8_t frame, uint8_t index, uint8_t value) {
    uint8_t &b = animationBuffer[frame][index >> 1];
    if (index & 1) {
        b = (b & 0x0F) | (value << 4);   // high nibble
    } else {
        b = (b & 0xF0) | (value & 0x0F); // low nibble
    }
    if (frame >= MAX_FRAMES) return;
}

uint8_t getPixelInAnimationBuffer(uint8_t frame, uint8_t index) {
    uint8_t b = animationBuffer[frame][index >> 1];
    if (index & 1) {
        return b >> 4;
    } else {
        return b & 0x0F;
    }
    if (frame >= MAX_FRAMES) return;
}

void convertAnimationFrameBuffer(int frameIndex){
    for (int i = 0; i<NUM_LEDS; i++){
        leds[i] = palette[getPixelInAnimationBuffer(frameIndex,i)];
    }
}

int coordinatesToLedAddress(int x, int y){
    x++;y++;
    int address = X*y;
    if ((y%2)==0){address -=x;}
    else {address-=X-x+1;}
    return address;
}

void snakeEffect(){
    fadeToBlackBy(leds, NUM_LEDS, 40);
    leds[effectIndex1] = effectColor;
    effectIndex1++;
    if (effectIndex1>=NUM_LEDS){effectIndex1=0;}
}

void pulseEffect(){
    if (effectIndex1 <= 50){
        fill_solid(leds, NUM_LEDS, CRGB(
            (effectColor.r*effectIndex1)/50,
            (effectColor.g*effectIndex1)/50,
            (effectColor.b*effectIndex1)/50)
        );
    } else {
        fill_solid(leds, NUM_LEDS, CRGB(
            (effectColor.r*(100-effectIndex1))/50,
            (effectColor.g*(100-effectIndex1))/50,
            (effectColor.b*(100-effectIndex1))/50)
        );
    }
    effectIndex1++;
    if(effectIndex1>=100){effectIndex1=0;}
}

void scammerEffect(){
    for (int x=0; x<X;x++){
        if(effectIndex1>=1){
            leds[coordinatesToLedAddress(x,effectIndex1-1)] = CRGB(0,0,0);
        }
        else {
            leds[coordinatesToLedAddress(x,Y-1)] = CRGB(0,0,0);
        }
        leds[coordinatesToLedAddress(x,effectIndex1)] = effectColor;
    }
    effectIndex1++;
    if (effectIndex1>=Y){effectIndex1 = 0;}
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

void renderEffects(){
    switch (effectMode){
        case 0:
            rainbowEffect();
            rainbowStartingHue++;
            break;
        case 1:
            rainbowEffect();
            applyCheckerEffect();
            rainbowStartingHue++;
            break;
        case 2:
            scammerEffect();
            break;
        case 3:
            pulseEffect();
            break;
        case 4:
            snakeEffect();
            break;
        case 5:
            rainbowFill();
            rainbowStartingHue++;
            break;
        }
}


void parseSerialInput(){
    char buf[120];
    size_t len = Serial.readBytesUntil('\n', buf, sizeof(buf) - 1);
    buf[len] = '\0';

    char* cmd = strtok(buf, " ");
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

    if (!cmd) return;
    switch (cmd[0]){
        case 's':
            switch (cmd[1]){
                case 'm':
                    displayMode = ia;
                    break;
                case 'b':
                    FastLED.setBrightness(ia);
                    break;
                case 's':
                    nextFrameDelay = ia;
                    break;
            }
            break;
        case 'f':
            fill_solid(leds, NUM_LEDS, CRGB(ia,ib,ic));
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
                    effectIndex1 = 0;
                    break;
                case 'c':
                    effectColor = CRGB(ia,ib,ic);
                    break;
            }
            break;
        case 'a':
            switch (cmd[1]){
                case 's':
                    if (ia <= 10){
                        animationFrameCount = ia;
                    }
                    break;
                case 'f':
                    for (int i=0;i<NUM_LEDS;i++){
                        setPixelInAnimationBuffer(ia,i,b[i]);
                    }
                    break;
                case 'p':
                    animationIsPlaying = !animationIsPlaying;
                    break;
                case 'c':
                    palette[ia] = CRGB(ib,ic,id);
                    break;
            }
            break;
        case 't':
            switch(cmd[1]){
                case 's':
                    strncpy(text, a, sizeof(text));
                    text[63] = '\0';
                    break;
                case 'c':
                    textColor = ia;
                    break;
            }
            break;
        case 'd':
            if(displayMode==0){FastLED.show();}
            break;
    }
}

int charToIndex(char x) {
    if (x >= 'a' && x <= 'z') x -= 32;
    if (x >= 'A' && x <= 'Z') {return x - 'A';}
    if (x >= '0' && x <= '9') {return (x - '0')+27;}
    return 26;
}

void loadFontChar(byte dest[7], int fontIndex) {
    for (int y = 0; y < 7; y++) {
        dest[y] = pgm_read_byte(&fontArray[fontIndex][y]);
    }
}

void renderTextFrame(){
    int textLength = strlen(text);
    int topPadding = 2;
    fill_solid(leds,NUM_LEDS,CRGB(0,0,0));
    for (int x = 0; x < X; x++){
        int textColumn = x + textXOffset; 
        int charIndex = textColumn / 6;
        int charColumn = textColumn % 6;
        
        if (charIndex >= textLength) continue;
        if (charColumn == 5) continue;

        byte currentChar[7];
        loadFontChar(currentChar, charToIndex(text[charIndex]));
        
        for (int y = 0; y < 7; y++){
            bool on = currentChar[y] & (1 << (4 - charColumn));
            if (on){
                if (textColor == 0){leds[coordinatesToLedAddress(x,y+topPadding)] = effectColor;}
                if (textColor == 1){leds[coordinatesToLedAddress(x,y+topPadding)] = CHSV(rainbowStartingHue + ((x+y)*10), 255, 255);}
            }
        }
    }
}


void loop() {
    if (Serial.available()) {
        parseSerialInput();
    }
    if (animationIsPlaying && displayMode == 2){
        convertAnimationFrameBuffer(animationCurrentFrame);
        animationCurrentFrame++;
        if (animationCurrentFrame >= animationFrameCount) {
            animationCurrentFrame = 0;
        }
    }
    if (displayMode == 1){renderEffects();}
    if (displayMode == 3){
        renderTextFrame();
        textXOffset++;
        if (textColor == 1){rainbowStartingHue++;}
        int maxOffset = strlen(text) * 6;
        if (textXOffset > maxOffset) textXOffset = -X;
    }
    FastLED.show();
    static unsigned long last = 0;
    if (millis() - last < nextFrameDelay) return;
    last = millis();
}