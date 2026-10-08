/**
 * FillerDetect AI – Speech Filler Word Detector
 * Pure HTML, CSS, and Vanilla JavaScript Implementation
 */

// ==========================================
// 1. CONFIGURATION & FILLER DICTIONARY
// ==========================================

const FILLER_DICTIONARY = [
  // Hesitation Fillers
  { word: "um", category: "hesitation", label: "Hesitation" },
  { word: "uh", category: "hesitation", label: "Hesitation" },
  { word: "hmm", category: "hesitation", label: "Hesitation" },
  { word: "aaa", category: "hesitation", label: "Hesitation" },
  { word: "er", category: "hesitation", label: "Hesitation" },
  { word: "ah", category: "hesitation", label: "Hesitation" },

  // Conversation Fillers (multi-word phrases listed first for precedence)
  { word: "you know", category: "conversation", label: "Conversation" },
  { word: "i mean", category: "conversation", label: "Conversation" },
  { word: "sort of", category: "conversation", label: "Conversation" },
  { word: "kind of", category: "conversation", label: "Conversation" },
  { word: "like", category: "conversation", label: "Conversation" },
  { word: "basically", category: "conversation", label: "Conversation" },
  { word: "literally", category: "conversation", label: "Conversation" },
  { word: "okay", category: "conversation", label: "Conversation" },

  // Thinking Fillers
  { word: "actually", category: "thinking", label: "Thinking" },
  { word: "well", category: "thinking", label: "Thinking" },
  { word: "so", category: "thinking", label: "Thinking" },
  { word: "honestly", category: "thinking", label: "Thinking" },
  { word: "right", category: "thinking", label: "Thinking" }
];

// Sort dictionary by word length descending to match multi-word phrases before single words
FILLER_DICTIONARY.sort((a, b) => b.word.length - a.word.length);

// ==========================================
// 2. DOM ELEMENT REFERENCES
// ==========================================

const recordBtn = document.getElementById('recordBtn');
const statusBadge = document.getElementById('statusBadge');
const statusText = document.getElementById('statusText');
const timerDisplay = document.getElementById('timerDisplay');
const alertBanner = document.getElementById('alertBanner');
const alertText = document.getElementById('alertText');

const totalWordsEl = document.getElementById('totalWords');
const fillerCountEl = document.getElementById('fillerCount');
const fillerPercentageEl = document.getElementById('fillerPercentage');
const fillerProgressEl = document.getElementById('fillerProgress');
const speakingRateEl = document.getElementById('speakingRate');
const clarityRatingEl = document.getElementById('clarityRating');
const scoreLabelEl = document.getElementById('scoreLabel');

const transcriptBox = document.getElementById('transcriptBox');
const sideBySideContainer = document.getElementById('sideBySideContainer');
const originalSpeechContent = document.getElementById('originalSpeechContent');
const cleanedSpeechContent = document.getElementById('cleanedSpeechContent');

const scoreNumberEl = document.getElementById('scoreNumber');
const scoreCircleEl = document.getElementById('scoreCircle');
const scoreStatusBadge = document.getElementById('scoreStatusBadge');
const readScoreBtn = document.getElementById('readScoreBtn');

const hesitationCountEl = document.getElementById('hesitationCount');
const conversationCountEl = document.getElementById('conversationCount');
const thinkingCountEl = document.getElementById('thinkingCount');

const suggestionsList = document.getElementById('suggestionsList');
const fillerTableBody = document.getElementById('fillerTableBody');
const chartBars = document.getElementById('chartBars');

