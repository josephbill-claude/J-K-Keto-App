// Adds a fresh batch of keto recipes to site/recipes-extra.json.
// Runs every week from GitHub Actions. Needs the ANTHROPIC_API_KEY secret.
import { readFile, writeFile } from "node:fs/promises";

const MODEL = process.env.MODEL || "claude-sonnet-5-5";
const COUNT = Number(process.env.RECIPE_COUNT || 8);
const SITE = new URL("../site/", import.meta.url);
const TAGS = ["poultry", "dairy", "eggs", "pork", "beef", "lamb", "fish", "shellfish", "nuts"];
const MEALS = ["breakfast", "main", "snack", "dessert"];

const KEY = process.env.ANTHROPIC_API_KEY;
if (!KEY) { console.error("Missing ANTHROPIC_API_KEY secret. Add it under Settings → Secrets and variables → Actions."); process.exit(1); }

// Safety net: tag ingredients the model forgot to flag.
const KEYWORDS = {
  poultry: ["chicken", "turkey", "duck", "goose", "quail"],
  dairy: ["butter", "ghee", "cheese", "cheddar", "parmesan", "mozzarella", "feta", "halloumi", "cream cheese", "double cream", "single cream", "sour cream", "crème fraîche", "milk", "yoghurt", "yogurt", "mascarpone", "ricotta", "paneer", "whey"],
  eggs: ["egg", "mayonnaise", "mayo"],
  pork: ["pork", "bacon", "ham", "prosciutto", "chorizo", "pancetta", "sausage", "salami", "lardons"],
  beef: ["beef", "steak", "sirloin", "ribeye", "rump", "brisket", "short rib", "oxtail"],
  lamb: ["lamb", "mutton"],
  fish: ["salmon", "cod", "tuna", "mackerel", "sardine", "anchov", "haddock", "trout", "sea bass", "halibut", "hake", "fish sauce", "fish"],
  shellfish: ["prawn", "shrimp", "mussel", "scallop", "crab", "lobster", "squid", "clam", "oyster", "calamari"],
  nuts: ["almond", "walnut", "pecan", "hazelnut", "cashew", "pistachio", "macadamia", "pine nut", "brazil nut", "peanut"]
};
const SAFE = ["almond butter", "coconut butter", "peanut butter", "nut butter", "cocoa butter", "seed butter", "coconut milk", "coconut cream", "coconut yoghurt", "coconut yogurt", "almond milk", "dairy-free", "nut-free", "egg-free", "eggplant", "chicken-free", "peanut-free"];
function autoTags(ing) {
  const text = " " + ing.join(" | ").toLowerCase() + " ";
  let cleaned = text; SAFE.forEach(s => { cleaned = cleaned.split(s).join(" "); });
  return TAGS.filter(t => KEYWORDS[t].some(k => new RegExp("\\b" + k).test(cleaned)));
}

const slug = s => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
const today = new Date().toISOString().slice(0, 10);

const html = await readFile(new URL("index.html", SITE), "utf8");
const builtIn = [...html.matchAll(/"name":\s*"([^"]+)"|name:"([^"]+)"/g)].map(m => m[1] || m[2]);
const extraPath = new URL("recipes-extra.json", SITE);
let extra = [];
try { extra = JSON.parse(await readFile(extraPath, "utf8")); } catch { extra = []; }
if (extra.some(r => r.added === today)) { console.log("Already added recipes today; nothing to do."); process.exit(0); }
const known = [...new Set([...builtIn, ...extra.map(r => r.name)])];

const prompt = `You write original, tested-style keto recipes for a UK recipe app used by home cooks.
Return ONLY a JSON array of exactly ${COUNT} recipe objects. No prose, no markdown fences.

Each object has exactly these fields:
- "name": string, appetising and specific
- "blurb": string, one sentence, max 18 words
- "meal": one of "breakfast" | "main" | "snack" | "dessert"
- "mins": total minutes, number
- "serves": number
- "carbs": net carbs in grams per serving, number, maximum 10
- "contains": array using only ${JSON.stringify(TAGS)}; list EVERY one present (butter/ghee/cheese/cream = dairy, mayonnaise = eggs, fish sauce/anchovy = fish)
- "ing": array of ingredient strings, metric quantity first (e.g. "400g beef mince", "2 tbsp olive oil", "1 lime")
- "steps": array of 3-5 short method steps

Mix for this batch: 1 breakfast, ${COUNT - 3} mains, 1 snack, 1 dessert.
At least ${COUNT - 2} recipes must contain NO poultry and NO dairy.
Strictly keto: no sugar, honey, grains, flour (except almond/coconut), rice, pasta, potatoes, legumes or most fruit (a few berries is fine).
Use UK ingredient names (courgette, aubergine, coriander, prawns) and ingredients from a normal UK supermarket.
Vary cuisines and proteins. Make them feel seasonal for the week of ${today}.
Do NOT repeat or closely resemble any of these existing recipes: ${known.join("; ")}.`;

async function ask() {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": KEY, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: MODEL, max_tokens: 8000, messages: [{ role: "user", content: prompt }] })
  });
  if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data.content.filter(b => b.type === "text").map(b => b.text).join("");
  const json = text.replace(/```json|```/g, "").trim();
  return JSON.parse(json.slice(json.indexOf("["), json.lastIndexOf("]") + 1));
}

function clean(list) {
  const knownLower = new Set(known.map(n => n.toLowerCase()));
  const ids = new Set(extra.map(r => r.id));
  const out = [];
  for (const r of Array.isArray(list) ? list : []) {
    if (!r || typeof r.name !== "string" || !Array.isArray(r.ing) || !Array.isArray(r.steps)) continue;
    if (knownLower.has(r.name.toLowerCase())) continue;
    const ing = r.ing.filter(x => typeof x === "string" && x.trim()).map(x => x.trim());
    const steps = r.steps.filter(x => typeof x === "string" && x.trim()).map(x => x.trim());
    if (ing.length < 3 || steps.length < 2) continue;
    const carbs = Math.round(Number(r.carbs));
    if (!(carbs >= 0 && carbs <= 12)) continue;
    const contains = [...new Set([...(Array.isArray(r.contains) ? r.contains : []).filter(t => TAGS.includes(t)), ...autoTags(ing)])];
    let id = slug(r.name) || "recipe"; while (ids.has(id)) id += "-" + today.replace(/-/g, "");
    ids.add(id);
    out.push({
      id, meal: MEALS.includes(r.meal) ? r.meal : "main", name: r.name.trim(),
      blurb: String(r.blurb || "").trim(), mins: Math.max(1, Math.round(Number(r.mins) || 20)),
      serves: Math.max(1, Math.round(Number(r.serves) || 2)), carbs, contains, ing, steps, added: today
    });
  }
  return out;
}

let batch = [];
for (let attempt = 1; attempt <= 3 && batch.length < COUNT - 2; attempt++) {
  try { batch = clean(await ask()); console.log(`Attempt ${attempt}: ${batch.length} usable recipes`); }
  catch (e) { console.error(`Attempt ${attempt} failed: ${e.message}`); }
}
if (!batch.length) { console.error("No usable recipes this week; leaving the file unchanged."); process.exit(1); }

await writeFile(extraPath, JSON.stringify([...batch, ...extra], null, 1) + "\n");
console.log(`Added ${batch.length} recipes:\n- ` + batch.map(r => `${r.name} [${r.contains.join(", ") || "no allergen tags"}]`).join("\n- "));
