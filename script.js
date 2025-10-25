document.addEventListener('DOMContentLoaded', () => {

    // --- DOM Elements ---
    const optionInput = document.getElementById('option-input');
    const addOptionBtn = document.getElementById('add-option-btn');
    const optionsListContainer = document.getElementById('options-list');
    const wheel = document.getElementById('wheel');
    const spinButton = document.getElementById('spin-button');
    const resultModal = document.getElementById('result-modal');
    const resultText = document.getElementById('result-text');
    const closeModalBtn = document.querySelector('.close-modal');

    // --- State ---
    let options = [];
    let isSpinning = false;
    // Pre-defined array of good-looking, distinct colors for the wheel
    const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FED766", "#2AB7CA", "#F08A5D", "#B22727", "#3D405B", "#E07A5F", "#81B29A"];

    // --- Functions ---

    /**
     * Loads options from localStorage on page load
     */
    function loadState() {
        const savedOptions = localStorage.getItem('decisionWheelOptions');
        if (savedOptions) {
            options = JSON.parse(savedOptions);
        }
        renderOptionsList();
        updateWheel();
    }

    /**
     * Saves the current options array to localStorage
     */
    function saveState() {
        localStorage.setItem('decisionWheelOptions', JSON.stringify(options));
    }

    /**
     * Calculates the weight for a single option
     * Weight = 1 (base) + (Pros) - (Cons)
     * Minimum weight is 1.
     */
    function calculateWeight(option) {
        return Math.max(1, 1 + option.pros.length - option.cons.length);
    }

    /**
     * Re-draws the entire list of option cards
     */
    function renderOptionsList() {
        optionsListContainer.innerHTML = ''; // Clear existing list

        options.forEach((option, index) => {
            const optionCard = document.createElement('div');
            optionCard.className = 'option-card';
            optionCard.dataset.id = option.id;

            // Pros and Cons lists
            const prosHTML = option.pros.map(pro => `<li>${pro}</li>`).join('');
            const consHTML = option.cons.map(con => `<li>${con}</li>`).join('');

            optionCard.innerHTML = `
                <div class="option-header">
                    <h3>${option.name} (Weight: ${calculateWeight(option)})</h3>
                    <button class="delete-option-btn" title="Delete Option">&times;</button>
                </div>
                <div class="reasoning-form">
                    <input type="text" class="reason-input" placeholder="Add a Pro or Con">
                    <button class="add-pro-btn">Pro +</button>
                    <button class="add-con-btn">Con -</button>
                </div>
                <div class="reason-list">
                    <ul class="pro-list">${prosHTML}</ul>
                    <ul class="con-list">${consHTML}</ul>
                </div>
            `;
            optionsListContainer.appendChild(optionCard);
        });
    }

    /**
     * Updates the conic-gradient background of the wheel
     */
    function updateWheel() {
        if (options.length === 0) {
            wheel.style.background = '#eee';
            return;
        }

        let totalWeight = 0;
        const weights = options.map(opt => {
            const weight = calculateWeight(opt);
            totalWeight += weight;
            return weight;
        });

        let gradientString = 'conic-gradient(';
        let currentPercent = 0;

        weights.forEach((weight, index) => {
            const percent = (weight / totalWeight) * 100;
            const color = colors[index % colors.length]; // Cycle through colors
            
            gradientString += `${color} ${currentPercent}% ${currentPercent + percent}%`;
            
            currentPercent += percent;

            if (index < weights.length - 1) {
                gradientString += ', ';
            }
        });

        gradientString += ')';
        wheel.style.background = gradientString;
    }

    /**
     * Handles adding a new option
     */
    function handleAddOption() {
        const optionName = optionInput.value.trim();
        if (optionName === '') {
            alert('Please enter an option name.');
            return;
        }

        const newOption = {
            id: Date.now(),
            name: optionName,
            pros: [],
            cons: []
        };

        options.push(newOption);
        optionInput.value = '';
        
        renderOptionsList();
        updateWheel();
        saveState();
    }

    /**
     * Handles clicks within the options list (add pro/con, delete option)
     * --- THIS IS THE CORRECTED FUNCTION ---
     */
    function handleOptionsListClick(e) {
        const target = e.target;
        const card = target.closest('.option-card');
        if (!card) return;

        const id = Number(card.dataset.id);
        const option = options.find(opt => opt.id === id);
        let stateChanged = false; // Flag to track if we need to re-render

        if (target.classList.contains('delete-option-btn')) {
            // Delete Option
            options = options.filter(opt => opt.id !== id);
            stateChanged = true;
        } else if (target.classList.contains('add-pro-btn')) {
            // Add Pro
            const input = card.querySelector('.reason-input');
            const reason = input.value.trim();
            if (reason) {
                option.pros.push(reason);
                input.value = ''; // Clear the input
                stateChanged = true; // Mark that we need to re-render
            }
        } else if (target.classList.contains('add-con-btn')) {
            // Add Con
            const input = card.querySelector('.reason-input');
            const reason = input.value.trim();
            if (reason) {
                option.cons.push(reason);
                input.value = ''; // Clear the input
                stateChanged = true; // Mark that we need to re-render
            }
        }

        // Only re-render, update, and save IF a button was
        // successfully pressed (and the state changed).
        if (stateChanged) {
            renderOptionsList();
            updateWheel();
            saveState();
        }
    }

    /**
     * Gets a weighted random winner
     */
    function getWinner() {
        let totalWeight = 0;
        const weights = options.map(opt => {
            const weight = calculateWeight(opt);
            totalWeight += weight;
            return weight;
        });

        let randomNum = Math.random() * totalWeight;
        
        for (let i = 0; i < options.length; i++) {
            randomNum -= weights[i];
            if (randomNum < 0) {
                return options[i];
            }
        }
    }

    /**
     * Handles the spin button click
     */
    function handleSpin() {
        if (options.length < 2) {
            alert('Please add at least two options to spin the wheel.');
            return;
        }
        if (isSpinning) return;

        isSpinning = true;
        const winner = getWinner();
        
        // --- Calculate Spin Angle ---
        // This calculates the correct angle to land on the winner's slice
        let totalWeight = 0;
        const weights = options.map(opt => {
            const weight = calculateWeight(opt);
            totalWeight += weight;
            return weight;
        });

        let startAngle = 0;
        let winnerIndex = options.findIndex(opt => opt.id === winner.id);

        for (let i = 0; i < winnerIndex; i++) {
            startAngle += (weights[i] / totalWeight) * 360;
        }

        const winnerSliceSize = (weights[winnerIndex] / totalWeight) * 360;
        // Random angle *within* the winner's slice
        const randomAngleInSlice = Math.random() * winnerSliceSize;
        const finalAngle = startAngle + randomAngleInSlice;

        // Add multiple rotations + the final angle
        // 10 rotations (3600deg) + the angle to stop at
        // We subtract finalAngle because the pointer is at the top (0deg)
        const spinRotations = 3600 + (360 - finalAngle);

        wheel.style.transition = 'transform 4s cubic-bezier(0.25, 0.1, 0.25, 1)';
        wheel.style.transform = `rotate(${spinRotations}deg)`;

        // After animation, show result
        setTimeout(() => {
            isSpinning = false;
            resultText.textContent = winner.name;
            resultModal.classList.add('show');
            
            // Reset wheel transform for next spin
            const currentRotation = spinRotations % 360;
            wheel.style.transition = 'none'; // No animation
            wheel.style.transform = `rotate(${currentRotation}deg)`; // Set to new "start"
        }, 4000);
    }

    // --- Event Listeners ---
    addOptionBtn.addEventListener('click', handleAddOption);
    optionsListContainer.addEventListener('click', handleOptionsListClick);
    spinButton.addEventListener('click', handleSpin);
    
    closeModalBtn.addEventListener('click', () => resultModal.classList.remove('show'));
    resultModal.addEventListener('click', (e) => {
        if (e.target === resultModal) {
            resultModal.classList.remove('show');
        }
    });

    // --- Initial Load ---
    loadState();
});