// --- Polyfill for browser compatibility ---
window.SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
window.AudioContext = window.AudioContext || window.webkitAudioContext;

// --- DOM Elements ---
const toggleBtn = document.getElementById('toggle-speech-btn');
const statusIndicator = document.getElementById('status-indicator');

// Visualizer Elements
const ringOuter = document.getElementById('ring-outer');
const ringMiddle = document.getElementById('ring-middle');
const ringInner = document.getElementById('ring-inner');
const barContainer = document.getElementById('bar-visualizer');
const NUM_BARS = 32; // Number of visualizer bars

// Dashboard Elements
const wpmEl = document.getElementById('wpm-value');
const pausesEl = document.getElementById('pauses-value');
const confidenceEl = document.getElementById('confidence-value');

// Report Modal Elements
const reportModal = document.getElementById('report-modal');
const reportTimeEl = document.getElementById('report-time');
const reportWpmEl = document.getElementById('report-wpm');
const reportPausesEl = document.getElementById('report-pauses');
const reportConfidenceEl = document.getElementById('report-confidence');
const tryAgainBtn = document.getElementById('try-again-btn');

// --- State Variables ---
let isListening = false;
let recognition;
let audioContext;
let analyser;
let visualizerFrameId;

// Session Stats
let startTime;
let wordCount = 0;
let pauseCount = 0;
let lastSpeechTime;
let pauseTimer;
let confidenceTotal = 0;
let confidenceCount = 0;

// --- Setup ---
// Create visualizer bars
for (let i = 0; i < NUM_BARS; i++) {
    const bar = document.createElement('div');
    bar.classList.add('visualizer-bar');
    const angle = (i / NUM_BARS) * 360;
    bar.style.transform = `rotate(${angle}deg) translate(0, -120px)`;
    barContainer.appendChild(bar);
}
const visualizerBars = document.querySelectorAll('.visualizer-bar');

// --- Core Functions ---

/**
 * Initializes and starts the Web Audio API for volume visualization.
 */
async function setupAudioVisualizer() {
    if (!audioContext) {
        audioContext = new AudioContext();
    }
    
    // Resume context if it was suspended
    if (audioContext.state === 'suspended') {
        await audioContext.resume();
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = audioContext.createMediaStreamSource(stream);
        
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 64; // Small FFT size for performance
        
        source.connect(analyser);
        
        // Start the visualization loop
        visualizeVolume();
    } catch (err) {
        console.error('Error accessing microphone for visualizer:', err);
        alert('Could not access microphone. Please allow microphone permissions.');
    }
}

/**
 * The render loop for the audio visualizer.
 */
function visualizeVolume() {
    if (!isListening) {
        // Reset visualizer to idle state
        ringOuter.style.transform = 'scale(1)';
        ringMiddle.style.transform = 'scale(1)';
        ringInner.style.transform = 'scale(1)';
        visualizerBars.forEach(bar => {
            bar.style.transform = `${bar.style.transform.split(' scaleY')[0]} scaleY(1)`;
        });
        return; // Stop the loop
    }

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(dataArray);

    // Calculate average volume
    const sum = dataArray.reduce((a, b) => a + b, 0);
    const avgVolume = sum / dataArray.length;

    // Map volume (0-255) to a scale factor (e.g., 1.0 - 2.0)
    const scale = 1 + (avgVolume / 255) * 1; // Max scale of 2

    // Apply scale to rings
    ringOuter.style.transform = `scale(${scale * 1.1})`;
    ringMiddle.style.transform = `scale(${scale * 1.05})`;
    ringInner.style.transform = `scale(${scale})`;

    // Apply height to bars
    visualizerBars.forEach((bar, i) => {
        const barIndex = Math.floor((i / NUM_BARS) * dataArray.length);
        const barHeight = dataArray[barIndex];
        const heightScale = 1 + (barHeight / 255) * 4; // Max scale of 5
        bar.style.transform = `${bar.style.transform.split(' scaleY')[0]} scaleY(${heightScale})`;
    });

    // Request next frame
    visualizerFrameId = requestAnimationFrame(visualizeVolume);
}

/**
 * Initializes and starts the Web Speech API.
 */
function setupSpeechRecognition() {
    recognition = new SpeechRecognition();
    recognition.continuous = true;  // Keep listening even after a pause
    recognition.interimResults = true; // Get results as they come
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        console.log('Speech recognition started.');
    };

    recognition.onresult = handleRecognitionResult;

    recognition.onend = () => {
        if (isListening) {
            console.log('Speech recognition ended unexpectedly, restarting...');
            recognition.start(); // Restart if it stops but we are still in "listening" state
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
    };

    recognition.start();
}