const demoBtn = document.getElementById('demoBtn');
const clearBtn = document.getElementById('clearBtn');
const saveSessionBtn = document.getElementById('saveSessionBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const historyTableBody = document.getElementById('historyTableBody');

const tabSideBySide = document.getElementById('tabSideBySide');
const tabCleanOnly = document.getElementById('tabCleanOnly');

// ==========================================
// 3. APPLICATION STATE
// ==========================================

let recognition = null;
let isRecording = false;
let startTime = null;
let timerInterval = null;
let elapsedSeconds = 0;

let currentRawTranscript = "";
let lastVoiceCommandTime = 0;

// Storage key
const STORAGE_KEY = "fillerdetect_ai_history";

// Sample Demo Speech Text
const DEMO_SPEECH = "Um, today I am going to explain, like, artificial intelligence. Basically, AI is used in many applications. You know, it helps computers perform intelligent tasks.";

// ==========================================
// 4. SPEECH RECOGNITION SETUP
// ==========================================

function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    showAlert("Your browser does not support Speech Recognition. Please use Google Chrome or MS Edge.");
    return false;
  }

  try {
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      isRecording = true;
      updateUIForRecordingState(true);
      startTimer();
    };

    recognition.onresult = (event) => {
      let finalTranscript = '';
      let interimTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript + ' ';
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      // Combine with existing text if newly added
      if (finalTranscript) {
        currentRawTranscript += finalTranscript;
      }

      const activeText = (currentRawTranscript + interimTranscript).trim();

      // Check for voice commands
      checkVoiceCommands(interimTranscript || finalTranscript);

      // Process and render analysis
      processSpeechAnalysis(activeText);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === 'not-allowed') {
        showAlert("Microphone permission was denied. Please allow microphone access in your browser settings.");
        stopRecording();
      } else if (event.error === 'no-speech') {
        // Keep listening cleanly
      }
    };

    recognition.onend = () => {
      // Auto restart if user didn't explicitly press stop
      if (isRecording) {
        try {
          recognition.start();
        } catch (e) {
          stopRecording();
        }
      } else {
        updateUIForRecordingState(false);
        stopTimer();
      }
    };

    return true;
  } catch (err) {
    console.error("Failed to initialize speech recognition:", err);
    showAlert("Could not access microphone speech recognition.");
    return false;
  }
}

// ==========================================
// 5. RECORDING CONTROLS & TIMERS
// ==========================================

