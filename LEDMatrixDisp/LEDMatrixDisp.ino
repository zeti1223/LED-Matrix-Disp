#include <FastLED.h>

#define LED_PIN 13
#define NUM_LEDS 84
#define MAX_FRAMES 10

#define X 7
#define Y 12

CRGB leds[NUM_LEDS];

byte displayMode = 0;
byte effectMode = 0;
int nextFrameDelay = 100;
char animationBuffer[MAX_FRAMES][NUM_LEDS];
int animationFrameCount = 0;
bool animationIsPlaying = false;
int animationCurrentFrame = 0;

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

    for (int i = 0; i < 20; i++) {
        fadeToBlackBy(leds, NUM_LEDS, 50);
        FastLED.show();
        delay(20);
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


int coordinatesToLedAddress(int x, int y){
    x++;y++;
    int address = X*y;
    if ((y%2)==0){address -=x;}
    else {address-=X-x+1;}
    return address;
}


void generateNextEffectFrame(){

}

void parseSerialInput(){
    String input = Serial.readStringUntil('\n');
    char buf[120];
    input.toCharArray(buf, 120);

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
                    break;
                case 's':
                    nextFrameDelay = ia;
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
                    strcpy(animationBuffer[ia], b);
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

void loop() {
    if (Serial.available()) {
        parseSerialInput();
    }
    if (animationIsPlaying && displayMode == 2){
        convertAnimationFrameBuffer(animationCurrentFrame);
        FastLED.show();
        delay(nextFrameDelay);
        animationCurrentFrame++;
        if (animationCurrentFrame >= animationFrameCount) {
            animationCurrentFrame = 0;
        }
    }
}