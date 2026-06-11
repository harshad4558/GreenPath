/**
 * Compute the Haversine distance in meters between two coordinates [lat, lng].
 * @param {[number, number]} p1 - [lat, lng]
 * @param {[number, number]} p2 - [lat, lng]
 * @returns {number} Distance in meters
 */
export function haversineDistance(p1, p2) {
  const R = 6371000; // Earth's radius in meters
  const lat1 = (p1[0] * Math.PI) / 180;
  const lat2 = (p2[0] * Math.PI) / 180;
  const dLat = ((p2[0] - p1[0]) * Math.PI) / 180;
  const dLng = ((p2[1] - p1[1]) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Helper to compute the distance from a point to a line segment [a, b].
 * Uses flat-plane projection adjusted by cosine of latitude for high accuracy over small distances.
 * @param {[number, number]} p - User location [lat, lng]
 * @param {[number, number]} a - Segment start [lat, lng]
 * @param {[number, number]} b - Segment end [lat, lng]
 * @returns {number} Distance in meters
 */
export function getDistanceToSegment(p, a, b) {
  const latP = p[0], lngP = p[1];
  const latA = a[0], lngA = a[1];
  const latB = b[0], lngB = b[1];

  const dy = latB - latA;
  const dx = (lngB - lngA) * Math.cos(((latA + latB) * Math.PI) / 360);
  const lenSq = dy * dy + dx * dx;

  if (lenSq === 0) {
    return haversineDistance(p, a);
  }

  // Find projection fraction t (clamped to [0, 1] for segment bounds)
  const p_dy = latP - latA;
  const p_dx = (lngP - lngA) * Math.cos(((latA + latP) * Math.PI) / 360);
  let t = (p_dy * dy + p_dx * dx) / lenSq;
  t = Math.max(0, Math.min(1, t));

  // Compute coordinate of projected point on segment
  const projLat = latA + t * dy;
  const projLng = lngA + t * (lngB - lngA);

  return haversineDistance(p, [projLat, projLng]);
}

/**
 * Calculates the exact perpendicular cross-track distance (in meters) from a user location
 * to the closest segment of a polyline.
 * @param {[number, number]} userLocation - [lat, lng]
 * @param {[number, number][]} polylinePoints - Array of [lat, lng] coordinates
 * @returns {number} Perpendicular distance in meters
 */
export function getDistanceToPolyline(userLocation, polylinePoints) {
  if (!polylinePoints || polylinePoints.length === 0) return Infinity;
  if (polylinePoints.length === 1) return haversineDistance(userLocation, polylinePoints[0]);

  let minDistance = Infinity;
  for (let i = 0; i < polylinePoints.length - 1; i++) {
    const dist = getDistanceToSegment(userLocation, polylinePoints[i], polylinePoints[i + 1]);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }
  return minDistance;
}

/**
 * Checks if a point is inside a polygon using ray-casting.
 * @param {[number, number]} point - [lat, lng]
 * @param {[number, number][]} polygon - Array of [lat, lng]
 * @returns {boolean}
 */
export function isPointInPolygon(point, polygon) {
  const [lat, lng] = point;
  let isInside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latI, lngI] = polygon[i];
    const [latJ, lngJ] = polygon[j];
    
    const intersect = ((lngI > lng) !== (lngJ > lng)) &&
      (lat < (latJ - latI) * (lng - lngI) / (lngJ - lngI) + latI);
    if (intersect) isInside = !isInside;
  }
  return isInside;
}

/**
 * Checks if a polyline (route) intersects a polygon zone by checking its coordinates.
 * @param {[number, number][]} polylinePoints - Array of [lat, lng]
 * @param {[number, number][]} polygon - Array of [lat, lng]
 * @returns {boolean}
 */
export function isPathIntersectingZone(polylinePoints, polygon) {
  if (!polygon || polygon.length < 3) return false;
  // Basic check: if any point in the path is inside the polygon
  for (const point of polylinePoints) {
    if (isPointInPolygon(point, polygon)) {
      return true;
    }
  }
  return false;
}
