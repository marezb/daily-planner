let gasUrl = "";
let gasToken = "";
try {
    gasUrl = localStorage.getItem('gas_url') || "";
    gasToken = localStorage.getItem('gas_token') || "";
} catch (e) {
    console.warn("localStorage niedostępny (np. zablokowany w trybie Incognito/Prywatnym)");
}

let loadedFiles = {}; // { 'data_2026_06.json': { data: {} } }
let futureTasks = [];
let currentHalfWeekStart = getStartOfHalfWeek(new Date());

const configApiBtn = document.getElementById("config-api-btn");
const futureLogBtn = document.getElementById("future-log-btn");
const mainWrapper = document.getElementById("main-wrapper");
const daysContainer = document.getElementById("days-container");
const prevHalfBtn = document.getElementById("prev-half");
const nextHalfBtn = document.getElementById("next-half");
const todayBtn = document.getElementById("today-btn");
const loadingIndicator = document.getElementById("loading");
const globalTodayDisplay = document.getElementById("global-today-display");

// Panel
const futurePanel = document.getElementById("future-panel");
const closeFutureBtn = document.getElementById("close-future-btn");
const futureTasksContainer = document.getElementById("future-tasks-container");
const addFutureTaskBtn = document.getElementById("add-future-task-btn");

function showLoading() { loadingIndicator.classList.remove("hidden"); }
function hideLoading() { loadingIndicator.classList.add("hidden"); }

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${d}`;
}

function getFilenameForDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `data_${year}_${month}.json`;
}

function formatDisplayDate(date) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = days[date.getDay()];
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${dayName} ${d}.${m}`;
}

function getStartOfHalfWeek(date) {
    const d = new Date(date);
    d.setHours(0,0,0,0);
    const day = d.getDay();
    const isoDay = day === 0 ? 7 : day;
    
    if (isoDay <= 3) {
        d.setDate(d.getDate() - (isoDay - 1));
    } else {
        d.setDate(d.getDate() - (isoDay - 4));
    }
    return d;
}

function getHalfWeekDates(startDate) {
    const dates = [];
    const isoDay = startDate.getDay() === 0 ? 7 : startDate.getDay();
    const count = (isoDay <= 3) ? 3 : 4;
    
    for (let i = 0; i < count; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        dates.push(d);
    }
    return dates;
}

