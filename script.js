/**
 * Handles the 'onresult' event from the SpeechRecognition API.
 */
function handleRecognitionResult(event) {
    lastSpeechTime = new Date(); // Reset pause timer on any speech
    
    let currentFullTranscript = '';

    // --- Part 1: Calculate Live Word Count ---
    // Iterate through ALL results (final and interim) to build the full transcript
    for (let i = 0; i < event.results.length; ++i) {
        currentFullTranscript += event.results[i][0].transcript + ' ';
    }

    // Set the global wordCount from the full transcript
    // Use regex /\s+/ to split on any whitespace and avoid empty strings
    if (currentFullTranscript.trim().length === 0) {
        wordCount = 0;
    } else {
        const words = currentFullTranscript.trim().split(/\s+/);
        wordCount = words.length;
    }

    // --- Part 2: Calculate Confidence ---
    // Iterate only over *new* results since the last event
    for (let i = event.resultIndex; i < event.results.length; ++i) {
        // We only add to the confidence score for results that are *final*
        if (event.results[i].isFinal) {
            confidenceTotal += event.results[i][0].confidence;
            confidenceCount++;
        }
    }

    // --- Part 3: Update UI ---
    updateDashboard();
}