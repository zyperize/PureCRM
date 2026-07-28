/* global process */

const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
const MAX_INLINE_BYTES = 4 * 1024 * 1024;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function base64ByteLength(value = '') {
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}

async function callGemini(body) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('Gemini API key is not configured on the server.');
  }

  const response = await fetch(`${ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `Gemini error ${response.status}`);
  }

  return response.json();
}

function parseCandidateText(data) {
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function analyzePrompt() {
  const businessContext = process.env.CRM_BUSINESS_CONTEXT || 'a business using a general-purpose CRM';
  return (
    `You are a sales-call analyzer for ${businessContext}. ` +
    'Transcribe this call recording, then summarize it. Respond as JSON matching this schema: ' +
    '{"transcript": string (full verbatim transcript), ' +
    '"summary": string (2-3 short bullet points covering key topics like pricing/products/order size, customer sentiment, and next steps), ' +
    '"outcome": one of "interested" | "not_interested" | "callback" | "no_answer" | "unclear"}.'
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};

    if (body.mode === 'analyze') {
      const audio = body.audio || {};
      if (!audio.data || !audio.mimeType) {
        return json(res, 400, { error: 'Audio data and MIME type are required.' });
      }

      if (base64ByteLength(audio.data) > MAX_INLINE_BYTES) {
        return json(res, 413, { error: 'Audio file too large for secure inline transcription. Trim it below 4MB and try again.' });
      }

      const data = await callGemini({
        contents: [{
          parts: [
            { text: analyzePrompt() },
            { inline_data: { mime_type: audio.mimeType, data: audio.data } },
          ],
        }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
      });

      const text = parseCandidateText(data);
      try {
        return json(res, 200, JSON.parse(text));
      } catch {
        return json(res, 200, { transcript: text, summary: '', outcome: 'unclear' });
      }
    }

    if (body.mode === 'summarize') {
      const transcript = String(body.transcript || '').trim();
      if (!transcript) {
        return json(res, 400, { error: 'Transcript is required.' });
      }

      const data = await callGemini({
        contents: [{
          parts: [{
            text: 'Summarize this sales-call transcript in 2-3 concise bullet points ' +
              '(key topics, customer sentiment, next steps). Keep it brief and actionable.\n\n' + transcript,
          }],
        }],
        generationConfig: { temperature: 0.3 },
      });

      return json(res, 200, { summary: parseCandidateText(data).trim() });
    }

    return json(res, 400, { error: 'Unsupported transcription mode.' });
  } catch (error) {
    return json(res, 500, { error: error.message || 'Transcription failed.' });
  }
}
