import re
from typing import List, Optional


def parse_page_range(input_str: Optional[str], page_count: int) -> List[int]:
    """
    Parses and validates a user page range string against total document pages.
    Matches TypeScript parser implementation with 100% fidelity.

    Supported syntax:
      - "1-3, 5, 8-10"
      - "1"
      - "  1 - 4 , 7 "

    Rules:
      - None or empty string defaults to all pages [1..page_count].
      - Whitespace is stripped.
      - Reversed ranges ('5-2') raise ValueError.
      - Page numbers must be between 1 and page_count.
      - Non-numeric characters raise ValueError.
      - Duplicate pages are deduplicated and returned sorted ascending.
    """
    if not isinstance(page_count, int) or page_count <= 0:
        raise ValueError(f"Invalid document page count: {page_count}. Must be positive integer.")

    if not input_str or input_str.strip() == "":
        return list(range(1, page_count + 1))

    trimmed = input_str.strip()

    if not re.match(r"^[\d\s,-]+$", trimmed):
        raise ValueError("Page range contains invalid characters. Use only digits, commas, and hyphens.")

    parts = [p.strip() for p in trimmed.split(",") if p.strip()]
    if not parts:
        raise ValueError("Page range cannot be empty when specified.")

    pages = set()

    for part in parts:
        if "-" in part:
            range_parts = [r.strip() for r in part.split("-")]
            if len(range_parts) != 2 or not range_parts[0] or not range_parts[1]:
                raise ValueError(f"Malformed range segment: '{part}'")

            try:
                start = int(range_parts[0])
                end = int(range_parts[1])
            except ValueError:
                raise ValueError(f"Non-integer page number in range: '{part}'")

            if start <= 0 or end <= 0:
                raise ValueError(f"Page numbers must be 1 or greater: '{part}'")

            if start > end:
                raise ValueError(f"Reversed range: '{start}-{end}'. Start page cannot exceed end page.")

            if end > page_count:
                raise ValueError(f"Page {end} exceeds total document pages ({page_count}).")

            for p in range(start, end + 1):
                pages.add(p)
        else:
            try:
                page = int(part)
            except ValueError:
                raise ValueError(f"Invalid page number: '{part}'")

            if page <= 0:
                raise ValueError(f"Page numbers must be 1 or greater: '{part}'")

            if page > page_count:
                raise ValueError(f"Page {page} exceeds total document pages ({page_count}).")

            pages.add(page)

    return sorted(list(pages))

