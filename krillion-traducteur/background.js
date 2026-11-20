// Service worker / event page : fait tous les appels réseau (traduction + aide).
// Les host_permissions contournent le CORS, ce qui est plus fiable que fetch depuis la page.

const api = globalThis.browser ?? globalThis.chrome; // Firefox / Chrome
const enc = encodeURIComponent;

/* ---------------------------- Traduction ---------------------------- */

async function googleTranslate(text, sl, tl) {
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=` + enc(text);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Google HTTP " + res.status);
  const data = await res.json();
  const out = (data[0] || []).map((seg) => seg[0]).join("");
  if (!out) throw new Error("Google: réponse vide");
  return { text: out, src: data[2] || sl };
}

async function myMemoryTranslate(text, sl, tl) {
  const url =
    `https://api.mymemory.translated.net/get?langpair=${sl === "auto" ? "en" : sl}|${tl}&q=` + enc(text);
  const res = await fetch(url);
  if (!res.ok) throw new Error("MyMemory HTTP " + res.status);
  const data = await res.json();
  const out = data && data.responseData && data.responseData.translatedText;
  if (!out) throw new Error("MyMemory: réponse vide");
  return { text: out, src: sl === "auto" ? "en" : sl };
}

async function translate(text, sl, tl) {
  try {
    return await googleTranslate(text, sl, tl);
  } catch (e) {
    return await myMemoryTranslate(text, sl, tl); // secours
  }
}

/* ------------------- Aide : suggestions simples/évidentes -------------------
 * On ne garde que des phrases COURTES et directes (première phrase d'un résumé,
 * une définition, une réponse instantanée). Pas d'articles longs ni de pages
 * d'homonymie. Sources gratuites, sans clé : Wikipedia, dictionaryapi.dev, DuckDuckGo.
 */

const MAX_LEN = 140;

function firstSentence(text) {
  const t = String(text || "").replace(/\s*\([^)]*\)/g, "").replace(/\s+/g, " ").trim(); // retire les (parenthèses)
  if (!t) return "";
  const m = t.match(/^.{15,}?[.!?](?=\s|$)/);
  const s = (m ? m[0] : t).trim();
  return s.length > MAX_LEN ? s.slice(0, MAX_LEN - 1).trimEnd() + "…" : s;
}

const cleanQuery = (q) => String(q || "").replace(/[?!.]+$/g, "").replace(/\s+/g, " ").trim().slice(0, 200);

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

async function wikiHints(q, lang) {
  const base = `https://${lang}.wikipedia.org`;
  const s = await getJson(
    `${base}/w/api.php?action=query&list=search&srsearch=${enc(q)}&srlimit=3&format=json&origin=*`
  );
  const hits = (s.query && s.query.search) || [];
  const sums = await Promise.allSettled(
    hits.map((h) => getJson(`${base}/api/rest_v1/page/summary/${enc(h.title.replace(/ /g, "_"))}`))
  );
  const out = [];
  for (const r of sums) {
    if (r.status !== "fulfilled") continue;
    const d = r.value;
    if (d.type !== "standard" || !d.extract) continue; // saute les pages d'homonymie
    if (/may refer to|peut désigner|peut faire référence/i.test(d.extract)) continue;
    const text = firstSentence(d.extract);
    if (text) out.push({ src: "Wikipedia", title: d.title, text });
  }
  return out;
}

async function dictHint(word, lang) {
  if (lang !== "en" || !/^[A-Za-z][A-Za-z'-]{1,29}$/.test(word)) return []; // un seul mot anglais
  const d = await getJson(`https://api.dictionaryapi.dev/v2/entries/en/${enc(word.toLowerCase())}`);
  const out = [];
  for (const m of (d[0] && d[0].meanings) || []) {
    const def = m.definitions && m.definitions[0] && m.definitions[0].definition;
    if (def) out.push({ src: "Dictionnaire", title: word, text: `${m.partOfSpeech}: ${firstSentence(def)}` });
    if (out.length >= 2) break;
  }
  return out;
}

async function ddgHint(q) {
  const d = await getJson(`https://api.duckduckgo.com/?q=${enc(q)}&format=json&no_html=1&skip_disambig=1`);
  const text = firstSentence(d.Answer || d.AbstractText || d.Definition || "");
  return text ? [{ src: "DuckDuckGo", title: d.Heading || q, text }] : [];
}

async function help(question, lang) {
  const q = cleanQuery(question);
  if (!q) return [];
  const words = q.split(" ").length;
  const jobs = [ddgHint(q), wikiHints(q, lang)];
  if (words === 1) jobs.push(dictHint(q, lang));
  const settled = await Promise.allSettled(jobs);
  const seen = new Set();
  const items = [];
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    for (const it of r.value) {
      const k = it.text.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      items.push(it);
    }
  }
  return items.slice(0, 4);
}

/* ---------------------------- Messages ---------------------------- */

api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return;
  if (msg.type === "translate") {
    translate(String(msg.text || ""), msg.sl || "fr", msg.tl || "en")
      .then((r) => sendResponse({ ok: true, text: r.text, src: r.src }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // réponse asynchrone
  }
  if (msg.type === "help") {
    help(String(msg.q || ""), msg.lang === "fr" ? "fr" : "en")
      .then((items) => sendResponse({ ok: true, items }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
});
