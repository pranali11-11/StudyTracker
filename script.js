import { signupUser, loginUser, logoutUser, monitorAuthState } from './authService.js';
import { 
    createTaskFirestore, 
    fetchTasksFirestore, 
    delTaskFirestore, 
    markTaskDoneFirestore 
} from './taskService.js';
import { 
    subscribeToAnalytics
} from './analyticsService.js';
import Chart from 'chart.js/auto';

let currentUserUid = null;
let analyticsUnsubscribe = null;
let trendChartInstance = null;
let subjectChartInstance = null;
// --- DOM Elements ---
const authSection = document.getElementById('auth-section');
const appSection = document.getElementById('app-section');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');

const navItems = document.querySelectorAll('.nav-item');
const viewPanels = document.querySelectorAll('.view-panel');
const pageTitle = document.getElementById('page-title');
const currentDateEl = document.getElementById('current-date');

// Task Form & Lists
const taskForm = document.getElementById('task-form');
const plannerTaskList = document.getElementById('planner-task-list');
const dashboardTaskList = document.getElementById('dashboard-task-list');
const focusTaskSelect = document.getElementById('focus-task-select');

// Quick add
const btnAddQuickTask = document.getElementById('btn-add-quick-task');

// Timer elements
const timerDisplay = document.getElementById('main-timer');
const quickTimerDisplay = document.querySelector('.quick-timer-display');
const progressRingValue = document.querySelector('.progress-ring__value');
const timerStart = document.getElementById('timer-start');
const timerPause = document.getElementById('timer-pause');
const timerReset = document.getElementById('timer-reset');
const timerTabs = document.querySelectorAll('.timer-tab');
const btnQuickStart = document.getElementById('btn-quick-start');

// Dash Stats
const dashTasksDone = document.getElementById('dash-tasks-done');
const dashTotalTime = document.getElementById('dash-total-time');

// --- Global State Context ---
let tasks = [];

let totalFocusTimeMinutes = 0;
let tasksCompleted = 0;

// Timer State
let timerInterval;
let timerTimeLeft = 25 * 60; // 25 mins in seconds
let timerTotalDuration = 25 * 60;
let isTimerRunning = false;
let currentTimerMode = 'pomodoro'; // pomodoro, shortBreak, longBreak

// Initialize Data
function init() {
    // Generate simple ID
    const genId = () => Math.random().toString(36).substr(2, 9);
    
    // Set Current Date
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    currentDateEl.textContent = new Date().toLocaleDateString(undefined, options);

    const dateInput = document.getElementById('task-date');
    if (dateInput) {
        const today = new Date().toISOString().split('T')[0];
        dateInput.setAttribute('min', today);
    }

    // Initial setup
    const circle = progressRingValue;
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    circle.style.strokeDashoffset = circumference; // start empty? no, start full
    circle.style.strokeDashoffset = 0;

    document.getElementById('sort-select')?.addEventListener('change', renderTasks);

    renderTasks();
    updateStatsDisplay();
}

// --- Navigation Logic ---
navItems.forEach(item => {
    item.addEventListener('click', () => {
        if (document.body.classList.contains('focus-active')) return;
        // Remove active class
        navItems.forEach(n => n.classList.remove('active'));
        viewPanels.forEach(p => p.classList.add('hidden'));

        // Add active class
        item.classList.add('active');
        const targetView = item.getAttribute('data-target');
        document.getElementById(`view-${targetView}`).classList.remove('hidden');

        // Update Title
        pageTitle.textContent = item.textContent.trim();
    });
});

btnAddQuickTask.addEventListener('click', () => {
    document.querySelector('.nav-item[data-target="planner"]').click();
});

btnQuickStart.addEventListener('click', () => {
    document.querySelector('.nav-item[data-target="timer"]').click();
    if(!isTimerRunning) timerStart.click();
});

// --- Authentication & Session Flow ---
const toggleSignupBtn = document.getElementById('toggle-signup');
const authTitle = document.getElementById('auth-title');
const authSubtitle = document.getElementById('auth-subtitle');
const nameGroup = document.getElementById('name-group');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authError = document.getElementById('auth-error');
const displayNameInput = document.getElementById('displayName');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const confirmPasswordGroup = document.getElementById('confirm-password-group');
const confirmPasswordInput = document.getElementById('confirmPassword');

