async function test() {
  const url = `https://acpx.virtuals.io/api/agents?filters[id][$eq]=18281`;
  const res = await fetch(url);
  const json = await res.json();
  console.log(JSON.stringify(json, null, 2));
}
test();
