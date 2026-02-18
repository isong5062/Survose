import {
  surveyCreatorModel,
  surveyQAModel,
  surveyQuestionerModel,
  surveyAnalyzerModel,
} from '../firebase';

const QA_SECTION_KEYS = [
  'bias',
  'demographics',
  'leadingQuestions',
  'clarity',
  'lengthAndFatigue',
  'sensitivityAndEthics',
];

const QA_SYSTEM_PROMPT = `You are a survey quality assurance expert. Analyze the given survey and return a JSON object with exactly six arrays of strings. Use these keys: bias, demographics, leadingQuestions, clarity, lengthAndFatigue, sensitivityAndEthics.

- bias: Potential sources of bias (sample, selection, order, wording). Be specific; cite question numbers where relevant.
- demographics: Whether key demographics are covered (age, gender, region, etc.) and what might be missing for representativeness.
- leadingQuestions: Questions that suggest a preferred answer, use loaded language, or could skew responses. Note question number and why.
- clarity: Ambiguous wording, double-barreled questions (two things in one), jargon, unclear instructions, or confusing flow. Cite question numbers.
- lengthAndFatigue: Survey length, repetition, risk of respondent fatigue or drop-off, or suggestions to shorten/streamline.
- sensitivityAndEthics: Sensitive topics, consent, privacy, placement of personal or sensitive questions, and whether the survey is appropriate and respectful.

If a category has no issues, include one brief positive or neutral note (e.g. "No major clarity issues detected"). Always return at least one item per array.`;

function extractJson(text) {
  if (!text || !text.trim()) return null;
  const trimmed = text.trim();
  const codeBlock = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = codeBlock ? codeBlock[1].trim() : trimmed;
  return JSON.parse(raw);
}

function formatSurveyForPrompt(survey) {
  const lines = (survey.questions || []).map((q, i) => {
    const text = typeof q === 'string' ? q : (q?.text ?? '');
    const type = typeof q === 'object' && q?.type ? q.type : 'open_ended';
    const opts = typeof q === 'object' && q?.options && Object.keys(q.options || {}).length ? JSON.stringify(q.options) : '{}';
    return `Q${i + 1}: ${text} [type: ${type}, options: ${opts}]`;
  });
  return `Title: ${survey.title ?? 'Untitled'}\n\nQuestions:\n${lines.join('\n')}`;
}

const CREATOR_PROMPT = `You are a survey creator. This survey will be conducted by a VOICE AGENT making phone calls—the agent has a conversation with the respondent, so design accordingly.

Produce a complete survey as a single JSON object with two keys: "title" (string) and "questions" (array of question objects).

Voice-agent rules:
- Keep questions SELF-CONTAINED and not too closely linked. Avoid "Following on from that..." or "Based on your previous answer...". Each question should make sense on its own so the agent can ask it in a natural, conversational order or allow brief back-and-forth.
- Phrase questions so they are easy to say aloud and easy to understand by ear. Prefer short, clear sentences. The voice agent needs to be able to have a real conversation with the person, not just read a rigid script.
- Avoid long dependency chains between questions so the conversation can flow and the agent can adapt (e.g. skip or rephrase) if needed.

Each question object must have: "id" (string, e.g. "q0", "q1"), "text" (string), "type" (one of: open_ended, scale, multiple_choice, checkbox, yes_no), "options" (object).
- For open_ended and yes_no: options is {}.
- For scale: options is { "min": number, "max": number } (e.g. 1 and 10).
- For multiple_choice or checkbox: options is { "choices": array of strings } (at least 2).
- For yes_no you may use options {} or { "choices": ["Yes", "No"] }.

Create 3 to 10 questions appropriate for the topic. Vary types where it fits. Return only valid JSON, no markdown or extra text.`;

const QUESTIONER_SYSTEM = `You are a survey quality expert (Questioner). You receive a survey and a QA report (or optional feedback). This survey will be used by a VOICE AGENT having a conversation with respondents.

Your task is to output a corrected survey that addresses the issues while keeping it voice-agent friendly:
- Keep questions SELF-CONTAINED and not too closely linked. Avoid dependencies like "Based on that..." so the agent can ask questions in a natural, conversational order.
- Wording should be easy to say aloud and easy to understand by ear; the agent should be able to have a real conversation, not a rigid script.
- Fix bias, leading questions, clarity, length/fatigue, and sensitivity/ethics per the QA report or feedback.

Output a single JSON object with: "title" (string), "questions" (array). Each question: "id", "text", "type", "options" (same format as input).
- type must be one of: open_ended, scale, multiple_choice, checkbox, yes_no.
- Keep the same number of questions unless the report says to add or remove; you may reword, reorder options, or change type if it improves quality.
Return only valid JSON, no markdown or extra text.`;

const ANALYZER_PROMPT = `You are an Analyzer. You receive the original draft survey and the QA-revised survey. This survey will be conducted by a VOICE AGENT in conversation with respondents.

Decide if the revised survey is good enough to use. Criteria:
- Survey QA: no significant bias, no leading questions, clear wording, reasonable length, appropriate sensitivity/ethics.
- Voice-agent suitability: questions should be self-contained (not overly dependent on each other) and phrased so the agent can have a natural conversation; avoid rigid, tightly chained sequences.

If the revised survey addresses the main issues and is ready for voice use, approve it.

Return a JSON object with: "approved" (boolean) and "feedback" (string). If approved is true, feedback can be empty or a brief note. If approved is false, feedback must briefly tell the Questioner what still needs improvement (e.g. "Questions still too linked" or "Make Q3 stand alone"). Return only valid JSON.`;

