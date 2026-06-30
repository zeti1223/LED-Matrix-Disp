import os
import time
import threading
from queue import Queue, Empty
import json

from flask import Flask, send_from_directory, jsonify
from flask_socketio import SocketIO

try:
    import serial
    from serial.tools import list_ports
except Exception:
    serial = None


class SerialManager:
    def __init__(self, socketio):
        self.socketio = socketio
        self.lock = threading.Lock()
        self.ser = None
        self.read_thread = None
        self.reading = False
        self.write_q = Queue()

    def list_ports(self):
        if serial is None:
            return []
        return [p.device for p in list_ports.comports()]

    def connect(self, port, baud=9600, timeout=1):
        if serial is None:
            return False, "pyserial not installed"
        with self.lock:
            try:
                if self.ser and self.ser.is_open:
                    self.disconnect()
                self.ser = serial.Serial(port, baud, timeout=timeout)
                time.sleep(1)
                self.ser.reset_input_buffer()
                self.start_reader()
                return True, f"Connected to {port}"
            except Exception as e:
                self.ser = None
                return False, str(e)

    def disconnect(self):
        with self.lock:
            try:
                self.stop_reader()
                if self.ser:
                    self.ser.close()
            except Exception:
                pass
            self.ser = None

    def send(self, command: str):
        with self.lock:
            if not self.ser or not self.ser.is_open:
                return False, "Not connected"
            try:
                data = (command.strip() + "\n").encode("utf-8")
                self.ser.write(data)
                return True, "Sent"
            except Exception as e:
                return False, str(e)

    def send_bytes(self, data: bytes):
        with self.lock:
            if not self.ser or not self.ser.is_open:
                return False, "Not connected"
            try:
                self.ser.write(data)
                return True, "Sent bytes"
            except Exception as e:
                return False, str(e)

    def start_reader(self):
        if self.reading:
            return
        self.reading = True
        self.read_thread = threading.Thread(target=self._reader_loop, daemon=True)
        self.read_thread.start()

    def stop_reader(self):
        self.reading = False
        if self.read_thread:
            self.read_thread.join(timeout=0.5)
            self.read_thread = None

    def _reader_loop(self):
        while self.reading:
            try:
                if not self.ser:
                    time.sleep(0.1)
                    continue
                while self.ser.in_waiting:
                    data = self.ser.read(self.ser.in_waiting).decode(
                        "utf-8", errors="ignore"
                    )
                    if data:
                        # emit to all connected socket clients
                        try:
                            self.socketio.emit("serial_data", {"data": data})
                            # also broadcast to console listeners so clients' consoles stay in sync
                            try:
                                self.socketio.emit("console", {"text": data})
                            except Exception:
                                pass
                        except Exception:
                            pass
                time.sleep(0.1)
            except Exception:
                time.sleep(0.2)


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
static_folder = os.path.join(BASE_DIR, "static")

app = Flask(__name__, static_folder=static_folder, static_url_path="")
socketio = SocketIO(app, cors_allowed_origins="*")

serial_mgr = SerialManager(socketio)


class PortsWatcher:
    def __init__(self, interval=3.0):
        self.interval = interval
        self.thread = None
        self.running = False
        self.last = []

    def start(self):
        if self.thread and self.thread.is_alive():
            return
        self.running = True
        self.thread = threading.Thread(target=self._loop, daemon=True)
        self.thread.start()

    def stop(self):
        self.running = False
        if self.thread:
            self.thread.join(timeout=0.5)
            self.thread = None

    def _loop(self):
        while self.running:
            try:
                current = serial_mgr.list_ports()
                if current != self.last:
                    self.last = current
                    try:
                        socketio.emit("ports", current)
                    except Exception:
                        pass
                time.sleep(self.interval)
            except Exception:
                time.sleep(self.interval)


ports_watcher = PortsWatcher()
ports_watcher.start()


