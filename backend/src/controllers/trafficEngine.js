/**
 * Traffic Engine — Deterministic Simulation
 * ==============================================================
 * Simulates traffic congestion level (LOW, MEDIUM, HIGH) based on
 * latitude, longitude, and current hour of the day.
 */

export function getTrafficLevel(lat, lng) {
  const hour = new Date().getHours();
  // Peak hour factors (rush hour 8-10 AM and 5-7 PM)
  const isPeak = (hour >= 8 && hour <= 10) || (hour >= 17 && hour <= 19);

  // Simple coordinate-based deterministic hash
  const latHash = Math.abs(Math.floor(Number(lat) * 1000));
  const lngHash = Math.abs(Math.floor(Number(lng) * 1000));
  const val = (latHash + lngHash + hour) % 100;

  if (isPeak) {
    if (val < 50) return "HIGH";
    if (val < 85) return "MEDIUM";
    return "LOW";
  } else {
    if (val < 15) return "HIGH";
    if (val < 50) return "MEDIUM";
    return "LOW";
  }
}

export function applyTrafficPenalty(timeMinutes, level) {
  const mins = Number(timeMinutes);
  if (level === "HIGH") {
    return mins * 1.5; // 50% time penalty
  }
  if (level === "MEDIUM") {
    return mins * 1.2; // 20% time penalty
  }
  return mins; // No penalty for LOW traffic
}

export function getTrafficHeatmap(lat = 16.7, lng = 74.24) {
  // Generate a deterministic grid of traffic hotspots around the requested/default center
  const points = [];
  const startLat = Number(lat) - 0.05;
  const endLat = Number(lat) + 0.05;
  const startLng = Number(lng) - 0.05;
  const endLng = Number(lng) + 0.05;
  const step = 0.015;

  for (let l = startLat; l <= endLat; l += step) {
    for (let g = startLng; g <= endLng; g += step) {
      const level = getTrafficLevel(l, g);
      if (level !== "LOW") {
        points.push({
          lat: Number(l.toFixed(5)),
          lng: Number(g.toFixed(5)),
          level,
          intensity: level === "HIGH" ? 0.8 : 0.4
        });
      }
    }
  }
  return points;
}
