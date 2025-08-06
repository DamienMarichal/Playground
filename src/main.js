// Constants
// 4 levels of food

const colorStates = [
    { color: 'grey', text: 'Rien' },
    { color: 'green', text: 'Raisonable' },
    { color: 'yellow', text: 'Trop' },
    { color: 'red', text: 'Déraisonable' }
];

// Manage the Button States for a Date
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
            buttonStates: Array(6).fill(0),
            values: ['', ''],
            timestamp: Date.now()
        };
    }

    async changeState(date, buttonIndex, newStateIndex) {
        const stateChange = {
            id: crypto.randomUUID(),
            date,
            buttonIndex,
            stateIndex: newStateIndex,
            timestamp: Date.now(),
            retryCount: 0
        };

        const currentState = this.getStateForDate(date);
        const newButtonStates = [...currentState.buttonStates];
        newButtonStates[buttonIndex] = newStateIndex;

        const newState = {
            ...currentState,
            buttonStates: newButtonStates,
            timestamp: stateChange.timestamp
        };

        this.dateStates.set(date, newState);
        this.saveDateStates();

        // Update UI
        updateButtonState(buttonIndex, newStateIndex);
        updateCurrentValue(colorStates[newStateIndex].text);
        this.syncQueue.enqueue(stateChange);
    }
}


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
        document.getElementById('queueCount').textContent = `Items in queue: ${this.queue.length}`;
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
}

// API Functions
async function syncWithAPI(stateChange) {
    // Simulated API call
    return new Promise((resolve) => {
        setTimeout(() => resolve(true), 1000);
    });
}

// UI Update Functions
function updateButtonState(buttonIndex, stateIndex) {
    const button = document.getElementById(`button${buttonIndex + 1}`);
    if (!button) return;

    colorStates.forEach(state => {
        button.classList.remove(`color-${state.color}`);
    });

    const newState = colorStates[stateIndex];
    button.classList.add(`color-${newState.color}`);
    button.textContent = newState.text;
}

// UI Update current value
function updateCurrentValue(text) {
    const currentValue = document.getElementById('currentValue');
    if (currentValue) {
        currentValue.textContent = text;
    }
}

// UI Update sync status
function updateSyncStatus(status) {
    const syncStatus = document.getElementById('syncStatus');
    if (!syncStatus) return;

    const statusClasses = ['synced', 'pending', 'processing', 'error'];
    syncStatus.classList.remove(...statusClasses);
    syncStatus.classList.add(status);
}

// UI Update for a Date
function updateDisplayForDate(date) {
    const state = stateManager.getStateForDate(date);
    state.buttonStates.forEach((stateIndex, index) => {
        updateButtonState(index, stateIndex);
    });
}

// UI Date Management
function setDateBoundaries(datePicker) {
    const today = new Date();
    const minDate = new Date(today);
    minDate.setMonth(today.getMonth() - 1);
    datePicker.min = minDate.toISOString().split('T')[0];

    const maxDate = new Date(today);
    maxDate.setMonth(today.getMonth() + 1);
    datePicker.max = maxDate.toISOString().split('T')[0];
}

function navigateDate(direction) {
    const datePicker = document.getElementById('datePicker');
    if (!datePicker) return;

    const currentDate = new Date(datePicker.value);
    currentDate.setDate(currentDate.getDate() + direction);
    const newDate = currentDate.toISOString().split('T')[0];

    if (newDate >= datePicker.min && newDate <= datePicker.max) {
        datePicker.value = newDate;
        updateDisplayForDate(newDate);
    }
}


// Main Program
// Initialize
const stateManager = new DateStateManager();

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    const datePicker = document.getElementById('datePicker');

    // Set today's date
    const today = new Date().toISOString().split('T')[0];
    datePicker.value = today;

    // Set date boundaries
    setDateBoundaries(datePicker);

    // Initialize buttons
    for (let i = 0; i < 6; i++) {
        const button = document.getElementById(`button${i + 1}`);
        if (button) {
            button.addEventListener('click', () => {
                const currentDate = datePicker.value;
                const currentState = stateManager.getStateForDate(currentDate);
                const nextStateIndex = (currentState.buttonStates[i] + 1) % colorStates.length;
                stateManager.changeState(currentDate, i, nextStateIndex);
            });
        }
    }

    // Date picker change event
    datePicker.addEventListener('change', (e) => {
        updateDisplayForDate(e.target.value);
    });

    // Date navigation buttons
    document.getElementById('prevDate')?.addEventListener('click', () => navigateDate(-1));
    document.getElementById('nextDate')?.addEventListener('click', () => navigateDate(1));

    // Force sync button
    document.getElementById('forceSync')?.addEventListener('click', () => {
        stateManager.syncQueue.processQueue();
    });

    // Online/Offline handlers
    window.addEventListener('online', () => {
        document.getElementById('connectionText').textContent = 'Online';
        document.getElementById('connectionIndicator').classList.remove('offline');
        stateManager.syncQueue.processQueue();
    });

    window.addEventListener('offline', () => {
        document.getElementById('connectionText').textContent = 'Offline';
        document.getElementById('connectionIndicator').classList.add('offline');
    });

    // Initial display update
    updateDisplayForDate(today);

    // Periodic queue processing
    setInterval(() => {
        if (navigator.onLine) {
            stateManager.syncQueue.processQueue();
        }
    }, 30000);
});