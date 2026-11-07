/**
 * GTIN / EAN / UPC handling. Canonical form used across the platform:
 * - EAN-8 stays 8 digits.
 * - UPC-A (12) is prefixed with 0 → 13 digits (EAN-13), as Open Food Facts does.
 * - GTIN-14 with a leading 0 collapses to EAN-13.
 */

export function gtinCheckDigit(body: string): number {
  let sum = 0;
  // Weights alternate 3,1,3,1… starting from the rightmost digit of the body.
  for (let i = body.length - 1, w = 3; i >= 0; i -= 1, w = w === 3 ? 1 : 3) {
    sum += Number(body[i]) * w;
  }
  return (10 - (sum % 10)) % 10;
}

export function isValidGtin(code: string): boolean {
  if (!/^\d+$/.test(code)) return false;
  if (![8, 12, 13, 14].includes(code.length)) return false;
  const body = code.slice(0, -1);
  return gtinCheckDigit(body) === Number(code[code.length - 1]);
}

/** Expands an 8-digit UPC-E code to its 12-digit UPC-A equivalent. */
export function expandUpcE(upce: string): string | null {
  if (!/^[01]\d{7}$/.test(upce)) return null;
  const ns = upce[0]!;
  const d = upce.slice(1, 7);
  const check = upce[7]!;
  const last = d[5]!;
  let body: string;
  if (last === '0' || last === '1' || last === '2') {
    body = `${ns}${d[0]}${d[1]}${last}0000${d[2]}${d[3]}${d[4]}`;
  } else if (last === '3') {
    body = `${ns}${d[0]}${d[1]}${d[2]}00000${d[3]}${d[4]}`;
  } else if (last === '4') {
    body = `${ns}${d[0]}${d[1]}${d[2]}${d[3]}00000${d[4]}`;
  } else {
    body = `${ns}${d[0]}${d[1]}${d[2]}${d[3]}${d[4]}0000${last}`;
  }
  const upca = `${body}${check}`;
  return isValidGtin(upca) ? upca : null;
}

/**
 * Normalises a scanned or typed barcode. Returns null when the code is not a
 * valid GTIN (wrong length or check digit).
 */
export function normalizeBarcode(raw: string, scannerType?: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return null;
  let code = digits;
  if (scannerType === 'upc_e' && code.length === 8) {
    const expanded = expandUpcE(code);
    if (!expanded) return null;
    code = expanded;
  }
  if (!isValidGtin(code)) return null;
  if (code.length === 12) return `0${code}`;
  if (code.length === 14 && code.startsWith('0')) return code.slice(1);
  return code;
}
