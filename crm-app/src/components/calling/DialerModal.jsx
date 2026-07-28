import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Phone, X, Mic, MicOff, Volume2, User, MapPin, Upload, Loader2, FileAudio, CheckCircle } from 'lucide-react';
import { transcriptionService } from '../../services/transcriptionService';
import { callsService } from '../../services/callsService';
import { invalidateCallWorkspace } from '../../utils/queryInvalidation';
import toast from 'react-hot-toast';
import { track } from '../../services/analytics';
import CallScripts from './CallScripts';

export default function DialerModal({ isOpen, onClose, lead }) {
    const queryClient = useQueryClient();
    const [callStatus, setCallStatus] = useState('ringing'); // ringing, connected, ended
    const [isMuted, setIsMuted] = useState(false);
    const [audioFile, setAudioFile] = useState(null);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [summary, setSummary] = useState('');
    const [callNotes, setCallNotes] = useState('');
    const [seconds, setSeconds] = useState(0);
    const fileInputRef = useRef(null);

    // Automatically transition ringing -> connected after 3s
    useEffect(() => {
        if (isOpen) {
            setCallStatus('ringing');
            setSeconds(0);
            const timer = setTimeout(() => {
                setCallStatus('connected');
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // Live call duration timer
    useEffect(() => {
        let interval = null;
        if (isOpen && callStatus === 'connected') {
            interval = setInterval(() => {
                setSeconds(prev => prev + 1);
            }, 1000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isOpen, callStatus]);

    const formatSeconds = (totalSeconds) => {
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const handleDialGoogleVoice = () => {
        if (!lead || !lead.phone) {
            toast.error('No phone number available for this lead');
            return;
        }
        const cleaned = lead.phone.replace(/\D/g, '');
        const formatted = cleaned.length === 10 ? `1${cleaned}` : cleaned;
        const url = `https://voice.google.com/u/0/calls?a=nc,+${formatted}`;
        window.open(url, '_blank');
        toast.success('Opening Google Voice...');

        // Reset status to ringing and let it auto-transition to connected
        setCallStatus('ringing');
        setSeconds(0);
    };

    // Free path: hand the number to the OS dialer (macOS rings FaceTime/your
    // paired iPhone), so the call goes out on your own phone number.
    const handleDialSystem = () => {
        if (!lead || !lead.phone) {
            toast.error('No phone number available for this lead');
            return;
        }
        const cleaned = lead.phone.replace(/\D/g, '');
        const formatted = cleaned.length === 10 ? `+1${cleaned}` : `+${cleaned}`;
        window.location.href = `tel:${formatted}`;
        toast.success('Dialing from your phone...');
        setCallStatus('ringing');
        setSeconds(0);
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (file) {
            setAudioFile(file);
            toast.success(`Audio file selected: ${file.name}`);
        }
    };

    const handleTranscribe = async () => {
        if (!audioFile) {
            toast.error('Please select an audio file first');
            return;
        }

        setIsTranscribing(true);
        try {
            toast.loading('Transcribing audio with Gemini AI...');
            const result = await transcriptionService.transcribeAndSummarize(audioFile);

            setTranscript(result.transcript);
            setSummary(result.summary);
            setCallNotes(result.summary); // Pre-fill notes with summary

            toast.dismiss();
            toast.success('Transcription complete!');
        } catch (error) {
            toast.dismiss();
            toast.error(`Transcription failed: ${error.message}`);
        } finally {
            setIsTranscribing(false);
        }
    };

    const handleSaveCall = async () => {
        try {
            await callsService.logCall(lead.id, {
                direction: 'outbound',
                duration: seconds || null,
                outcome: 'connected',
                notes: callNotes,
                transcript: transcript || null,
                summary: summary || null
            });

            invalidateCallWorkspace(queryClient, lead.id);

            track('call_logged', { outcome: 'connected', has_transcript: !!transcript });
            toast.success('Call log saved successfully');

            // Reset state
            setAudioFile(null);
            setTranscript('');
            setSummary('');
            setCallNotes('');
            setSeconds(0);

            onClose();
        } catch (error) {
            toast.error(`Failed to save call: ${error.message}`);
        }
    };

    if (!isOpen || !lead) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="card w-full max-w-4xl p-0 overflow-hidden grid grid-cols-1 md:grid-cols-2 h-[600px] shadow-2xl border border-gold-500/20">

                {/* Left Panel: Phone UI */}
                <div className="bg-charcoal-800 p-6 flex flex-col items-center justify-between border-r border-white/5 relative overflow-hidden">
                    {/* Background Ambient Effect */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-gold-500/5 rounded-full blur-3xl pointer-events-none"></div>

                    <div className="w-full flex justify-between items-center z-10">
                        <span className="text-xs font-mono text-gray-500">DIALER</span>
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${callStatus === 'ringing' ? 'bg-amber-500 animate-ping' : 'bg-green-500 animate-pulse'}`}></div>
                            <span className="text-xs text-green-400 font-mono">
                                {callStatus === 'ringing' ? 'RINGING' : formatSeconds(seconds)}
                            </span>
                        </div>
                    </div>

                    <div className="text-center z-10 mt-8 w-full">
                        <div className="w-24 h-24 rounded-full bg-charcoal-700 mx-auto mb-4 border-4 border-charcoal-600 flex items-center justify-center relative">
                            <User size={40} className="text-gray-400" />
                            {callStatus === 'ringing' && (
                                <span className="absolute inset-0 rounded-full border-2 border-gold-500 animate-ping"></span>
                            )}
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-1 truncate px-4">{lead.business_name}</h2>

                        {/* Interactive Phone Number Link — primary tap opens Google Voice */}
                        <button
                            onClick={handleDialGoogleVoice}
                            className="text-gold-400 hover:text-gold-300 text-lg font-mono mb-2 inline-flex items-center gap-2 px-3 py-1 bg-white/5 rounded-full border border-white/10 hover:bg-white/10 transition-all cursor-pointer"
                            title="Call via Google Voice (opens with this number)"
                        >
                            <Phone size={14} className="text-green-400 animate-pulse" />
                            <span>{lead.phone}</span>
                        </button>

                        <p className="text-sm text-gray-400 flex items-center justify-center gap-1">
                            <MapPin size={12} /> {lead.city}, {lead.state}
                        </p>
                    </div>

                    <div className="w-full max-w-xs grid grid-cols-3 gap-4 mb-8 z-10">
                        {/* Dialer Controls */}
                        <button
                            onClick={() => setIsMuted(!isMuted)}
                            className={`p-4 rounded-full bg-charcoal-700 hover:bg-charcoal-600 transition-colors flex items-center justify-center text-white
               ${isMuted ? 'bg-red-500/20 text-red-400' : ''}`}
                            title={isMuted ? "Unmute Mic" : "Mute Mic"}
                        >
                            {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
                        </button>

                        {/* Direct SIM / native-dialer call */}
                        <button
                            onClick={handleDialSystem}
                            className="p-4 rounded-full bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 transition-colors flex items-center justify-center text-green-400 hover:text-green-300"
                            title="Call via your phone / SIM (native dialer)"
                        >
                            <Phone size={24} className="animate-bounce" />
                        </button>

                        {/* Hang up & Close */}
                        <button
                            onClick={onClose}
                            className="p-4 rounded-full bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center text-white"
                            title="End Call & Close"
                        >
                            <Phone size={24} className="rotate-[135deg]" />
                        </button>
                    </div>

                    <div className="w-full bg-charcoal-900/50 p-4 rounded-lg border border-white/5 z-10">
                        <p className="text-xs text-center text-gray-500 uppercase tracking-widest mb-2">Manager</p>
                        <p className="text-center font-bold text-lg">{lead.manager_name || 'Recall Name'}</p>
                    </div>
                </div>

                {/* Right Panel: Scripts & Notes */}
                <div className="bg-charcoal-900 p-6 flex flex-col h-full overflow-y-auto">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="font-bold text-white">Call Details</h3>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-white/10 rounded text-gray-400 hover:text-white"
                        >
                            <X size={20} />
                        </button>
                    </div>

                    {/* Audio Upload Section */}
                    <div className="mb-4 border-b border-white/10 pb-4">
                        <label className="label-text mb-2">Upload Call Recording</label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="audio/*,.mp3,.wav,.m4a"
                            onChange={handleFileSelect}
                            className="hidden"
                        />

                        <div className="space-y-2">
                            {!audioFile ? (
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-full p-3 border-2 border-dashed border-white/20 rounded-lg hover:border-gold-500/50 transition-colors flex items-center justify-center gap-2 text-gray-400 hover:text-white"
                                >
                                    <Upload size={18} />
                                    <span className="text-sm">Select Audio File</span>
                                </button>
                            ) : (
                                <div className="bg-charcoal-800 p-3 rounded-lg border border-white/10">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-sm">
                                            <FileAudio size={16} className="text-gold-400" />
                                            <span className="text-white truncate">{audioFile.name}</span>
                                        </div>
                                        <button
                                            onClick={() => setAudioFile(null)}
                                            className="text-gray-400 hover:text-red-400"
                                        >
                                            <X size={16} />
                                        </button>
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {(audioFile.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                </div>
                            )}

                            {audioFile && !transcript && (
                                <button
                                    onClick={handleTranscribe}
                                    disabled={isTranscribing}
                                    className="w-full btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isTranscribing ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Transcribing...
                                        </>
                                    ) : (
                                        <>
                                            <Mic size={16} />
                                            Transcribe with AI
                                        </>
                                    )}
                                </button>
                            )}

                            {transcript && (
                                <div className="bg-green-500/10 border border-green-500/20 p-2 rounded flex items-center gap-2 text-sm text-green-400">
                                    <CheckCircle size={16} />
                                    <span>Transcription complete</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Transcript Display */}
                    {transcript && (
                        <div className="mb-4 border-b border-white/10 pb-4">
                            <label className="label-text mb-2">AI Transcript</label>
                            <div className="bg-charcoal-800 p-3 rounded-lg border border-white/10 max-h-32 overflow-y-auto">
                                <p className="text-sm text-gray-300 whitespace-pre-wrap">{transcript}</p>
                            </div>
                        </div>
                    )}

                    {/* Summary Display */}
                    {summary && (
                        <div className="mb-4 border-b border-white/10 pb-4">
                            <label className="label-text mb-2">AI Summary</label>
                            <div className="bg-charcoal-800 p-3 rounded-lg border border-gold-500/20">
                                <p className="text-sm text-gray-300 whitespace-pre-wrap">{summary}</p>
                            </div>
                        </div>
                    )}

                    {/* Scripts Section */}
                    <div className="flex-1 min-h-0 mb-4">
                        <CallScripts lead={lead} />
                    </div>

                    {/* Call Notes */}
                    <div className="mb-4">
                        <label className="label-text">Call Notes</label>
                        <textarea
                            className="input-field h-24 resize-none text-sm"
                            placeholder="Type notes while you talk..."
                            value={callNotes}
                            onChange={(e) => setCallNotes(e.target.value)}
                        ></textarea>
                    </div>

                    {/* Save Button */}
                    {(callNotes || transcript) && (
                        <button
                            onClick={handleSaveCall}
                            className="w-full btn-primary"
                        >
                            Save Call Log
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
