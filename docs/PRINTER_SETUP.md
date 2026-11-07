# Printer & Print Agent Hardware Setup Guide - QR Print Kiosk (QRLY)

## 1. Hardware Selection & Requirements

### 1.1 Recommended Printer Models
- **High-Volume Color (Ink Tank)**:
  - Epson EcoTank Series (e.g., L3250, L4260, L6270 with Auto-Duplex).
  - HP Smart Tank 580 / 750 (Auto-Duplex).
  - Canon PIXMA MegaTank G6070 / G7070.
  - *Advantage*: Extremely low cost per page (Rs 0.15 - 0.30 per B&W, Rs 0.50 - 1.20 per Color).
- **High-Volume Monochrome (Laser)**:
  - Brother HL-L2361DN / HL-L2366DW (Standard Auto-Duplex laser).
  - HP LaserJet Pro M404 / 1020 Plus.
  - *Advantage*: Lightning fast (30+ ppm), zero smudge, high duty cycles.

### 1.2 Host Computer / Kiosk Controller
- **Recommended Platform**:
  - Raspberry Pi 4 (4GB RAM) or Raspberry Pi 5 running 64-bit Raspberry Pi OS (Debian).
  - Dedicated Windows 10/11 Mini PC (Intel N100 or similar) connected via USB.
- **Power & Network**:
  - Connect via Uninterruptible Power Supply (UPS) or surge protector.
  - Disable OS sleep and standby modes (`sudo systemctl mask sleep.target suspend.target`).
  - For network printers: assign a static IP reservation in the router. Disable printer "Auto Power Off / Deep Sleep" in the hardware menu.

---

## 2. Linux & Raspberry Pi Setup (CUPS)

### 2.1 Package Installation
```bash
sudo apt update
sudo apt install -y cups ghostscript qpdf poppler-utils python3-venv git
sudo usermod -aG lpadmin $USER
sudo cupsctl --remote-admin
```

### 2.2 Adding the Printer in CUPS
1. Open a browser to `http://localhost:631` (or `http://<pi-ip>:631` from local network).
2. Go to **Administration** ➔ **Add Printer** (log in with system user credentials).
3. Select your connected USB or network printer.
4. Set the exact system name to: `ShopPrinter`.
5. Select the manufacturer PPD driver and set default media size to `A4`.

### 2.3 Command Line Verification
```bash
# Verify printer is detected and idle
lpstat -p -d

# Inspect driver-specific supported options
lpoptions -p ShopPrinter -l

# Test a physical two-sided print
lp -d ShopPrinter -n 1 -o sides=two-sided-long-edge test.pdf
```

---

## 3. Windows Setup (SumatraPDF)

### 3.1 Driver Installation & SumatraPDF
1. Install official manufacturer drivers from the vendor website.
2. Print a Windows test page to confirm connectivity.
3. Name the printer in Windows Settings: `ShopPrinter`.
4. Download and install [SumatraPDF](https://www.sumatrapdfreader.org/). Ensure `SumatraPDF.exe` is added to system PATH.

### 3.2 Command Line Verification (PowerShell)
```powershell
# Verify command-line silent printing
SumatraPDF.exe -print-to "ShopPrinter" -print-settings "1x,monochrome,duplex" "test.pdf" -silent
```

---

## 4. Print Option Mapping Specification

| Customer Option | Linux & macOS (CUPS `lp`) | Windows (SumatraPDF) |
| :--- | :--- | :--- |
| **Copies** | `-n <copies>` | `<copies>x` in print settings |
| **Black & White** | DeviceGray PDF + `-o print-color-mode=monochrome` | `monochrome` in print settings |
| **Color** | `-o print-color-mode=color` | `color` in print settings |
| **Quality** | `-o print-quality=3` (Draft), `4` (Normal), `5` (High) | Uses driver default |
| **Page Sides** | `-o sides=one-sided` or `-o sides=two-sided-long-edge` | `simplex` or `duplex` |
| **Page Range** | Pre-extracted via `qpdf` (Printer prints all pages of sliced PDF) | Pre-extracted via `qpdf` |

### 4.1 Configuration File (`agent-config.yaml`)
Because option names can vary across CUPS PPD drivers, model-specific flags are parameterized in `print-agent/agent-config.yaml`:
```yaml
printer_name: "ShopPrinter"
poll_interval_seconds: 3
heartbeat_interval_seconds: 15
cups_options:
  color_mode_bw: "print-color-mode=monochrome"
  color_mode_color: "print-color-mode=color"
  duplex_long_edge: "sides=two-sided-long-edge"
  simplex: "sides=one-sided"
  quality_draft: "print-quality=3"
  quality_normal: "print-quality=4"
  quality_high: "print-quality=5"
```

---

## 5. Diagnostic Tool (`tools/probe_printer`)

The print agent repository includes a hardware inspection script:
```bash
python print-agent/probe.py
```
**Probe Output Includes**:
- Detected operating system and spooler (CUPS vs Windows Spooler).
- List of installed printers and default system printer.
- Detailed dump of supported CUPS option names (color modes, media sizes, duplex modes).
- Dispatches a 1-page alignment test print to verify communication.

---

## 6. Dry-Run Verification Mode

Before wasting physical paper and toner, run the agent in dry-run mode:
```bash
# In print-agent/.env
PRINT_DRY_RUN=true
WORK_DIR="./work"
```
**Verification Procedure**:
1. In dry-run mode, the agent performs all steps: downloading, page range extraction via `qpdf`, DeviceGray conversion via `gs`, but skips sending to `lp` / `SumatraPDF`.
2. Output PDFs are preserved in `./out/<jobId>.pdf`.
3. Inspect generated files:
   ```bash
   # Verify page range
   pdfinfo out/<jobId>.pdf | grep Pages

   # Verify true monochrome (Cyan, Magenta, Yellow must be 0.00000)
   gs -q -o - -sDEVICE=inkcov out/<jobId>.pdf
   ```

---

## 7. Service Installation (Daemon Setup)

### 7.1 Linux systemd Service
Create `/etc/systemd/system/printagent.service`:
```ini
[Unit]
Description=QR Print Kiosk Agent Daemon
After=network.target cups.service
Wants=cups.service

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/QRLY/print-agent
ExecStart=/home/pi/QRLY/print-agent/venv/bin/python agent.py
Restart=always
RestartSec=5
EnvironmentFile=/home/pi/QRLY/print-agent/.env

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable printagent
sudo systemctl start printagent
sudo systemctl status printagent
```

### 7.2 Windows Task Scheduler
1. Open **Task Scheduler** ➔ **Create Task**.
2. Trigger: *"At startup"*.
3. Action: *"Start a program"* ➔ `python.exe` with argument `agent.py` in `C:\QRLY\print-agent`.
4. Settings: Check *"Restart if task fails every 1 minute"*.

---

## 8. Open Questions
1. *Multi-Model PPD Auto-Detection*: Should `probe.py` automatically write the generated `agent-config.yaml` based on detected PPD keywords? (Yes, the script will offer an auto-configure flag `--save-config`).
2. *USB Disconnect Alerting*: When a USB cable is unplugged, does CUPS mark the printer `offline` immediately, or only upon the next print attempt? (CUPS updates status when polled or upon job dispatch; agent detects both via `lpstat`).
