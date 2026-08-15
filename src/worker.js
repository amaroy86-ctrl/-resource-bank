const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: JSON_HEADERS });
}
function textValue(v, max = 20000) {
  return String(v ?? "").slice(0, max);
}
function arrayValue(v, max = 40) {
  return Array.isArray(v) ? v.slice(0, max) : [];
}
function cleanModelJson(raw) {
  return String(raw || "").trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/, "")
    .replace(/\s*```$/, "");
}
function outputText(data) {
  if (data?.output_text) return data.output_text;
  if (!Array.isArray(data?.output)) return "";
  return data.output.flatMap(o => Array.isArray(o?.content) ? o.content : [])
    .map(c => c?.text || "").join("");
}

async function callOpenAI(env, { instructions, input, timeoutMs = 0 }) {
  if (!env.OPENAI_API_KEY) {
    const e = new Error("OPENAI_API_KEY is not configured in Cloudflare.");
    e.status = 503;
    throw e;
  }
  const controller = timeoutMs ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  let response;
  try {
    response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "authorization": `Bearer ${env.OPENAI_API_KEY}`,
        "content-type": "application/json"
      },
      signal: controller?.signal,
      body: JSON.stringify({
        model: env.OPENAI_MODEL || "gpt-5-mini",
        store: false,
        instructions,
        input
      })
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      const e = new Error("The AI request took too long. Please try again.");
      e.status = 504;
      throw e;
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const e = new Error(data?.error?.message || `OpenAI request failed (${response.status}).`);
    e.status = response.status;
    throw e;
  }
  return outputText(data);
}

function officialSources(body, max = 14) {
  return arrayValue(body?.sources || body?.officialSources, max).map((s, i) => ({
    n: i + 1,
    source: textValue(s?.source, 200),
    subtitle: textValue(s?.subtitle, 300),
    sourceDate: textValue(s?.sourceDate, 100),
    authority: textValue(s?.authority, 300),
    page: textValue(s?.page, 50),
    paragraph: textValue(s?.paragraph, 120),
    heading: textValue(s?.heading, 400),
    text: textValue(s?.text, 7000)
  }));
}

async function handleAsk(request, env) {
  const body = await request.json();
  const question = textValue(body?.question, 5000).trim();
  if (!question) return json({ error: "Question is required." }, 400);

  const history = arrayValue(body?.history, 8).map(m => ({
    role: m?.role === "assistant" ? "assistant" : "user",
    content: textValue(m?.content, 6000)
  })).filter(m => m.content.trim());
  const official = officialSources(body, 8);
  const local = arrayValue(body?.localResources, 12).map((x, i) => ({
    source: textValue(x?.title || `Local Resource ${i + 1}`, 250),
    subtitle: textValue(x?.category, 200),
    sourceDate: textValue(x?.effectiveDate || x?.addedDate || "Local", 100),
    authority: "Local Resource",
    page: "Local",
    paragraph: textValue(x?.reference || "Local", 150),
    heading: textValue(x?.reference || x?.category || "Local Resource", 300),
    text: textValue(x?.text, 7000),
    local: true
  }));

  const combined = [...official, ...local].slice(0, 12);
  if (!combined.length) return json({ error: "No Resource Bank sources were retrieved for this question." }, 400);

  const sourceText = combined.map((s, i) =>
    `[SOURCE ${i + 1}] ${s.source}${s.subtitle ? ` — ${s.subtitle}` : ""}\n` +
    `Authority: ${s.authority || ""} | Date: ${s.sourceDate || ""} | ` +
    `Paragraph/Reference: ${s.paragraph || ""} | Page: ${s.page || ""}\n` +
    `${s.heading ? `Heading: ${s.heading}\n` : ""}${s.text}`
  ).join("\n\n");

  const instructions = `You are Resource Bank's source-grounded assistant.
- Answer ONLY from the supplied Resource Bank sources.
- Do not use outside knowledge or invent requirements.
- Conversation history is context for interpreting the new question only. It is NOT a source of policy facts.
- If a requirement mentioned in conversation history is not supported by the currently supplied sources, say the current supplied sources do not support it.
- Preserve mandatory wording such as must, will, shall, required, prohibited, NLT, minimum, and maximum.
- Cite supporting source numbers inline as [1], [2], etc.
- If the supplied sources do not support the answer, say so.
- Identify Local Resource content as local guidance, not Air Force-wide policy.
- Identify older/legacy-source limitations when present.
- Be practical and concise, but include exact requirements when the source states them.`;

  const answer = await callOpenAI(env, {
    instructions,
    input: `RECENT CONVERSATION CONTEXT (NOT A POLICY SOURCE)\n${history.length ? history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n") : "No prior conversation."}\n\nCURRENT QUESTION\n${question}\n\nCURRENT RESOURCE BANK SOURCES (THE ONLY POLICY FACT SOURCES)\n${sourceText}`,
    timeoutMs: 45000
  });

  return json({
    answer,
    sources: combined.map((s, i) => ({
      source: s.source,
      authority: s.authority,
      sourceDate: s.sourceDate,
      paragraph: s.paragraph,
      page: s.page,
      title: s.heading || s.subtitle || "",
      sourceNumber: i + 1
    })),
    sourceCount: combined.length
  });
}

