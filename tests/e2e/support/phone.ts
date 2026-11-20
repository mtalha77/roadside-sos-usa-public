/**
 * A fictional US mobile number (555-0100 to 555-0199) in one of ten area codes: 900 numbers. The
 * request duplicate rule reopens a number's open request from the last 30 minutes, so tests that
 * file requests on the shared preview database need a wide pool (90 numbers collided often).
 */
const AREAS = ["210", "512", "713", "702", "602", "407", "305", "214", "615", "919"];
export function fakeMobile(): string {
  const area = AREAS[Math.floor(Math.random() * AREAS.length)];
  return `(${area}) 555-01${String(Math.floor(Math.random() * 90) + 10)}`;
}
