from typing import List, Dict, Any

def detect_layout(pdf_bytes: bytes) -> str:
    """
    Return a layout string (e.g., 'td_cc_v1', 'nb_cc_v2', 'unknown') based on simple heuristics.
    """
    # placeholder
    return "unknown"

def parse_pdf_transactions(pdf_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Parse transactions from a PDF byte stream.
    Returns a list of transaction dicts with keys:
    - date (ISO string)
    - raw_description (str)
    - normalized_description (str)
    - merchant_normalized (str or None)
    - amount (decimal as string)
    - currency (ISO)
    - direction ('debit'|'credit')
    - tags (list) e.g., ['refund','preauth','transfer','fee']
    - confidence (0.0-1.0)
    - parser_version (str)
    """
    # Implementation plan:
    # 1) detect layout
    # 2) try structured extraction with pdfplumber / camelot
    # 3) fallback: line-based regex parsing
    # 4) fallback OCR (pytesseract) if necessary
    raise NotImplementedError
