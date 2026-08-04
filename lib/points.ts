export const POINT_TO_NAIRA_RATE = 0.1;

export function pointsToNaira(points: number): number {
  return points * POINT_TO_NAIRA_RATE;
}