let isSignupMode = false;

// Toggle Signup/Login Mode
toggleSignupBtn.addEventListener('click', (e) => {
    e.preventDefault();
    isSignupMode = !isSignupMode;
    authError.classList.add('hidden');
    
    if (isSignupMode) {
        authTitle.textContent = "Create an Account";
        authSubtitle.textContent = "Sign up to start planning";
        nameGroup.style.display = "block";
        confirmPasswordGroup.style.display = "block";
        displayNameInput.required = true;
        confirmPasswordInput.required = true;
        authSubmitBtn.textContent = "Sign Up";
        toggleSignupBtn.textContent = "Log in instead";
    } else {
        authTitle.textContent = "Welcome Back!";
        authSubtitle.textContent = "Log in to access your study planner";
        nameGroup.style.display = "none";
        confirmPasswordGroup.style.display = "none";
        displayNameInput.required = false;
        confirmPasswordInput.required = false;
        authSubmitBtn.textContent = "Log In";
        toggleSignupBtn.textContent = "Sign up";
    }
});

// Form Submit Handler
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.classList.add('hidden');
    authSubmitBtn.disabled = true;
    authSubmitBtn.textContent = "Processing...";

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const confirmPassword = confirmPasswordInput.value.trim();
    const displayName = displayNameInput.value.trim();

    try {
        if (isSignupMode) {
            if (password !== confirmPassword) {
                throw new Error("Passwords do not match.");
            }
            await signupUser(email, password, displayName);
        } else {
            await loginUser(email, password);
        }
        // Note: successful login will be caught by monitorAuthState
    } catch (error) {
        console.error("Login/Signup Error:", error);
        authError.textContent = error.message.replace('Firebase: ', '');
        authError.classList.remove('hidden');
        authSubmitBtn.textContent = isSignupMode ? "Sign Up" : "Log In";
        authSubmitBtn.disabled = false;
    }
});

// Logout Handler
logoutBtn.addEventListener('click', async () => {
    try {
        await logoutUser();
    } catch (error) {
        console.error("Logout failed", error);
    }
});

// Auth Guard Listener
monitorAuthState((user) => {
    if (user) {
        currentUserUid = user.uid;
        // Logged In State
        authSection.classList.add('hidden');
        appSection.classList.remove('hidden');
        
        // Update user profile display
        const nameToDisplay = user.displayName || user.email.split('@')[0];
        const avatarChar = nameToDisplay.charAt(0).toUpperCase();
        
        // Desktop
        document.querySelector('.user-name').textContent = nameToDisplay;
        document.querySelector('.user-avatar').textContent = avatarChar;
        
        // Mobile
        const mobileAvatar = document.getElementById('mobile-avatar');
        if (mobileAvatar) mobileAvatar.textContent = avatarChar;
        
        // Reset form for next logout/login
        loginForm.reset();
        authSubmitBtn.textContent = isSignupMode ? "Sign Up" : "Log In";
        authSubmitBtn.disabled = false;

        // Start Real-Time Analytics
        if (analyticsUnsubscribe) analyticsUnsubscribe();
        analyticsUnsubscribe = subscribeToAnalytics(user.uid, updateAnalyticsUI);

        // Fetch stored pending tasks from Firestore
        fetchTasksFirestore(user.uid)
            .then(fetchedTasks => {
                tasks = fetchedTasks;
                renderTasks();
            })
            .catch(err => console.error("Error loading tasks:", err));
    } else {
        currentUserUid = null;
        if (analyticsUnsubscribe) {
            analyticsUnsubscribe();
            analyticsUnsubscribe = null;
        }
        // Logged Out State
        appSection.classList.add('hidden');
        authSection.classList.remove('hidden');
        
        // Stop timer if running
        if (typeof isTimerRunning !== 'undefined' && isTimerRunning) {
            timerPause.click();
            timerReset.click();
        }
    }
});
window.showToast = showToast;


