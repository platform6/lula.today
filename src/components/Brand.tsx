// The lula wordmark and lockup. Path data is the outlined IBM Plex Sans Bold
// wordmark from docs/brand/logo-wordmark.svg; it is drawn with currentColor so
// it follows the theme accent (#ff6a2b on dark, #c2410c on light).

const WORDMARK_PATH =
  'M283 0H216Q140 0 104.5 -37.0Q69 -74 69 -144V-740H217V-115H283ZM682 0V-88H677Q664 -48 629.5 -18.0Q595 12 530 12Q450 12 408.0 -42.0Q366 -96 366 -195V-525H514V-208Q514 -160 531.5 -134.0Q549 -108 589 -108Q612 -108 633.5 -116.5Q655 -125 668.5 -142.0Q682 -159 682 -184V-525H830V0ZM1182 0H1115Q1039 0 1003.5 -37.0Q968 -74 968 -144V-740H1116V-115H1182ZM1741 0H1659Q1632 0 1608.5 -13.5Q1585 -27 1571 -54Q1562 -71 1559 -92H1553Q1541 -41 1500.0 -14.5Q1459 12 1399 12Q1320 12 1278.0 -30.5Q1236 -73 1236 -141Q1236 -197 1263.5 -233.0Q1291 -269 1341.5 -287.0Q1392 -305 1461 -305H1544V-338Q1544 -376 1524.0 -398.5Q1504 -421 1457 -421Q1413 -421 1387.0 -402.0Q1361 -383 1344 -359L1256 -437Q1288 -484 1337.0 -510.5Q1386 -537 1468 -537Q1579 -537 1635.5 -487.5Q1692 -438 1692 -345V-115H1741ZM1544 -221H1472Q1429 -221 1407.0 -206.0Q1385 -191 1385 -162V-147Q1385 -119 1403.0 -105.0Q1421 -91 1454 -91Q1479 -91 1499.0 -98.0Q1519 -105 1531.5 -120.0Q1544 -135 1544 -159Z';

// Wordmark box is 1672 × 752 units: ascender top at 0, baseline at 740, so
// centering the box centers the word (ascender to baseline) on the tile.
const RATIO = 1672 / 752;

export function Wordmark({ height, className = '' }: { height: number; className?: string }) {
  return (
    <svg
      role="img"
      aria-label="lula"
      viewBox="0 0 1672 752"
      width={Math.round(height * RATIO)}
      height={height}
      className={`text-accent ${className}`}
    >
      <path transform="translate(-69 740)" d={WORDMARK_PATH} fill="currentColor" />
    </svg>
  );
}

/**
 * App icon tile beside the wordmark: gap is half the tile, per the brand lockup.
 * Block-level so it never sits on a text baseline (which would push it above
 * whatever it's centered beside, like the header's sync badge).
 */
export function BrandLockup({ size }: { size: number }) {
  const wordHeight = Math.round(size * 0.78);
  return (
    <span className="flex w-fit items-center" style={{ gap: size / 2 }}>
      <img src="/favicon.svg" alt="" width={size} height={size} className="shrink-0 rounded-[22%]" />
      <Wordmark height={wordHeight} />
    </span>
  );
}
