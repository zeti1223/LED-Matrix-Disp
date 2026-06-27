import os
import time
import threading
from queue import Queue, Empty

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

    def connect(self, port, baud=115200, timeout=1):
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


@socketio.on("send_frame")
def handle_send_frame(data):
    frame = data.get("frame")
    if not isinstance(frame, list):
        socketio.emit("send_result", {"ok": False, "msg": "Invalid frame format", "command": "FRAME"})
        return
    try:
        payload = bytes(frame)
    except Exception as e:
        socketio.emit("send_result", {"ok": False, "msg": str(e), "command": "FRAME"})
        return
    header = f"FRAME {len(payload)}\n".encode("utf-8")
    ok, msg = serial_mgr.send_bytes(header + payload)
    socketio.emit("send_result", {"ok": ok, "msg": msg, "command": f"FRAME {len(payload)}"})


if __name__ == "__main__":
    print("Starting web UI on http://localhost:5000")
    socketio.run(app, host="0.0.0.0", port=5000)
