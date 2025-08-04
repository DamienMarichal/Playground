// Constants and State Definitions
const colorStates = [
    { color: 'grey', text: 'Start' },
    { color: 'green', text: 'Hello' },
    { color: 'yellow', text: 'World' },
    { color: 'red', text: 'House' }
];

// Queue Management System
class SyncQueue {
    constructor() {
        this.queue = this.loadQueue();
        this.isProcessing = false;
    }

    loadQueue() {
        const savedQueue = localStorage.getItem('syncQueue');
        return savedQueue ? JSON.parse(savedQueue) : [];
    }

    saveQueue() {
        localStorage.setItem('syncQueue', JSON.stringify(this.queue));
    }

    enqueue(stateChange) {
        this.queue.push(stateChange);
        this.saveQueue();
        this.processQueue();
    }

    dequeue() {
        const item = this.queue.shift();
        this.saveQueue();
        return item;
    }

    async processQueue() {
        if (this.isProcessing || this.queue.length === 0 || !navigator.onLine) {
            return;
        }

        this.isProcessing = true;
        updateSyncStatus('processing');

        while (this.queue.length > 0 && navigator.onLine) {
            const item = this.queue[0];
            try {
                const success = await syncWithAPI(item);
                if (success) {
                    this.dequeue();
                    updateSyncStatus('synced');
                } else {
                    updateSyncStatus('error');
                    break;
                }
            } catch (error) {
                console.error('Error processing queue:', error);
                updateSyncStatus('error');
                break;
            }
        }

        this.isProcessing = false;

        if (this.queue.length > 0) {
            updateSyncStatus('pending');
        }
    }

    get length() {
        return this.queue.length;
    }

    clear() {
        this.queue = [];
        this.saveQueue();
    }
}

// Date State Manager
class DateStateManager {
    constructor() {
        this.syncQueue = new SyncQueue();
        this.dateStates = new Map();
        this.loadDateStates();
    }

    loadDateStates() {
        const savedStates = localStorage.getItem('dateStates');
        if (savedStates) {
            this.dateStates = new Map(JSON.parse(savedStates));
        }
    }

    saveDateStates() {
        localStorage.setItem('dateStates', JSON.stringify([...this.dateStates]));
    }

    getStateForDate(date) {
        return this.dateStates.get(date) || {
            stateIndex: 0,
            timestamp: Date.now()
        };
    }

    async changeState(date, newIndex) {
        const stateChange = {
            id: crypto.randomUUID(),
            date: date,
            stateIndex: newIndex,
            timestamp: Date.now(),
            retryCount: 0
        };

        this.dateStates.set(date, {
            stateIndex: newIndex,
            timestamp: stateChange.timestamp
        });
        this.saveDateStates();

        updateButtonState(newIndex);
        updateCurrentValue(colorStates[newIndex].text);

        this.syncQueue.enqueue(stateChange);
        updateSyncStatus('pending');
    }

    getStateHistory(date) {
        const history = [];
        this.syncQueue.queue.forEach(change => {
            if (change.date === date) {
                history.push({
                    state: colorStates[change.stateIndex].text,
                    timestamp: new Date(change.timestamp).toLocaleTimeString()
                });
            }
        });
        return history;
    }
}

// API Functions
async function syncWithAPI(stateChange) {
    try {
        const response = await fetch('YOUR_API_ENDPOINT', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                id: stateChange.id,
                date: stateChange.date,
                stateIndex: stateChange.stateIndex,
                timestamp: stateChange.timestamp
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return true;
    } catch (error) {
        console.error('Sync failed:', error);
        stateChange.retryCount++;
        return false;
    }
}

// UI Update Functions
function updateButtonState(stateIndex) {
    // Remove all color classes
    colorStates.forEach(state => {
        colorButton.classList.remove(`color-${state.color}`);
    });

    // Add new color class and update text
    const newState = colorStates[stateIndex];
    colorButton.classList.add(`color-${newState.color}`);
    colorButton.textContent = newState.text;
}

function updateCurrentValue(text) {
    currentValue.textContent = text;
}

function updateSyncStatus(status) {
    const statusClasses = {
        synced: 'synced',
        pending: 'pending',
        processing: 'processing',
        error: 'error'
    };

    Object.values(statusClasses).forEach(className => {
        colorButton.classList.remove(className);
    });

    colorButton.classList.add(status);

    const statusMessages = {
        synced: 'All changes synchronized',
        pending: 'Changes waiting to be synchronized',
        processing: 'Synchronizing changes...',
        error: 'Sync error - will retry'
    };

    colorButton.title = statusMessages[status];
}

function updateDisplayForDate(date) {
    const state = stateManager.getStateForDate(date);
    updateButtonState(state.stateIndex);
    updateCurrentValue(colorStates[state.stateIndex].text);
}

// Date Management Functions
function setDateBoundaries() {
    const minDate = new Date();
    minDate.setMonth(minDate.getMonth() - 1);
    const minDateString = minDate.toISOString().split('T')[0];
    datePicker.min = minDateString;

    const maxDate = new Date();
    maxDate.setMonth(maxDate.getMonth() + 1);
    const maxDateString = maxDate.toISOString().split('T')[0];
    datePicker.max = maxDateString;
}


// Initialize Components
const datePicker = document.getElementById('datePicker');
const currentValue = document.getElementById('currentValue');
const colorButton = document.getElementById('colorButton');
const stateManager = new DateStateManager();

// Set initial date and boundaries
const today = new Date().toISOString().split('T')[0];
datePicker.value = today;
setDateBoundaries();

// Event Listeners
datePicker.addEventListener('change', (e) => {
    updateDisplayForDate(e.target.value);
});

colorButton.addEventListener('click', () => {
    const currentDate = datePicker.value;
    const currentState = stateManager.getStateForDate(currentDate);
    const nextStateIndex = (currentState.stateIndex + 1) % colorStates.length;
    stateManager.changeState(currentDate, nextStateIndex);
});

window.addEventListener('online', () => {
    console.log('Back online, processing queue...');
    stateManager.syncQueue.processQueue();
});

window.addEventListener('offline', () => {
    console.log('Gone offline, sync paused');
    updateSyncStatus('pending');
});

// Periodic queue processing
setInterval(() => {
    if (navigator.onLine) {
        stateManager.syncQueue.processQueue();
    }
}, 30000);

// Initial display update
updateDisplayForDate(today);

// Add these functions after your existing initialization code

function navigateDate(direction) {
    const currentDate = new Date(datePicker.value);
    currentDate.setDate(currentDate.getDate() + direction);

    // Format the date to YYYY-MM-DD
    const newDate = currentDate.toISOString().split('T')[0];

    // Check if the new date is within boundaries
    if (newDate >= datePicker.min && newDate <= datePicker.max) {
        datePicker.value = newDate;
        updateDisplayForDate(newDate);
    }
}

// Add event listeners for the navigation buttons
document.getElementById('prevDate').addEventListener('click', () => navigateDate(-1));
document.getElementById('nextDate').addEventListener('click', () => navigateDate(1));
