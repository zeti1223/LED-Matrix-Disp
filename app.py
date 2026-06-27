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
    from PySide6.QtGui import QColor, QTextCursor
    from PySide6.QtWidgets import (
        QApplication,
        QComboBox,
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
        self.setMinimumSize(740, 620)
        self.setStyleSheet('''
            QWidget { background: #121828; color: #d7e0ff; }
            QLabel { color: #d7e0ff; font-size: 12px; }
            QGroupBox { font-weight: 700; border: 1px solid #2f4064; border-radius: 14px; margin-top: 20px; color: #d7e0ff; background: #111d33; }
            QGroupBox::title { subcontrol-origin: margin; subcontrol-position: top left; padding: 0 14px; }
            QPushButton { min-height: 36px; padding: 10px 18px; border-radius: 10px; font-weight: 600; }
            QPushButton#primary { background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #3f66ff, stop:1 #5f7dff); color: white; border: none; }
            QPushButton#primary:hover { background: qlineargradient(x1:0, y1:0, x2:1, y2:1, stop:0 #557dff, stop:1 #6f8dff); }
            QPushButton#secondary { background: #1f2a45; color: #d7e0ff; border: 1px solid #324364; }
            QPushButton#secondary:hover { background: #2b3a5f; }
            QPushButton#flat { background: transparent; color: #d7e0ff; border: 1px solid transparent; }
            QPushButton#flat:hover { border-color: #3f66ff; }
            QLineEdit, QComboBox { background: #161f29; color: #e3ebff; border: 1px solid #34486d; border-radius: 10px; padding: 8px 10px; }
            QLineEdit:focus, QComboBox:focus { border-color: #3f66ff; }
            QComboBox QAbstractItemView { background: #161f29; color: #e3ebff; selection-background-color: #3f66ff; }
            QTextEdit { background: #0f1727; color: #e3ebff; border: 1px solid #23314f; border-radius: 10px; padding: 10px; }
            QSlider::groove:horizontal { height: 8px; border-radius: 4px; background: #283650; }
            QSlider::handle:horizontal { width: 18px; background: #3f66ff; margin: -5px 0; border-radius: 9px; }
            QScrollBar:vertical { width: 8px; background: #161f34; margin: 0px; }
            QScrollBar::handle:vertical { background: #3f66ff; border-radius: 4px; }
            QDialog, QMessageBox, QColorDialog { background: #111d33; color: #e3ebff; }
            QMessageBox QLabel, QColorDialog QLabel { color: #e3ebff; }
            QMessageBox QPushButton, QColorDialog QPushButton { background: #1f2a45; color: #e3ebff; border: 1px solid #324364; border-radius: 8px; }
            QMessageBox QPushButton:hover, QColorDialog QPushButton:hover { background: #2b3a5f; }
        ''')

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
        self.r_input.setAlignment(Qt.AlignCenter)
        self.g_input.setAlignment(Qt.AlignCenter)
        self.b_input.setAlignment(Qt.AlignCenter)

        self.connect_button.clicked.connect(self.toggle_connection)
        self.connect_button.setObjectName('primary')
        self.connect_button.setMinimumWidth(120)

        refresh_button = QPushButton('Refresh')
        refresh_button.setObjectName('secondary')
        refresh_button.clicked.connect(self.refresh_ports)
        refresh_button.setMinimumWidth(100)

        status_label_wrapper = QLabel('Status:')
        status_label_wrapper.setStyleSheet('color: #b8c4f3;')
        self.status_label.setStyleSheet('font-weight: 600; color: #f4f8ff;')

        connect_group = QGroupBox('Serial connection')
        connect_layout = QHBoxLayout(connect_group)
        connect_layout.setSpacing(14)
        connect_layout.addWidget(QLabel('Port:'))
        self.port_combo.setMinimumWidth(340)
        connect_layout.addWidget(self.port_combo, 1)
        connect_layout.addWidget(refresh_button)
        connect_layout.addWidget(self.connect_button)
        connect_layout.addStretch(1)
        connect_layout.addWidget(status_label_wrapper)
        connect_layout.addWidget(self.status_label)

        control_group = QGroupBox('Control')
        control_layout = QVBoxLayout(control_group)
        control_layout.setSpacing(16)
        control_layout.setContentsMargins(14, 18, 14, 14)

        pattern_layout = QHBoxLayout()
        pattern_layout.addWidget(QLabel('Pattern:'))
        self.pattern_combo.setMinimumWidth(320)
        pattern_layout.addWidget(self.pattern_combo)
        pattern_button = QPushButton('Send pattern')
        pattern_button.setObjectName('secondary')
        pattern_button.setMinimumWidth(140)
        pattern_button.clicked.connect(self.send_pattern)
        pattern_layout.addWidget(pattern_button)
        control_layout.addLayout(pattern_layout)

        color_group = QGroupBox('Color')
        color_layout = QVBoxLayout(color_group)
        color_layout.setSpacing(10)

        color_row = QHBoxLayout()
        color_row.setSpacing(12)
        for label, widget in [('R', self.r_input), ('G', self.g_input), ('B', self.b_input)]:
            color_row.addWidget(QLabel(label))
            widget.setFixedWidth(60)
            color_row.addWidget(widget)
        color_row.addStretch(1)
        color_layout.addLayout(color_row)

        action_row = QHBoxLayout()
        action_row.setSpacing(12)
        pick_color_button = QPushButton('Pick color')
        pick_color_button.setObjectName('secondary')
        pick_color_button.clicked.connect(self.pick_color)
        pick_color_button.setMinimumWidth(120)
        action_row.addWidget(pick_color_button)
        send_color_button = QPushButton('Send color')
        send_color_button.setObjectName('primary')
        send_color_button.clicked.connect(self.send_color)
        send_color_button.setMinimumWidth(120)
        action_row.addWidget(send_color_button)
        action_row.addStretch(1)
        color_layout.addLayout(action_row)

        control_layout.addWidget(color_group)

        brightness_layout = QHBoxLayout()
        brightness_layout.addWidget(QLabel('Brightness:'))
        self.brightness_slider.setMinimumWidth(340)
        brightness_layout.addWidget(self.brightness_slider)
        brightness_send_button = QPushButton('Send')
        brightness_send_button.setObjectName('secondary')
        brightness_send_button.setMinimumWidth(100)
        brightness_send_button.clicked.connect(self.send_brightness)
        brightness_layout.addWidget(brightness_send_button)
        control_layout.addLayout(brightness_layout)

        control_group.setLayout(control_layout)

        command_group = QGroupBox('Commands')
        command_layout = QHBoxLayout(command_group)
        command_layout.setSpacing(12)
        command_layout.addStretch(1)
        for text, cmd in [('Get status', 'S'), ('Help', 'H'), ('Mirror on', 'M 1'), ('Mirror off', 'M 0')]:
            button = QPushButton(text)
            button.setObjectName('secondary')
            button.setMinimumWidth(120)
            button.setMinimumHeight(42)
            button.clicked.connect(lambda checked, c=cmd: self.send_command(c))
            command_layout.addWidget(button)
        command_layout.addStretch(1)

        output_group = QGroupBox('Arduino output')
        output_layout = QVBoxLayout(output_group)
        self.output_text.setReadOnly(True)
        self.output_text.setMinimumHeight(240)
        self.output_text.setStyleSheet(self.output_text.styleSheet() + 'font-family: "Courier New", monospace; font-size: 12px;')
        output_layout.addWidget(self.output_text)

        main_widget = QWidget()
        main_layout = QVBoxLayout(main_widget)
        main_layout.setContentsMargins(18, 18, 18, 18)
        main_layout.setSpacing(18)

        title_label = QLabel('LED Matrix Disp Controller')
        title_label.setStyleSheet('font-size: 20px; font-weight: 700; color: #f4f8ff;')
        title_label.setAlignment(Qt.AlignCenter)
        main_layout.addWidget(title_label)
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
            self.show_message('No port found', 'No serial ports found. Connect an Arduino and click Refresh.', QMessageBox.Warning)
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
            self.show_message('Connect', 'Select a serial port first.', QMessageBox.Warning)
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
            self.show_message('Connection error', f'Failed to open port:\n{exc}', QMessageBox.Critical)
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

    def show_message(self, title, text, icon=QMessageBox.Information):
        msg = QMessageBox(self)
        msg.setWindowTitle(title)
        msg.setText(text)
        msg.setIcon(icon)
        msg.setStyleSheet('''
            QMessageBox { background: #111d33; color: #e3ebff; }
            QMessageBox QLabel { color: #e3ebff; }
            QMessageBox QPushButton { background: #1f2a45; color: #e3ebff; border: 1px solid #324364; border-radius: 8px; padding: 6px 12px; }
            QMessageBox QPushButton:hover { background: #2b3a5f; }
        ''')
        msg.exec()

    def send_pattern(self):
        current = self.pattern_combo.currentText()
        try:
            pattern = int(current.split(' - ')[0])
        except (ValueError, IndexError):
            self.show_message('Invalid pattern', 'Select a valid pattern first.', QMessageBox.Warning)
            return
        self.send_command(f'P {pattern}')

    def send_color(self):
        try:
            r = clamp(int(self.r_input.text().strip()), 0, 255)
            g = clamp(int(self.g_input.text().strip()), 0, 255)
            b = clamp(int(self.b_input.text().strip()), 0, 255)
        except ValueError:
            self.show_message('Invalid color', 'Enter valid integer values between 0 and 255 for R, G, B.', QMessageBox.Warning)
            return
        self.r_input.setText(str(r))
        self.g_input.setText(str(g))
        self.b_input.setText(str(b))
        self.send_command(f'C {r} {g} {b}')

    def pick_color(self):
        current = QColor(int(self.r_input.text() or 0), int(self.g_input.text() or 0), int(self.b_input.text() or 0))
        dialog = QColorDialog(current, self)
        dialog.setOption(QColorDialog.ShowAlphaChannel, False)
        dialog.setWindowTitle('Pick LED color')
        dialog.setStyleSheet('''
            QColorDialog { background: #111d33; color: #e3ebff; }
            QColorDialog QLabel { color: #e3ebff; }
            QColorDialog QPushButton { background: #1f2a45; color: #e3ebff; border: 1px solid #324364; border-radius: 8px; padding: 6px 10px; }
            QColorDialog QPushButton:hover { background: #2b3a5f; }
        ''')
        if dialog.exec() == QColorDialog.Accepted:
            color = dialog.currentColor()
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
            self.show_message('Not connected', 'Connect to a port before sending commands.', QMessageBox.Warning)
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
        cursor = self.output_text.textCursor()
        cursor.movePosition(QTextCursor.End)
        self.output_text.setTextCursor(cursor)
        self.output_text.insertPlainText(text)
        cursor.movePosition(QTextCursor.End)
        self.output_text.setTextCursor(cursor)

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