async function handleParseResource(request, env) {
  const body = await request.json();
  const text = textValue(body?.text, 50000).trim();
  if (!text) return json({ error: "No email or message text was provided." }, 400);

  const instructions = `Extract work-center policy and operational changes from pasted email/message text.
- Use ONLY the pasted message.
- Do not invent dates, requirements, references, contacts, deadlines, or policy.
- If unsupported, return an empty string or empty array.
- Preserve must/will/shall/required/prohibited/NLT wording.
- Distinguish actual changes from greetings, signatures, disclaimers, discussion, and old quoted reply chains.
- Prefer the newest/top-level message unless older quoted material is necessary.
- effectiveDate and reviewDate must be YYYY-MM-DD only when an exact date is supported.
- cleanText removes email clutter without changing operational meaning.

Return ONLY valid JSON:
{"title":"","category":"","effectiveDate":"","reviewDate":"","reference":"","summary":"","actions":[],"deadlines":[],"pocs":[],"cleanText":""}`;

  const raw = await callOpenAI(env, { instructions, input: text });
  let parsed;
  try { parsed = JSON.parse(cleanModelJson(raw)); }
  catch { return json({ error: "The message was read, but the extracted result could not be parsed. Please try again." }, 502); }

  return json({ extracted: {
    title: textValue(parsed.title, 500),
    category: textValue(parsed.category, 300),
    effectiveDate: textValue(parsed.effectiveDate, 20),
    reviewDate: textValue(parsed.reviewDate, 20),
    reference: textValue(parsed.reference, 700),
    summary: textValue(parsed.summary, 6000),
    actions: arrayValue(parsed.actions, 30).map(x => textValue(x, 1500)),
    deadlines: arrayValue(parsed.deadlines, 30).map(x => textValue(x, 1200)),
    pocs: arrayValue(parsed.pocs, 30).map(x => textValue(x, 1200)),
    cleanText: textValue(parsed.cleanText, 20000)
  }});
}

async function handleParseAppointment(request, env) {
  const body = await request.json();
  const text = textValue(body?.text, 30000).trim();
  const fileData = textValue(body?.fileData, 8_000_000).trim();
  const fileName = textValue(body?.fileName || "appointment-letter.pdf", 250);
  if (!text && !fileData) return json({ error: "No appointment letter was provided." }, 400);

  const instructions = `Extract appointment-letter information using ONLY the supplied letter.
Do not invent names, dates, roles, authorities, expiration dates, or references.
If the letter says until superseded/rescinded/PCS/PCA or similar, do NOT invent a calendar expiration date.
expirationDate may be calculated only from an exact date plus an explicit duration.
Preserve mandatory wording.

Return ONLY valid JSON:
{"title":"","category":"","members":[],"role":"","effectiveDate":"","expirationDate":"","expirationBasis":"","reference":"","summary":""}`;

  const content = [{ type: "input_text", text: text || "Analyze the attached appointment letter." }];
  if (fileData) content.push({ type: "input_file", filename: fileName, file_data: fileData });

  const raw = await callOpenAI(env, {
    instructions,
    input: [{ role: "user", content }]
  });

  let parsed;
  try { parsed = JSON.parse(cleanModelJson(raw)); }
  catch { return json({ error: "The letter was read, but the detected information could not be parsed. Please try again." }, 502); }

  return json({ extracted: {
    title: textValue(parsed.title, 500),
    category: textValue(parsed.category, 300),
    members: arrayValue(parsed.members, 40).map(x => textValue(x, 500)),
    role: textValue(parsed.role, 3000),
    effectiveDate: textValue(parsed.effectiveDate, 20),
    expirationDate: textValue(parsed.expirationDate, 20),
    expirationBasis: textValue(parsed.expirationBasis, 1000),
    reference: textValue(parsed.reference, 1500),
    summary: textValue(parsed.summary, 7000)
  }});
}

