document.addEventListener('DOMContentLoaded', () => {
    const DATA_KEY = 'waterSportsTrackerData';
    let data = loadData();
    let currentViewDate = new Date();
    let selectedDate = null;
    let editingSessionId = null;

    function loadData() {
        const stored = localStorage.getItem(DATA_KEY);
        return stored ? JSON.parse(stored) : {};
    }

    function saveData() {
        localStorage.setItem(DATA_KEY, JSON.stringify(data));
        updateSummary();
        renderCalendar();
        if (selectedDate) renderDay(selectedDate);
    }

    // Calendar functions
    function renderCalendar() {
        const month = currentViewDate.getMonth();
        const year = currentViewDate.getFullYear();
        document.getElementById('current-month').textContent = `${new Intl.DateTimeFormat('en-US', { month: 'long' }).format(currentViewDate)} ${year}`;

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const tbody = document.getElementById('calendar-body');
        tbody.innerHTML = '';

        let row = document.createElement('tr');
        for (let i = 0; i < firstDay; i++) {
            row.innerHTML += '<td></td>';
        }

        for (let day = 1; day <= daysInMonth; day++) {
            if (row.children.length === 7) {
                tbody.appendChild(row);
                row = document.createElement('tr');
            }
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const hasSessions = data[dateStr] && data[dateStr].length > 0;
            const td = document.createElement('td');
            td.textContent = day;
            if (hasSessions) td.classList.add('has-sessions');
            td.addEventListener('click', () => selectDay(dateStr));
            row.appendChild(td);
        }

        while (row.children.length < 7) {
            row.innerHTML += '<td></td>';
        }
        tbody.appendChild(row);
    }

    document.getElementById('prev-month').addEventListener('click', () => {
        currentViewDate.setMonth(currentViewDate.getMonth() - 1);
        renderCalendar();
    });

    document.getElementById('next-month').addEventListener('click', () => {
        currentViewDate.setMonth(currentViewDate.getMonth() + 1);
        renderCalendar();
    });

    function selectDay(dateStr) {
        selectedDate = dateStr;
        renderDay(dateStr);
        document.getElementById('day-view').style.display = 'block';
    }

    function renderDay(dateStr) {
        document.getElementById('day-title').textContent = `Sessions for ${dateStr}`;
        let sessionsList = data[dateStr] || [];
        // Sort sessions by time of day
        sessionsList.sort((a, b) => a.timeOfDay.localeCompare(b.timeOfDay));
        const list = document.getElementById('sessions-list');
        list.innerHTML = '';
        let dayTotal = 0;
        sessionsList.forEach((session, index) => {
            dayTotal += session.distance;
            const div = document.createElement('div');
            div.classList.add('session');
            div.innerHTML = `
                <p>Time: ${session.timeOfDay}</p>
                <p>Wind Speed: ${session.windSpeed} knots</p>
                <p>Wind Direction: ${session.windDirection}</p>
                <p>Tide: ${session.tide}</p>
                <p>Equipment: ${session.equipment}</p>
                <p>Distance: ${session.distance} miles</p>
                <p>Notes: ${session.notes || 'None'}</p>
            `;
            const editBtn = document.createElement('button');
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', () => editSession(index));
            div.appendChild(editBtn);
            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', () => deleteSession(index));
            div.appendChild(deleteBtn);
            list.appendChild(div);
        });
        document.getElementById('day-total-distance').textContent = `Total Distance Today: ${dayTotal.toFixed(1)} miles`;
    }

    // Modal and form
    const modal = document.getElementById('modal');
    const closeBtn = document.getElementsByClassName('close')[0];
    const form = document.getElementById('session-form');
    closeBtn.onclick = () => modal.style.display = 'none';
    window.onclick = (event) => {
        if (event.target === modal) modal.style.display = 'none';
    };

    document.getElementById('add-session').addEventListener('click', () => {
        editingSessionId = null;
        document.getElementById('modal-title').textContent = 'Add New Session';
        form.reset();
        modal.style.display = 'block';
    });

    function editSession(index) {
        editingSessionId = index;
        const session = data[selectedDate][index];
        document.getElementById('timeOfDay').value = session.timeOfDay;
        document.getElementById('windSpeed').value = session.windSpeed;
        document.getElementById('windDirection').value = session.windDirection;
        document.getElementById('tide').value = session.tide;
        document.getElementById('equipment').value = session.equipment;
        document.getElementById('distance').value = session.distance;
        document.getElementById('notes').value = session.notes;
        document.getElementById('modal-title').textContent = 'Edit Session';
        modal.style.display = 'block';
    }

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const session = {
            timeOfDay: document.getElementById('timeOfDay').value,
            windSpeed: parseFloat(document.getElementById('windSpeed').value),
            windDirection: document.getElementById('windDirection').value,
            tide: document.getElementById('tide').value,
            equipment: document.getElementById('equipment').value,
            distance: parseFloat(document.getElementById('distance').value),
            notes: document.getElementById('notes').value
        };
        if (!data[selectedDate]) data[selectedDate] = [];
        if (editingSessionId !== null) {
            data[selectedDate][editingSessionId] = session;
        } else {
            data[selectedDate].push(session);
        }
        modal.style.display = 'none';
        saveData();
    });

    function deleteSession(index) {
        if (confirm('Are you sure you want to delete this session?')) {
            data[selectedDate].splice(index, 1);
            if (data[selectedDate].length === 0) delete data[selectedDate];
            saveData();
        }
    }

    // Summary
    function updateSummary() {
        const now = new Date();
        const yearStart = new Date(now.getFullYear(), 0, 1);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());

        let totalYear = 0;
        let totalMonth = 0;
        let totalWeek = 0;

        Object.entries(data).forEach(([dateStr, sessions]) => {
            const date = new Date(dateStr);
            const distance = sessions.reduce((sum, s) => sum + s.distance, 0);
            if (date >= yearStart) totalYear += distance;
            if (date >= monthStart) totalMonth += distance;
            if (date >= weekStart) totalWeek += distance;
        });

        document.getElementById('total-year').textContent = totalYear.toFixed(1);
        document.getElementById('total-month').textContent = totalMonth.toFixed(1);
        document.getElementById('total-week').textContent = totalWeek.toFixed(1);
    }

    // CSV Download
    document.getElementById('download-csv').addEventListener('click', () => {
        let csv = 'Date,Session,Time of Day,Wind Speed,Wind Direction,Tide,Equipment,Distance,Notes\n';
        Object.entries(data).forEach(([date, sessions]) => {
            sessions.forEach((session, index) => {
                csv += `${date},${index + 1},${session.timeOfDay},${session.windSpeed},${session.windDirection},${session.tide},${session.equipment},${session.distance},${session.notes.replace(/\n/g, ' ')}\n`;
            });
        });
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'water_sports_data.csv';
        a.click();
        URL.revokeObjectURL(url);
    });

    // Initial render
    renderCalendar();
    updateSummary();
});
