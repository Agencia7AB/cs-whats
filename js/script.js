const MANIFEST_URL = require("../manifest.json");
const BASE_DIR = "txt/";
const MAX_SNIPPETS_PER_FILE = 3;
const SNIPPET_CHARS_BEFORE = 80;
const SNIPPET_CHARS_AFTER = 120;

const CATEGORIES =
{
  "pagamento/preço":
	[
    "pix",
    "boleto",
    "cartão",
    "pagamento",
    "pago",
    "preço",
    "valor",
    "invoice",
    "payment",
    "precio",
    "pagar",
  ],
  "agendamento/horário":
	[
    "agendar",
    "marcar",
    "horário",
    "disponível",
    "agenda",
    "cita",
    "turno",
    "schedule",
    "booking",
  ],
  "endereço/localização":
	[
    "endereço",
    "local",
    "onde fica",
    "como chegar",
    "address",
    "ubicación",
    "direccion",
    "mapa",
  ],
  "suporte/ajuda":
	[
    "ajuda",
    "suporte",
    "atendimento",
    "help",
    "soporte",
    "ayuda",
    "não funciona",
    "no funciona",
    "erro",
    "error",
    "bug",
  ],
  "documentos/dados":
	[
    "cpf",
    "cnpj",
    "rg",
    "dni",
    "pasaporte",
    "passaporte",
    "documento",
    "comprovante",
    "doc",
  ],
  "cadastro/acesso":
	[
    "cadastro",
    "registrar",
    "registro",
    "login",
    "senha",
    "password",
    "acesso",
    "entrar",
    "cadastrar",
  ],
  "reembolso/cancelamento":
	[
    "reembolso",
    "estorno",
    "devolução",
    "cancelar",
    "cancelamento",
    "refund",
  ],
  "prazo/entrega":
	[
    "prazo",
    "entrega",
    "quando",
    "data",
    "deadline",
    "plazo",
    "tarde",
    "demora",
  ],
  "mídia/arquivo":
	[
    "áudio",
    "audio",
    "imagem",
    "foto",
    "video",
    "arquivo",
    "documento",
    "adjunto",
    "anexo",
    "media omitted",
    "multimedia omitida",
  ],
};

function guessLang(t)
{
  t = t.toLowerCase();

  const pt =
	[
    "você",
    "prazo",
    "boleto",
    "pix",
    "obrigado",
    "obrigada",
    "atendimento",
    "cadastro",
    "cpf",
  ];
  const es =
	[
    "usted",
    "gracias",
    "pago",
    "precio",
    "horario",
    "soporte",
    "ayuda",
    "registro",
    "dni",
  ];
  const en =
	[
    // "you",
    // "thanks",
    // "price",
    // "support",
    // "help",
    // "register",
    // "id",
    // "payment",
  ];

  const s = { pt: 0, es: 0, en: 0 };
  pt.forEach((w) => t.includes(w) && s.pt++);
  es.forEach((w) => t.includes(w) && s.es++);
  en.forEach((w) => t.includes(w) && s.en++);
  return s.pt >= s.es && s.pt >= s.en ? "pt" : s.es >= s.en ? "es" : "en";
}