window.onload = () => {
    const today = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    globalTodayDisplay.textContent = `${days[today.getDay()]} ${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;
    
    if (gasUrl && gasToken) {
        initializeApp();
    }
};

configApiBtn.addEventListener("click", () => {
    const url = prompt("Wklej pełny adres URL (Web App) ze skryptu Google Apps Script:", gasUrl);
    if (url !== null && url.trim() !== "") {
        const token = prompt("Podaj swój tajny klucz (Token API):", gasToken);
        if (token !== null && token.trim() !== "") {
            gasUrl = url.trim();
            gasToken = token.trim();
            try {
                localStorage.setItem('gas_url', gasUrl);
                localStorage.setItem('gas_token', gasToken);
            } catch (e) {
                console.warn("Nie można zapisać w localStorage");
            }
            initializeApp();
        }
    }
});

async function initializeApp() {
    configApiBtn.classList.add("hidden");
    futureLogBtn.classList.remove("hidden");
    mainWrapper.classList.remove("hidden");
    
    new Sortable(futureTasksContainer, {
        group: 'shared',
        handle: '.drag-handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: handleDragEnd
    });

    await loadFutureLog();
    await loadHalfWeek(currentHalfWeekStart);
    
    setTimeout(() => {
        const dzisString = formatDate(new Date());
        const dzisCard = document.querySelector(`.day-card[data-date="${dzisString}"]`);
        if (dzisCard) {
            dzisCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }, 200);
}

function closePanel() {
    futurePanel.classList.add("hidden");
    futureLogBtn.classList.remove("active");
}

futureLogBtn.addEventListener("click", () => {
    futurePanel.classList.toggle("hidden");
    futureLogBtn.classList.toggle("active");
    if (!futurePanel.classList.contains("hidden")) {
        setTimeout(() => {
            renderFutureTasks();
            futurePanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
    }
});

closeFutureBtn.addEventListener("click", closePanel);

// ----------------------------------------------------
// GOOGLE APPS SCRIPT API CALLS
// ----------------------------------------------------

async function fetchFromGAS(action, filename, payload = null) {
    if (!gasUrl || !gasToken) {
        console.warn(`[GAS] Brak konfiguracji API (url=${!!gasUrl}, token=${!!gasToken})`);
        return null;
    }
    try {
        const url = new URL(gasUrl);
        url.searchParams.append('action', action);
        url.searchParams.append('filename', filename);
        url.searchParams.append('token', gasToken);
        
        const fetchOptions = {
            redirect: 'follow'
        };
        
        if (action === 'GET') {
            fetchOptions.method = 'GET';
        } else if (action === 'POST') {
            fetchOptions.method = 'POST';
            fetchOptions.body = JSON.stringify(payload);
        }
        
        console.log(`[GAS] ${action} ${filename}...`);
        const response = await fetch(url.toString(), fetchOptions);
        
        if (!response.ok) {
            console.error(`[GAS] HTTP error ${response.status} for ${filename}`);
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        // GAS web apps sometimes return text/html instead of application/json
        const responseText = await response.text();
        console.log(`[GAS] Raw response for ${filename}:`, responseText.substring(0, 500));
        
        let json;
        try {
            json = JSON.parse(responseText);
        } catch (parseErr) {
            console.error(`[GAS] Response for ${filename} is not valid JSON:`, responseText.substring(0, 200));
            return null;
        }
        
        if (!json.success) {
            console.warn(`[GAS] Server returned success=false for ${filename}:`, json.error || 'brak szczegółów');
            return null;
        }
        
        console.log(`[GAS] OK ${filename}, data type: ${Array.isArray(json.data) ? 'array' : typeof json.data}`);
        return json.data;
    } catch (err) {
        console.error(`[GAS] Błąd połączenia dla ${filename}:`, err);
        return null;
    }
}

/**
 * Extracts a flat array of tasks from various possible GAS response formats.
 * Handles: direct array, object with nested array, object with numeric keys, null/undefined.
 */
function extractTasksArray(data) {
    // Direct array — ideal case
    if (Array.isArray(data)) return data;
    
    // Null, undefined, empty string, etc.
    if (!data || typeof data !== 'object') return [];
    
    // Object wrapping: { data: [...] }, { future_log: [...] }, { tasks: [...] }, { items: [...] }
    for (const key of ['data', 'future_log', 'tasks', 'items']) {
        if (Array.isArray(data[key])) return data[key];
    }
    
    // Object with numeric keys (GAS sometimes serializes arrays as objects): {"0": {...}, "1": {...}}
    const keys = Object.keys(data);
    if (keys.length > 0 && keys.every(k => /^\d+$/.test(k))) {
        return keys
            .sort((a, b) => Number(a) - Number(b))
            .map(k => data[k])
            .filter(item => item && typeof item === 'object');
    }
    
    console.warn('[FutureLog] Nierozpoznany format danych:', JSON.stringify(data).substring(0, 300));
    return [];
}

async function loadFutureLog() {
    console.log('[FutureLog] Ładowanie future_log.json...');
    const data = await fetchFromGAS('GET', 'future_log.json');
    
    futureTasks = extractTasksArray(data);
    console.log(`[FutureLog] Załadowano ${futureTasks.length} zadań`);
    
    sortTasksArray(futureTasks);
    renderFutureTasks();
}

async function saveFutureTasks() {
    await fetchFromGAS('POST', 'future_log.json', futureTasks);
}

// ----------------------------------------------------
// LOGIKA WIDOKU (MULTI-DAY)
// ----------------------------------------------------

async function loadHalfWeek(startDate) {
    showLoading();
    
    const dates = getHalfWeekDates(startDate);
    const filenamesToFetch = [...new Set(dates.map(d => getFilenameForDate(d)))];
    
    for (const filename of filenamesToFetch) {
        if (!loadedFiles[filename]) {
            const data = await fetchFromGAS('GET', filename) || {};
            loadedFiles[filename] = { data: data };
        }
    }
    
    renderDays(dates);
    hideLoading();
}

function getTasksForDate(dateStr) {
    const d = new Date(dateStr);
    const filename = getFilenameForDate(d);
    if (!loadedFiles[filename]) return [];
    if (!loadedFiles[filename].data[dateStr]) {
        loadedFiles[filename].data[dateStr] = [];
    }
    return loadedFiles[filename].data[dateStr];
}

async function saveTasksForDate(dateStr) {
    const d = new Date(dateStr);
    const filename = getFilenameForDate(d);
    const fileInfo = loadedFiles[filename];
    if (fileInfo) {
        await fetchFromGAS('POST', filename, fileInfo.data);
    }
}


function sortTasksArray(arr) {
    arr.sort((a, b) => {
        const stateA = a.state || 0;
        const stateB = b.state || 0;
        if (stateA !== stateB) return stateA - stateB;
        
        const orderA = a.Order !== undefined ? a.Order : 999999;
        const orderB = b.Order !== undefined ? b.Order : 999999;
        return orderA - orderB;
    });
}

function handleDragEnd(evt) {
    const sourceContainer = evt.from;
    const targetContainer = evt.to;
    
    const sourceIsFuture = sourceContainer.id === 'future-tasks-container';
    const targetIsFuture = targetContainer.id === 'future-tasks-container';
    
    const sourceDate = sourceContainer.dataset.date;
    const targetDate = targetContainer.dataset.date;
    
    let sourceArr = sourceIsFuture ? futureTasks : getTasksForDate(sourceDate);
    let targetArr = targetIsFuture ? futureTasks : getTasksForDate(targetDate);
    
    if (sourceContainer === targetContainer) {
        // Move within same container
        const item = sourceArr.splice(evt.oldIndex, 1)[0];
        targetArr.splice(evt.newIndex, 0, item);
    } else {
        // Migration to another day/future log
        const originalItem = sourceArr[evt.oldIndex];
        
        // Deep copy the item for the new day
        const copiedTask = JSON.parse(JSON.stringify(originalItem));
        copiedTask.state = 0; // Reset state
        delete copiedTask.was_migrated;
        
        // Insert copied task at the new position
        targetArr.splice(evt.newIndex, 0, copiedTask);
        
        if (sourceIsFuture || targetIsFuture) {
            // Task opuszcza Future Log ALBO do niego wraca - w obu przypadkach jest to przeniesienie fizyczne (bez szarej ikony migracji)
            sourceArr.splice(evt.oldIndex, 1);
        } else {
            // Mark original task as migrated (jeśli to był normalny dzień na inny normalny dzień)
            originalItem.state = 2; // Migrated state (▶)
            originalItem.was_migrated = true;
        }
    }
    
    // Update order
    sourceArr.forEach((t, i) => t.Order = i);
    targetArr.forEach((t, i) => t.Order = i);
    
    if (sourceIsFuture || targetIsFuture) saveFutureTasks();
    if (!sourceIsFuture) saveTasksForDate(sourceDate);
    if (!targetIsFuture && sourceDate !== targetDate) saveTasksForDate(targetDate);
    
    renderDays(getHalfWeekDates(currentHalfWeekStart));
    renderFutureTasks();
}

function createTaskElement(task, index, isFuture, dateStr = null) {
    const div = document.createElement('div');
    div.className = `task-item ${task.state === 1 ? 'completed' : (task.state === 2 ? 'migrated' : '')}`;
    
    const dragHandle = document.createElement('div');
    dragHandle.className = 'drag-handle';
    dragHandle.innerHTML = '☰';
    
    const stateBtn = document.createElement('button');
    stateBtn.className = 'task-state';
    stateBtn.textContent = task.state === 1 ? '✓' : (task.state === 2 ? '▶' : '•');
    stateBtn.onclick = () => cycleState(index, isFuture, dateStr);
    
    const textInput = document.createElement('textarea');
    textInput.className = 'task-text';
    textInput.value = task.text;
    textInput.rows = 1;
    
    textInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
    
    textInput.addEventListener('blur', (e) => {
        const newVal = e.target.value.trim();
        if (newVal === "") {
            // Automatyczne kasowanie pustego zadania po odkliknięciu
            if (isFuture) {
                futureTasks.splice(index, 1);
                renderFutureTasks();
                saveFutureTasks();
            } else {
                getTasksForDate(dateStr).splice(index, 1);
                renderDays(getHalfWeekDates(currentHalfWeekStart));
                saveTasksForDate(dateStr);
            }
        } else {
            // Zapisanie tekstu po edycji
            if (isFuture) {
                if (futureTasks[index].text !== newVal) {
                    futureTasks[index].text = newVal;
                    saveFutureTasks();
                }
            } else {
                if (getTasksForDate(dateStr)[index].text !== newVal) {
                    getTasksForDate(dateStr)[index].text = newVal;
                    saveTasksForDate(dateStr);
                }
            }
        }
    });
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.innerHTML = '✕';
    deleteBtn.onclick = () => {
        if(task.text.trim() === "" || confirm("Czy na pewno chcesz usunąć to zadanie?")) {
            if (isFuture) {
                futureTasks.splice(index, 1);
                renderFutureTasks();
                saveFutureTasks();
            } else {
                getTasksForDate(dateStr).splice(index, 1);
                renderDays(getHalfWeekDates(currentHalfWeekStart));
                saveTasksForDate(dateStr);
            }
        }
    };
    
    div.appendChild(stateBtn);
    div.appendChild(textInput);
    div.appendChild(dragHandle);
    div.appendChild(deleteBtn);
    
    return div;
}

function renderDays(dates) {
    daysContainer.innerHTML = '';
    
    dates.forEach(dateObj => {
        const dateStr = formatDate(dateObj);
        const tasks = getTasksForDate(dateStr);
        sortTasksArray(tasks);
        
        const card = document.createElement('div');
        card.className = 'day-card';
        if (dateStr === formatDate(new Date())) {
            card.classList.add('today-card');
        }
        card.dataset.date = dateStr;
        
        const header = document.createElement('div');
        header.className = 'day-header';
        const doneCount = tasks.filter(t => t.state === 1 || t.state === 2).length;
        const totalCount = tasks.length;
        const isDayDone = totalCount > 0 && doneCount === totalCount;
        
        header.innerHTML = `<span>${isDayDone ? '✓ ' : ''}${formatDisplayDate(dateObj)}</span><span>${doneCount}/${totalCount}</span>`;
        if (isDayDone) {
            header.style.color = 'var(--muted-text)';
        }
        

        header.onclick = () => {
            const isFullscreen = card.classList.contains('fullscreen');
            document.querySelectorAll('.day-card').forEach(c => c.style.display = 'flex');
            
            if (!isFullscreen) {
                card.classList.add('fullscreen');
                document.querySelectorAll('.day-card').forEach(c => {
                    if (c !== card) c.style.display = 'none';
                });
                setTimeout(() => card.querySelectorAll('.task-text').forEach(ta => ta.dispatchEvent(new Event('input'))), 10);
            } else {
                card.classList.remove('fullscreen');
                setTimeout(() => document.querySelectorAll('.day-card .task-text').forEach(ta => ta.dispatchEvent(new Event('input'))), 10);
            }
        };
        
        const tContainer = document.createElement('div');
        tContainer.className = 'tasks-container';
        tContainer.dataset.date = dateStr;
        
        tasks.forEach((task, index) => {
            const el = createTaskElement(task, index, false, dateStr);
            tContainer.appendChild(el);
            setTimeout(() => el.querySelector('.task-text').dispatchEvent(new Event('input')), 0);
        });
        
        new Sortable(tContainer, {
            group: 'shared',
            handle: '.drag-handle',
            animation: 150,
            ghostClass: 'sortable-ghost',
            onEnd: handleDragEnd
        });
        
        const addBtn = document.createElement('button');
        addBtn.className = 'text-add-btn';
        addBtn.textContent = '+ Add task';
        addBtn.onclick = () => {
            const arr = getTasksForDate(dateStr);
            arr.push({text: "", state: 0, Order: arr.length});
            sortTasksArray(arr);
            saveTasksForDate(dateStr);
            renderDays(getHalfWeekDates(currentHalfWeekStart));
            
            const dayCard = document.querySelector(`.day-card[data-date="${dateStr}"]`);
            if (dayCard) {
                const emptyTextareas = Array.from(dayCard.querySelectorAll('.task-text')).filter(ta => ta.value === "");
                if (emptyTextareas.length > 0) {
                    emptyTextareas[emptyTextareas.length - 1].focus();
                }
            }
        };
        
        card.appendChild(header);
        card.appendChild(tContainer);
        card.appendChild(addBtn);
        daysContainer.appendChild(card);
    });
}

function renderFutureTasks() {
    futureTasksContainer.innerHTML = '';
    futureTasks.forEach((task, index) => {
        const el = createTaskElement(task, index, true);
        futureTasksContainer.appendChild(el);
        setTimeout(() => el.querySelector('.task-text').dispatchEvent(new Event('input')), 0);
    });
}

async function cycleState(index, isFuture, dateStr = null) {
    if (isFuture) {
        const task = futureTasks[index];
        task.state = (task.state + 1) % 3;
        sortTasksArray(futureTasks);
        renderFutureTasks();
        saveFutureTasks();
    } else {
        const task = getTasksForDate(dateStr)[index];
        task.state = (task.state + 1) % 3;
        sortTasksArray(getTasksForDate(dateStr));
        renderDays(getHalfWeekDates(currentHalfWeekStart));
        saveTasksForDate(dateStr);
    }
}



prevHalfBtn.addEventListener("click", () => {
    currentHalfWeekStart.setDate(currentHalfWeekStart.getDate() - (currentHalfWeekStart.getDay() <= 3 && currentHalfWeekStart.getDay() > 0 ? 4 : 3));
    currentHalfWeekStart = getStartOfHalfWeek(currentHalfWeekStart);
    loadHalfWeek(currentHalfWeekStart);
});

nextHalfBtn.addEventListener("click", () => {
    currentHalfWeekStart.setDate(currentHalfWeekStart.getDate() + (currentHalfWeekStart.getDay() <= 3 && currentHalfWeekStart.getDay() > 0 ? 3 : 4));
    currentHalfWeekStart = getStartOfHalfWeek(currentHalfWeekStart);
    loadHalfWeek(currentHalfWeekStart);
});

todayBtn.addEventListener("click", () => {
    currentHalfWeekStart = getStartOfHalfWeek(new Date());
    loadHalfWeek(currentHalfWeekStart).then(() => {
        // Opóźnienie na render layoutu przez przeglądarkę
        setTimeout(() => {
            const dzisString = formatDate(new Date());
            const dzisCard = document.querySelector(`.day-card[data-date="${dzisString}"]`);
            if (dzisCard) {
                dzisCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }, 150);
    });
});

addFutureTaskBtn.addEventListener("click", () => {
    futureTasks.push({text: "", state: 0, Order: futureTasks.length});
    sortTasksArray(futureTasks);
    renderFutureTasks();
    saveFutureTasks();
    
    const emptyTextareas = Array.from(futureTasksContainer.querySelectorAll('.task-text')).filter(ta => ta.value === "");
    if (emptyTextareas.length > 0) {
        emptyTextareas[emptyTextareas.length - 1].focus();
    }
});

// ----------------------------------------------------
// GOOGLE DRIVE API CALLS
// ----------------------------------------------------

// ----------------------------------------------------
// SWIPE GESTURES & FULLSCREEN
// ----------------------------------------------------

let touchstartX = 0;
let touchstartY = 0;
let touchendX = 0;
let touchendY = 0;
let touchstartScrollY = 0;

document.addEventListener('touchstart', e => {
    touchstartX = e.changedTouches[0].screenX;
    touchstartY = e.changedTouches[0].screenY;
    touchstartScrollY = window.scrollY;
}, {passive: true});

document.addEventListener('touchend', e => {
    touchendX = e.changedTouches[0].screenX;
    touchendY = e.changedTouches[0].screenY;
    handleGesture();
});

function handleGesture() {
    const diffX = touchendX - touchstartX;
    const diffY = touchendY - touchstartY;
    const absDiffX = Math.abs(diffX);
    const absDiffY = Math.abs(diffY);
    
    // Zdejmij focus z pola tekstowego, jeśli gest był wyraźnym przesunięciem ekranu
    if (Math.max(absDiffX, absDiffY) > 40 && document.activeElement && document.activeElement.tagName === 'TEXTAREA') {
        document.activeElement.blur();
    }
    
    // Jeśli ruch był bardziej w pionie (scrollowanie lub pull-to-refresh)
    if (absDiffY > absDiffX) {
        // Pull-to-refresh: szybki ruch w dół, będąc na samej górze
        if (diffY > 100 && touchstartScrollY <= 0) {
            console.log("Pull to refresh triggered");
            initializeApp();
        }
        return;
    }
    
    // Ignoruj bardzo krótkie machnięcia w poziomie
    if (absDiffX < 40) return;
    
    if (diffX < -40) {
        handleSwipeNext();
    } else if (diffX > 40) {
        handleSwipePrev();
    }
}

function handleSwipeNext() {
    const fullscreenCard = document.querySelector('.day-card.fullscreen');
    if (fullscreenCard) {
        document.querySelectorAll('.day-card').forEach(c => c.style.display = 'flex');
        const nextCard = fullscreenCard.nextElementSibling;
        if (nextCard && nextCard.classList.contains('day-card')) {
            fullscreenCard.classList.remove('fullscreen');
            nextCard.classList.add('fullscreen');
            document.querySelectorAll('.day-card').forEach(c => {
                if (c !== nextCard) c.style.display = 'none';
            });
            setTimeout(() => nextCard.querySelectorAll('.task-text').forEach(ta => ta.dispatchEvent(new Event('input'))), 10);
        } else {
            currentHalfWeekStart.setDate(currentHalfWeekStart.getDate() + (currentHalfWeekStart.getDay() <= 3 && currentHalfWeekStart.getDay() > 0 ? 3 : 4));
            currentHalfWeekStart = getStartOfHalfWeek(currentHalfWeekStart);
            loadHalfWeek(currentHalfWeekStart).then(() => {
                const cards = document.querySelectorAll('.day-card');
                if (cards.length > 0) cards[0].querySelector('.day-header').click();
            });
        }
    } else {
        nextHalfBtn.click();
    }
}

function handleSwipePrev() {
    const fullscreenCard = document.querySelector('.day-card.fullscreen');
    if (fullscreenCard) {
        document.querySelectorAll('.day-card').forEach(c => c.style.display = 'flex');
        const prevCard = fullscreenCard.previousElementSibling;
        if (prevCard && prevCard.classList.contains('day-card')) {
            fullscreenCard.classList.remove('fullscreen');
            prevCard.classList.add('fullscreen');
            document.querySelectorAll('.day-card').forEach(c => {
                if (c !== prevCard) c.style.display = 'none';
            });
            setTimeout(() => prevCard.querySelectorAll('.task-text').forEach(ta => ta.dispatchEvent(new Event('input'))), 10);
        } else {
            currentHalfWeekStart.setDate(currentHalfWeekStart.getDate() - (currentHalfWeekStart.getDay() <= 3 && currentHalfWeekStart.getDay() > 0 ? 4 : 3));
            currentHalfWeekStart = getStartOfHalfWeek(currentHalfWeekStart);
            loadHalfWeek(currentHalfWeekStart).then(() => {
                const cards = document.querySelectorAll('.day-card');
                if (cards.length > 0) cards[cards.length - 1].querySelector('.day-header').click();
            });
        }
    } else {
        prevHalfBtn.click();
    }
}
