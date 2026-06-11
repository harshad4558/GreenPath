/**
 * Weather Engine — Weather aware routing
 * ==============================================================
 * Connects to OpenWeather API or falls back to deterministic simulation.
 */

export async function getCurrentWeather(lat, lng) {
  const apiKey = process.env.WEATHER_API_KEY;
  
  if (apiKey) {
    try {
      const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${apiKey}&units=metric`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const mainCond = data.weather?.[0]?.main || "Clear";
        const temp = data.main?.temp || 25;
        let severity = "NONE";

        if (["Thunderstorm", "Tornado", "Extreme"].includes(mainCond)) {
          severity = "HIGH";
        } else if (["Rain", "Snow", "Drizzle"].includes(mainCond)) {
          severity = "MEDIUM";
        }

        return {
          condition: mainCond,
          temp,
          severity
        };
      }
    } catch (err) {
      console.warn("Failed to fetch weather from API, falling back to mock:", err.message);
    }
  }

  // Fallback / Mock weather based on coords & hour of the day
  const hour = new Date().getHours();
  const latHash = Math.abs(Math.floor(Number(lat) * 100));
  const val = (latHash + hour) % 10;

  let condition = "Clear";
  let temp = 27;
  let severity = "NONE";

  if (val < 2) {
    condition = "Rain";
    temp = 22;
    severity = "MEDIUM";
  } else if (val === 2) {
    condition = "Thunderstorm";
    temp = 20;
    severity = "HIGH";
  } else if (val < 5) {
    condition = "Clouds";
    temp = 25;
    severity = "NONE";
  } else {
    // Clear / Sunny
    temp = hour >= 10 && hour <= 16 ? 32 : 24;
  }

  return { condition, temp, severity };
}

/**
 * Reduce routing score or options based on weather conditions.
 * e.g., in rain or heavy storm, cycling should receive safety penalty.
 */
export function applyWeatherPenalties(mode, weather) {
  let penalty = 0;
  if (mode === "CYCLING") {
    if (weather.severity === "HIGH") {
      penalty = 50; // Severe penalty
    } else if (weather.severity === "MEDIUM") {
      penalty = 20;
    }
  }
  return penalty;
}

export function shouldSuggestTransit(weather) {
  return weather.severity === "HIGH" || weather.condition === "Rain";
}
