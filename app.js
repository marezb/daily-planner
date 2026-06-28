const CLIENT_ID = '263456020482-d304dup1jkkgdk0no23c25q0goa6cboh.apps.googleusercontent.com';
// Wymagane uprawnienia do wyszukiwania, odczytu i zapisu plików
const SCOPES = 'https://www.googleapis.com/auth/drive';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest';

let tokenClient;
let gapiInited = false;
let gisInited = false;
let loadedFiles = {}; // { 'data_2026_06.json': { id: '...', data: {} } }
let futureTasks = [];
let futureFileId = null;
let currentHalfWeekStart = getStartOfHalfWeek(new Date());

const loginBtn = document.getElementById("login-btn");
const logoutBtn = document.getElementById("logout-btn");
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

// Inicjalizacja biblioteki GAPI (Google API)
function gapiLoaded() {
    gapi.load('client', initializeGapiClient);
}

async function initializeGapiClient() {
    await gapi.client.init({
        discoveryDocs: [DISCOVERY_DOC],
    });
    gapiInited = true;
    maybeEnableButtons();
}

// Inicjalizacja biblioteki GIS (Google Identity Services)
function gisLoaded() {
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: '',
    });
    gisInited = true;
    maybeEnableButtons();
}

function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        loginBtn.disabled = false;
        
        const savedToken = localStorage.getItem('gapi_token');
        if (savedToken) {
            const tokenObj = JSON.parse(savedToken);
            if (tokenObj.expires_at > Date.now()) {
                gapi.client.setToken({ access_token: tokenObj.access_token });
                onAuthenticated();
                return;
            } else {
                localStorage.removeItem('gapi_token');
            }
        }
    }
}

window.onload = () => {
    loginBtn.disabled = true;
    if (typeof gapi !== 'undefined') gapiLoaded();
    if (typeof google !== 'undefined') gisLoaded();
    
    // Set global header
    const today = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    globalTodayDisplay.textContent = `${days[today.getDay()]} ${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`;
};

loginBtn.addEventListener("click", () => {
    tokenClient.callback = async (resp) => {
        if (resp.error !== undefined) {
            throw (resp);
        }
        // Zapisz token
        const expiresAt = Date.now() + (resp.expires_in * 1000);
        localStorage.setItem('gapi_token', JSON.stringify({
            access_token: resp.access_token,
            expires_at: expiresAt
        }));
        
        onAuthenticated();
    };

    if (gapi.client.getToken() === null) {
        tokenClient.requestAccessToken({prompt: 'consent'});
    } else {
        tokenClient.requestAccessToken({prompt: ''});
    }
});

function refreshGoogleToken() {
    return new Promise((resolve, reject) => {
        tokenClient.callback = (resp) => {
            if (resp.error) {
                reject(resp.error);
                return;
            }
            const expiresAt = Date.now() + (resp.expires_in * 1000);
            localStorage.setItem('gapi_token', JSON.stringify({
                access_token: resp.access_token,
                expires_at: expiresAt
            }));
            // Update the global gapi client token
            gapi.client.setToken({ access_token: resp.access_token });
            resolve(resp.access_token);
        };
        tokenClient.requestAccessToken({prompt: ''});
    });
}

// Usunięto przestarzały logoutBtn.addEventListener

async function onAuthenticated() {
    loginBtn.classList.add("hidden");
    if(logoutBtn) logoutBtn.classList.remove("hidden");
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
    
    // Automatyczne zjechanie do dnia dzisiejszego zaraz po uruchomieniu aplikacji
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
}

