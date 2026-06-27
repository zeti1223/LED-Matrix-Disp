# LED Matrix Disp

Ez a projekt egy WS2812B LED mátrix vezérlőszoftvert tartalmaz Arduino-hoz.

## Tartalom

- `LEDMatrixDisp.ino` - Arduino sketch a LED mátrix vezérléséhez
- `app.py` - egyszerű PC-s vezérlő szkript soros kapcsolaton keresztül

## Hardver

- Arduino kompatibilis lap
- WS2812B LED szalag vagy mátrix
- Megfelelő tápellátás (5V, elegendő áram)
- Data vonal az Arduino `DATA_PIN` lábára (alapértelmezett: D6)

## Beállítás

1. Telepítsd az Arduino IDE-t.
2. Telepítsd a `FastLED` könyvtárat az Arduino Library Manager segítségével.
3. Nyisd meg a `LEDMatrixDisp.ino` fájlt az Arduino IDE-ben.
4. Állítsd be a `WIDTH`, `HEIGHT` és `DATA_PIN` értékeket, ha eltérő mátrixot használsz.
5. Töltsd fel az Arduino-ra.

## Arduino parancsok

- `P n` - minta választás
  - `0` - statikus szín
  - `1` - szivárvány
  - `2` - theater chase
  - `3` - scanner
  - `4` - color wipe
- `C r g b` - RGB szín beállítása
- `B v` - fényerő beállítása (0-255)
- `S` - státusz lekérése
- `H` - segédlet
- `M 0/1` - tükrözés kikapcsolása/bekapcsolása

## PC-s vezérlés Python-nal

1. Telepítsd a `pyserial` és `PySide6` csomagokat:

   ```bash
   pip install -r requirements.txt
   ```

2. Futtasd az `app.py`-t:

   ```bash
   python app.py
   ```

3. A program Qt-alapú grafikus felületen indul, ahol kiválaszthatod a soros portot és vezérelheted a LED mátrixot.

## Megjegyzés

A LED mátrix tápellátása nagyon fontos. A WS2812B nagyon sok áramot fogyaszthat teljes fényerőn, ezért használj külső 5V tápegységet és közös földet az Arduino-val.
