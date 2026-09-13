async function testHealth() {
  try {
    const res = await fetch("http://localhost:3000/api/health");
    const json = await res.json();
    console.log("=== LIVE HEALTH CHECK RESPONSE ===");
    console.log("HTTP Status:", res.status);
    console.log(JSON.stringify(json, null, 2));
  } catch (err: any) {
    console.error("Fetch failed:", err.message);
    process.exit(1);
  }
}

testHealth();