futureLogBtn.addEventListener("click", () => {
    futurePanel.classList.toggle("hidden");
    if (!futurePanel.classList.contains("hidden")) {
        // Zamiast walczyć z przeliczaniem wysokości na ukrytych elementach,
        // po prostu rysujemy cały Future Log na nowo, gdy panel staje się widoczny!
        setTimeout(() => {
            renderFutureTasks();
            futurePanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
    }
});

closeFutureBtn.addEventListener("click", closePanel);

async function loadFutureLog() {
    futureFileId = await findFileId("future_log.json");
    if (futureFileId) {
        futureTasks = await fetchJsonFromGoogleDrive(futureFileId);
        if (!Array.isArray(futureTasks)) futureTasks = [];
    } else {
        futureTasks = [];
    }
    sortTasksArray(futureTasks);
    renderFutureTasks();
}

// ----------------------------------------------------
// GOOGLE DRIVE API CALLS
// ----------------------------------------------------

// Znajdź plik na Dysku Google po nazwie (zwraca ID pliku)
async function findFileId(filename) {
    let response;
    try {
        response = await gapi.client.drive.files.list({
            q: `name='${filename}' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive',
        });
    } catch (err) {
        console.error("Błąd wyszukiwania pliku:", err);
        return null;
    }
    const files = response.result.files;
    if (files && files.length > 0) {
        return files[0].id;
    } else {
        return null;
    }
}

// Pobierz zawartość (zawartość JSON)
async function fetchJsonFromGoogleDrive(fileId) {
    try {
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });
        
        // Czasami Google Drive API zwraca string dla JSON-a, jeśli był pobierany jako media.
        if (typeof response.result === 'string') {
            return JSON.parse(response.result);
        }
        return response.result;
    } catch (err) {
        console.error("Błąd pobierania zawartości:", err);
        return {};
    }
}

// Zaktualizuj zawartość pliku (PATCH media)
async function saveJsonToGoogleDrive(fileId, data, isRetry = false) {
    try {
        const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
        const token = gapi.client.getToken().access_token;
        
        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data, null, 4)
        });
        
        if (response.status === 401 && !isRetry) {
            console.log("Token wygasł, próbuję odnowić w tle...");
            try {
                await refreshGoogleToken();
                return await saveJsonToGoogleDrive(fileId, data, true);
            } catch (refreshErr) {
                console.error("Nie udało się odnowić tokenu", refreshErr);
                alert("Sesja Google wygasła. Kliknij Wyloguj i Zaloguj ponownie.");
                return;
            }
        }
        
        if (!response.ok) throw new Error("Błąd zapisu do chmury Google!");
    } catch (err) {
        console.error("Błąd zapisywania:", err);
        alert("Błąd zapisu! Zobacz konsolę.");
    }
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
            const fileId = await findFileId(filename);
            let data = {};
            if (fileId) {
                data = await fetchJsonFromGoogleDrive(fileId);
            }
            loadedFiles[filename] = { id: fileId, data: data };
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
    if (fileInfo && fileInfo.id) {
        saveJsonToGoogleDrive(fileInfo.id, fileInfo.data);
    } else {
        console.warn(`Plik ${filename} nie ma ID, zmiany na ten miesiąc nie zostaną zapisane w PWA.`);
    }
}

function sortTasksArray(arr) {
    arr.sort((a, b) => {
        const stateA = a.state || 0;
        const stateB = b.state || 0;
        if (stateA !== stateB) return stateA - stateB;
        return (a.Order || 999999) - (b.Order || 999999);
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
    
    div.appendChild(dragHandle);
    div.appendChild(stateBtn);
    div.appendChild(textInput);
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
            } else {
                card.classList.remove('fullscreen');
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

async function saveFutureTasks() {
    if (!futureFileId) return;
    saveJsonToGoogleDrive(futureFileId, futureTasks);
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

function refreshGoogleToken() {
    return new Promise((resolve, reject) => {
        tokenClient.callback = (resp) => {
            if (resp.error) {
                reject(resp.error);
                return;
            }
            const expiresAt = Date.now() + (resp.expires_in * 1000);
            localStorage.setItem('gapi_token', JSON.stringify({
                access_token: resp.access_token,
                expires_at: expiresAt
            }));
            // Update the global gapi client token
            gapi.client.setToken({ access_token: resp.access_token });
            resolve(resp.access_token);
        };
        tokenClient.requestAccessToken({prompt: ''});
    });
}

async function findFileId(filename) {
    let response;
    try {
        response = await gapi.client.drive.files.list({
            q: `name='${filename}' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive'
        });
    } catch (err) {
        console.error('Błąd podczas wyszukiwania pliku', err);
        return null;
    }
    const files = response.result.files;
    if (files && files.length > 0) {
        return files[0].id;
    } else {
        return null;
    }
}

async function fetchJsonFromGoogleDrive(fileId) {
    try {
        const response = await gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });
        if (!response.body) return {};
        if (typeof response.body === 'string') {
            return JSON.parse(response.body);
        }
        return response.result;
    } catch (err) {
        console.error('Błąd podczas pobierania zawartości pliku', err);
        return {};
    }
}

async function saveJsonToGoogleDrive(fileId, dataObj) {
    const url = `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`;
    const token = gapi.client.getToken().access_token;
    
    try {
        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(dataObj)
        });
        if (response.status === 401) {
            console.warn('Token wygasł podczas zapisu, odświeżam i ponawiam...');
            const newToken = await refreshGoogleToken();
            const retryResponse = await fetch(url, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${newToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dataObj)
            });
            if (!retryResponse.ok) {
                console.error('Błąd po ponowieniu zapisu', await retryResponse.text());
            }
        } else if (!response.ok) {
            console.error('Błąd podczas zapisywania pliku', await response.text());
        }
    } catch (err) {
        console.error('Wyjątek podczas zapisywania do Google Drive', err);
    }
}

async function loadFutureLog() {
    futureFileId = await findFileId('future_log.json');
    if (futureFileId) {
        futureTasks = await fetchJsonFromGoogleDrive(futureFileId);
        if (!Array.isArray(futureTasks)) futureTasks = [];
    } else {
        futureTasks = [];
    }
    sortTasksArray(futureTasks);
    renderFutureTasks();
}

