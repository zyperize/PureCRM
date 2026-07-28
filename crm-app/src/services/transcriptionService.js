const ENDPOINT = '/api/gemini-transcription';
const MAX_INLINE_BYTES = 4 * 1024 * 1024;

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1]);
        reader.onerror = () => reject(new Error('Could not read the audio file'));
        reader.readAsDataURL(file);
    });
}

function audioMime(file) {
    if (file.type && file.type.startsWith('audio/')) return file.type;
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const map = {
        mp3: 'audio/mp3',
        wav: 'audio/wav',
        m4a: 'audio/mp4',
        mp4: 'audio/mp4',
        aac: 'audio/aac',
        ogg: 'audio/ogg',
        flac: 'audio/flac'
    };
    return map[ext] || 'audio/mp3';
}

async function postTranscription(payload) {
    const response = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Transcription request failed (${response.status})`);
    }

    return response.json();
}

async function analyzeCall(audioFile) {
    if (audioFile.size > MAX_INLINE_BYTES) {
        throw new Error('Audio file too large for secure inline transcription (max 4MB). Trim the recording and try again.');
    }

    return postTranscription({
        mode: 'analyze',
        audio: {
            mimeType: audioMime(audioFile),
            data: await fileToBase64(audioFile)
        }
    });
}

export const transcriptionService = {
    async transcribeAudio(audioFile) {
        return (await analyzeCall(audioFile)).transcript;
    },

    async generateSummary(transcript) {
        if (!transcript || !transcript.trim()) throw new Error('Transcript is empty');
        const result = await postTranscription({ mode: 'summarize', transcript });
        return String(result.summary || '').trim();
    },

    async transcribeAndSummarize(audioFile) {
        const result = await analyzeCall(audioFile);
        const summary = result.outcome ? `${result.summary}\n\nOutcome: ${result.outcome}` : result.summary;
        return { transcript: result.transcript, summary };
    },
};