async function handleTraining(request, env) {
  const body = await request.json();
  const task = textValue(body?.task, 2000).trim();
  if (!task) return json({ error: "Training task is required." }, 400);

  const experience = textValue(body?.experience || "Basic", 50);
  const format = textValue(body?.format || "Hands-on qualification", 100);
  const duration = textValue(body?.duration, 300);
  const target = textValue(body?.target || "Intermediate", 50);
  const known = textValue(body?.known, 6000);
  const localProcess = textValue(body?.localProcess, 9000);
  const goal = textValue(body?.goal, 4000);
  const cfetpCurrent = body?.cfetpCurrent || {};
  const cfetpTarget = body?.cfetpTarget || {};
  const cfetpProgression = textValue(body?.cfetpProgression, 1000);

  const official = officialSources(body, 14);
  const localResources = arrayValue(body?.localResources, 40);
  const readFile = arrayValue(body?.readFile, 40);

  const officialText = official.map((x, i) =>
    `[OFFICIAL SOURCE ${i + 1}] ${x.source}${x.subtitle ? ` — ${x.subtitle}` : ""} | ` +
    `Date ${x.sourceDate || ""} | Paragraph ${x.paragraph || ""} | Page ${x.page || ""}\n` +
    `${x.heading ? x.heading + "\n" : ""}${x.text}`
  ).join("\n\n");

  const localText = [
    ...localResources.map((x, i) =>
      `[LOCAL RESOURCE ${i + 1}] ${textValue(x?.title,250)} | ${textValue(x?.category,200)} | ${textValue(x?.reference,500)}\n${textValue(x?.text,7000)}`
    ),
    ...readFile.map((x, i) =>
      `[ATOC READ FILE ${i + 1}] ${textValue(x?.title,250)} | ${textValue(x?.category,200)} | ${textValue(x?.reference,500)}\n${textValue(x?.text,7000)}`
    )
  ].join("\n\n");

  const instructions = `Create a source-grounded Air Force work-center training plan.

SOURCE RULES:
- Official requirements may come ONLY from OFFICIAL SOURCE excerpts.
- Local practices may come ONLY from user local notes, Local Resource entries, and ATOC Read File entries.
- NEVER present local practice as Air Force-wide policy.
- NEVER invent qualification intervals, safety rules, forms, references, or mandatory standards.
- Preserve must/will/shall/required/prohibited/NLT wording.
- If official excerpts do not support a requested detail, say so.

2T2X1 CFETP PROFICIENCY MODEL:
- Basic: sustained application of competency over time.
- Intermediate: sustained application over time in a variety of situations.
- Advanced: sustained application over time in complex situations.
- Expert: able to innovate/formulate strategies and model, guide, or teach others.
- Do not automatically equate these with 3-/5-/7-/9-skill levels.
- Build observable standards appropriate to the TARGET proficiency.

Return ONLY valid JSON:
{"title":"","objective":"","currentProficiency":"","targetProficiency":"","proficiencyCriterion":"","officialBaseline":"","localAdaptation":"","phases":[{"name":"","purpose":"","steps":[],"instructorFocus":"","traineeStandard":""}],"commonErrors":[],"knowledgeChecks":[],"scenarios":[],"evaluationStandard":"","references":[{"source":"","reference":"","page":"","note":""}]}`;

  const input = `TRAINING REQUEST
Task: ${task}
Current CFETP proficiency: ${experience}
Current criterion: ${textValue(cfetpCurrent?.criterion,1000) || "Not specified"}
Training format: ${format}
Time available: ${duration || "Not specified"}
Target CFETP proficiency: ${target}
Target criterion: ${textValue(cfetpTarget?.criterion,1000) || "Not specified"}
Progression intent: ${cfetpProgression || "Not specified"}
Already knows: ${known || "Not specified"}
Training goal: ${goal || "Not specified"}

USER-PROVIDED LOCAL PROCESS / INSTRUCTOR NOTES
${localProcess || "None provided"}

OFFICIAL INDEXED SOURCE EXCERPTS
${officialText || "No matching official excerpts were retrieved."}

SAVED LOCAL RESOURCES / ATOC READ FILE
${localText || "No saved local resources were provided."}`;

  const raw = await callOpenAI(env, { instructions, input });
  let plan;
  try { plan = JSON.parse(cleanModelJson(raw)); }
  catch { return json({ error: "The training plan was created, but the response could not be parsed. Please try again." }, 502); }

  return json({ plan });
}

async function routeApi(request, env, url) {
  if (url.pathname === "/api/health" && request.method === "GET") {
    return json({
      ok: true,
      runtime: "cloudflare-workers",
      openaiConfigured: Boolean(env.OPENAI_API_KEY),
      model: env.OPENAI_MODEL || "gpt-5-mini"
    });
  }

  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    if (url.pathname === "/api/ask") return await handleAsk(request, env);
    if (url.pathname === "/api/parse-resource") return await handleParseResource(request, env);
    if (url.pathname === "/api/parse-appointment") return await handleParseAppointment(request, env);
    if (url.pathname === "/api/build-training") return await handleTraining(request, env);
    return json({ error: "API route not found." }, 404);
  } catch (error) {
    return json({ error: error?.message || "Request failed." }, error?.status || 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) return routeApi(request, env, url);
    return env.ASSETS.fetch(request);
  }
};
