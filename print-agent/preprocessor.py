import shutil
import subprocess
from pathlib import Path
from typing import Optional
from parser import parse_page_range


def slice_pages(
    input_pdf: Path,
    output_pdf: Path,
    page_range_str: Optional[str],
    total_pages: int,
) -> Path:
    """
    Extracts the specified page range from the input PDF into output_pdf.
    Uses qpdf if available, or copies entire document if all pages requested.
    """
    pages = parse_page_range(page_range_str, total_pages)

    # If all pages are selected, no slicing needed
    if len(pages) == total_pages and pages == list(range(1, total_pages + 1)):
        shutil.copyfile(input_pdf, output_pdf)
        return output_pdf

    qpdf_bin = shutil.which("qpdf")
    if qpdf_bin:
        # qpdf syntax: qpdf --empty --pages input.pdf 1,3,5 -- output.pdf
        pages_arg = ",".join(str(p) for p in pages)
        cmd = [qpdf_bin, "--empty", "--pages", str(input_pdf), pages_arg, "--", str(output_pdf)]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"qpdf failed to slice pages: {result.stderr}")
        return output_pdf

    # Fallback: copy file if external tool not yet installed
    shutil.copyfile(input_pdf, output_pdf)
    return output_pdf


def convert_to_grayscale(input_pdf: Path, output_pdf: Path) -> Path:
    """
    Converts a PDF to pure DeviceGray using Ghostscript to eliminate
    color toner / ink consumption on color printers.
    """
    # Look for gs (Linux/macOS) or gswin64c / gswin32c (Windows)
    gs_bin = (
        shutil.which("gs")
        or shutil.which("gswin64c")
        or shutil.which("gswin32c")
    )

    if gs_bin:
        cmd = [
            gs_bin,
            "-sDEVICE=pdfwrite",
            "-dColorConversionStrategy=/LeaveColorUnchanged",
            "-dProcessColorModel=/DeviceGray",
            "-dCompatibilityLevel=1.4",
            "-dNOPAUSE",
            "-dBATCH",
            f"-sOutputFile={output_pdf}",
            str(input_pdf),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"Ghostscript grayscale conversion failed: {result.stderr}")
        return output_pdf

    # Fallback: copy file if gs not present
    shutil.copyfile(input_pdf, output_pdf)
    return output_pdf


def prepare_document(
    input_pdf: Path,
    work_dir: Path,
    job_id: str,
    color_mode: str,
    page_range: Optional[str],
    total_pages: int = 1,
) -> Path:
    """
    Runs the complete pre-processing pipeline:
    1. Slices requested page range
    2. Converts to DeviceGray if colorMode is 'bw'
    Returns path to the final printable PDF in work_dir.
    """
    sliced_pdf = work_dir / f"sliced-{job_id}.pdf"
    slice_pages(input_pdf, sliced_pdf, page_range, total_pages)

    if color_mode == "bw":
        gray_pdf = work_dir / f"gray-{job_id}.pdf"
        final_pdf = convert_to_grayscale(sliced_pdf, gray_pdf)
        return final_pdf

    return sliced_pdf

