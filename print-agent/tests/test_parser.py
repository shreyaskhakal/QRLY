import unittest
import sys
from pathlib import Path

# Add parent directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from parser import parse_page_range


class TestParser(unittest.TestCase):
    def test_parse_single_range(self):
        self.assertEqual(parse_page_range("1-5", 10), [1, 2, 3, 4, 5])

    def test_parse_compound_range(self):
        self.assertEqual(parse_page_range("1-3, 5, 8-10", 10), [1, 2, 3, 5, 8, 9, 10])

    def test_parse_padded_whitespace(self):
        self.assertEqual(parse_page_range("  1 - 3 ,  7 ", 10), [1, 2, 3, 7])

    def test_parse_single_page(self):
        self.assertEqual(parse_page_range("5", 10), [5])

    def test_parse_empty_or_none_returns_all_pages(self):
        self.assertEqual(parse_page_range(None, 6), [1, 2, 3, 4, 5, 6])
        self.assertEqual(parse_page_range("", 4), [1, 2, 3, 4])
        self.assertEqual(parse_page_range("   ", 3), [1, 2, 3])

    def test_deduplicates_overlapping_ranges(self):
        self.assertEqual(parse_page_range("1-3, 2-4", 10), [1, 2, 3, 4])

    def test_rejects_reversed_ranges(self):
        with self.assertRaises(ValueError):
            parse_page_range("5-2", 10)

    def test_rejects_out_of_bounds_pages(self):
        with self.assertRaises(ValueError):
            parse_page_range("1-12", 10)

        with self.assertRaises(ValueError):
            parse_page_range("15", 10)

    def test_rejects_non_numeric_characters(self):
        with self.assertRaises(ValueError):
            parse_page_range("1-3, abc, 5", 10)

    def test_rejects_zero_or_negative_pages(self):
        with self.assertRaises(ValueError):
            parse_page_range("0-3", 10)

    def test_rejects_invalid_page_count(self):
        with self.assertRaises(ValueError):
            parse_page_range("1-3", 0)


if __name__ == "__main__":
    unittest.main()