function classify(t)
{
  t = t.toLowerCase();
  const hit = [];
  for (const [cat, kws] of Object.entries(CATEGORIES)) {
    if (kws.some((k) => t.includes(k))) hit.push(cat);
  }
  return hit;
}
function escReg(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const state = { docs: [], loaded: false };

async function loadAll() {
  try {
    const manifestResp = await fetch(MANIFEST_URL, { cache: "no-store" });
    if (!manifestResp.ok) throw new Error("manifest.json não encontrado");
    const manifest = await manifestResp.json();
    const loaders = manifest.map(async (f) => {
      const url = BASE_DIR + f;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("Arquivo não acessível: " + url);
      const text = await res.text();
      const lang = guessLang(text);
      const cats = Array.from(new Set(classify(text)));
      state.docs.push({ file: f, url, text, lang, cats });
    });
    await Promise.all(loaders);
    state.loaded = true;
    document.getElementById(
      "count"
    ).textContent = `Carregados ${state.docs.length} arquivos.`;
    runSearch();
  } catch (e) {
    document.getElementById("count").textContent =
      "Sem manifest.json (clique em “Gen” para gerar).";
    console.warn(e.message);
  }
}

function makeSnippet(text, idx, q) {
  const start = Math.max(0, idx - SNIPPET_CHARS_BEFORE);
  const end = Math.min(text.length, idx + q.length + SNIPPET_CHARS_AFTER);
  let sn = text.slice(start, end);
  const rx = new RegExp(escReg(q), "ig");
  sn = sn.replace(rx, (m) => `<mark>${m}</mark>`);
  return (start > 0 ? "…" : "") + sn + (end < text.length ? "…" : "");
}

function runSearch() {
  const results = document.getElementById("results");
  results.innerHTML = "";
  if (!state.loaded) {
    return;
  }

  const q = document.getElementById("q").value.trim();
  const lang = document.getElementById("lang").value;
  const cat = document.getElementById("cat").value;

  const rx = q ? new RegExp(escReg(q), "i") : null;

  let totalSnippets = 0;
  const matches = [];

  for (const d of state.docs) {
    if (lang && d.lang !== lang) continue;
    if (cat && !d.cats.includes(cat)) continue;
    if (!rx) {
      matches.push({ doc: d, snippets: [] });
      continue;
    }
    const found = [];
    let m;
    while ((m = rx.exec(d.text)) && found.length < MAX_SNIPPETS_PER_FILE) {
      found.push(makeSnippet(d.text, m.index, q));
      if (rx.lastIndex === m.index) rx.lastIndex++; // evita loop
    }
    if (found.length) matches.push({ doc: d, snippets: found });
  }

  if (!matches.length) {
    results.innerHTML = `<div class="empty">Nenhum resultado.</div>`;
    document.getElementById("count").textContent = "0 resultados";
    return;
  }

  for (const { doc, snippets } of matches) {
    const card = document.createElement("div");
    card.className = "card";
    const chips = doc.cats
      .map((c) => `<span class="chip">${c}</span>`)
      .join(" ");
    card.innerHTML = `
      <div class="hdr">
        <div class="file">${
          doc.file
        } <span class="mut">• ${doc.lang.toUpperCase()}</span></div>
        <div><a class="open" href="${
          doc.url
        }" target="_blank" rel="noopener">abrir arquivo</a></div>
      </div>
      <div class="chips">${
        chips || '<span class="chip">sem categoria</span>'
      }</div>
      ${snippets.map((s) => `<div class="snippet">${s}</div>`).join("")}
    `;
    results.appendChild(card);
    totalSnippets += snippets.length || 1;
  }

  const label = q
    ? `${totalSnippets} ocorrência(s) em ${matches.length} arquivo(s)`
    : `${matches.length} arquivo(s) listados`;
  document.getElementById("count").textContent = label;
}

// debounce
let timer = null;
["q", "lang", "cat"].forEach((id) => {
  document.getElementById(id).addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(runSearch, 140);
  });
});


async function urlExists(url) {
  try {
    // tenta HEAD
    let r = await fetch(url, { method: "HEAD", cache: "no-store" });
    if (r.ok) return true;
    // fallback GET leve
    r = await fetch(url, { method: "GET", cache: "no-store" });
    return r.ok;
  } catch (_) {
    return false;
  }
}

async function generate() {
  const btn = document.getElementById("genBtn");
  btn.disabled = true;
  btn.textContent = "Gerando…";
  try {
    const maxTry = 5000;
    const found = [];
    const step = 600;
    let upper = step;

    // checa progressivamente
    while (upper <= maxTry) {
      let anyHit = false;
      for (let i = upper - step + 1; i <= upper; i++) {
        const name = `_chat ${i}.txt`;
        const url = BASE_DIR + name;
        /* eslint no-await-in-loop: 0 */
        const ok = await urlExists(url);
        if (ok) {
          found.push(name);
          anyHit = true;
        }
      }
      if (!anyHit && found.length) break;
      upper += step;
    }

    if (!found.length) {
      alert('Nenhum arquivo encontrado em /messages no padrão "_chat N.txt".');
      btn.disabled = false;
      btn.textContent = "Gen";
      return;
    }

    // ordena numericamente
    found.sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] || 0, 10);
      const nb = parseInt(b.match(/\d+/)?.[0] || 0, 10);
      return na - nb;
    });

    // baixa o manifest.json
    const blob = new Blob([JSON.stringify(found, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "manifest.json";
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();

    document.getElementById(
      "count"
    ).textContent = `Manifest gerado com ${found.length} arquivos. Salve-o na raiz ao lado do index.html.`;
  } catch (e) {
    console.error(e);
    alert("Falha ao gerar manifest.json");
  } finally {
    btn.disabled = false;
    btn.textContent = "Gen";
  }
}

document.getElementById("genBtn").addEventListener("click", generate);

loadAll();
