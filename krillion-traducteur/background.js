// Service worker : fait les appels réseau de traduction (les host_permissions
// contournent le CORS, ce qui est plus fiable que fetch depuis la page).

async function googleTranslate(text) {
  const url =
    "https://translate.googleapis.com/translate_a/single?client=gtx&sl=fr&tl=en&dt=t&q=" +
    encodeURIComponent(text);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Google HTTP " + res.status);
  const data = await res.json();
  const out = (data[0] || []).map((seg) => seg[0]).join("");
  if (!out) throw new Error("Google: réponse vide");
  return out;
}

async function myMemoryTranslate(text) {
  const url =
    "https://api.mymemory.translated.net/get?langpair=fr|en&q=" +
    encodeURIComponent(text);
  const res = await fetch(url);
  if (!res.ok) throw new Error("MyMemory HTTP " + res.status);
  const data = await res.json();
  const out = data && data.responseData && data.responseData.translatedText;
  if (!out) throw new Error("MyMemory: réponse vide");
  return out;
}

async function translate(text) {
  try {
    return await googleTranslate(text);
  } catch (e) {
    return await myMemoryTranslate(text); // secours
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "translate") return;
  translate(String(msg.text || ""))
    .then((text) => sendResponse({ ok: true, text }))
    .catch((err) => sendResponse({ ok: false, error: String(err) }));
  return true; // réponse asynchrone
});
