// Simple Test Framework
let passed = 0;
let failed = 0;
const resultsDiv = document.getElementById('test-results');

function assertEqual(actual, expected, testName) {
    const isPass = JSON.stringify(actual) === JSON.stringify(expected);
    const div = document.createElement('div');
    div.className = 'test-case ' + (isPass ? 'pass' : 'fail');
    
    if (isPass) {
        div.innerHTML = `✓ ${testName}`;
        passed++;
    } else {
        div.innerHTML = `✗ ${testName} <br> <small>Expected: ${JSON.stringify(expected)} <br> Actual: ${JSON.stringify(actual)}</small>`;
        failed++;
    }
    resultsDiv.appendChild(div);
}

function runTests() {
    try {
        // --- Test: formatDate ---
        assertEqual(
            formatDate(new Date(2026, 5, 5, 12, 0, 0)), // month 5 = June
            '2026-06-05',
            'formatDate: prawidłowo formatuje jednicyfrowe dni i miesiące'
        );
        
        assertEqual(
            formatDate(new Date(2026, 9, 25, 12, 0, 0)), // month 9 = October
            '2026-10-25',
            'formatDate: prawidłowo formatuje dwucyfrowe dni i miesiące'
        );

        // --- Test: getStartOfHalfWeek ---
        assertEqual(
            formatDate(getStartOfHalfWeek(new Date(2026, 5, 29, 12, 0, 0))), // Monday June 29
            '2026-06-29',
            'getStartOfHalfWeek: Poniedziałek zwraca poniedziałek jako start'
        );
        assertEqual(
            formatDate(getStartOfHalfWeek(new Date(2026, 6, 1, 12, 0, 0))), // Wednesday July 1
            '2026-06-29', // Monday June 29
            'getStartOfHalfWeek: Środa zwraca poniedziałek jako start'
        );
        assertEqual(
            formatDate(getStartOfHalfWeek(new Date(2026, 6, 2, 12, 0, 0))), // Thursday July 2
            '2026-07-02', // Thursday July 2
            'getStartOfHalfWeek: Czwartek zwraca czwartek jako start'
        );
        assertEqual(
            formatDate(getStartOfHalfWeek(new Date(2026, 6, 5, 12, 0, 0))), // Sunday July 5
            '2026-07-02', // Thursday July 2
            'getStartOfHalfWeek: Niedziela zwraca czwartek jako start'
        );

        // --- Test: getHalfWeekDates ---
        const firstHalf = getHalfWeekDates(new Date(2026, 5, 29, 12, 0, 0)); // Mon
        assertEqual(firstHalf.length, 3, 'getHalfWeekDates: Pierwsza połowa tygodnia (Pon-Śr) ma 3 dni');
        assertEqual(formatDate(firstHalf[2]), '2026-07-01', 'getHalfWeekDates: Ostatni dzień pierwszej połowy to środa');
        
        const secondHalf = getHalfWeekDates(new Date(2026, 6, 2, 12, 0, 0)); // Thu
        assertEqual(secondHalf.length, 4, 'getHalfWeekDates: Druga połowa tygodnia (Czw-Ndz) ma 4 dni');
        assertEqual(formatDate(secondHalf[3]), '2026-07-05', 'getHalfWeekDates: Ostatni dzień drugiej połowy to niedziela');

        // --- Test: sortTasksArray ---
        const tasks = [
            { text: 'Migrated task', state: 2, Order: 0 },
            { text: 'Active task 1', state: 0, Order: 1 },
            { text: 'Completed task', state: 1, Order: 2 },
            { text: 'Active task 2', state: 0, Order: 3 }
        ];
        sortTasksArray(tasks);
        
        assertEqual(tasks[0].text, 'Active task 1', 'sortTasksArray: Aktywne zadania lądują na początku');
        assertEqual(tasks[1].text, 'Active task 2', 'sortTasksArray: Aktywne zadania zachowują relatywną kolejność');
        assertEqual(tasks[2].text, 'Completed task', 'sortTasksArray: Ukończone (1) spadają na dół, ale przed przeniesionymi (2)');
        assertEqual(tasks[3].text, 'Migrated task', 'sortTasksArray: Przeniesione (2) lądują na samym dole, po ukończonych');

    } catch (e) {
        const div = document.createElement('div');
        div.className = 'fail';
        div.innerHTML = `✗ Wyjątek podczas testów: ${e.message}`;
        resultsDiv.appendChild(div);
        console.error(e);
        failed++;
    }

    // Summary
    const summary = document.createElement('div');
    summary.className = 'summary ' + (failed === 0 ? 'pass' : 'fail');
    summary.innerHTML = `Wyniki: ${passed} zaliczonych, ${failed} oblanych.`;
    resultsDiv.appendChild(summary);
}

// Uruchom testy z opóźnieniem, żeby dać app.js załadować się na spokojnie
setTimeout(runTests, 100);
