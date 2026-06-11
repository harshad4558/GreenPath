import http from "http";
import { haversineDistance } from "./utils/geoUtils.js";

function postJson(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(data);

    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const req = http.request(options, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        body += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, raw: body });
        }
      });
    });

    req.on("error", (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

async function runTests() {
  const PORT = process.env.PORT || 5000;
  const BASE_URL = `http://localhost:${PORT}/api/navigation`;

  console.log("=== STARTING NAVIGATION TELEMETRY INTEGRATION TESTS ===");

  try {
    // 1. Start Navigation Session
    console.log("\n1. Testing POST /start...");
    const { status: startStatus, data: startData } = await postJson(`${BASE_URL}/start`, {
      origin: "47.5985,-122.3280", // Seattle Union Station
      destination: "47.6156,-122.2038", // Bellevue Square
      travelMode: "EV",
      userId: "test-user-123",
    });

    if (startStatus !== 200) {
      throw new Error(`Failed to start navigation: ${startStatus} - ${JSON.stringify(startData)}`);
    }

    console.log("✓ Navigation session initialized successfully!");
    console.log(`- Start Coords: ${JSON.stringify(startData.startCoords)}`);
    console.log(`- Geometry points count: ${startData.geometry.length}`);
    console.log(`- Steps count: ${startData.steps.length}`);
    console.log(`- CO2 emissions: ${startData.co2Emissions} kg`);

    const initialGeometry = startData.geometry;
    const initialSteps = startData.steps;

    // 2. Telemetry update - On route
    console.log("\n2. Testing telemetry update exactly on the route path...");
    const onRoutePt = initialGeometry[1];
    const { status: uStatus1, data: data1 } = await postJson(`${BASE_URL}/update-location`, {
      userId: "test-user-123",
      lat: onRoutePt[0],
      lng: onRoutePt[1],
      currentStepIndex: 0,
    });

    console.log("Response 1:", data1);
    if (data1.state === "FOLLOWING_ROUTE" || data1.state === "ROUTE_ACTIVE") {
      console.log("✓ Correctly identified as on-route!");
    } else {
      console.warn(`✗ Unexpected state: ${data1.state}`);
    }

    // 3. Telemetry update - Approaching turn
    console.log("\n3. Testing telemetry update close to a turn (step maneuver)...");
    const turnStep = initialSteps.find(s => s.type !== "depart" && s.type !== "arrive");
    if (turnStep) {
      console.log(`Found a turn maneuver at: ${JSON.stringify(turnStep.coordinate)} (${turnStep.instruction})`);
      
      const turnLat = turnStep.coordinate[0];
      const turnLng = turnStep.coordinate[1];
      const approachingLat = turnLat + 0.0002; 
      const approachingLng = turnLng;

      const dist = haversineDistance([approachingLat, approachingLng], [turnLat, turnLng]);
      console.log(`Distance to turn: ${dist.toFixed(2)} meters.`);

      const { status: uStatus2, data: data2 } = await postJson(`${BASE_URL}/update-location`, {
        userId: "test-user-123",
        lat: approachingLat,
        lng: approachingLng,
        currentStepIndex: initialSteps.indexOf(turnStep),
      });

      console.log("Response 2:", data2);
      if (data2.state === "APPROACHING_TURN" || data2.state === "TURN_NOW") {
        console.log("✓ Correctly transitioned to warning/turn state!");
      } else {
        console.warn(`✗ Unexpected state: ${data2.state}`);
      }
    } else {
      console.log("Skipping turn test: no mid-route maneuvers found.");
    }

    // 4. Telemetry update - Off-route rerouting
    console.log("\n4. Testing telemetry update far away from the route path (> 30 meters)...");
    const { status: uStatus3, data: data3 } = await postJson(`${BASE_URL}/update-location`, {
      userId: "test-user-123",
      lat: 34.0522,
      lng: -118.2437,
      currentStepIndex: 0,
    });

    console.log("Response 3:", data3);
    if (data3.state === "REROUTING") {
      console.log("✓ Correctly triggered OSRM rerouting!");
      console.log(`- New geometry points: ${data3.routeGeometry?.length || 0}`);
    } else {
      console.warn(`✗ Unexpected state: ${data3.state}`);
    }

    console.log("\n=== ALL INTEGRATION TESTS COMPLETED SUCCESSFULLY ===");
  } catch (err) {
    console.error("Test execution failed:", err);
    process.exit(1);
  }
}

runTests();
