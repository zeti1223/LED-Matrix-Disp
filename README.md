# LED Matrix Disp

Ez a projekt egy WS2812B LED mátrix vezérlőszoftvert tartalmaz Arduino-hoz.

## Tartalom

- `LEDMatrixDisp.ino` - Arduino sketch a LED mátrix vezérléséhez
- `web_ui/` - Web UI backend és statikus frontend (új)

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

## PC-s vezérlés Python-nal (Web UI)

1. Telepítsd a szükséges Python-csomagokat a projekt virtuális környezetébe:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

2. Indítsd el a webes backendet:

```bash
python web_ui/backend.py
```

3. Nyisd meg a böngészőt: <http://localhost:5000> és használd a vezérlőt.

Megjegyzés: ha már van működő `app.py`-d korábbi Qt-alkalmazással, azt eltávolítottam a projektből, mert a Web UI-t használjuk tovább.

### Web UI (új)

Egy egyszerű Web UI-t is készítettem, amely HTTP + WebSocket proxyként kommunikál a helyi soros porttal.

Futtatás:

```bash
pip install -r requirements.txt
python web_ui/backend.py
```

Majd nyisd meg a böngészőt: <http://localhost:5000>

Az oldal lehetővé teszi a portválasztást, minta, szín és fényerő küldését, valamint a soros kimenet megtekintését.

## Megjegyzés

A LED mátrix tápellátása nagyon fontos. A WS2812B nagyon sok áramot fogyaszthat teljes fényerőn, ezért használj külső 5V tápegységet és közös földet az Arduino-val.
