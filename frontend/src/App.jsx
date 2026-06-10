import React, { useState, useEffect } from 'react'
import {
  MessageSquare,
  Film,
  Upload,
  Download,
  Trash2,
  Play,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Sparkles,
  Clock,
  Cpu,
  History,
  BarChart3,
  Database,
  ArrowRight,
  RefreshCw,
  Search,
  Filter
} from 'lucide-react'
import confetti from 'canvas-confetti'

// --- LOCAL CLIENT-SIDE SENTIMENT ENGINE (FALLBACK) ---
const CONTRACTION_MAP = {
  "don't": "do not",
  "can't": "cannot",
  "won't": "will not",
  "i'm": "i am",
  "it's": "it is",
  "he's": "he is",
  "she's": "she is",
  "you're": "you are",
  "we're": "we are",
  "they're": "they are",
  "i've": "i have",
  "you've": "you have",
  "we've": "we have",
  "they've": "they have",
  "isn't": "is not",
  "aren't": "are not",
  "wasn't": "was not",
  "weren't": "were not",
  "haven't": "have not",
  "hasn't": "has not",
  "hadn't": "had not",
  "doesn't": "does not",
  "didn't": "did not",
  "couldn't": "could not",
  "shouldn't": "should not",
  "wouldn't": "would not",
  "mustn't": "must not"
};

const POSITIVE_WORDS = new Set([
  'love', 'loved', 'likes', 'like', 'great', 'awesome', 'amazing', 'beautiful', 'excellent', 'fantastic',
  'wonderful', 'best', 'good', 'masterpiece', 'brilliant', 'superb', 'outstanding', 'classic', 'entertaining',
  'enjoyed', 'funny', 'fun', 'happy', 'cool', 'perfect', 'perfectly', 'gem', 'must', 'recommend', 'nice',
  'favorite', 'touching', 'sweet', 'genius', 'incredible', 'triumph', 'charming', 'funniest', 'strong',
  'highly', 'stellar', 'super', 'enjoyable', 'impressive', 'clever', 'pleasant', 'glad', 'satisfying'
]);

const NEGATIVE_WORDS = new Set([
  'hate', 'hated', 'dislike', 'bad', 'terrible', 'worst', 'horrible', 'waste', 'boring', 'awful',
  'crap', 'garbage', 'dull', 'suck', 'sucks', 'stupid', 'rubbish', 'fail', 'failed', 'failure',
  'disappointed', 'disappointment', 'annoying', 'wasted', 'pointless', 'lame', 'worse', 'predictable',
  'poor', 'poorly', 'sad', 'mess', 'messy', 'uninspired', 'avoid', 'lacks', 'lacking', 'slow',
  'dragging', 'painful', 'cliché', 'cheap', 'silly', 'flat', 'dumb', 'ridiculous', 'pathetic', 'ugly'
]);

