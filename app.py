import sys
import time
import tkinter as tk
from tkinter import ttk, messagebox, colorchooser

try:
    import serial
    from serial.tools import list_ports
except ImportError:
    message = 'Missing pyserial library. Install it: pip install pyserial'
    print(message)
    sys.exit(1)

PATTERNS = {
    0: 'Static color',
    1: 'Rainbow',
    2: 'Theater chase',
    3: 'Scanner',
    4: 'Color wipe'
}

BAUD_RATE = 115200


def list_serial_ports():
    return [port.device for port in list_ports.comports()]


def clamp(value, minimum, maximum):
    return max(minimum, min(maximum, value))


class LEDControllerApp:
    def __init__(self):
        self.ser = None
        self.root = tk.Tk()
        self.root.title('LED Matrix Disp Controller')
        self.root.geometry('550x520')
        self.root.resizable(False, False)

        self.port_var = tk.StringVar()
        self.pattern_var = tk.StringVar(value='0 - Static color')
        self.r_var = tk.IntVar(value=255)
        self.g_var = tk.IntVar(value=255)
        self.b_var = tk.IntVar(value=255)
        self.brightness_var = tk.IntVar(value=128)
        self.status_var = tk.StringVar(value='Disconnected')

        self.build_ui()
        self.refresh_ports()
        self.root.protocol('WM_DELETE_WINDOW', self.on_close)
        self.root.after(200, self.poll_serial)
        self.root.mainloop()

    def build_ui(self):
        main_frame = ttk.Frame(self.root, padding=12)
        main_frame.pack(fill='both', expand=True)

        port_frame = ttk.LabelFrame(main_frame, text='Serial connection', padding=10)
        port_frame.pack(fill='x', pady=(0, 10))

        ttk.Label(port_frame, text='Port:').grid(row=0, column=0, sticky='w')
        self.port_combo = ttk.Combobox(port_frame, textvariable=self.port_var, state='readonly', width=35)
        self.port_combo.grid(row=0, column=1, padx=(6, 0), sticky='w')
        ttk.Button(port_frame, text='Refresh', command=self.refresh_ports).grid(row=0, column=2, padx=6)
        self.connect_button = ttk.Button(port_frame, text='Connect', command=self.toggle_connection)
        self.connect_button.grid(row=0, column=3, padx=6)

        ttk.Label(port_frame, text='Status:').grid(row=1, column=0, sticky='w', pady=(8, 0))
        ttk.Label(port_frame, textvariable=self.status_var).grid(row=1, column=1, columnspan=3, sticky='w', pady=(8, 0))

        control_frame = ttk.LabelFrame(main_frame, text='Control', padding=10)
        control_frame.pack(fill='x', pady=(0, 10))

        ttk.Label(control_frame, text='Pattern:').grid(row=0, column=0, sticky='w')
        pattern_options = [f'{key} - {name}' for key, name in PATTERNS.items()]
        self.pattern_combo = ttk.Combobox(control_frame, values=pattern_options, textvariable=self.pattern_var, state='readonly', width=30)
        self.pattern_combo.grid(row=0, column=1, padx=(6, 0), sticky='w')
        self.pattern_combo.current(0)
        ttk.Button(control_frame, text='Send pattern', command=self.send_pattern).grid(row=0, column=2, padx=6)

        ttk.Label(control_frame, text='Color:').grid(row=1, column=0, sticky='w', pady=(8, 0))
        color_frame = ttk.Frame(control_frame)
        color_frame.grid(row=1, column=1, columnspan=2, sticky='w', pady=(8, 0))
        ttk.Label(color_frame, text='R').grid(row=0, column=0)
        ttk.Entry(color_frame, textvariable=self.r_var, width=4).grid(row=0, column=1, padx=(4, 12))
        ttk.Label(color_frame, text='G').grid(row=0, column=2)
        ttk.Entry(color_frame, textvariable=self.g_var, width=4).grid(row=0, column=3, padx=(4, 12))
        ttk.Label(color_frame, text='B').grid(row=0, column=4)
        ttk.Entry(color_frame, textvariable=self.b_var, width=4).grid(row=0, column=5, padx=(4, 12))
        ttk.Button(color_frame, text='Pick color', command=self.pick_color).grid(row=0, column=6, padx=(0, 12))
        ttk.Button(color_frame, text='Send color', command=self.send_color).grid(row=0, column=7)

        ttk.Label(control_frame, text='Brightness:').grid(row=2, column=0, sticky='w', pady=(8, 0))
        brightness_frame = ttk.Frame(control_frame)
        brightness_frame.grid(row=2, column=1, columnspan=2, sticky='w', pady=(8, 0))
        self.brightness_scale = ttk.Scale(brightness_frame, from_=0, to=255, orient='horizontal', variable=self.brightness_var, length=220)
        self.brightness_scale.grid(row=0, column=0, sticky='w')
        ttk.Button(brightness_frame, text='Send', command=self.send_brightness).grid(row=0, column=1, padx=(8, 0))

        command_frame = ttk.LabelFrame(main_frame, text='Commands', padding=10)
        command_frame.pack(fill='x', pady=(0, 10))

        ttk.Button(command_frame, text='Get status', command=lambda: self.send_command('S')).grid(row=0, column=0, padx=4, pady=4)
        ttk.Button(command_frame, text='Help', command=lambda: self.send_command('H')).grid(row=0, column=1, padx=4, pady=4)
        ttk.Button(command_frame, text='Mirror on', command=lambda: self.send_command('M 1')).grid(row=0, column=2, padx=4, pady=4)
        ttk.Button(command_frame, text='Mirror off', command=lambda: self.send_command('M 0')).grid(row=0, column=3, padx=4, pady=4)

        output_frame = ttk.LabelFrame(main_frame, text='Arduino output', padding=10)
        output_frame.pack(fill='both', expand=True)

        self.output_text = tk.Text(output_frame, wrap='word', height=12, state='disabled')
        self.output_text.pack(side='left', fill='both', expand=True)
        scrollbar = ttk.Scrollbar(output_frame, command=self.output_text.yview)
        scrollbar.pack(side='right', fill='y')
        self.output_text.config(yscrollcommand=scrollbar.set)

        self.disable_controls()

    def refresh_ports(self):
        ports = list_serial_ports()
        self.port_combo['values'] = ports
        if ports:
            self.port_var.set(ports[0])
        else:
            self.port_var.set('')
            self.status_var.set('No serial ports found')
            self.append_output('No serial ports found. Connect an Arduino and click Refresh.')

    def toggle_connection(self):
        if self.ser and self.ser.is_open:
            self.disconnect()
        else:
            self.connect()

    def connect(self):
        port_name = self.port_var.get()
        if not port_name:
            messagebox.showwarning('Connect', 'Select a serial port first.')
            return

        try:
            self.ser = serial.Serial(port_name, BAUD_RATE, timeout=1)
            time.sleep(1)
            self.ser.reset_input_buffer()
            self.status_var.set(f'Connected: {port_name}')
            self.connect_button.config(text='Disconnect')
            self.enable_controls()
            self.append_output(f'Connected to {port_name}\n')
            self.send_command('H')
        except Exception as exc:
            messagebox.showerror('Connection error', f'Failed to open port:\n{exc}')
            self.status_var.set('Disconnected')
            self.ser = None
            self.disable_controls()

    def disconnect(self):
        if self.ser:
            try:
                self.ser.close()
            except Exception:
                pass
        self.ser = None
        self.status_var.set('Disconnected')
        self.connect_button.config(text='Connect')
        self.disable_controls()
        self.append_output('Disconnected\n')

    def enable_controls(self):
        self.pattern_combo.config(state='readonly')
        self.brightness_scale.config(state='normal')

    def disable_controls(self):
        self.pattern_combo.config(state='disabled')
        self.brightness_scale.config(state='disabled')

    def send_pattern(self):
        current = self.pattern_var.get()
        try:
            pattern = int(current.split(' - ')[0])
        except (ValueError, IndexError):
            messagebox.showwarning('Invalid pattern', 'Select a valid pattern first.')
            return
        self.send_command(f'P {pattern}')

    def send_color(self):
        try:
            r = clamp(int(self.r_var.get()), 0, 255)
            g = clamp(int(self.g_var.get()), 0, 255)
            b = clamp(int(self.b_var.get()), 0, 255)
            self.r_var.set(r)
            self.g_var.set(g)
            self.b_var.set(b)
            self.send_command(f'C {r} {g} {b}')
        except (ValueError, tk.TclError):
            messagebox.showwarning('Invalid color', 'Enter valid integers between 0 and 255 for R, G, B.')

    def pick_color(self):
        color = colorchooser.askcolor(color=(self.r_var.get(), self.g_var.get(), self.b_var.get()), title='Pick LED color')
        if color and color[0]:
            r, g, b = [int(clamp(value, 0, 255)) for value in color[0]]
            self.r_var.set(r)
            self.g_var.set(g)
            self.b_var.set(b)
            self.send_color()

    def send_brightness(self):
        value = clamp(int(self.brightness_var.get()), 0, 255)
        self.brightness_var.set(value)
        self.send_command(f'B {value}')

    def send_command(self, command):
        if not self.ser or not self.ser.is_open:
            messagebox.showwarning('Not connected', 'Connect to a port before sending commands.')
            return

        try:
            self.ser.write((command.strip() + '\n').encode('utf-8'))
        except Exception as exc:
            messagebox.showerror('Send error', f'Failed to send command:\n{exc}')
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
        self.root.after(200, self.poll_serial)

    def append_output(self, text):
        self.output_text.config(state='normal')
        self.output_text.insert('end', text)
        self.output_text.see('end')
        self.output_text.config(state='disabled')

    def on_close(self):
        self.disconnect()
        self.root.destroy()


if __name__ == '__main__':
    LEDControllerApp()
