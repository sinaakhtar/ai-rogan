'use client';

import { useState, useRef } from 'react';

export default function Home() {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [message, setMessage] = useState('');
  const [style, setStyle] = useState('Deep Dive');
  const [script, setScript] = useState('');
  const [speaker1Voice, setSpeaker1Voice] = useState('Kore');
  const [speaker2Voice, setSpeaker2Voice] = useState('Charon');
  const [audioUrl, setAudioUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const [speaker1Search, setSpeaker1Search] = useState('');
  const [speaker2Search, setSpeaker2Search] = useState('');
  const [showSpeaker1Dropdown, setShowSpeaker1Dropdown] = useState(false);
  const [showSpeaker2Dropdown, setShowSpeaker2Dropdown] = useState(false);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showScriptReview, setShowScriptReview] = useState(true);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  const [promptTemplate, setPromptTemplate] = useState(`You are a podcast script generator. 
Take the following source text and generate a podcast script out of it.
The style should be: {style}.
The output must always be a conversation between two people.
You MUST use the speaker labels "Speaker1:" and "Speaker2:" exactly at the start of each line to indicate who is speaking.

CRITICAL RULES:
1. Do NOT use markdown bolding (like **Speaker1:**) anywhere in the script. Use plain text labels like "Speaker1:".
2. Do NOT include any text descriptions of music, sound effects, or production cues (like "[Episode Intro Music]"). Only output the words to be spoken.
3. Do NOT have the speakers address each other as "Speaker1" or "Speaker2" in the dialogue. They are labels for the TTS engine, not names.
4. To make the podcast more interesting, you are encouraged to include expressive cues in the text, such as [laughs], [sigh], [giggles], [snickers], or [hesitation] where appropriate to make the conversation feel more natural and alive.

Make it engaging, natural, and informative.

Source Text:
{text}`);

  const [taskId, setTaskId] = useState('');
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);

  // Voices found in documentation
  const voiceOptions = ['Kore', 'Charon', 'Callirrhoe', 'Aoede', 'Puck'];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const uploadAndGenerateScript = async () => {
    if (selectedFiles.length === 0) {
      throw new Error('Please add at least one document.');
    }
    
    setMessage('Uploading and processing documents...');
    
    const formData = new FormData();
    selectedFiles.forEach((file) => {
      formData.append('files', file);
    });
    
    const uploadResponse = await fetch('http://localhost:8000/upload', {
      method: 'POST',
      body: formData,
    });
    
    const uploadData = await uploadResponse.json();
    
    if (!uploadResponse.ok) {
      throw new Error(`Upload error: ${uploadData.message}`);
    }
    
    setMessage('Generating podcast script...');
    const response = await fetch('http://localhost:8000/generate_script', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ style, prompt_template: promptTemplate }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(`Error: ${data.message}`);
    }
    
    return data.script;
  };

  const handleGenerateScript = async () => {
    setLoading(true);
    try {
      const scriptText = await uploadAndGenerateScript();
      setScript(scriptText);
      setMessage('Script generated! Please review and edit if needed.');
    } catch (error: any) {
      setMessage(error.message || 'Error generating script.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateAudio = async () => {
    setLoading(true);
    let currentScript = script;
    
    try {
      if (!currentScript) {
        currentScript = await uploadAndGenerateScript();
        setScript(currentScript); // Update state so user can see it
      }
      
      setMessage('Starting audio generation...');
      setProgress(0);
      setLogs([]);
      
      const response = await fetch('http://localhost:8000/generate_audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ script: currentScript, speaker1_voice: speaker1Voice, speaker2_voice: speaker2Voice }),
      });

      const data = await response.json();
      if (response.ok) {
        setTaskId(data.task_id);
        setMessage('Generation started. Polling status...');
        startPolling(data.task_id);
      } else {
        setMessage(`Error: ${data.message}`);
        setLoading(false);
      }
    } catch (error: any) {
      setMessage(error.message || 'Error starting audio generation.');
      console.error(error);
      setLoading(false);
    }
  };

  const startPolling = (id: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:8000/status/${id}`);
        const data = await response.json();
        
        if (response.ok) {
          setProgress(data.progress);
          setLogs(data.logs);
          
          if (data.status === 'completed') {
            clearInterval(interval);
            setMessage('Podcast generated successfully! Downloading file...');
            downloadAudio(id);
          } else if (data.status === 'failed') {
            clearInterval(interval);
            setMessage('Audio generation failed.');
            setLoading(false);
          }
        }
      } catch (error) {
        console.error('Error polling status:', error);
      }
    }, 1000);
  };

  const downloadAudio = async (id: string) => {
    try {
      const response = await fetch(`http://localhost:8000/download/${id}`);
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setMessage('Podcast ready!');
      } else {
        setMessage('Error downloading audio file.');
      }
    } catch (error) {
      console.error('Error downloading audio:', error);
      setMessage('Error downloading audio.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-4xl w-full bg-white/10 backdrop-blur-md rounded-2xl p-8 shadow-2xl border border-white/20">
        <h1 className="text-4xl font-bold text-center mb-2 bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-violet-500">
          AI Podcast Generator
        </h1>
        <p className="text-slate-300 text-center mb-8">
          Turn your documents into an engaging podcast conversation.
        </p>

        {/* Upload Section */}
        <div className="mb-8">
          <label className="block text-sm font-medium mb-2 text-slate-200">
            Upload Documents (PDF, DOCX, PPTX, TXT)
          </label>
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <input
                type="file"
                multiple
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-full file:border-0
                  file:text-sm file:font-semibold
                  file:bg-violet-50 file:text-violet-700
                  hover:file:bg-violet-100
                  cursor:pointer"
              />
            </div>
            
            {/* File List */}
            {selectedFiles.length > 0 && (
              <div className="flex flex-col gap-2 mt-2">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between bg-white/5 backdrop-blur-sm p-4 rounded-xl border border-white/10 hover:border-violet-500/50 transition-colors group">
                    <div className="flex items-center gap-2 truncate max-w-[80%]">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-slate-400 group-hover:text-violet-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="text-sm text-slate-200 truncate">{file.name}</span>
                    </div>
                    <button
                      onClick={() => setSelectedFiles(selectedFiles.filter((_, i) => i !== index))}
                      className="text-slate-400 hover:text-pink-500 transition-colors"
                      title="Remove file"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-4v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Style Selection */}
        <div className="mb-8">
          <label className="block text-sm font-medium mb-2 text-slate-200">
            Podcast Style
          </label>
          <div className="grid grid-cols-3 gap-4">
            {['Deep Dive', 'Highlights', 'Debate'].map((s) => (
              <div
                key={s}
                onClick={() => setStyle(s)}
                className={`cursor-pointer p-4 rounded-xl border ${
                  style === s
                    ? 'border-violet-500 bg-violet-500/20 shadow-lg shadow-violet-500/20'
                    : 'border-white/10 bg-white/5'
                } hover:bg-white/10 transition-colors text-center`}
              >
                <h3 className="font-semibold capitalize">{s.replace(/-/g, ' ')}</h3>
              </div>
            ))}
          </div>
        </div>

        {/* Voice Selection */}
        <div className="mb-8">
          <label className="block text-sm font-medium mb-2 text-slate-200 flex items-center gap-2">
            Voice Selection
            <a
              href="https://docs.cloud.google.com/text-to-speech/docs/gemini-tts#voice_options"
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-400 hover:text-white transition-colors"
              title="Listen to voices"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </a>
          </label>
          <div className="grid grid-cols-2 gap-4">
            {/* Speaker 1 */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Speaker 1 Voice ({speaker1Voice})</label>
              <select
                value={speaker1Voice}
                onChange={(e) => setSpeaker1Voice(e.target.value)}
                className="w-full p-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
              >
                {voiceOptions.map((voice) => (
                  <option key={voice} value={voice} className="bg-slate-800">
                    {voice}
                  </option>
                ))}
              </select>
            </div>

            {/* Speaker 2 */}
            <div>
              <label className="block text-xs text-slate-400 mb-1">Speaker 2 Voice ({speaker2Voice})</label>
              <select
                value={speaker2Voice}
                onChange={(e) => setSpeaker2Voice(e.target.value)}
                className="w-full p-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors"
              >
                {voiceOptions.map((voice) => (
                  <option key={voice} value={voice} className="bg-slate-800">
                    {voice}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Advanced Options */}
        <div className="mb-8">
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm text-slate-400 hover:text-white transition-colors flex items-center gap-1"
          >
            {showAdvanced ? 'Hide' : 'Show'} Advanced Options (Custom Prompt)
          </button>
          {showAdvanced && (
            <div className="mt-2">
              <label className="block text-xs text-slate-400 mb-1">
                Script Prompt Template (Use {"{style}"} and {"{text}"} as placeholders)
              </label>
              <textarea
                value={promptTemplate}
                onChange={(e) => setPromptTemplate(e.target.value)}
                className="w-full h-48 p-3 bg-slate-800 border border-white/10 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-violet-500"
              />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex justify-center mb-8">
          <button
            onClick={handleGenerateScript}
            disabled={loading || selectedFiles.length === 0}
            className="bg-gradient-to-r from-pink-500 to-violet-500 text-white px-8 py-3 rounded-full font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg shadow-violet-500/30"
          >
            {loading ? 'Working...' : 'Generate Script'}
          </button>
        </div>



        {/* Script Review Area */}
        {script && (
          <div className="mb-8 bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden">
            <button
              onClick={() => setShowScriptReview(!showScriptReview)}
              className="w-full p-4 flex items-center justify-between text-left text-slate-200 hover:bg-white/5 transition-colors"
            >
              <span className="font-medium">Review & Edit Script</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`h-5 w-5 transform transition-transform ${showScriptReview ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showScriptReview && (
              <div className="p-4 border-t border-white/10">
                <textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  className="w-full h-64 p-4 bg-slate-800/50 border border-white/10 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-violet-500"
                />
              </div>
            )}
          </div>
        )}

        {/* Generate Audio Section */}
        <div className="flex flex-col items-center gap-4 mb-8 mt-8">
          <button
            onClick={handleGenerateAudio}
            disabled={loading || selectedFiles.length === 0}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white px-8 py-3 rounded-full font-bold text-lg hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg shadow-emerald-500/30"
          >
            {loading ? 'Working...' : 'Generate Audio'}
          </button>
          
          {/* Progress and Logs */}
          {loading && (
            <div className="w-full max-w-md">
              <div className="flex justify-between mb-1">
                <span className="text-sm text-slate-300">{message}</span>
                <span className="text-sm text-slate-300">{progress}%</span>
              </div>
              <div className="w-full bg-slate-700 rounded-full h-2.5">
                <div className="bg-violet-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
              </div>
              
              <div className="mt-4">
                <details className="group">
                  <summary className="text-sm text-slate-400 hover:text-white cursor-pointer flex items-center gap-1">
                    <span>Show Console Output</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="mt-2 p-3 bg-slate-800 border border-white/10 rounded-lg max-h-40 overflow-y-auto font-mono text-xs text-emerald-400">
                    {logs.map((log, index) => (
                      <div key={index}>{log}</div>
                    ))}
                  </div>
                </details>
              </div>
            </div>
          )}
        </div>

        {/* Message */}
        {!loading && message && (
          <p className="text-center text-sm text-slate-300 mb-4">{message}</p>
        )}

        {/* Player */}
        {audioUrl && (
          <div className="mt-8 bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 shadow-2xl w-full max-w-md mx-auto">
            <h2 className="text-lg font-semibold mb-4 text-center bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-teal-400">
              Podcast ready!
            </h2>
            
            <audio
              ref={audioRef}
              src={audioUrl}
              onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
              onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              className="hidden"
            />
            
            <div className="flex items-center gap-4">
              {/* Play/Pause Button */}
              <button
                onClick={() => {
                  if (isPlaying) {
                    audioRef.current?.pause();
                  } else {
                    audioRef.current?.play();
                  }
                }}
                className="w-12 h-12 flex items-center justify-center rounded-full bg-gradient-to-r from-pink-500 to-violet-500 text-white hover:opacity-90 transition-opacity shadow-lg shadow-violet-500/30 flex-shrink-0"
              >
                {isPlaying ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  </svg>
                )}
              </button>
              
              {/* Progress Bar */}
              <div className="flex-1 flex flex-col gap-1 min-w-0">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={(e) => {
                    const time = parseFloat(e.target.value);
                    if (audioRef.current) audioRef.current.currentTime = time;
                    setCurrentTime(time);
                  }}
                  className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-violet-500"
                />
              </div>
              
              {/* Volume/Menu (Visual only for now) */}
              <div className="flex items-center gap-2 text-slate-400 flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 hover:text-white cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                </svg>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 hover:text-white cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                </svg>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