// --- Task Logic ---
taskForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const subject = document.getElementById('task-subject').value;
    const description = document.getElementById('task-desc').value;
    const datetime = document.getElementById('task-date').value;
    const priority = document.getElementById('task-priority').value;

    const newTask = {
        id: 'task_' + Math.random().toString(36).substr(2, 9),
        subject,
        description,
        datetime,
        priority,
        completed: false
    };

    if (currentUserUid) {
        createTaskFirestore(currentUserUid, newTask).then(() => {
            tasks.push(newTask);
            renderTasks();
            taskForm.reset();
            showToast("Task synced to cloud!", "success");
        }).catch(err => {
            console.error("Cloud sync failed:", err);
            // Still add locally for immediate feedback
            tasks.push(newTask);
            renderTasks();
            taskForm.reset();
        });
    } else {
        tasks.push(newTask);
        renderTasks();
        taskForm.reset();
    }
});

async function completeTask(id) {
    console.log("completeTask triggered for ID:", id);
    if (!currentUserUid) {
        console.warn("Complete task failed: No currentUserUid");
        showToast("You must be logged in to complete tasks.", "error");
        return;
    }

    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex > -1) {
        const taskData = tasks[taskIndex];
        
        try {
            // Save to Firestore First
            await markTaskDoneFirestore(currentUserUid, taskData);
            
            // Only update local UI if Firestore succeeds
            tasks[taskIndex].completed = true;
            tasksCompleted++;
            updateStatsDisplay();
            renderTasks();
            
            showToast("✅ Task marked as done!", "success");
        } catch (error) {
            console.error("Firestore save error:", error);
            showToast("Failed to save task completion: " + (error.message || "Unknown error"), "error");
            // Do NOT mark as completed locally! UI remains intact.
        }
    }
}

// --- Analytics UI Updates ---
function updateAnalyticsUI(data) {
    const loader = document.getElementById('analytics-loader');
    const content = document.getElementById('analytics-content');
    const emptyState = document.getElementById('analytics-empty-state');
    
    if (!data.isReady) return;

    loader.classList.add('hidden');
    content.classList.remove('hidden');

    if (data.totalCompleted === 0) {
        emptyState.classList.remove('hidden');
        document.querySelector('.analytics-grid').classList.add('hidden');
        document.querySelector('.analytics-summary-grid').classList.add('hidden');
        document.getElementById('dash-streak').textContent = "0 Days"; // Update dash
        return;
    } else {
        emptyState.classList.add('hidden');
        document.querySelector('.analytics-grid').classList.remove('hidden');
        document.querySelector('.analytics-summary-grid').classList.remove('hidden');
    }

    // Update Stats
    document.getElementById('stat-total-done').textContent = data.totalCompleted;
    document.getElementById('stat-today-done').textContent = data.todayCount;
    document.getElementById('stat-week-done').textContent = data.weekCount;
    document.getElementById('dash-streak').textContent = `${data.streak} Day${data.streak === 1 ? '' : 's'}`;

    // Update Charts
    updateTrendChart(data.trendData);
    updateSubjectChart(data.subjectBreakdown);
}

function updateTrendChart(trendMap) {
    const ctx = document.getElementById('trendChart').getContext('2d');
    
    // Sort keys (dates) and get counts
    const labels = Object.keys(trendMap).sort();
    const values = labels.map(l => trendMap[l]);

    if (trendChartInstance) trendChartInstance.destroy();

    trendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels.map(l => l.split('-').slice(1).join('/')), // Shorten date
            datasets: [{
                label: 'Tasks Completed',
                data: values,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                tension: 0.4,
                fill: true,
                pointRadius: 4,
                pointBackgroundColor: '#3b82f6'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, ticks: { stepSize: 1 } },
                x: { grid: { display: false } }
            }
        }
    });
}

function updateSubjectChart(subjectMap) {
    const ctx = document.getElementById('subjectChart').getContext('2d');
    const labels = Object.keys(subjectMap);
    const values = Object.values(subjectMap);

    if (subjectChartInstance) subjectChartInstance.destroy();

    subjectChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            },
            cutout: '65%'
        }
    });
}

