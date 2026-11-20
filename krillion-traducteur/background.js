// Service worker : fait les appels réseau de traduction (les host_permissions
// contournent le CORS, ce qui est plus fiable que fetch depuis la page).

async function googleTranslate(text, sl, tl) {
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=` +
    encodeURIComponent(text);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Google HTTP " + res.status);
  const data = await res.json();
  const out = (data[0] || []).map((seg) => seg[0]).join("");
  if (!out) throw new Error("Google: réponse vide");
  return { text: out, src: data[2] || sl };
}

async function myMemoryTranslate(text, sl, tl) {
  const url =
    `https://api.mymemory.translated.net/get?langpair=${sl === "auto" ? "en" : sl}|${tl}&q=` +
    encodeURIComponent(text);
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

const api = globalThis.browser ?? globalThis.chrome; // Firefox / Chrome

api.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "translate") return;
  translate(String(msg.text || ""), msg.sl || "fr", msg.tl || "en")
    .then((r) => sendResponse({ ok: true, text: r.text, src: r.src }))
    .catch((err) => sendResponse({ ok: false, error: String(err) }));
  return true; // réponse asynchrone
});
