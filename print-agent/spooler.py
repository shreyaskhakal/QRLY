import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Dict, Any, Tuple, Optional
from config import (
    PRINTER_NAME,
    PRINT_DRY_RUN,
    OUT_DIR,
    CUPS_OPTIONS,
    SUMATRA_OPTIONS,
)


def dispatch_print(
    pdf_path: Path,
    job_id: str,
    options: Dict[str, Any],
) -> Tuple[bool, Optional[str]]:
    """
    Submits the prepared PDF to the local printer spooler,
    or writes to ./out/<jobId>.pdf if running in dry-run mode.

    Returns:
      (success: bool, error_message: str | None)
    """
    copies = int(options.get("copies", 1))
    color_mode = options.get("colorMode", "bw")
    quality = options.get("quality", "normal")
    sides = options.get("sides", "single")

    # 1. Hardware Dry-Run Mode (Zero paper waste)
    if PRINT_DRY_RUN:
        out_file = OUT_DIR / f"{job_id}.pdf"
        shutil.copyfile(pdf_path, out_file)
        print(f"[Spooler] [Dry-Run] Saved output to: {out_file} (copies: {copies}, sides: {sides})")
        return True, None

    # 2. Linux & macOS (CUPS lp)
    if sys.platform.startswith("linux") or sys.platform == "darwin":
        lp_bin = shutil.which("lp")
        if not lp_bin:
            return False, "CUPS 'lp' command not found. Please install cups-client."

        cmd = [lp_bin, "-d", PRINTER_NAME, "-n", str(copies)]

        # Add color option
        if color_mode == "bw":
            cmd.extend(["-o", CUPS_OPTIONS.get("color_mode_bw", "print-color-mode=monochrome")])
        else:
            cmd.extend(["-o", CUPS_OPTIONS.get("color_mode_color", "print-color-mode=color")])

        # Add duplex option
        if sides == "double":
            cmd.extend(["-o", CUPS_OPTIONS.get("duplex_long_edge", "sides=two-sided-long-edge")])
        else:
            cmd.extend(["-o", CUPS_OPTIONS.get("simplex", "sides=one-sided")])

        # Add quality option
        if quality == "draft":
            cmd.extend(["-o", CUPS_OPTIONS.get("quality_draft", "print-quality=3")])
        elif quality == "high":
            cmd.extend(["-o", CUPS_OPTIONS.get("quality_high", "print-quality=5")])
        else:
            cmd.extend(["-o", CUPS_OPTIONS.get("quality_normal", "print-quality=4")])

        cmd.append(str(pdf_path))

        try:
            res = subprocess.run(cmd, capture_output=True, text=True, check=True)
            print(f"[Spooler] CUPS job submitted: {res.stdout.strip()}")
            return True, None
        except subprocess.CalledProcessError as e:
            return False, f"CUPS lp error: {e.stderr}"

    # 3. Windows (SumatraPDF)
    if sys.platform == "win32":
        sumatra_bin = shutil.which("SumatraPDF.exe") or shutil.which("SumatraPDF")
        if not sumatra_bin:
            # Common installation paths
            for candidate in [
                Path(os.environ.get("LOCALAPPDATA", "")) / "SumatraPDF" / "SumatraPDF.exe",
                Path("C:/Program Files/SumatraPDF/SumatraPDF.exe"),
                Path("C:/Program Files (x86)/SumatraPDF/SumatraPDF.exe"),
            ]:
                if candidate.exists():
                    sumatra_bin = str(candidate)
                    break

        if not sumatra_bin:
            return False, "SumatraPDF executable not found. Please install SumatraPDF."

        settings_parts = [f"{copies}x"]
        if color_mode == "bw":
            settings_parts.append(SUMATRA_OPTIONS.get("color_mode_bw", "monochrome"))
        else:
            settings_parts.append(SUMATRA_OPTIONS.get("color_mode_color", "color"))

        if sides == "double":
            settings_parts.append(SUMATRA_OPTIONS.get("duplex_long_edge", "duplex"))
        else:
            settings_parts.append(SUMATRA_OPTIONS.get("simplex", "simplex"))

        settings_str = ",".join(settings_parts)

        cmd = [
            sumatra_bin,
            "-print-to",
            PRINTER_NAME,
            "-print-settings",
            settings_str,
            str(pdf_path),
            "-silent",
        ]

        try:
            subprocess.run(cmd, capture_output=True, text=True, check=True)
            return True, None
        except subprocess.CalledProcessError as e:
            return False, f"SumatraPDF error: {e.stderr}"

    return False, f"Unsupported platform: {sys.platform}"