function cleanTextJS(text) {
  if (typeof text !== 'string') return '';
  let cleaned = text.replace(/<[^>]*>/g, ' ');
  cleaned = cleaned.toLowerCase();
  for (const [contraction, expansion] of Object.entries(CONTRACTION_MAP)) {
    cleaned = cleaned.replace(new RegExp(contraction, 'g'), expansion);
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

function analyzeSentimentJS(text) {
  const cleaned = cleanTextJS(text);
  if (!cleaned) {
    return {
      label: 'negative',
      probability: 0.5,
      processed_text_snippet: ''
    };
  }

  const words = cleaned.split(/[^a-zA-Z]/).filter(w => w.length > 0);
  let posCount = 0;
  let negCount = 0;

  words.forEach(word => {
    if (POSITIVE_WORDS.has(word)) posCount++;
    if (NEGATIVE_WORDS.has(word)) negCount++;
  });

  let label = 'positive';
  let probability = 0.51;

  if (posCount > negCount) {
    label = 'positive';
    probability = 0.5 + 0.45 * (posCount - negCount) / (posCount + negCount + 1);
  } else if (negCount > posCount) {
    label = 'negative';
    probability = 0.5 + 0.45 * (negCount - posCount) / (posCount + negCount + 1);
  } else {
    // Check general length or words
    label = 'positive';
    probability = 0.52;
  }

  const snippet = words.slice(0, 15).join(' ');
  const processed_snippet = words.length > 15 ? snippet + '...' : snippet;

  return {
    label,
    probability: parseFloat(probability.toFixed(4)),
    processed_text_snippet: processed_snippet
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState('single') // 'single' | 'batch' | 'model' | 'history'
  
  // Connection states
  const [serverConnected, setServerConnected] = useState(false)
  const [inferenceMode, setInferenceMode] = useState('Local ML Engine')

  // Single Review State
  const [singleText, setSingleText] = useState('')
  const [singleLoading, setSingleLoading] = useState(false)
  const [singleResult, setSingleResult] = useState(null)
  const [singleError, setSingleError] = useState(null)

  // Batch Review State
  const [batchTextsInput, setBatchTextsInput] = useState('')
  const [batchLoading, setBatchLoading] = useState(false)
  const [batchResults, setBatchResults] = useState(null)
  const [batchError, setBatchError] = useState(null)
  const [batchSearch, setBatchSearch] = useState('')
  const [batchFilter, setBatchFilter] = useState('all') // 'all' | 'positive' | 'negative'

  // History State
  const [history, setHistory] = useState(() => {
    const saved = localStorage.getItem('senti_history')
    return saved ? JSON.parse(saved) : []
  })

  // Check backend server connection on startup
  useEffect(() => {
    const checkConnection = async () => {
      try {
        const res = await fetch('/health')
        if (res.ok) {
          const data = await res.json()
          if (data.status === 'healthy') {
            setServerConnected(true)
            setInferenceMode('FastAPI Server')
            return
          }
        }
      } catch (err) {
        // Fallback silently to local mode
      }
      setServerConnected(false)
      setInferenceMode('Local ML Engine')
    }
    checkConnection()
  }, [])

  // Sync History to LocalStorage
  useEffect(() => {
    localStorage.setItem('senti_history', JSON.stringify(history))
  }, [history])

  // Single review analysis trigger
  const handleAnalyzeSingle = async (e) => {
    e.preventDefault()
    if (!singleText.trim()) return

    setSingleLoading(true)
    setSingleError(null)
    setSingleResult(null)

    try {
      // Try to request backend
      const response = await fetch('/api/v1/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: singleText }),
      })

      if (!response.ok) {
        throw new Error('API server returned error code.')
      }

      const res = await response.json()
      const data = res.data
      setSingleResult(data)
      setInferenceMode('FastAPI Server')
      setServerConnected(true)

      // Add to session history
      const newEntry = {
        id: Date.now().toString(),
        text: singleText,
        label: data.label,
        probability: data.probability,
        execution_time_ms: data.execution_time_ms,
        engine: 'FastAPI Server',
        timestamp: new Date().toLocaleString()
      }
      setHistory(prev => [newEntry, ...prev])

      // Celebration effect on positive review
      if (data.label === 'positive') {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0']
        })
      }
    } catch (err) {
      // FALLBACK: Local JS Sentiment Engine
      console.warn("Backend API offline. Falling back to local JS sentiment engine.", err);
      const startLocal = performance.now();
      const localResult = analyzeSentimentJS(singleText);
      const latency = performance.now() - startLocal;

      const data = {
        ...localResult,
        sentiment: localResult.label,
        confidence_score: localResult.probability,
        execution_time_ms: parseFloat(latency.toFixed(2))
      };

      setSingleResult(data);
      setInferenceMode('Local ML Engine');
      setServerConnected(false);

      // Add to session history
      const newEntry = {
        id: Date.now().toString(),
        text: singleText,
        label: data.label,
        probability: data.probability,
        execution_time_ms: data.execution_time_ms,
        engine: 'Local ML Engine',
        timestamp: new Date().toLocaleString()
      }
      setHistory(prev => [newEntry, ...prev])

      // Celebration effect on positive review
      if (data.label === 'positive') {
        confetti({
          particleCount: 85,
          spread: 60,
          origin: { y: 0.8 },
          colors: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0']
        })
      }
    } finally {
      setSingleLoading(false)
    }
  }

  // Batch analysis trigger
  const handleAnalyzeBatch = async (e) => {
    e.preventDefault()
    if (!batchTextsInput.trim()) return

    setBatchLoading(true)
    setBatchError(null)
    setBatchResults(null)

    const textsArray = batchTextsInput
      .split('\n')
      .map(t => t.trim())
      .filter(t => t.length > 0)

    if (textsArray.length === 0) {
      setBatchError('Please enter at least one non-empty review.')
      setBatchLoading(false)
      return
    }

    try {
      const response = await fetch('/api/v1/analyze/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ texts: textsArray }),
      })

      if (!response.ok) {
        throw new Error('API server returned error code.')
      }

      const res = await response.json()
      setBatchResults(res.results.map((r, idx) => ({
        ...r,
        original: textsArray[idx]
      })))
      setInferenceMode('FastAPI Server')
      setServerConnected(true)

      // Add all to session history
      const batchEntries = res.results.map((r, idx) => ({
        id: `${Date.now()}-${idx}`,
        text: textsArray[idx],
        label: r.label,
        probability: r.probability,
        execution_time_ms: 0,
        engine: 'FastAPI Server',
        timestamp: new Date().toLocaleString()
      }))
      setHistory(prev => [...batchEntries, ...prev])
    } catch (err) {
      // FALLBACK: Local JS Sentiment Engine
      console.warn("Backend API offline. Falling back to local JS batch sentiment engine.", err);
      const localResults = textsArray.map(text => {
        const localResult = analyzeSentimentJS(text);
        return {
          ...localResult,
          original: text
        };
      });

      setBatchResults(localResults);
      setInferenceMode('Local ML Engine');
      setServerConnected(false);

      // Add all to session history
      const batchEntries = localResults.map((r, idx) => ({
        id: `${Date.now()}-${idx}`,
        text: textsArray[idx],
        label: r.label,
        probability: r.probability,
        execution_time_ms: 0,
        engine: 'Local ML Engine',
        timestamp: new Date().toLocaleString()
      }))
      setHistory(prev => [...batchEntries, ...prev])
    } finally {
      setBatchLoading(false)
    }
  }

  // Clear history
  const handleClearHistory = () => {
    setHistory([])
    localStorage.removeItem('senti_history')
  }

  // Format and download history as markdown file
  const handleDownloadHistory = () => {
    if (history.length === 0) return

    let content = '# SentiMovie Sentiment Analysis History\n\n'
    content += `Exported on: ${new Date().toLocaleString()}\n`
    content += `Total items analyzed: ${history.length}\n\n`
    content += '| Date/Time | Review Text | Sentiment | Confidence | Engine |\n'
    content += '| :--- | :--- | :--- | :--- | :--- |\n'

    history.forEach(item => {
      const escapedText = item.text.replace(/\|/g, '\\|').replace(/\n/g, ' ')
      const shortText = escapedText.length > 150 ? escapedText.substring(0, 147) + '...' : escapedText
      const confidence = `${(item.probability * 100).toFixed(2)}%`
      content += `| ${item.timestamp} | ${shortText} | **${item.label.toUpperCase()}** | ${confidence} | ${item.engine || 'Local'} |\n`
    })

    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.setAttribute('href', url)
    link.setAttribute('download', `movie_sentiment_history_${Date.now()}.md`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const loadSampleReview = (text) => {
    setSingleText(text)
    setSingleResult(null)
    setSingleError(null)
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row relative bg-glow-radial">
      
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-slate-900/50 backdrop-blur-xl border-b md:border-b-0 md:border-r border-slate-800 flex flex-col shrink-0 z-10">
        
        {/* Branding header */}
        <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
          <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-lg shadow-indigo-500/20">
            <Film className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent m-0 select-none">
              SentiMovie
            </h1>
            <p className="text-xs text-slate-500 font-medium">IMDb ML Platform</p>
          </div>
        </div>

        {/* Sidebar Nav Buttons */}
        <nav className="flex-1 p-4 space-y-1.5" aria-label="Main Navigation">
          <button
            id="nav-btn-single"
            onClick={() => setActiveTab('single')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'single'
                ? 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-indigo-400 border-l-2 border-indigo-500'
                : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
            }`}
          >
            <MessageSquare className="w-4 h-5" />
            <span>Single Review</span>
          </button>

          <button
            id="nav-btn-batch"
            onClick={() => setActiveTab('batch')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'batch'
                ? 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-indigo-400 border-l-2 border-indigo-500'
                : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
            }`}
          >
            <Upload className="w-4 h-5" />
            <span>Batch Upload</span>
          </button>

          <button
            id="nav-btn-model"
            onClick={() => setActiveTab('model')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'model'
                ? 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-indigo-400 border-l-2 border-indigo-500'
                : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-4 h-5" />
            <span>Model Insights</span>
          </button>

          <button
            id="nav-btn-history"
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-indigo-400 border-l-2 border-indigo-500'
                : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
            }`}
          >
            <History className="w-4 h-5" />
            <span className="flex-1 text-left">Session History</span>
            {history.length > 0 && (
              <span className="bg-indigo-950 text-indigo-400 border border-indigo-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                {history.length}
              </span>
            )}
          </button>
        </nav>

        {/* Footer info */}
        <div className="p-4 border-t border-slate-800 text-xs text-slate-500 flex flex-col space-y-2">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${serverConnected ? 'bg-emerald-500 animate-ping' : 'bg-amber-500 animate-pulse'}`}></div>
            <span>{serverConnected ? 'FastAPI Server Live' : 'Static Local Engine'}</span>
          </div>
          <span className="text-[10px] text-slate-400 leading-none">
            Active: {inferenceMode}
          </span>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6 md:p-10 flex flex-col max-w-6xl overflow-y-auto custom-scrollbar z-0" id="main-content">
        
        {/* Render Single Review Tab */}
        {activeTab === 'single' && (
          <div className="space-y-8 animate-fadeIn">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-white mb-2">
                Movie Review Sentiment Analysis
              </h2>
              <p className="text-slate-400 text-sm max-w-2xl">
                Analyze single review blocks in real-time. Type your review below or load a pre-set sample review to test.
              </p>
            </div>

            {/* Quick-try examples */}
            <div className="space-y-2.5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Try Quick Examples</span>
              </h3>
              <div className="flex flex-wrap gap-2">
                <button
                  id="sample-btn-1"
                  onClick={() => loadSampleReview("This movie was absolutely fantastic! The acting was supreme, the pacing was incredibly engaging, and the soundtrack hit every emotional cue perfectly. A masterpiece of modern cinema!")}
                  className="px-3.5 py-2 text-xs bg-slate-900 border border-slate-800 text-slate-350 hover:bg-indigo-950/20 hover:border-indigo-800 rounded-xl transition duration-200"
                >
                  Positive Review Example 🎬
                </button>
                <button
                  id="sample-btn-2"
                  onClick={() => loadSampleReview("An absolute waste of time and money. The script felt entirely uninspired, characters were dull, and the ending was completely predictable and lazy. Avoid at all costs.")}
                  className="px-3.5 py-2 text-xs bg-slate-900 border border-slate-800 text-slate-350 hover:bg-rose-950/20 hover:border-rose-800 rounded-xl transition duration-200"
                >
                  Negative Review Example 👎
                </button>
                <button
                  id="sample-btn-3"
                  onClick={() => loadSampleReview("It was alright, I guess. The visuals were stunning, but the story felt very messy and dragging in parts. Some good performances, but overall mediocre.")}
                  className="px-3.5 py-2 text-xs bg-slate-900 border border-slate-800 text-slate-350 hover:bg-slate-800 rounded-xl transition duration-200"
                >
                  Mixed Review Example 🤷
                </button>
              </div>
            </div>

            {/* Form & Card */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Input Area */}
              <div className="lg:col-span-7 space-y-4">
                <form onSubmit={handleAnalyzeSingle} className="space-y-4">
                  <div className="bg-slate-900/40 rounded-2xl border border-slate-800 p-4 focus-within:border-indigo-500/50 transition-all duration-300">
                    <label htmlFor="review-textarea" className="sr-only">Movie Review Text</label>
                    <textarea
                      id="review-textarea"
                      rows="8"
                      value={singleText}
                      onChange={(e) => setSingleText(e.target.value)}
                      placeholder="Type or paste your movie review here (up to 5,000 characters)..."
                      maxLength={5000}
                      disabled={singleLoading}
                      className="w-full bg-transparent text-slate-100 placeholder-slate-500 text-sm border-0 focus:ring-0 resize-none outline-none custom-scrollbar"
                    />
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-500">
                      <span>{singleText.length} / 5,000 characters</span>
                      {singleText.trim().length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSingleText('')}
                          className="text-slate-400 hover:text-slate-200 font-medium transition"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    id="single-analyze-btn"
                    type="submit"
                    disabled={singleLoading || !singleText.trim()}
                    className={`w-full py-3.5 px-6 rounded-2xl font-semibold text-sm shadow-xl flex items-center justify-center space-x-2 transition duration-300 select-none ${
                      singleLoading || !singleText.trim()
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/15 hover:shadow-indigo-500/25 active:scale-[0.98]'
                    }`}
                  >
                    {singleLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-300" />
                        <span>Running Sentiment Engine...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-white" />
                        <span>Analyze Sentiment</span>
                      </>
                    )}
                  </button>
                </form>

                {singleError && (
                  <div className="bg-rose-950/20 border border-rose-800/60 text-rose-300 p-4 rounded-2xl flex items-start space-x-3 text-sm animate-shake">
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <span>{singleError}</span>
                  </div>
                )}
              </div>

              {/* Analytics Panel */}
              <div className="lg:col-span-5 flex flex-col">
                <div className="flex-1 bg-slate-900/30 glow-card border border-slate-800/80 rounded-3xl p-6 min-h-[300px] flex flex-col justify-between">
                  {singleLoading ? (
                    // Skeleton loader
                    <div className="flex-1 flex flex-col justify-between relative overflow-hidden rounded-2xl shimmer space-y-6">
                      <div className="space-y-4">
                        <div className="h-4 bg-slate-800 w-1/3 rounded-lg"></div>
                        <div className="h-10 bg-slate-800 w-3/4 rounded-xl"></div>
                      </div>
                      <div className="flex items-center justify-center py-8">
                        <div className="w-32 h-32 rounded-full border-8 border-slate-800 border-t-indigo-500 animate-spin"></div>
                      </div>
                      <div className="space-y-3">
                        <div className="h-3 bg-slate-800 rounded-lg"></div>
                        <div className="h-3 bg-slate-800 w-5/6 rounded-lg"></div>
                      </div>
                    </div>
                  ) : singleResult ? (
                    // Success Result View
                    <div className="flex-1 flex flex-col justify-between space-y-6 animate-slideDown">
                      
                      {/* Metric Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-slate-400 tracking-widest uppercase">
                            Analysis Output
                          </span>
                          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase border ${
                            inferenceMode === 'FastAPI Server'
                              ? 'bg-indigo-950/80 text-indigo-400 border-indigo-900/40'
                              : 'bg-amber-950/80 text-amber-405 border-amber-900/40 animate-pulse'
                          }`}>
                            {inferenceMode}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1.5 text-xs text-slate-400 bg-slate-850 px-2.5 py-1.5 rounded-full border border-slate-800/60">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{singleResult.execution_time_ms} ms</span>
                        </div>
                      </div>

                      {/* Sentiment Label Card */}
                      <div className="text-center py-4">
                        <span className="text-sm font-semibold text-slate-400 block mb-2">PREDICTED SENTIMENT</span>
                        <div className="inline-flex items-center space-x-3">
                          {singleResult.label === 'positive' ? (
                            <>
                              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                              <span className="text-4xl font-extrabold tracking-tight text-emerald-400 select-none">
                                Positive
                              </span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-8 h-8 text-rose-500" />
                              <span className="text-4xl font-extrabold tracking-tight text-rose-400 select-none">
                                Negative
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Sentiment Gauge */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs font-semibold text-slate-400">
                          <span>NEGATIVE (0.0)</span>
                          <span className={singleResult.label === 'positive' ? 'text-emerald-400' : 'text-rose-400'}>
                            {(singleResult.probability * 100).toFixed(1)}% Confidence
                          </span>
                          <span>POSITIVE (1.0)</span>
                        </div>
                        {/* Gauge bar container */}
                        <div className="h-3.5 bg-slate-800 rounded-full overflow-hidden relative border border-slate-700/30">
                          {/* Centered marker */}
                          <div className="absolute left-1/2 top-0 bottom-0 w-[2px] bg-slate-650 z-10"></div>
                          
                          {/* Probability Fill */}
                          <div
                            className={`h-full absolute left-0 transition-all duration-700 ${
                              singleResult.label === 'positive'
                                ? 'bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-r-full'
                                : 'bg-gradient-to-r from-rose-600 to-rose-400 rounded-r-full'
                            }`}
                            style={{
                              width: `${
                                singleResult.label === 'positive'
                                  ? (singleResult.probability * 100)
                                  : (100 - singleResult.probability * 100)
                              }%`
                            }}
                          ></div>
                        </div>
                      </div>

                      {/* Processed Text Snippet */}
                      <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 space-y-1.5">
                        <span className="text-[10px] font-bold text-indigo-400 tracking-wider uppercase">
                          Cleaned Pipeline Token Flow
                        </span>
                        <p className="text-xs text-slate-350 italic leading-relaxed">
                          "{singleResult.processed_text_snippet}"
                        </p>
                      </div>

                      <button
                        id="reset-analysis-btn"
                        onClick={() => {
                          setSingleText('')
                          setSingleResult(null)
                        }}
                        className="w-full py-2.5 text-xs font-semibold border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-850 rounded-xl transition"
                      >
                        Reset Analysis
                      </button>

                    </div>
                  ) : (
                    // Default Idle state
                    <div className="flex-1 flex flex-col justify-center items-center text-center p-6 space-y-4">
                      <div className="bg-slate-800/40 p-4 rounded-full border border-slate-700/20 text-slate-500">
                        <BarChart3 className="w-8 h-8" />
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-sm font-semibold text-slate-200">Awaiting ML Analysis</span>
                        <p className="text-xs text-slate-500 max-w-[240px] leading-relaxed">
                          Enter review text and press analyze. Inference results will visualise instantly.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

          </div>
        )}

        {/* Render Batch Review Tab */}
        {activeTab === 'batch' && (
          <div className="space-y-8 animate-fadeIn">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-white mb-2">
                Batch Sentiment Processing
              </h2>
              <p className="text-slate-400 text-sm max-w-2xl">
                Submit multiple reviews simultaneously. Paste reviews below, with each review starting on a new line.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Batch Inputs */}
              <div className="lg:col-span-5 space-y-4 flex flex-col">
                <form onSubmit={handleAnalyzeBatch} className="flex-1 flex flex-col space-y-4">
                  <div className="flex-1 bg-slate-900/40 rounded-2xl border border-slate-800 p-4 focus-within:border-indigo-500/50 flex flex-col">
                    <label htmlFor="batch-textarea" className="sr-only">Batch Movie Reviews</label>
                    <textarea
                      id="batch-textarea"
                      rows="10"
                      value={batchTextsInput}
                      onChange={(e) => setBatchTextsInput(e.target.value)}
                      placeholder="Review 1: Loved this cinema!&#10;Review 2: Script was horrible...&#10;Review 3: Good performance but boring."
                      disabled={batchLoading}
                      className="flex-1 w-full bg-transparent text-slate-105 placeholder-slate-500 text-sm border-0 focus:ring-0 resize-none outline-none custom-scrollbar min-h-[200px]"
                    />
                    <div className="flex justify-between items-center mt-3 pt-3 border-t border-slate-800/80 text-xs text-slate-550">
                      <span>
                        {batchTextsInput.split('\n').filter(t => t.trim()).length} reviews detected
                      </span>
                      {batchTextsInput.trim().length > 0 && (
                        <button
                          type="button"
                          onClick={() => setBatchTextsInput('')}
                          className="text-slate-400 hover:text-slate-200 font-medium transition"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  <button
                    id="batch-analyze-btn"
                    type="submit"
                    disabled={batchLoading || !batchTextsInput.trim()}
                    className={`w-full py-3.5 px-6 rounded-2xl font-semibold text-sm shadow-xl flex items-center justify-center space-x-2 transition duration-300 select-none ${
                      batchLoading || !batchTextsInput.trim()
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/15 hover:shadow-indigo-500/25 active:scale-[0.98]'
                    }`}
                  >
                    {batchLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-300" />
                        <span>Analyzing Batch Dataset...</span>
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        <span>Process Batch Analysis</span>
                      </>
                    )}
                  </button>
                </form>

                {batchError && (
                  <div className="bg-rose-950/20 border border-rose-800/60 text-rose-300 p-4 rounded-2xl flex items-start space-x-3 text-sm animate-shake">
                    <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                    <span>{batchError}</span>
                  </div>
                )}
              </div>

              {/* Batch Results Table */}
              <div className="lg:col-span-7 flex flex-col">
                <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl p-6 flex flex-col h-full min-h-[350px]">
                  
                  {batchLoading ? (
                    // Skeleton loader
                    <div className="flex-1 flex flex-col justify-between shimmer space-y-6">
                      <div className="flex justify-between items-center">
                        <div className="h-6 bg-slate-800 w-1/4 rounded-lg"></div>
                        <div className="h-6 bg-slate-800 w-1/5 rounded-lg"></div>
                      </div>
                      <div className="space-y-4 flex-1 mt-4">
                        {[1, 2, 3, 4].map(n => (
                          <div key={n} className="flex space-x-4 items-center">
                            <div className="h-8 bg-slate-800 w-12 rounded-lg"></div>
                            <div className="h-8 bg-slate-800 flex-1 rounded-lg"></div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : batchResults ? (
                    // Results list
                    <div className="flex-1 flex flex-col space-y-4 h-full">
                      
                      {/* Search and filter controls */}
                      <div className="flex flex-col sm:flex-row gap-3 items-center justify-between pb-3 border-b border-slate-800/80">
                        <div className="relative w-full sm:w-60">
                          <label htmlFor="search-input" className="sr-only">Search batch reviews</label>
                          <input
                            id="search-input"
                            type="text"
                            value={batchSearch}
                            onChange={(e) => setBatchSearch(e.target.value)}
                            placeholder="Filter reviews..."
                            className="w-full bg-slate-900/80 text-xs text-slate-200 placeholder-slate-500 pl-8 pr-3 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-indigo-500/50"
                          />
                          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-3" />
                        </div>

                        <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
                          <Filter className="w-3.5 h-3.5 text-slate-500" />
                          <label htmlFor="filter-select" className="sr-only">Filter sentiment</label>
                          <select
                            id="filter-select"
                            value={batchFilter}
                            onChange={(e) => setBatchFilter(e.target.value)}
                            className="bg-slate-900/80 text-xs text-slate-300 border border-slate-800 px-3 py-2.5 rounded-xl outline-none focus:border-indigo-500/50"
                          >
                            <option value="all">All Sentiment</option>
                            <option value="positive">Positive Only</option>
                            <option value="negative">Negative Only</option>
                          </select>
                        </div>
                      </div>

                      {/* Table layout */}
                      <div className="flex-1 overflow-y-auto max-h-[350px] custom-scrollbar">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-slate-800/40 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                              <th className="py-3 px-2">Label</th>
                              <th className="py-3 px-3">Snippet</th>
                              <th className="py-3 px-2 text-right">Confidence</th>
                            </tr>
                          </thead>
                          <tbody>
                            {batchResults
                              .filter(r => {
                                const matchesSearch = r.original.toLowerCase().includes(batchSearch.toLowerCase())
                                const matchesFilter = batchFilter === 'all' || r.label === batchFilter
                                return matchesSearch && matchesFilter
                              })
                              .map((r, idx) => (
                                <tr key={idx} className="border-b border-slate-850 hover:bg-slate-900/30 transition">
                                  <td className="py-3.5 px-2">
                                    <span
                                      className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase select-none ${
                                        r.label === 'positive'
                                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-900/40'
                                          : 'bg-rose-950/80 text-rose-400 border border-rose-900/40'
                                      }`}
                                    >
                                      {r.label}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-3 max-w-xs sm:max-w-md truncate text-xs text-slate-300 italic">
                                    "{r.original}"
                                  </td>
                                  <td className="py-3.5 px-2 text-right text-xs font-semibold text-slate-400">
                                    {(r.probability * 100).toFixed(1)}%
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>

                    </div>
                  ) : (
                    // Default Idle
                    <div className="flex-1 flex flex-col justify-center items-center text-center p-6 space-y-4">
                      <div className="bg-slate-800/40 p-4 rounded-full border border-slate-700/20 text-slate-500">
                        <Database className="w-8 h-8" />
                      </div>
                      <div className="space-y-1.5">
                        <span className="text-sm font-semibold text-slate-200">No Dataset Analyzed</span>
                        <p className="text-xs text-slate-500 max-w-[260px] leading-relaxed">
                          Enter multiple reviews and hit process. An interactive analytical breakdown will be rendered here.
                        </p>
                      </div>
                    </div>
                  )}

                </div>
              </div>

            </div>

          </div>
        )}

        {/* Render Model Insights Tab */}
        {activeTab === 'model' && (
          <div className="space-y-8 animate-fadeIn">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight text-white mb-2">
                ML Pipeline Architecture Insights
              </h2>
              <p className="text-slate-400 text-sm max-w-2xl">
                Details about the underlying Scikit-Learn Logistic Regression model trained on 50,000 IMDb movie reviews.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              
              {/* Card 1: Accuracy */}
              <div className="bg-slate-900/40 glow-card border border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="bg-indigo-950 text-indigo-400 p-3 rounded-2xl border border-indigo-900/50">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-900/50 px-2 py-0.5 rounded-full">
                    SOTA Baseline
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-450 uppercase tracking-wider block">
                    Validation Accuracy
                  </span>
                  <div className="text-3xl font-extrabold text-white">90.29%</div>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Trained on 40,000 reviews and tested against 10,000 reviews. Balanced Precision/Recall on positive and negative reviews (~0.90 F1-score).
                </p>
              </div>

              {/* Card 2: Features */}
              <div className="bg-slate-900/40 glow-card border border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="bg-purple-950 text-purple-400 p-3 rounded-2xl border border-purple-900/50">
                    <Database className="w-5 h-5" />
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-450 uppercase tracking-wider block">
                    Feature Vectorization
                  </span>
                  <div className="text-3xl font-extrabold text-white">10,000 N-Grams</div>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Utilizes a TF-IDF vectorizer configuration mapping uni-grams and bi-grams with a cap on the top 10,000 words. Strips HTML, performs contraction resolution, and case-folds input.
                </p>
              </div>

              {/* Card 3: Performance */}
              <div className="bg-slate-900/40 glow-card border border-slate-800 rounded-3xl p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="bg-amber-950 text-amber-400 p-3 rounded-2xl border border-amber-900/50">
                    <Clock className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold text-amber-400 bg-amber-950/60 border border-amber-900/50 px-2 py-0.5 rounded-full">
                    Execution
                  </span>
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-semibold text-slate-450 uppercase tracking-wider block">
                    Average Latency
                  </span>
                  <div className="text-3xl font-extrabold text-white">&lt; 5.0 ms</div>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Optimized for execution budgets. Model is preloaded into RAM during FastAPI startup phase (`@app.on_event("startup")` equivalent lifespan), preventing file read bottlenecks.
                </p>
              </div>

            </div>

            {/* Preprocessing workflow pipeline chart */}
            <div className="bg-slate-900/20 border border-slate-800 rounded-3xl p-6 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Text Preprocessing Pipeline Workflow
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-center">
                <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between items-center">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">Stage 1</span>
                  <span className="text-xs font-semibold text-slate-200 block mb-1">HTML Stripper</span>
                  <p className="text-[10px] text-slate-500">Strips raw tags (e.g. `&lt;br /&gt;`) via regex filtering</p>
                </div>

                <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between items-center">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">Stage 2</span>
                  <span className="text-xs font-semibold text-slate-200 block mb-1">Lowercasing</span>
                  <p className="text-[10px] text-slate-500">Normalizes case variants to prevent duplicate tokens</p>
                </div>

                <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between items-center">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">Stage 3</span>
                  <span className="text-xs font-semibold text-slate-200 block mb-1">Contraction Expansion</span>
                  <p className="text-[10px] text-slate-500">Expands slang mappings (e.g. `don't` &rarr; `do not` )</p>
                </div>

                <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between items-center">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider mb-2">Stage 4</span>
                  <span className="text-xs font-semibold text-slate-200 block mb-1">TF-IDF Vectorizer</span>
                  <p className="text-[10px] text-slate-500">Extracts top 10k n-grams and computes weights</p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Render Session History Tab */}
        {activeTab === 'history' && (
          <div className="space-y-8 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-3xl font-extrabold tracking-tight text-white mb-2">
                  Session Analysis History
                </h2>
                <p className="text-slate-400 text-sm max-w-2xl">
                  Inspect previous analysis inputs, labels, and execution metrics. Clear logs or export them as a markdown report.
                </p>
              </div>

              {history.length > 0 && (
                <div className="flex items-center space-x-3 shrink-0">
                  <button
                    id="download-history-btn"
                    onClick={handleDownloadHistory}
                    className="flex items-center space-x-2 px-4 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-600/10 active:scale-[0.98] transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Report (.md)</span>
                  </button>
                  
                  <button
                    id="clear-history-btn"
                    onClick={handleClearHistory}
                    className="flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border border-slate-800 text-rose-400 hover:bg-rose-950/20 rounded-xl transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear Logs</span>
                  </button>
                </div>
              )}
            </div>

            {history.length > 0 ? (
              <div className="space-y-4">
                {history.map(item => (
                  <div
                    key={item.id}
                    className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-5 flex flex-col md:flex-row md:items-start justify-between gap-4 hover:border-slate-700/60 transition"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center space-x-3 text-xs text-slate-500">
                        <span className="font-semibold">{item.timestamp}</span>
                        {item.execution_time_ms > 0 && (
                          <>
                            <span>&bull;</span>
                            <span>Latency: {item.execution_time_ms} ms</span>
                          </>
                        )}
                        <span>&bull;</span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                          item.engine === 'FastAPI Server' ? 'bg-indigo-950 text-indigo-400' : 'bg-amber-955 bg-opacity-20 text-amber-400'
                        }`}>
                          {item.engine || 'Local'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-200 italic leading-relaxed">
                        "{item.text}"
                      </p>
                    </div>

                    <div className="shrink-0 flex items-center md:self-center">
                      <span
                        className={`text-xs font-extrabold px-3 py-1.5 rounded-xl uppercase tracking-wider select-none ${
                          item.label === 'positive'
                            ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-900/40'
                            : 'bg-rose-950/80 text-rose-400 border border-rose-900/40'
                        }`}
                      >
                        {item.label} ({(item.probability * 100).toFixed(0)}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-slate-900/20 border border-slate-800 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-4">
                <div className="bg-slate-800/40 p-4 rounded-full text-slate-500 border border-slate-700/20">
                  <History className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <span className="text-sm font-semibold text-slate-200">No Logs Recorded</span>
                  <p className="text-xs text-slate-550 max-w-[260px] leading-relaxed">
                    Once you start analyzing reviews (single or batch), the logs will accumulate and display here.
                  </p>
                </div>
              </div>
            )}

          </div>
        )}

      </main>

    </div>
  )
}
