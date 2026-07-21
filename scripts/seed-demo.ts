import fixture from "../fixtures/demo-batch.json" with { type: "json" };

const apiUrl = process.env.API_URL ?? "http://localhost:3001/api";
const response = await fetch(`${apiUrl}/batches`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(fixture),
});
if (!response.ok) throw new Error(`API returned ${response.status}: ${await response.text()}`);
console.log(await response.json());
