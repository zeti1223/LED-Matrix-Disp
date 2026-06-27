import sys
import time

try:
    import serial
    from serial.tools import list_ports
except ImportError:
    print('Missing pyserial library. Install it: pip install pyserial')
    sys.exit(1)

try:
    from PySide6.QtCore import Qt, QTimer
    from PySide6.QtGui import QColor
    from PySide6.QtWidgets import (
        QApplication,
        QComboBox,
        QFormLayout,
        QGroupBox,
        QHBoxLayout,
        QLabel,
        QLineEdit,
        QMainWindow,
        QMessageBox,
        QPushButton,
        QSlider,
        QTextEdit,
        QVBoxLayout,
        QWidget,
        QColorDialog,
    )
except ImportError:
    print('Missing Qt library. Install it: pip install PySide6')
    sys.exit(1)

PATTERNS = {
    0: 'Static color',
    1: 'Rainbow',
    2: 'Theater chase',
    3: 'Scanner',
    4: 'Color wipe',
}

BAUD_RATE = 115200


def list_serial_ports():
    return [port.device for port in list_ports.comports()]


def clamp(value, minimum, maximum):
    return max(minimum, min(maximum, value))


class LedMatrixController(QMainWindow):
    def __init__(self):
        super().__init__()
        self.ser = None
        self.setWindowTitle('LED Matrix Disp Controller')
        self.setMinimumSize(600, 540)

        self.port_combo = QComboBox()
        self.connect_button = QPushButton('Connect')
        self.status_label = QLabel('Disconnected')
        self.pattern_combo = QComboBox()
        self.r_input = QLineEdit('255')
        self.g_input = QLineEdit('255')
        self.b_input = QLineEdit('255')
        self.brightness_slider = QSlider(Qt.Horizontal)
        self.output_text = QTextEdit()

        self.setup_ui()
        self.refresh_ports()

        self.timer = QTimer(self)
        self.timer.timeout.connect(self.poll_serial)
        self.timer.start(200)

    def setup_ui(self):
        self.pattern_combo.addItems([f'{key} - {name}' for key, name in PATTERNS.items()])
        self.brightness_slider.setRange(0, 255)
        self.brightness_slider.setValue(128)

        self.port_combo.setEditable(False)
        self.pattern_combo.setEditable(False)
        self.r_input.setMaximumWidth(60)
        self.g_input.setMaximumWidth(60)
        self.b_input.setMaximumWidth(60)

        self.connect_button.clicked.connect(self.toggle_connection)

        connect_group = QGroupBox('Serial connection')
        connect_layout = QHBoxLayout(connect_group)
        connect_layout.addWidget(QLabel('Port:'))
        connect_layout.addWidget(self.port_combo)
        refresh_button = QPushButton('Refresh')
        refresh_button.clicked.connect(self.refresh_ports)
        connect_layout.addWidget(refresh_button)
        connect_layout.addWidget(self.connect_button)
        connect_layout.addWidget(QLabel('Status:'))
        connect_layout.addWidget(self.status_label)

        control_group = QGroupBox('Control')
        control_layout = QVBoxLayout(control_group)

        pattern_layout = QHBoxLayout()
        pattern_layout.addWidget(QLabel('Pattern:'))
        pattern_layout.addWidget(self.pattern_combo)
        pattern_button = QPushButton('Send pattern')
        pattern_button.clicked.connect(self.send_pattern)
        pattern_layout.addWidget(pattern_button)
        control_layout.addLayout(pattern_layout)

        color_group = QGroupBox('Color')
        color_layout = QHBoxLayout(color_group)
        color_layout.addWidget(QLabel('R'))
        color_layout.addWidget(self.r_input)
        color_layout.addWidget(QLabel('G'))
        color_layout.addWidget(self.g_input)
        color_layout.addWidget(QLabel('B'))
        color_layout.addWidget(self.b_input)
        pick_color_button = QPushButton('Pick color')
        pick_color_button.clicked.connect(self.pick_color)
        color_layout.addWidget(pick_color_button)
        send_color_button = QPushButton('Send color')
        send_color_button.clicked.connect(self.send_color)
        color_layout.addWidget(send_color_button)
        control_layout.addWidget(color_group)

        brightness_layout = QHBoxLayout()
        brightness_layout.addWidget(QLabel('Brightness:'))
        brightness_layout.addWidget(self.brightness_slider)
        brightness_send_button = QPushButton('Send')
        brightness_send_button.clicked.connect(self.send_brightness)
        brightness_layout.addWidget(brightness_send_button)
        control_layout.addLayout(brightness_layout)

        command_group = QGroupBox('Commands')
        command_layout = QHBoxLayout(command_group)
        status_button = QPushButton('Get status')
        status_button.clicked.connect(lambda: self.send_command('S'))
        help_button = QPushButton('Help')
        help_button.clicked.connect(lambda: self.send_command('H'))
        mirror_on_button = QPushButton('Mirror on')
        mirror_on_button.clicked.connect(lambda: self.send_command('M 1'))
        mirror_off_button = QPushButton('Mirror off')
        mirror_off_button.clicked.connect(lambda: self.send_command('M 0'))
        command_layout.addWidget(status_button)
        command_layout.addWidget(help_button)
        command_layout.addWidget(mirror_on_button)
        command_layout.addWidget(mirror_off_button)

        output_group = QGroupBox('Arduino output')
        output_layout = QVBoxLayout(output_group)
        self.output_text.setReadOnly(True)
        output_layout.addWidget(self.output_text)

        main_widget = QWidget()
        main_layout = QVBoxLayout(main_widget)
        main_layout.addWidget(connect_group)
        main_layout.addWidget(control_group)
        main_layout.addWidget(command_group)
        main_layout.addWidget(output_group)

        self.setCentralWidget(main_widget)
        self.set_controls_enabled(False)

    def refresh_ports(self):
        ports = list_serial_ports()
        self.port_combo.clear()
        self.port_combo.addItems(ports)
        if ports:
            self.port_combo.setCurrentIndex(0)
            self.status_label.setText('Select port and connect')
        else:
            self.status_label.setText('No serial ports found')
            self.append_output('No serial ports found. Connect an Arduino and click Refresh.\n')
            self.connect_button.setEnabled(False)
            return
        self.connect_button.setEnabled(True)

    def toggle_connection(self):
        if self.ser and self.ser.is_open:
            self.disconnect()
        else:
            self.connect()

    def connect(self):
        port_name = self.port_combo.currentText().strip()
        if not port_name:
            QMessageBox.warning(self, 'Connect', 'Select a serial port first.')
            return
        try:
            self.ser = serial.Serial(port_name, BAUD_RATE, timeout=1)
            time.sleep(1)
            self.ser.reset_input_buffer()
            self.status_label.setText(f'Connected: {port_name}')
            self.connect_button.setText('Disconnect')
            self.set_controls_enabled(True)
            self.append_output(f'Connected to {port_name}\n')
            self.send_command('H')
        except Exception as exc:
            QMessageBox.critical(self, 'Connection error', f'Failed to open port:\n{exc}')
            self.status_label.setText('Disconnected')
            self.ser = None
            self.set_controls_enabled(False)

    def disconnect(self):
        if self.ser:
            try:
                self.ser.close()
            except Exception:
                pass
        self.ser = None
        self.status_label.setText('Disconnected')
        self.connect_button.setText('Connect')
        self.set_controls_enabled(False)
        self.append_output('Disconnected\n')

    def set_controls_enabled(self, enabled):
        self.pattern_combo.setEnabled(enabled)
        self.r_input.setEnabled(enabled)
        self.g_input.setEnabled(enabled)
        self.b_input.setEnabled(enabled)
        self.brightness_slider.setEnabled(enabled)

    def send_pattern(self):
        current = self.pattern_combo.currentText()
        try:
            pattern = int(current.split(' - ')[0])
        except (ValueError, IndexError):
            QMessageBox.warning(self, 'Invalid pattern', 'Select a valid pattern first.')
            return
        self.send_command(f'P {pattern}')

    def send_color(self):
        try:
            r = clamp(int(self.r_input.text().strip()), 0, 255)
            g = clamp(int(self.g_input.text().strip()), 0, 255)
            b = clamp(int(self.b_input.text().strip()), 0, 255)
        except ValueError:
            QMessageBox.warning(self, 'Invalid color', 'Enter valid integer values between 0 and 255 for R, G, B.')
            return
        self.r_input.setText(str(r))
        self.g_input.setText(str(g))
        self.b_input.setText(str(b))
        self.send_command(f'C {r} {g} {b}')

    def pick_color(self):
        current = QColor(int(self.r_input.text() or 0), int(self.g_input.text() or 0), int(self.b_input.text() or 0))
        color = QColorDialog.getColor(current, self, 'Pick LED color')
        if color.isValid():
            self.r_input.setText(str(color.red()))
            self.g_input.setText(str(color.green()))
            self.b_input.setText(str(color.blue()))
            self.send_color()

    def send_brightness(self):
        value = self.brightness_slider.value()
        self.send_command(f'B {value}')

    def send_command(self, command):
        if not self.ser or not self.ser.is_open:
            QMessageBox.warning(self, 'Not connected', 'Connect to a port before sending commands.')
            return
        try:
            self.ser.write((command.strip() + '\n').encode('utf-8'))
        except Exception as exc:
            QMessageBox.critical(self, 'Send error', f'Failed to send command:\n{exc}')
            return

        time.sleep(0.05)
        response = ''
        try:
            response = self.ser.read(self.ser.in_waiting or 1).decode('utf-8', errors='ignore')
        except Exception:
            pass

        if response:
            self.append_output(response)
        else:
            self.append_output(f'Sent: {command}\n')

    def poll_serial(self):
        if self.ser and self.ser.is_open:
            try:
                while self.ser.in_waiting:
                    data = self.ser.read(self.ser.in_waiting).decode('utf-8', errors='ignore')
                    if data:
                        self.append_output(data)
            except Exception:
                pass

    def append_output(self, text):
        self.output_text.moveCursor(self.output_text.textCursor().End)
        self.output_text.insertPlainText(text)
        self.output_text.moveCursor(self.output_text.textCursor().End)

    def closeEvent(self, event):
        self.disconnect()
        event.accept()


def main():
    app = QApplication(sys.argv)
    window = LedMatrixController()
    window.show()
    sys.exit(app.exec())


if __name__ == '__main__':
    main()