function toggleRecording() {
  if (isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

function startRecording() {
  if (!recognition && !initSpeechRecognition()) {
    return;
  }

  try {
    currentRawTranscript = "";
    elapsedSeconds = 0;
    transcriptBox.innerHTML = "";
    recognition.start();
  } catch (err) {
    console.warn("Recognition start failed or already active:", err);
  }
}

function stopRecording() {
  isRecording = false;
  if (recognition) {
    try {
      recognition.stop();
    } catch (e) {}
  }
  updateUIForRecordingState(false);
  stopTimer();
}

function updateUIForRecordingState(recording) {
  if (recording) {
    recordBtn.classList.add('recording');
    statusBadge.className = 'status-badge recording';
    statusText.textContent = '🔴 Recording Live...';
  } else {
    recordBtn.classList.remove('recording');
    statusBadge.className = 'status-badge ready';
    statusText.textContent = 'Ready to Record';
  }
}

function startTimer() {
  stopTimer();
  startTime = Date.now() - (elapsedSeconds * 1000);
  timerInterval = setInterval(() => {
    elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
    updateTimerDisplay(elapsedSeconds);
    updateSpeakingRate();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  timerDisplay.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

// ==========================================
// 6. FILLER WORD DETECTION ENGINE
// ==========================================

function analyzeTranscript(rawText) {
  if (!rawText || !rawText.trim()) {
    return {
      rawText: "",
      totalWords: 0,
      fillerCount: 0,
      fillerPercentage: 0,
      clarityScore: 100,
      categoryCounts: { hesitation: 0, conversation: 0, thinking: 0 },
      fillerBreakdown: [],
      highlightedHtml: "",
      cleanedText: ""
    };
  }

  const wordsArray = rawText.trim().split(/\s+/).filter(Boolean);
  const totalWords = wordsArray.length;

  // 1. Match filler words/phrases using range tracking
  const matches = [];

  FILLER_DICTIONARY.forEach(item => {
    const regex = new RegExp(`\\b${escapeRegExp(item.word)}\\b`, 'gi');
    let match;
    while ((match = regex.exec(rawText)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        word: item.word,
        matchedText: match[0],
        category: item.category,
        label: item.label
      });
    }
  });

  // Sort matches by start position, then by length descending
  matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

  // Filter overlapping spans
  const filteredMatches = [];
  let lastEnd = 0;
  for (const match of matches) {
    if (match.start >= lastEnd) {
      filteredMatches.push(match);
      lastEnd = match.end;
    }
  }

  const fillerCount = filteredMatches.length;
  const fillerPercentage = totalWords > 0 ? ((fillerCount / totalWords) * 100) : 0;

  // Clarity Score Formula (0 to 100)
  // 0% fillers = 100, 5% = 78, 10% = 55, 20%+ = <=10
  const clarityScore = Math.max(0, Math.min(100, Math.round(100 - (fillerPercentage * 4.5))));

  // 2. Count by Category & Breakdown
  const categoryCounts = { hesitation: 0, conversation: 0, thinking: 0 };
  const breakdownMap = {};

  filteredMatches.forEach(m => {
    categoryCounts[m.category] = (categoryCounts[m.category] || 0) + 1;
    const lowerWord = m.word.toLowerCase();
    if (!breakdownMap[lowerWord]) {
      breakdownMap[lowerWord] = { word: m.matchedText, count: 0, category: m.category, label: m.label };
    }
    breakdownMap[lowerWord].count++;
  });

  const fillerBreakdown = Object.values(breakdownMap).sort((a, b) => b.count - a.count);

  // 3. Generate Highlighted HTML
  let highlightedHtml = "";
  let currentIndex = 0;

  for (const m of filteredMatches) {
    highlightedHtml += escapeHtml(rawText.substring(currentIndex, m.start));
    highlightedHtml += `<mark class="filler-tag filler-${m.category}">${escapeHtml(m.matchedText)}</mark>`;
    currentIndex = m.end;
  }
  highlightedHtml += escapeHtml(rawText.substring(currentIndex));

  // 4. Generate Cleaned Text (Before & After view)
  let cleanedText = "";
  currentIndex = 0;

  for (const m of filteredMatches) {
    cleanedText += rawText.substring(currentIndex, m.start);
    currentIndex = m.end;
  }
  cleanedText += rawText.substring(currentIndex);

  // Clean up punctuation artifacts (e.g. duplicate spaces, floating commas)
  cleanedText = cleanedText
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/,\s*,/g, ',')
    .replace(/^[\s,]+/, '')
    .trim();

  // Capitalize first letter if needed
  if (cleanedText.length > 0) {
    cleanedText = cleanedText.charAt(0).toUpperCase() + cleanedText.slice(1);
  }

  return {
    rawText,
    totalWords,
    fillerCount,
    fillerPercentage: parseFloat(fillerPercentage.toFixed(1)),
    clarityScore,
    categoryCounts,
    fillerBreakdown,
    highlightedHtml,
    cleanedText
  };
}

// ==========================================
// 7. RENDER & UPDATE DASHBOARD UI
// ==========================================

function processSpeechAnalysis(rawText) {
  currentRawTranscript = rawText;
  const analysis = analyzeTranscript(rawText);

  // Update Transcript Box (only if user isn't currently typing manually)
  if (document.activeElement !== transcriptBox) {
    transcriptBox.innerHTML = analysis.highlightedHtml || "";
  }

  // Update Stat Cards
  totalWordsEl.textContent = analysis.totalWords;
  fillerCountEl.textContent = analysis.fillerCount;
  fillerPercentageEl.textContent = `${analysis.fillerPercentage}%`;
  fillerProgressEl.style.width = `${Math.min(100, analysis.fillerPercentage * 4)}%`;

  updateSpeakingRate();
  updateClarityScoreUI(analysis.clarityScore, analysis.fillerPercentage);

  // Category Breakdown
  hesitationCountEl.textContent = analysis.categoryCounts.hesitation;
  conversationCountEl.textContent = analysis.categoryCounts.conversation;
  thinkingCountEl.textContent = analysis.categoryCounts.thinking;

  // Before & After View
  originalSpeechContent.innerHTML = analysis.highlightedHtml || "<em>No speech transcript yet.</em>";
  cleanedSpeechContent.textContent = analysis.cleanedText || "No speech transcript yet.";

  // Breakdown Table & Charts
  renderBreakdownTable(analysis.fillerBreakdown, analysis.fillerCount);
  renderBarChart(analysis.fillerBreakdown, analysis.fillerCount);

  // Dynamic AI Suggestions
  renderSuggestions(analysis);
}

function updateSpeakingRate() {
  const words = parseInt(totalWordsEl.textContent, 10) || 0;
  const minutes = elapsedSeconds / 60;
  const wpm = minutes > 0 ? Math.round(words / minutes) : 0;
  speakingRateEl.textContent = `${wpm} WPM`;
}

function updateClarityScoreUI(score, fillerPct) {
  scoreNumberEl.textContent = score;
  
  // Rating label & colors
  let ratingText = "Excellent";
  let statusClass = "excellent";
  let circleColor = "#10b981";

  if (score < 50) {
    ratingText = "Poor";
    statusClass = "poor";
    circleColor = "#ef4444";
  } else if (score < 70) {
    ratingText = "Needs Improvement";
    statusClass = "needs-improvement";
    circleColor = "#f59e0b";
  } else if (score < 85) {
    ratingText = "Good";
    statusClass = "good";
    circleColor = "#3b82f6";
  }

  clarityRatingEl.textContent = `${score}/100`;
  scoreLabelEl.textContent = `${ratingText} (${fillerPct}% fillers)`;

  scoreStatusBadge.textContent = ratingText;
  scoreStatusBadge.className = `score-status-badge ${statusClass}`;

  // SVG Circular Gauge Animation (stroke-dashoffset range 264 -> 0)
  const offset = 264 - (264 * (score / 100));
  scoreCircleEl.style.strokeDashoffset = offset;
  scoreCircleEl.style.stroke = circleColor;
}

function renderBreakdownTable(breakdown, totalFillers) {
  if (!breakdown || breakdown.length === 0) {
    fillerTableBody.innerHTML = `<tr><td colspan="4" class="empty-state">No filler words detected yet.</td></tr>`;
    return;
  }

  fillerTableBody.innerHTML = breakdown.map(item => {
    const share = totalFillers > 0 ? ((item.count / totalFillers) * 100).toFixed(1) : 0;
    return `
      <tr>
        <td><strong>${escapeHtml(item.word)}</strong></td>
        <td><span class="legend-dot ${item.category}"></span> ${item.label}</td>
        <td>${item.count}</td>
        <td>${share}%</td>
      </tr>
    `;
  }).join('');
}

function renderBarChart(breakdown, totalFillers) {
  if (!breakdown || breakdown.length === 0) {
    chartBars.innerHTML = `<div class="empty-state">Speak or run demo to populate chart.</div>`;
    return;
  }

  const topItems = breakdown.slice(0, 5);
  const maxCount = topItems[0].count;

  chartBars.innerHTML = topItems.map(item => {
    const widthPct = Math.round((item.count / maxCount) * 100);
    return `
      <div class="bar-row">
        <div class="bar-label" title="${escapeHtml(item.word)}">${escapeHtml(item.word)}</div>
        <div class="bar-wrapper">
          <div class="bar-fill" style="width: ${widthPct}%"></div>
        </div>
        <div class="bar-value">${item.count}</div>
      </div>
    `;
  }).join('');
}

function renderSuggestions(analysis) {
  const suggestions = [];

  if (analysis.totalWords === 0) {
    suggestions.push({
      icon: "🎙️",
      text: "Click the microphone button to start recording or click 'Load Demo Speech' to see real-time analysis."
    });
  } else if (analysis.fillerCount === 0) {
    suggestions.push({
      icon: "🌟",
      text: "Outstanding performance! Your speech is completely free of filler words."
    });
    suggestions.push({
      icon: "🎯",
      text: "Maintain this smooth cadence and confident pace during public speaking."
    });
  } else {
    // Specific targeted recommendations
    const topFiller = analysis.fillerBreakdown[0];

    if (topFiller) {
      if (topFiller.word.toLowerCase() === "um" || topFiller.word.toLowerCase() === "uh") {
        suggestions.push({
          icon: "💡",
          text: `You used '${topFiller.word}' ${topFiller.count} time(s). Try taking a 1-second silent pause instead of hesitating aloud.`
        });
      } else if (topFiller.word.toLowerCase() === "like") {
        suggestions.push({
          icon: "💬",
          text: `Word 'like' was detected ${topFiller.count} time(s). Replace casual filler words with deliberate sentence breaks.`
        });
      } else if (topFiller.word.toLowerCase() === "basically" || topFiller.word.toLowerCase() === "actually") {
        suggestions.push({
          icon: "⚡",
          text: `You frequently use '${topFiller.word}'. Stating facts directly without softening qualifiers builds greater authority.`
        });
      } else if (topFiller.word.toLowerCase() === "you know") {
        suggestions.push({
          icon: "🤝",
          text: `Phrase 'you know' occurred ${topFiller.count} time(s). Avoid assuming consensus; articulate your ideas clearly.`
        });
      } else {
        suggestions.push({
          icon: "📌",
          text: `Your top filler is '${topFiller.word}'. Practice speaking at a slightly slower pace to reduce repetition.`
        });
      }
    }

    if (analysis.fillerPercentage > 15) {
      suggestions.push({
        icon: "⚠️",
        text: "Filler word density is above 15%. Take deep breaths between major points to structure your thoughts."
      });
    } else if (analysis.fillerPercentage <= 5) {
      suggestions.push({
        icon: "✨",
        text: "Great job! Your speech clarity is in the top tier."
      });
    }
  }

  suggestionsList.innerHTML = suggestions.map(s => `
    <li class="suggestion-item">
      <span class="sug-icon">${s.icon}</span>
      <div class="sug-text">${s.text}</div>
    </li>
  `).join('');
}

// ==========================================
// 8. VOICE COMMANDS ENGINE
// ==========================================

function checkVoiceCommands(text) {
  if (!text) return;
  const now = Date.now();
  if (now - lastVoiceCommandTime < 3000) return; // Prevent double trigger

  const lower = text.toLowerCase().trim();

  if (lower.includes("stop recording")) {
    lastVoiceCommandTime = now;
    stopRecording();
    speakText("Recording stopped.");
  } else if (lower.includes("show analysis")) {
    lastVoiceCommandTime = now;
    document.querySelector('.analytics-section').scrollIntoView({ behavior: 'smooth' });
  } else if (lower.includes("clear transcript")) {
    lastVoiceCommandTime = now;
    clearAnalysis();
    speakText("Transcript cleared.");
  } else if (lower.includes("read score")) {
    lastVoiceCommandTime = now;
    readScoreAloud();
  }
}

function readScoreAloud() {
  const score = scoreNumberEl.textContent;
  const rating = scoreStatusBadge.textContent;
  const total = totalWordsEl.textContent;
  const fillers = fillerCountEl.textContent;

  const textToSpeak = `Your speech clarity score is ${score} out of 100, which is ${rating}. Total words spoken: ${total}. Filler words detected: ${fillers}.`;
  speakText(textToSpeak);
}

function speakText(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }
}

// ==========================================
// 9. LOCALSTORAGE SESSION HISTORY
// ==========================================

function saveCurrentSession() {
  const words = parseInt(totalWordsEl.textContent, 10) || 0;
  if (words === 0) {
    alert("No speech transcript available to save.");
    return;
  }

  const session = {
    id: Date.now(),
    date: new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
    time: timerDisplay.textContent,
    words: words,
    fillers: parseInt(fillerCountEl.textContent, 10) || 0,
    score: parseInt(scoreNumberEl.textContent, 10) || 100,
    percentage: fillerPercentageEl.textContent
  };

  const history = getHistory();
  history.unshift(session);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  renderHistoryTable();
}

function getHistory() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
}

function deleteHistoryItem(id) {
  let history = getHistory();
  history = history.filter(item => item.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  renderHistoryTable();
}

function clearAllHistory() {
  if (confirm("Are you sure you want to clear all saved session history?")) {
    localStorage.removeItem(STORAGE_KEY);
    renderHistoryTable();
  }
}

function renderHistoryTable() {
  const history = getHistory();
  if (history.length === 0) {
    historyTableBody.innerHTML = `<tr><td colspan="6" class="empty-state">No saved sessions in history.</td></tr>`;
    return;
  }

  historyTableBody.innerHTML = history.map(item => `
    <tr>
      <td>${item.date}</td>
      <td>${item.time}</td>
      <td>${item.words}</td>
      <td><span class="warning">${item.fillers}</span> (${item.percentage})</td>
      <td><strong>${item.score}/100</strong></td>
      <td>
        <button class="btn btn-ghost btn-sm text-danger" onclick="deleteHistoryItem(${item.id})">Delete</button>
      </td>
    </tr>
  `).join('');
}

// Make deleteHistoryItem accessible globally
window.deleteHistoryItem = deleteHistoryItem;

// ==========================================
// 10. DEMO MODE & RESET
// ==========================================

function loadDemoSpeech() {
  stopRecording();
  elapsedSeconds = 42;
  updateTimerDisplay(elapsedSeconds);
  processSpeechAnalysis(DEMO_SPEECH);
}

function clearAnalysis() {
  stopRecording();
  currentRawTranscript = "";
  elapsedSeconds = 0;
  updateTimerDisplay(0);
  transcriptBox.innerHTML = "";
  processSpeechAnalysis("");
}

function showAlert(message) {
  alertText.textContent = message;
  alertBanner.classList.remove('hidden');
}

function escapeHtml(text) {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ==========================================
// 11. EVENT LISTENERS INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  // Initialize speech recognition capabilities
  initSpeechRecognition();

  // Attach button events
  recordBtn.addEventListener('click', toggleRecording);
  demoBtn.addEventListener('click', loadDemoSpeech);
  clearBtn.addEventListener('click', clearAnalysis);
  readScoreBtn.addEventListener('click', readScoreAloud);
  saveSessionBtn.addEventListener('click', saveCurrentSession);
  clearHistoryBtn.addEventListener('click', clearAllHistory);

  // Editable transcript box listener
  transcriptBox.addEventListener('input', () => {
    processSpeechAnalysis(transcriptBox.innerText);
  });

  // Tab buttons for Before/After view
  tabSideBySide.addEventListener('click', () => {
    tabSideBySide.classList.add('active');
    tabCleanOnly.classList.remove('active');
    sideBySideContainer.style.gridTemplateColumns = '1fr 1fr';
    originalSpeechContent.parentElement.style.display = 'block';
  });

  tabCleanOnly.addEventListener('click', () => {
    tabCleanOnly.classList.add('active');
    tabSideBySide.classList.remove('active');
    sideBySideContainer.style.gridTemplateColumns = '1fr';
    originalSpeechContent.parentElement.style.display = 'none';
  });

  // Render initial history
  renderHistoryTable();

  // Automatically load Demo Mode on launch for instant demonstration!
  loadDemoSpeech();
});