// --- Toast Notification Helper ---
function showToast(message, type = "success") {
    const toastContainer = document.getElementById("toast-container");
    if (!toastContainer) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span>${message}</span>
        <i class="fa-solid ${type === 'success' ? 'fa-check-circle' : 'fa-circle-exclamation'}"></i>
    `;
    
    toastContainer.appendChild(toast);

    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.add("removing");
        toast.addEventListener("animationend", () => {
            toast.remove();
        });
    }, 3000);
}

async function deleteTask(id) {
    if (currentUserUid) {
        try {
            await delTaskFirestore(currentUserUid, id);
            showToast("Task deleted!", "success");
        } catch (error) {
            console.error("Failed to delete from Firestore:", error);
        }
    }
    tasks = tasks.filter(t => t.id !== id);
    renderTasks();
}

function updateStatsDisplay() {
    dashTasksDone.textContent = tasksCompleted;
    const hours = Math.floor(totalFocusTimeMinutes / 60);
    const mins = totalFocusTimeMinutes % 60;
    dashTotalTime.textContent = `${hours}h ${mins}m`;
}

const PRIORITY_ORDER = { high: 1, medium: 2, low: 3 };

function getSortedTasks() {
    const sortBy = document.getElementById('sort-select')?.value || 'priority';
    return [...tasks].sort((a, b) => {
        if (sortBy === 'priority') return PRIORITY_ORDER[a.priority.toLowerCase()] - PRIORITY_ORDER[b.priority.toLowerCase()];
        if (sortBy === 'date') return new Date(a.datetime) - new Date(b.datetime);
        if (sortBy === 'subject') return a.subject.localeCompare(b.subject);
        if (sortBy === 'added') return b.id.localeCompare(a.id);
    });
}

function renderTasks() {
    plannerTaskList.innerHTML = '';
    dashboardTaskList.innerHTML = '';
    focusTaskSelect.innerHTML = '<option value="">Select a task...</option>';

    const pendingTasks = getSortedTasks().filter(t => !t.completed);

    // Render Planner
    pendingTasks.forEach(task => {
        const itemHtml = createTaskHTML(task);
        plannerTaskList.insertAdjacentHTML('beforeend', itemHtml);
    });

    // Render Dashboard (limit to 3 for neatness)
    pendingTasks.slice(0, 3).forEach(task => {
        const itemHtml = createTaskHTML(task);
        dashboardTaskList.insertAdjacentHTML('beforeend', itemHtml);
    });

    // Populate Select
    pendingTasks.forEach(task => {
        const option = document.createElement('option');
        option.value = task.id;
        option.textContent = task.subject;
        focusTaskSelect.appendChild(option);
    });

    // Add listeners to generated buttons
    document.querySelectorAll('.btn-complete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const taskId = e.target.closest('.task-item').dataset.id;
            completeTask(taskId);
        });
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const taskId = e.target.closest('.task-item').dataset.id;
            deleteTask(taskId);
        });
    });
}

function createTaskHTML(task) {
    const dateObj = new Date(task.datetime);
    const formattedDate = dateObj.toLocaleDateString();
    const priorityLower = task.priority.toLowerCase();
    const priorityClass = `priority-${priorityLower}`;
    
    let priorityBadgeContent = task.priority;
    if (priorityLower === 'high') priorityBadgeContent = '🔴 ' + task.priority;
    else if (priorityLower === 'medium') priorityBadgeContent = '🟡 ' + task.priority;
    else if (priorityLower === 'low') priorityBadgeContent = '🟢 ' + task.priority;

    return `
        <li class="task-item border-${priorityClass}" data-id="${task.id}">
            <div class="task-info">
                <span class="task-title">${task.subject}</span>
                <span class="task-meta">
                    <span><i class="fa-regular fa-calendar-days"></i> ${formattedDate}</span>
                    <span class="priority-badge ${priorityClass}">${priorityBadgeContent}</span>
                </span>
            </div>
            <div class="task-actions">
                <button class="btn-icon btn-complete" title="Mark as Done"><i class="fa-solid fa-check"></i></button>
                <button class="btn-icon delete btn-delete" title="Delete Task"><i class="fa-solid fa-trash"></i></button>
            </div>
        </li>
    `;
}

// --- Timer Logic ---
function updateTimerDisplay() {
    const m = Math.floor(timerTimeLeft / 60);
    const s = timerTimeLeft % 60;
    const displayStr = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    timerDisplay.textContent = displayStr;
    quickTimerDisplay.textContent = displayStr;
    
    // Sync Strict Focus Timer if it exists
    const focusTimerDisplay = document.getElementById('focus-timer-display');
    if (focusTimerDisplay) focusTimerDisplay.textContent = displayStr;

    updateProgressRing();
}

function updateProgressRing() {
    const circle = progressRingValue;
    // Use getBoundingClientRect or getAttribute to handle responsive changes if needed, 
    // but r.baseVal.value should work if CSS updates it.
    // To be safe, let's recalculate circumference.
    const radius = circle.r.baseVal.value;
    const circumference = radius * 2 * Math.PI;
    
    circle.style.strokeDasharray = `${circumference} ${circumference}`;
    
    const rawFrac = timerTimeLeft / timerTotalDuration;
    const offset = circumference - rawFrac * circumference;
    circle.style.strokeDashoffset = offset;
}

function setTimerMode(mode) {
    if (isTimerRunning) return; // Disallow switching while running

    currentTimerMode = mode;
    timerTabs.forEach(tab => tab.classList.remove('active'));
    document.querySelector(`.timer-tab[data-mode="${mode}"]`).classList.add('active');

    if (mode === 'pomodoro') {
        timerTotalDuration = 25 * 60;
    } else if (mode === 'shortBreak') {
        timerTotalDuration = 5 * 60;
    } else if (mode === 'longBreak') {
        timerTotalDuration = 15 * 60;
    }

    timerTimeLeft = timerTotalDuration;
    updateTimerDisplay();
}

timerTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        setTimerMode(e.target.dataset.mode);
    });
});

timerStart.addEventListener('click', () => {
    if (isTimerRunning) return;
    
    isTimerRunning = true;
    timerStart.classList.add('hidden');
    timerPause.classList.remove('hidden');

    timerInterval = setInterval(() => {
        if (timerTimeLeft > 0) {
            timerTimeLeft--;
            updateTimerDisplay();
        } else {
            clearInterval(timerInterval);
            isTimerRunning = false;
            timerPause.classList.add('hidden');
            timerStart.classList.remove('hidden');
            
            // Session logic
            if (currentTimerMode === 'pomodoro') {
                totalFocusTimeMinutes += 25;
                updateStatsDisplay();
                alert('Focus session completed! Time for a break.');
            } else {
                alert('Break is over! Time to focus.');
            }
        }
    }, 1000);
});

timerPause.addEventListener('click', () => {
    if (!isTimerRunning) return;
    clearInterval(timerInterval);
    isTimerRunning = false;
    timerPause.classList.add('hidden');
    timerStart.classList.remove('hidden');
});

timerReset.addEventListener('click', () => {
    clearInterval(timerInterval);
    isTimerRunning = false;
    timerPause.classList.add('hidden');
    timerStart.classList.remove('hidden');
    timerTimeLeft = timerTotalDuration;
    updateTimerDisplay();
});

// Start the app logic
init();

// --- Games Logic ---
const gamesMainView = document.getElementById('games-main-view');
const gameArena = document.getElementById('game-arena');
const gameContainer = document.getElementById('game-container');
const btnPlayGame = document.querySelectorAll('.btn-play-game');
const btnExitGame = document.getElementById('btn-exit-game');
const gameOverCard = document.getElementById('game-over-card');
const btnPlayAgain = document.getElementById('btn-play-again');
const btnBackGames = document.getElementById('btn-back-games');
const arenaTitle = document.getElementById('arena-title');
const arenaTimer = document.getElementById('arena-timer');
const gameScoreMsg = document.getElementById('game-score-msg');

let currentGameId = '';
let gameScore = 0;
let gameTimeLeft = 0;
let gameTimerInterval = null;

// Game Configs
const gamesConfig = {
    memory: { title: "Memory Match", time: 60 },
    math: { title: "Math Sprint", time: 45 },
    scramble: { title: "Word Scramble", time: 30 }
};

btnPlayGame.forEach(btn => {
    btn.addEventListener('click', (e) => {
        const gameId = e.target.getAttribute('data-game');
        launchGame(gameId);
    });
});

btnExitGame.addEventListener('click', exitGame);
btnBackGames.addEventListener('click', exitGame);
btnPlayAgain.addEventListener('click', () => launchGame(currentGameId));

function exitGame() {
    clearTimeout(gameTimerInterval);
    gameArena.classList.add('hidden');
    gameOverCard.classList.add('hidden');
    gamesMainView.classList.remove('hidden');
    gameContainer.innerHTML = '';
}

function launchGame(gameId) {
    currentGameId = gameId;
    gameScore = 0;
    
    // UI Prep
    gamesMainView.classList.add('hidden');
    gameOverCard.classList.add('hidden');
    gameArena.classList.remove('hidden');
    gameContainer.classList.remove('hidden');
    
    const config = gamesConfig[gameId];
    arenaTitle.textContent = config.title;
    gameTimeLeft = config.time;
    updateGameTimerDisplay();
    
    // Clear Container
    gameContainer.innerHTML = '';
    
    // Setup specific game
    if (gameId === 'memory') setupMemoryMatch();
    if (gameId === 'math') setupMathSprint();
    if (gameId === 'scramble') setupWordScramble();
    
    // Start Timer
    clearInterval(gameTimerInterval);
    gameTimerInterval = setInterval(() => {
        gameTimeLeft--;
        updateGameTimerDisplay();
        if (gameTimeLeft <= 0) endGame();
    }, 1000);
}

function updateGameTimerDisplay() {
    const s = gameTimeLeft.toString().padStart(2, '0');
    arenaTimer.textContent = `00:${s}`;
}

function endGame() {
    clearInterval(gameTimerInterval);
    gameContainer.classList.add('hidden');
    gameOverCard.classList.remove('hidden');
    gameScoreMsg.textContent = `Score: ${gameScore}`;
}

// -- 1. Memory Match --
function setupMemoryMatch() {
    const emojis = ['🍎', '🍌', '🍉', '🍇', '🍓', '🍍', '🥥', '🥝'];
    const deck = [...emojis, ...emojis].sort(() => Math.random() - 0.5);
    
    const grid = document.createElement('div');
    grid.className = 'memory-grid';
    
    let flippedCards = [];
    let matchedPairs = 0;
    
    deck.forEach((emoji, index) => {
        const card = document.createElement('div');
        card.className = 'memory-card';
        card.dataset.value = emoji;
        card.dataset.index = index;
        card.innerHTML = `<span>${emoji}</span>`;
        
        card.addEventListener('click', () => {
            if (flippedCards.length < 2 && !card.classList.contains('flipped') && !card.classList.contains('matched')) {
                card.classList.add('flipped');
                flippedCards.push(card);
                
                if (flippedCards.length === 2) {
                    const val1 = flippedCards[0].dataset.value;
                    const val2 = flippedCards[1].dataset.value;
                    
                    if (val1 === val2) {
                        flippedCards.forEach(c => c.classList.add('matched'));
                        flippedCards = [];
                        matchedPairs++;
                        gameScore = matchedPairs * 10;
                        if (matchedPairs === emojis.length) {
                            setTimeout(endGame, 500); // Win condition
                        }
                    } else {
                        setTimeout(() => {
                            flippedCards.forEach(c => c.classList.remove('flipped'));
                            flippedCards = [];
                        }, 800);
                    }
                }
            }
        });
        grid.appendChild(card);
    });
    
    gameContainer.appendChild(grid);
}

// -- 2. Math Sprint --
function setupMathSprint() {
    const wrapper = document.createElement('div');
    wrapper.className = 'focus-game-wrapper';
    
    const prompt = document.createElement('div');
    prompt.className = 'focus-game-prompt';
    
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'focus-game-input';
    input.placeholder = 'Answer here...';
    
    const scoreDisplay = document.createElement('div');
    scoreDisplay.className = 'focus-score-counter';
    scoreDisplay.textContent = `Score: 0`;
    
    wrapper.appendChild(prompt);
    wrapper.appendChild(input);
    wrapper.appendChild(scoreDisplay);
    gameContainer.appendChild(wrapper);
    
    let currentAnswer = 0;
    
    function generateProblem() {
        const ops = ['+', '-', '*'];
        const op = ops[Math.floor(Math.random() * ops.length)];
        let a = Math.floor(Math.random() * 12) + 2;
        let b = Math.floor(Math.random() * 12) + 2;
        
        if (op === '-') {
            // ensure positive answer
            if (a < b) { const temp = a; a = b; b = temp; }
            currentAnswer = a - b;
        } else if (op === '+') {
            currentAnswer = a + b;
        } else {
            currentAnswer = a * b;
        }
        
        prompt.textContent = `${a} ${op === '*' ? '×' : op} ${b}`;
    }
    
    generateProblem();
    
    // Timeout to ensure it focuses after paint
    setTimeout(() => input.focus(), 100);
    
    input.addEventListener('input', () => {
        if (parseInt(input.value) === currentAnswer) {
            gameScore++;
            scoreDisplay.textContent = `Score: ${gameScore}`;
            input.value = '';
            generateProblem();
        }
    });
}

// -- 3. Word Scramble --
function setupWordScramble() {
    const words = ['FOCUS', 'STUDY', 'BRAIN', 'SMART', 'LEARN', 'THINK', 'SOLVE', 'POWER', 'LOGIC', 'SKILL', 'TRACK', 'NOTES'];
    
    const wrapper = document.createElement('div');
    wrapper.className = 'focus-game-wrapper';
    
    const prompt = document.createElement('div');
    prompt.className = 'focus-game-prompt';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'focus-game-input';
    input.placeholder = 'Unscramble...';
    
    const scoreDisplay = document.createElement('div');
    scoreDisplay.className = 'focus-score-counter';
    scoreDisplay.textContent = `Score: 0`;
    
    wrapper.appendChild(prompt);
    wrapper.appendChild(input);
    wrapper.appendChild(scoreDisplay);
    gameContainer.appendChild(wrapper);
    
    let currentWord = '';
    
    function scrambleWord(word) {
        let arr = word.split('');
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr.join('');
    }
    
    function generateScramble() {
        currentWord = words[Math.floor(Math.random() * words.length)];
        let scrambled = scrambleWord(currentWord);
        // Ensure it actually scrambled
        while (scrambled === currentWord) {
            scrambled = scrambleWord(currentWord);
        }
        prompt.textContent = scrambled;
    }
    
    generateScramble();
    setTimeout(() => input.focus(), 100);
    
    input.addEventListener('input', () => {
        if (input.value.trim().toUpperCase() === currentWord) {
            gameScore++;
            scoreDisplay.textContent = `Score: ${gameScore}`;
            input.value = '';
            generateScramble();
        }
    });
}

// --- Strict Focus Mode Logic ---
const enterFocusBtn = document.getElementById('enter-focus-btn');
const focusOverlay = document.getElementById('focus-overlay');
const exitFocusBtn = document.getElementById('exit-focus-btn');
const focusHeader = document.getElementById('focus-header');

if (enterFocusBtn) {
    enterFocusBtn.addEventListener('click', () => {
        document.body.classList.add('focus-active');
        focusOverlay.classList.remove('hidden');
        if (!isTimerRunning) {
            timerStart.click();
        }
    });
}

if (exitFocusBtn) {
    exitFocusBtn.addEventListener('click', () => {
        document.body.classList.remove('focus-active');
        focusOverlay.classList.add('hidden');
        if (isTimerRunning) {
            timerPause.click(); // Pause timer on exit, do not reset
        }
    });
}

// Block browser exit / reload
window.addEventListener('beforeunload', (e) => {
    if (document.body.classList.contains('focus-active')) {
        e.preventDefault();
        e.returnValue = ''; 
    }
});

// Flash warning if tab is minimized/switched
document.addEventListener('visibilitychange', () => {
    if (document.hidden && document.body.classList.contains('focus-active')) {
        const originalText = focusHeader.textContent;
        focusHeader.textContent = 'Come back! 👀';
        setTimeout(() => {
            focusHeader.textContent = originalText;
        }, 3000);
    }
});
