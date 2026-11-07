#!/usr/bin/env python3
"""
Hardware Discovery and Printer Diagnostic Tool: QR Print Kiosk (QRLY)
Usage:
  python print-agent/probe.py
"""

import os
import shutil
import subprocess
import sys
from pathlib import Path


def probe_system():
    print("=" * 60)
    print(" QRLY Printer Probe & Diagnostic Tool")
    print("=" * 60)
    print(f"Platform: {sys.platform} ({sys.version.split()[0]})")

    # 1. Check Pre-processing Utilities
    print("\n[1] Pre-processing Utilities:")
    for tool in ["qpdf", "gs", "gswin64c", "pdfinfo"]:
        location = shutil.which(tool)
        status = f"[OK] Found: {location}" if location else "[MISSING] Not found in PATH"
        print(f"  - {tool:10}: {status}")

    # 2. Check Print Spooler
    print("\n[2] Print Spooler Subsystem:")
    if sys.platform.startswith("linux") or sys.platform == "darwin":
        lp_bin = shutil.which("lp")
        lpstat_bin = shutil.which("lpstat")
        if lp_bin and lpstat_bin:
            print(f"  [OK] CUPS subsystem detected ({lpstat_bin})")
            try:
                res = subprocess.run(["lpstat", "-p", "-d"], capture_output=True, text=True)
                print("\n  Available CUPS Printers:")
                for line in res.stdout.strip().split("\n"):
                    print(f"    {line}")
            except Exception as e:
                print(f"  Error querying CUPS: {e}")
        else:
            print("  [MISSING] CUPS tools ('lp', 'lpstat') not found.")

    elif sys.platform == "win32":
        print("  Windows Print Spooler environment")
        sumatra_bin = shutil.which("SumatraPDF.exe") or shutil.which("SumatraPDF")
        if sumatra_bin:
            print(f"  [OK] SumatraPDF detected: {sumatra_bin}")
        else:
            print("  [MISSING] SumatraPDF not found in PATH.")

        try:
            cmd = ["powershell", "-NoProfile", "-Command", "Get-Printer | Select-Object Name, PrinterStatus, JobCount"]
            res = subprocess.run(cmd, capture_output=True, text=True)
            print("\n  Available Windows Printers:")
            for line in res.stdout.strip().split("\n"):
                if line.strip():
                    print(f"    {line}")
        except Exception as e:
            print(f"  Error querying Windows printers: {e}")

    print("\n" + "=" * 60)
    print(" Diagnostics complete.")


if __name__ == "__main__":
    probe_system()