class StateManager:
    def __init__(self, path=None):
        self.lock = threading.Lock()
        self.path = path or os.path.join(BASE_DIR, "state.json")
        self.default = {
            # Pattern-related (commented out until Arduino implements patterns)
            # "pattern": 0,
            "r": 255,
            "g": 255,
            "b": 255,
            "brightness": 128,
            # Strobe-related (commented out until Arduino implements strobe)
            # "strobeOn": False,
            # "strobeSpeed": 8,
            # "strobeFill": 50,
        }
        self._state = self.default.copy()
        self._load()

    def _load(self):
        try:
            if os.path.exists(self.path):
                with open(self.path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        self._state.update(data)
        except Exception:
            pass

    def _save(self):
        try:
            with open(self.path, "w", encoding="utf-8") as f:
                json.dump(self._state, f)
        except Exception:
            pass

    def get_state(self):
        with self.lock:
            return self._state.copy()

    def update_state(self, updates: dict):
        if not isinstance(updates, dict):
            return self.get_state()
        with self.lock:
            for k, v in updates.items():
                if k in self.default:
                    self._state[k] = v
            self._save()
            return self._state.copy()


state_mgr = StateManager()


@app.route("/")
def index():
    return send_from_directory(static_folder, "index.html")


@app.route("/ports")
def ports():
    return jsonify(serial_mgr.list_ports())


@socketio.on("list_ports")
def handle_list_ports():
    emit = socketio.emit
    emit("ports", serial_mgr.list_ports())


@socketio.on("connect_port")
def handle_connect_port(data):
    port = data.get("port")
    ok, msg = serial_mgr.connect(port)
    socketio.emit("connect_result", {"ok": ok, "msg": msg})


@socketio.on("disconnect_port")
def handle_disconnect_port(data=None):
    serial_mgr.disconnect()
    socketio.emit("disconnect_result", {"ok": True})


@socketio.on("send_command")
def handle_send_command(data):
    cmd = data.get("command", "")
    ok, msg = serial_mgr.send(cmd)
    socketio.emit("send_result", {"ok": ok, "msg": msg, "command": cmd})


@socketio.on("set_brightness")
def handle_set_brightness(data):
    brightness = data.get("brightness", 128)
    cmd = f"sb {brightness}"
    ok, msg = serial_mgr.send(cmd)
    if ok:
        serial_mgr.send("d")
    socketio.emit("send_result", {"ok": ok, "msg": msg, "command": cmd})


@socketio.on("fill_color")
def handle_fill_color(data):
    r = data.get("r", 0)
    g = data.get("g", 0)
    b = data.get("b", 0)
    cmd = f"f {r} {g} {b}"
    ok, msg = serial_mgr.send(cmd)
    if ok:
        serial_mgr.send("d")
    socketio.emit("send_result", {"ok": ok, "msg": msg, "command": cmd})


@socketio.on("set_display_mode")
def handle_set_display_mode(data):
    mode = data.get("mode", 0)
    cmd = f"sm {mode}"
    ok, msg = serial_mgr.send(cmd)
    socketio.emit("send_result", {"ok": ok, "msg": msg, "command": cmd})


# Pattern-related commands (commented out until Arduino implements patterns)
# @socketio.on("set_pattern")
# def handle_set_pattern(data):
#     pattern = data.get("pattern", 0)
#     cmd = f"em {pattern}"
#     ok, msg = serial_mgr.send(cmd)
#     socketio.emit("send_result", {"ok": ok, "msg": msg, "command": cmd})


# Animation commands (commented out until Arduino implements animation patterns)
# @socketio.on("set_animation_frame_count")
# def handle_set_animation_frame_count(data):
#     count = data.get("count", 0)
#     cmd = f"as {count}"
#     ok, msg = serial_mgr.send(cmd)
#     socketio.emit("send_result", {"ok": ok, "msg": msg, "command": cmd})


# @socketio.on("set_animation_frame")
# def handle_set_animation_frame(data):
#     frame_index = data.get("frame_index", 0)
#     frame_data = data.get("data", "")
#     cmd = f"af {frame_index} {frame_data}"
#     ok, msg = serial_mgr.send(cmd)
#     socketio.emit("send_result", {"ok": ok, "msg": msg, "command": cmd})


# @socketio.on("set_animation_delay")
# def handle_set_animation_delay(data):
#     delay = data.get("delay", 100)
#     cmd = f"aw {delay}"
#     ok, msg = serial_mgr.send(cmd)
#     socketio.emit("send_result", {"ok": ok, "msg": msg, "command": cmd})


# @socketio.on("toggle_animation")
# def handle_toggle_animation(data):
#     cmd = "ap"
#     ok, msg = serial_mgr.send(cmd)
#     socketio.emit("send_result", {"ok": ok, "msg": msg, "command": cmd})


@socketio.on("send_frame")
def handle_send_frame(data):
    frame = data.get("frame")
    if not isinstance(frame, list):
        socketio.emit(
            "send_result",
            {"ok": False, "msg": "Invalid frame format", "command": "FRAME"},
        )
        return
    
    # Send individual LED commands for each pixel
    # Frame format: [r0, g0, b0, r1, g1, b1, ...] for 64 LEDs
    ok = True
    msg = "Sent"
    
    for i in range(0, len(frame), 3):
        if i + 2 >= len(frame):
            break
        r = frame[i]
        g = frame[i + 1]
        b = frame[i + 2]
        led_index = i // 3
        
        # Convert LED index to x,y coordinates
        x = led_index % 8
        y = led_index // 8
        
        cmd = f"o {x} {y} {r} {g} {b}"
        result, result_msg = serial_mgr.send(cmd)
        if not result:
            ok = False
            msg = result_msg
            break
    
    # Trigger display update
    if ok:
        serial_mgr.send("d")
    
    socketio.emit("send_result", {"ok": ok, "msg": msg, "command": "FRAME"})


@socketio.on("get_state")
def handle_get_state():
    socketio.emit("state", state_mgr.get_state())


@socketio.on("update_state")
def handle_update_state(data):
    new = state_mgr.update_state(data or {})
    # broadcast updated canonical state to all clients
    socketio.emit("state", new)


@socketio.on("console")
def handle_console(data):
    try:
        text = data.get("text", "") if isinstance(data, dict) else str(data)
        if text:
            socketio.emit("console", {"text": text})
    except Exception:
        pass


if __name__ == "__main__":
    print("Starting web UI on http://localhost:5000")
    socketio.run(app, host="0.0.0.0", port=5000)
