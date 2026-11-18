"use strict";

// AIs with `url` take the question from the link. AIs with only `open` get the
// copy-and-paste fallback, because they have no known prefill link.
const AIS = {
  claude: { name: "Claude", url: (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}` },
  chatgpt: { name: "ChatGPT", url: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}` },
  perplexity: { name: "Perplexity", url: (q) => `https://www.perplexity.ai/search?q=${encodeURIComponent(q)}` },
  gemini: { name: "Gemini", open: "https://gemini.google.com/app" },
  codex: { name: "Codex", open: "https://chatgpt.com/codex" },
};

const STORAGE_KEY = "lmaitfy.ai";
const MAX_LENGTH = 2000;
const TYPING_TOTAL_MS = 4000;
const REDIRECT_DELAY_MS = 1500;
const POINTER_MOVE_MS = 700;

const $ = (id) => document.getElementById(id);
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, reducedMotion ? 0 : ms));
const isAi = (key) => typeof key === "string" && Object.hasOwn(AIS, key);

// Each route() call bumps this, so an animation still running stops itself.
let runId = 0;

function readParams() {
  const params = new URLSearchParams(location.hash.slice(1));
  const question = (params.get("q") || "").trim().slice(0, MAX_LENGTH);
  const ai = params.get("ai");
  return { question, suggested: isAi(ai) ? ai : null };
}

function savedAi() {
  try {
    const key = localStorage.getItem(STORAGE_KEY);
    return isAi(key) ? key : null;
  } catch {
    return null;
  }
}

function saveAi(key) {
  try {
    localStorage.setItem(STORAGE_KEY, key);
  } catch {
    // Private mode or storage blocked: the picker just shows again next time.
  }
}

function forgetAi() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing saved to forget.
  }
}

function show(sectionId) {
  for (const id of ["create", "pick", "play"]) {
    $(id).hidden = id !== sectionId;
  }
}

function buildLink(question, ai) {
  const params = new URLSearchParams({ q: question });
  if (ai) params.set("ai", ai);
  return `${location.origin}${location.pathname}#${params}`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

function showCreate() {
  show("create");
  $("result").hidden = true;
}

function setupCreate() {
  const select = $("suggest");
  for (const [key, ai] of Object.entries(AIS)) {
    select.add(new Option(ai.name, key));
  }

  $("create-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const question = $("question").value.trim();
    if (!question) return;
    const link = buildLink(question, select.value || null);
    $("link").value = link;
    $("preview").href = link;
    $("result").hidden = false;
  });

  $("copy-link").addEventListener("click", async () => {
    const ok = await copyText($("link").value);
    $("copy-link").textContent = ok ? "Copied!" : "Copy failed";
    setTimeout(() => ($("copy-link").textContent = "Copy link"), 1500);
  });
}

function showPick(question, suggested) {
  show("pick");
  $("pick-question").textContent = `“${question}”`;
  const choices = $("choices");
  choices.replaceChildren();
  for (const [key, ai] of Object.entries(AIS)) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = ai.name;
    const notes = [];
    if (key === suggested) notes.push("suggested");
    if (!ai.url) notes.push("copy & paste");
    if (notes.length) {
      const small = document.createElement("small");
      small.textContent = notes.join(" · ");
      button.appendChild(small);
    }
    if (key === suggested) button.classList.add("suggested");
    button.addEventListener("click", () => {
      if ($("remember").checked) saveAi(key);
      play(question, key);
    });
    choices.appendChild(button);
  }
}

async function movePointerTo(element) {
  const rect = element.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  $("pointer").style.transform = `translate(${x}px, ${y}px)`;
  await sleep(POINTER_MOVE_MS);
}

async function play(question, key) {
  const run = ++runId;
  const stillRunning = () => run === runId;
  const ai = AIS[key];

  show("play");
  $("chat-title").textContent = `Ask ${ai.name}`;
  $("typed").textContent = "";
  $("finish").hidden = true;
  $("status").textContent = "Step 1: click the box.";

  const pointer = $("pointer");
  pointer.style.transition = "none";
  pointer.style.transform = `translate(${window.innerWidth - 40}px, ${window.innerHeight - 40}px)`;
  pointer.getBoundingClientRect();
  pointer.style.transition = "";

  await movePointerTo($("typed"));
  if (!stillRunning()) return;

  $("status").textContent = "Step 2: type your question.";
  const delay = Math.max(15, Math.min(70, TYPING_TOTAL_MS / question.length));
  for (const char of question) {
    $("typed").textContent += char;
    await sleep(delay);
    if (!stillRunning()) return;
  }

  $("status").textContent = "Step 3: press send.";
  await movePointerTo($("send"));
  if (!stillRunning()) return;
  $("send").classList.add("pressed");
  await sleep(150);
  $("send").classList.remove("pressed");

  if (ai.url) {
    $("status").textContent = `Was that so hard? Opening ${ai.name}…`;
    await sleep(REDIRECT_DELAY_MS);
    if (!stillRunning()) return;
    location.href = ai.url(question);
    return;
  }

  $("status").textContent = `Was that so hard? ${ai.name} can't take a question from a link, so paste it in.`;
  const go = $("go");
  go.textContent = `Copy question & open ${ai.name}`;
  go.onclick = async () => {
    await copyText(question);
    location.href = ai.open;
  };
  $("finish").hidden = false;
}

function route() {
  runId++;
  const { question, suggested } = readParams();
  if (!question) {
    showCreate();
    return;
  }
  const saved = savedAi();
  if (saved) {
    play(question, saved);
  } else {
    showPick(question, suggested);
  }
}

$("change-ai").addEventListener("click", (event) => {
  event.preventDefault();
  runId++;
  forgetAi();
  const { question, suggested } = readParams();
  showPick(question, suggested);
});

setupCreate();
window.addEventListener("hashchange", route);
route();