/**
 * Toggles the listening state of the application.
 */
async function toggleListening() {
    isListening = !isListening;

    if (isListening) {
        // --- Start Listening ---
        toggleBtn.textContent = 'Stop Session';
        toggleBtn.classList.add('listening');
        statusIndicator.classList.add('listening');
        
        // Reset stats
        wordCount = 0;
        pauseCount = 0;
        confidenceTotal = 0;
        confidenceCount = 0;
        startTime = new Date();
        lastSpeechTime = new Date();
        
        updateDashboard();

        // Start pause timer
        pauseTimer = setInterval(checkPause, 500);

        // Start APIs
        await setupAudioVisualizer();
        setupSpeechRecognition();

    } else {
        // --- Stop Listening ---
        toggleBtn.textContent = 'Start Speaking';
        toggleBtn.classList.remove('listening');
        statusIndicator.classList.remove('listening');

        // Stop APIs
        if (recognition) recognition.stop();
        if (audioContext && audioContext.state !== 'suspended') audioContext.suspend();
        cancelAnimationFrame(visualizerFrameId);
        clearInterval(pauseTimer);

        // Show final report
        showReport();
    }
}

/**
 * Handles the 'onresult' event from the SpeechRecognition API.
 */
function handleRecognitionResult(event) {
    lastSpeechTime = new Date(); // Reset pause timer on any speech
    let finalTranscript = '';
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
            // Add confidence from final results
            confidenceTotal += event.results[i][0].confidence;
            confidenceCount++;
        } else {
            interimTranscript += event.results[i][0].transcript;
        }
    }

    // Calculate new words from the final transcript
    if (finalTranscript.trim().length > 0) {
        wordCount += finalTranscript.trim().split(' ').length;
    }

    updateDashboard();
}

/**
 * Updates the live statistics dashboard.
 */
function updateDashboard() {
    if (!startTime) return;

    // 1. Calculate WPM
    const elapsedTimeInMinutes = (new Date() - startTime) / 60000;
    const wpm = (elapsedTimeInMinutes > 0) ? Math.round(wordCount / elapsedTimeInMinutes) : 0;
    wpmEl.textContent = wpm;

    // 2. Update Pauses (handled by checkPause)
    pausesEl.textContent = pauseCount;

    // 3. Calculate Confidence
    const avgConfidence = (confidenceCount > 0) ? Math.round((confidenceTotal / confidenceCount) * 100) : 0;
    confidenceEl.textContent = avgConfidence;
}

/**
 * Checks for long pauses in speech.
 */
function checkPause() {
    const secondsSinceLastSpeech = (new Date() - lastSpeechTime) / 1000;
    
    // Define a pause as > 2 seconds of silence
    if (secondsSinceLastSpeech > 2) {
        // Increment pause count, but only once per pause
        if (!pauseTimer.isPaused) {
            pauseCount++;
            pausesEl.textContent = pauseCount;
            pauseTimer.isPaused = true; // Flag to prevent multiple increments
        }
    } else {
        pauseTimer.isPaused = false; // Reset flag when speech resumes
    }
}

/**
 * Generates and displays the final session report.
 */
function showReport() {
    const totalTimeInSeconds = (new Date() - startTime) / 1000;
    
    reportTimeEl.textContent = `${totalTimeInSeconds.toFixed(1)}s`;
    reportWpmEl.textContent = wpmEl.textContent;
    reportPausesEl.textContent = pausesEl.textContent;
    reportConfidenceEl.textContent = `${confidenceEl.textContent}%`;

    reportModal.classList.remove('hidden');
}

/**
 * Hides the report and resets the app to its initial state.
 */
function resetApp() {
    reportModal.classList.add('hidden');
    wordCount = 0;
    pauseCount = 0;
    confidenceTotal = 0;
    confidenceCount = 0;
    startTime = null;
    
    // Reset dashboard UI
    wpmEl.textContent = '0';
    pausesEl.textContent = '0';
    confidenceEl.textContent = '0';
    
    // Reset visualizer to idle
    visualizeVolume();
}

// --- Event Listeners ---
toggleBtn.addEventListener('click', toggleListening);
tryAgainBtn.addEventListener('click', resetApp);