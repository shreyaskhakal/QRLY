import unittest
import sys
from pathlib import Path

# Add parent directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from spooler import dispatch_print
from config import OUT_DIR, WORK_DIR


class TestSpooler(unittest.TestCase):
    def test_dry_run_dispatch(self):
        # Create dummy pdf file in WORK_DIR
        dummy_pdf = WORK_DIR / "dummy_test.pdf"
        dummy_pdf.write_bytes(b"%PDF-1.4\n%test content\n")

        job_id = "test-job-uuid-12345"
        options = {
            "copies": 2,
            "colorMode": "bw",
            "quality": "high",
            "sides": "double",
        }

        success, error_msg = dispatch_print(dummy_pdf, job_id, options)

        self.assertTrue(success)
        self.assertIsNone(error_msg)

        expected_out_file = OUT_DIR / f"{job_id}.pdf"
        self.assertTrue(expected_out_file.exists())
        self.assertEqual(expected_out_file.read_bytes(), b"%PDF-1.4\n%test content\n")

        # Clean up
        if dummy_pdf.exists():
            dummy_pdf.unlink()
        if expected_out_file.exists():
            expected_out_file.unlink()


if __name__ == "__main__":
    unittest.main()