async function runCreator(userPrompt) {
  const fullPrompt = `${CREATOR_PROMPT}\n\nUser description or topic:\n${userPrompt}`;
  const result = await surveyCreatorModel.generateContent(fullPrompt);
  const text = result.response.text();
  const parsed = extractJson(text);
  if (!parsed || !parsed.questions || !Array.isArray(parsed.questions)) {
    throw new Error('Creator did not return a valid survey with questions.');
  }
  return {
    title: parsed.title ?? 'Untitled Survey',
    questions: parsed.questions,
  };
}

async function runQA(survey) {
  const questionLines = (survey.questions ?? []).map((q, i) => {
    const text = typeof q === 'string' ? q : q?.text ?? '';
    const type = typeof q === 'object' && q?.type ? ` [${q.type}]` : '';
    const opts = typeof q === 'object' && q?.options && Object.keys(q.options).length ? ` Options: ${JSON.stringify(q.options)}` : '';
    return `Q${i + 1}: ${text}${type}${opts}`.trim();
  }).filter(Boolean);
  const prompt = `Survey title: ${survey.title ?? 'Untitled'}\n\nQuestions:\n${questionLines.join('\n')}`;
  const result = await surveyQAModel.generateContent(`${QA_SYSTEM_PROMPT}\n\n${prompt}`);
  const text = result.response.text();
  const parsed = extractJson(text);
  if (!parsed) throw new Error('QA did not return valid JSON.');
  const ensureArray = (v) => (Array.isArray(v) ? v : typeof v === 'string' ? [v] : []);
  const sections = {};
  for (const key of QA_SECTION_KEYS) {
    sections[key] = ensureArray(parsed[key]);
  }
  return { sections };
}

async function runQuestioner(draftSurvey, qaReport, analyzerFeedback = null) {
  const surveyText = formatSurveyForPrompt(draftSurvey);
  const reportText = QA_SECTION_KEYS.map(
    (key) => `${key}:\n${(qaReport.sections[key] ?? []).map((s) => `- ${s}`).join('\n')}`
  ).join('\n\n');
  const feedbackPart = analyzerFeedback
    ? `\n\nAnalyzer feedback (address these):\n${analyzerFeedback}`
    : '';
  const prompt = `${QUESTIONER_SYSTEM}\n\nCurrent survey:\n${surveyText}\n\nQA Report:\n${reportText}${feedbackPart}`;
  const result = await surveyQuestionerModel.generateContent(prompt);
  const text = result.response.text();
  const parsed = extractJson(text);
  if (!parsed || !Array.isArray(parsed.questions)) {
    throw new Error('Questioner did not return a valid survey.');
  }
  return {
    title: parsed.title ?? draftSurvey.title,
    questions: parsed.questions,
  };
}

async function runAnalyzer(draftSurvey, revisedSurvey) {
  const draftText = formatSurveyForPrompt(draftSurvey);
  const revisedText = formatSurveyForPrompt(revisedSurvey);
  const prompt = `${ANALYZER_PROMPT}\n\nOriginal draft survey:\n${draftText}\n\nQA-revised survey:\n${revisedText}`;
  const result = await surveyAnalyzerModel.generateContent(prompt);
  const text = result.response.text();
  const parsed = extractJson(text);
  if (!parsed || typeof parsed.approved !== 'boolean') {
    return { approved: true, feedback: '' };
  }
  return {
    approved: parsed.approved,
    feedback: parsed.feedback ?? '',
  };
}

function normalizeQuestions(questions) {
  if (!Array.isArray(questions)) return [];
  return questions.map((q, idx) => {
    if (typeof q === 'string') {
      return { id: `q${idx}`, text: q, type: 'open_ended', options: {} };
    }
    const type = q.type || 'open_ended';
    let options = q.options || {};
    if (type === 'scale') {
      const min = Number(options.min);
      const max = Number(options.max);
      options = { min: !Number.isNaN(min) ? min : 1, max: !Number.isNaN(max) ? max : 10 };
    }
    if ((type === 'multiple_choice' || type === 'checkbox') && !Array.isArray(options.choices)) {
      options = { choices: options.choices ? [options.choices] : ['', ''] };
    }
    if (type === 'yes_no' && !options.choices) {
      options = { choices: ['Yes', 'No'] };
    }
    return {
      id: q.id || `q${idx}`,
      text: q.text ?? '',
      type,
      options,
    };
  });
}

export async function generateSurveyWithAI(userPrompt) {
  const draft = await runCreator(userPrompt);
  const qaReport = await runQA(draft);
  let revised = await runQuestioner(draft, qaReport, null);
  let analyzer = await runAnalyzer(draft, revised);
  if (!analyzer.approved && analyzer.feedback) {
    revised = await runQuestioner(revised, qaReport, analyzer.feedback);
    analyzer = await runAnalyzer(draft, revised);
  }
  const title = revised.title ?? draft.title;
  const questions = normalizeQuestions(revised.questions);
  return { title, questions };
}
