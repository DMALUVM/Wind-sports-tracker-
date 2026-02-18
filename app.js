/* ============================================================
   AERO - Wind Sports Tracker
   Core Application Engine
   ============================================================ */

(function () {
    'use strict';

    // ─── Constants ───────────────────────────────────────────
    const STORAGE_KEYS = {
        sessions: 'aero_sessions',
        equipment: 'aero_equipment',
        spots: 'aero_spots',
        settings: 'aero_settings',
        achievements: 'aero_achievements_unlocked',
    };

    const SPORT_LABELS = {
        kitesurf: 'Kitesurf',
        wingfoil: 'Wing Foil',
        windsurf: 'Windsurf',
        foilboard: 'Foilboard',
    };

    const SPORT_EMOJIS = {
        kitesurf: '\u{1FA81}',
        wingfoil: '\u{1F985}',
        windsurf: '\u26F5',
        foilboard: '\u{1F3C4}',
    };

    const EQ_EMOJIS = {
        kite: '\u{1FA81}',
        wing: '\u{1F985}',
        board: '\u{1F3C4}',
        foil: '\u2693',
        sail: '\u26F5',
        bar: '\u{1F517}',
        wetsuit: '\u{1F9E5}',
        harness: '\u{1F4CE}',
        other: '\u2699\uFE0F',
    };

    const RATING_LABELS = ['', 'Rough', 'Meh', 'Good', 'Epic', 'Legendary!'];

    const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const DIR_DEGREES = { N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315 };

    // ─── Achievement Definitions ─────────────────────────────
    const ACHIEVEMENTS = [
        { id: 'first_session', name: 'First Splash', desc: 'Log your first session', icon: '\u{1F4A7}', check: (s) => s.length >= 1 },
        { id: 'five_sessions', name: 'Getting Hooked', desc: 'Log 5 sessions', icon: '\u{1FA9D}', check: (s) => s.length >= 5 },
        { id: 'ten_sessions', name: 'Regular Rider', desc: 'Log 10 sessions', icon: '\u{1F30A}', check: (s) => s.length >= 10 },
        { id: 'twenty_five', name: 'Committed', desc: 'Log 25 sessions', icon: '\u{1F3C6}', check: (s) => s.length >= 25 },
        { id: 'fifty_sessions', name: 'Half Century', desc: 'Log 50 sessions', icon: '\u{1F451}', check: (s) => s.length >= 50 },
        { id: 'hundred', name: 'Centurion', desc: 'Log 100 sessions', icon: '\u{1F4AF}', check: (s) => s.length >= 100 },
        { id: 'multi_sport', name: 'Versatile', desc: 'Try 2+ different sports', icon: '\u{1F3AF}', check: (s) => new Set(s.map(x => x.sport)).size >= 2 },
        { id: 'all_sports', name: 'Renaissance', desc: 'Try all 4 sports', icon: '\u{1F308}', check: (s) => new Set(s.map(x => x.sport)).size >= 4 },
        { id: 'strong_wind', name: 'Storm Chaser', desc: 'Session in 30+ knots', icon: '\u26A1', check: (s) => s.some(x => x.windSpeed >= 30) },
        { id: 'gale_force', name: 'Gale Force', desc: 'Session in 40+ knots', icon: '\u{1F32A}\uFE0F', check: (s) => s.some(x => x.windSpeed >= 40) },
        { id: 'long_session', name: 'Marathon', desc: '3+ hour session', icon: '\u23F1\uFE0F', check: (s) => s.some(x => x.duration >= 180) },
        { id: 'big_distance', name: 'Explorer', desc: 'Cover 10+ miles in one session', icon: '\u{1F9ED}', check: (s) => s.some(x => (x.distance || 0) >= 10) },
        { id: 'early_bird', name: 'Dawn Patrol', desc: 'Start before 7am', icon: '\u{1F305}', check: (s) => s.some(x => x.time && parseInt(x.time.split(':')[0]) < 7) },
        { id: 'night_rider', name: 'Sunset Session', desc: 'Start after 6pm', icon: '\u{1F307}', check: (s) => s.some(x => x.time && parseInt(x.time.split(':')[0]) >= 18) },
        { id: 'big_air', name: 'Big Air', desc: 'Jump over 5 meters', icon: '\u{1F680}', check: (s) => s.some(x => (x.maxJumpHeight || 0) > 5) },
        { id: 'mega_air', name: 'Mega Air', desc: 'Jump over 10 meters', icon: '\u{1FA82}', check: (s) => s.some(x => (x.maxJumpHeight || 0) > 10) },
        { id: 'ten_jumps', name: 'Bouncy', desc: '10+ jumps in one session', icon: '\u{1F3C3}', check: (s) => s.some(x => (x.jumpCount || 0) >= 10) },
        { id: 'perfect_rating', name: 'Legendary Day', desc: 'Rate a session 5/5', icon: '\u2B50', check: (s) => s.some(x => x.rating === 5) },
        { id: 'speed_demon', name: 'Speed Demon', desc: 'Hit 25+ knots max speed', icon: '\u{1F3CE}\uFE0F', check: (s) => s.some(x => (x.maxSpeed || 0) >= 25) },
        { id: 'three_spots', name: 'Spot Collector', desc: 'Ride 3 different spots', icon: '\u{1F4CD}', check: (s) => new Set(s.filter(x => x.spot).map(x => x.spot)).size >= 3 },
        { id: 'weekly_streak', name: '7-Day Streak', desc: 'Ride 7 days in a row', icon: '\u{1F525}', check: (s) => calcMaxStreak(s) >= 7 },
        { id: 'monthly_ten', name: 'Month of Wind', desc: '10 sessions in a month', icon: '\u{1F4C5}', check: (s) => checkMonthlyCount(s, 10) },
        { id: 'distance_50', name: 'Road Warrior', desc: '50 total miles', icon: '\u{1F6E3}\uFE0F', check: (s) => s.reduce((a, x) => a + (x.distance || 0), 0) >= 50 },
        { id: 'distance_100', name: 'Century Miles', desc: '100 total miles', icon: '\u{1F30D}', check: (s) => s.reduce((a, x) => a + (x.distance || 0), 0) >= 100 },
    ];

    // ─── State ───────────────────────────────────────────────
    let state = {
        sessions: [],
        equipment: [],
        spots: [],
        settings: { unit: 'mi', windUnit: 'kts', name: '' },
        unlockedAchievements: new Set(),
        currentView: 'dashboard',
        calendarDate: new Date(),
        selectedCalDay: null,
        editingSessionId: null,
        editingEquipmentId: null,
        formRating: 0,
        formWindDir: '',
        formSport: 'kitesurf',
        spotFormWindDirs: new Set(),
    };

    // ─── Data Persistence ────────────────────────────────────
    function load() {
        try {
            state.sessions = JSON.parse(localStorage.getItem(STORAGE_KEYS.sessions)) || [];
            state.equipment = JSON.parse(localStorage.getItem(STORAGE_KEYS.equipment)) || [];
            state.spots = JSON.parse(localStorage.getItem(STORAGE_KEYS.spots)) || [];
            state.settings = { ...state.settings, ...JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || '{}') };
            const ua = JSON.parse(localStorage.getItem(STORAGE_KEYS.achievements)) || [];
            state.unlockedAchievements = new Set(ua);
        } catch (_) { /* fresh start */ }
    }

    function save() {
        localStorage.setItem(STORAGE_KEYS.sessions, JSON.stringify(state.sessions));
        localStorage.setItem(STORAGE_KEYS.equipment, JSON.stringify(state.equipment));
        localStorage.setItem(STORAGE_KEYS.spots, JSON.stringify(state.spots));
        localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(state.settings));
        localStorage.setItem(STORAGE_KEYS.achievements, JSON.stringify([...state.unlockedAchievements]));
    }

    // ─── Helpers ─────────────────────────────────────────────
    function $(sel) { return document.querySelector(sel); }
    function $$(sel) { return document.querySelectorAll(sel); }
    function uuid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

    function formatDate(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }

    function formatDateShort(dateStr) {
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    function toDateStr(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    }

    function todayStr() { return toDateStr(new Date()); }

    function durationLabel(mins) {
        if (mins < 60) return `${mins}m`;
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return m ? `${h}h ${m}m` : `${h}h`;
    }

    function calcMaxStreak(sessions) {
        if (!sessions.length) return 0;
        const days = [...new Set(sessions.map(s => s.date))].sort();
        let max = 1, cur = 1;
        for (let i = 1; i < days.length; i++) {
            const prev = new Date(days[i - 1] + 'T00:00:00');
            const curr = new Date(days[i] + 'T00:00:00');
            const diff = (curr - prev) / (1000 * 60 * 60 * 24);
            if (diff === 1) { cur++; max = Math.max(max, cur); }
            else { cur = 1; }
        }
        return max;
    }

    function calcCurrentStreak(sessions) {
        if (!sessions.length) return 0;
        const days = [...new Set(sessions.map(s => s.date))].sort().reverse();
        const today = todayStr();
        const yesterday = toDateStr(new Date(Date.now() - 86400000));
        if (days[0] !== today && days[0] !== yesterday) return 0;
        let streak = 1;
        for (let i = 1; i < days.length; i++) {
            const prev = new Date(days[i - 1] + 'T00:00:00');
            const curr = new Date(days[i] + 'T00:00:00');
            if ((prev - curr) / (1000 * 60 * 60 * 24) === 1) streak++;
            else break;
        }
        return streak;
    }

    function checkMonthlyCount(sessions, target) {
        const counts = {};
        sessions.forEach(s => {
            const key = s.date.slice(0, 7);
            counts[key] = (counts[key] || 0) + 1;
        });
        return Object.values(counts).some(c => c >= target);
    }

    // ─── Toast System ────────────────────────────────────────
    function showToast(message, type = 'success', duration = 3000) {
        const container = $('#toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const icons = { success: '\u2705', error: '\u274C', achievement: '\u{1F3C6}', info: '\u{1F4A1}' };
        toast.innerHTML = `<span class="toast-icon">${icons[type] || ''}</span><span>${message}</span>`;
        container.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('leaving');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    // ─── Navigation ──────────────────────────────────────────
    function navigateTo(view) {
        state.currentView = view;
        $$('.view').forEach(v => v.classList.remove('active'));
        const target = $(`#view-${view}`);
        if (target) target.classList.add('active');
        $$('.nav-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.view === view);
        });
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Render view
        renderView(view);
    }

    function renderView(view) {
        switch (view) {
            case 'dashboard': renderDashboard(); break;
            case 'log': renderLogForm(); break;
            case 'calendar': renderCalendar(); break;
            case 'quiver': renderQuiver(); break;
            case 'achievements': renderAchievements(); break;
        }
    }

    // ─── Dashboard ───────────────────────────────────────────
    function renderDashboard() {
        // Greeting
        const hour = new Date().getHours();
        const name = state.settings.name;
        let greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
        if (name) greet += `, ${name}`;
        $('.greeting-text').textContent = greet;
        const subs = [
            'Ready to chase the wind?',
            'Perfect day to get stoked!',
            'The ocean is calling.',
            'Time to send it!',
            'Let the wind guide you.',
        ];
        $('.greeting-sub').textContent = subs[Math.floor(Math.random() * subs.length)];

        // Stats
        const sessions = state.sessions;
        const totalDist = sessions.reduce((a, s) => a + (s.distance || 0), 0);
        const totalHours = sessions.reduce((a, s) => a + (s.duration || 0), 0) / 60;
        const streak = calcCurrentStreak(sessions);
        $('#stat-sessions').textContent = sessions.length;
        $('#stat-distance').textContent = totalDist.toFixed(1);
        $('#stat-hours').textContent = totalHours.toFixed(1);
        $('#stat-streak').textContent = streak;

        // Recent Sessions
        renderRecentSessions();

        // Wind Rose
        renderWindRose();

        // Progress Chart
        renderProgressChart();

        // Achievements preview
        renderAchievementsPreview();
    }

    function renderRecentSessions() {
        const container = $('#recent-sessions');
        const recent = [...state.sessions].sort((a, b) => {
            const da = a.date + (a.time || '');
            const db = b.date + (b.time || '');
            return db.localeCompare(da);
        }).slice(0, 5);

        if (!recent.length) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="empty-icon">
                        <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/>
                    </svg>
                    <p>No sessions yet</p>
                    <span>Hit the water and log your first session!</span>
                </div>`;
            return;
        }

        container.innerHTML = recent.map(s => buildSessionCard(s)).join('');
        container.querySelectorAll('.session-card').forEach(card => {
            card.addEventListener('click', () => openSessionDetail(card.dataset.id));
        });
    }

    function buildSessionCard(s) {
        const sportLabel = SPORT_LABELS[s.sport] || s.sport;
        const sportEmoji = SPORT_EMOJIS[s.sport] || '';
        const ratingDots = Array.from({ length: 5 }, (_, i) =>
            `<span class="session-rating-dot ${i < (s.rating || 0) ? 'filled' : ''}"></span>`
        ).join('');

        return `
            <div class="session-card" data-id="${s.id}">
                <div class="session-sport-badge ${s.sport}">${sportEmoji}</div>
                <div class="session-info">
                    <div class="session-info-top">
                        <span class="session-sport-name">${sportLabel}</span>
                        <span class="session-date-label">${formatDateShort(s.date)}</span>
                    </div>
                    <div class="session-info-bottom">
                        ${s.duration ? `<span class="session-meta">${durationLabel(s.duration)}</span>` : ''}
                        ${s.windSpeed ? `<span class="session-meta">${s.windSpeed}kts</span>` : ''}
                        ${s.distance ? `<span class="session-meta">${s.distance}mi</span>` : ''}
                        <span class="session-rating">${ratingDots}</span>
                    </div>
                </div>
            </div>`;
    }

    // ─── Wind Rose ───────────────────────────────────────────
    function renderWindRose() {
        const canvas = $('#wind-rose-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const size = 240;
        const center = size / 2;
        const radius = 90;
        ctx.clearRect(0, 0, size, size);

        // Count directions
        const counts = {};
        DIRECTIONS.forEach(d => counts[d] = 0);
        state.sessions.forEach(s => {
            if (s.windDirection && counts.hasOwnProperty(s.windDirection)) {
                counts[s.windDirection]++;
            }
        });
        const maxCount = Math.max(1, ...Object.values(counts));

        // Background circles
        for (let i = 3; i >= 1; i--) {
            ctx.beginPath();
            ctx.arc(center, center, radius * (i / 3), 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255,255,255,0.04)';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Direction labels
        ctx.font = '500 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        DIRECTIONS.forEach((dir, i) => {
            const angle = (i * 45 - 90) * Math.PI / 180;
            const lx = center + Math.cos(angle) * (radius + 16);
            const ly = center + Math.sin(angle) * (radius + 16);
            ctx.fillStyle = 'rgba(232,236,244,0.35)';
            ctx.fillText(dir, lx, ly);
        });

        // Draw petals
        DIRECTIONS.forEach((dir, i) => {
            const angle = (i * 45 - 90) * Math.PI / 180;
            const pct = counts[dir] / maxCount;
            const r = Math.max(8, radius * pct);
            const halfWidth = 12 * Math.PI / 180;

            ctx.beginPath();
            ctx.moveTo(center, center);
            ctx.arc(center, center, r, angle - halfWidth, angle + halfWidth);
            ctx.closePath();

            const grad = ctx.createRadialGradient(center, center, 0, center, center, r);
            grad.addColorStop(0, 'rgba(0,180,255,0.3)');
            grad.addColorStop(1, 'rgba(0,230,180,0.6)');
            ctx.fillStyle = grad;
            ctx.fill();

            // Glow dot at tip
            if (pct > 0) {
                const dx = center + Math.cos(angle) * r;
                const dy = center + Math.sin(angle) * r;
                ctx.beginPath();
                ctx.arc(dx, dy, 3, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0,230,180,0.8)';
                ctx.fill();
            }
        });

        // Center dot
        ctx.beginPath();
        ctx.arc(center, center, 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,180,255,0.6)';
        ctx.fill();
    }

    // ─── Progress Chart (pure canvas) ────────────────────────
    let chartMetric = 'distance';

    function renderProgressChart() {
        const canvas = $('#progress-chart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = 200 * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = '200px';
        ctx.scale(dpr, dpr);
        const w = rect.width;
        const h = 200;

        ctx.clearRect(0, 0, w, h);

        // Get last 6 months of data
        const now = new Date();
        const months = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            months.push({
                key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
                label: d.toLocaleDateString('en-US', { month: 'short' }),
            });
        }

        const values = months.map(m => {
            const monthSessions = state.sessions.filter(s => s.date.startsWith(m.key));
            if (chartMetric === 'distance') return monthSessions.reduce((a, s) => a + (s.distance || 0), 0);
            if (chartMetric === 'sessions') return monthSessions.length;
            if (chartMetric === 'hours') return monthSessions.reduce((a, s) => a + (s.duration || 0), 0) / 60;
            return 0;
        });

        const maxVal = Math.max(1, ...values);
        const padding = { top: 20, right: 16, bottom: 30, left: 40 };
        const chartW = w - padding.left - padding.right;
        const chartH = h - padding.top - padding.bottom;

        // Grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.04)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + chartH - (chartH * i / 4);
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();
        }

        // Y-axis labels
        ctx.font = '400 10px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(232,236,244,0.3)';
        ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + chartH - (chartH * i / 4);
            const val = (maxVal * i / 4).toFixed(chartMetric === 'sessions' ? 0 : 1);
            ctx.fillText(val, padding.left - 6, y + 3);
        }

        // Bars
        const barWidth = Math.min(32, (chartW / months.length) * 0.6);
        const gap = chartW / months.length;

        months.forEach((m, i) => {
            const x = padding.left + gap * i + gap / 2;
            const barH = (values[i] / maxVal) * chartH;
            const y = padding.top + chartH - barH;

            // Bar gradient
            const grad = ctx.createLinearGradient(x, y, x, padding.top + chartH);
            grad.addColorStop(0, 'rgba(0,180,255,0.8)');
            grad.addColorStop(1, 'rgba(124,58,237,0.4)');

            ctx.beginPath();
            ctx.roundRect(x - barWidth / 2, y, barWidth, barH, [4, 4, 0, 0]);
            ctx.fillStyle = grad;
            ctx.fill();

            // Glow
            if (values[i] > 0) {
                ctx.shadowColor = 'rgba(0,180,255,0.3)';
                ctx.shadowBlur = 8;
                ctx.fill();
                ctx.shadowBlur = 0;
            }

            // Value on top
            if (values[i] > 0) {
                ctx.fillStyle = 'rgba(232,236,244,0.6)';
                ctx.font = '500 10px "JetBrains Mono", monospace';
                ctx.textAlign = 'center';
                ctx.fillText(values[i].toFixed(chartMetric === 'sessions' ? 0 : 1), x, y - 6);
            }

            // Month label
            ctx.fillStyle = 'rgba(232,236,244,0.35)';
            ctx.font = '500 10px "Inter", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(m.label, x, h - 8);
        });
    }

    // ─── Achievements ────────────────────────────────────────
    function checkAchievements() {
        let newlyUnlocked = [];
        ACHIEVEMENTS.forEach(a => {
            if (!state.unlockedAchievements.has(a.id) && a.check(state.sessions)) {
                state.unlockedAchievements.add(a.id);
                newlyUnlocked.push(a);
            }
        });
        if (newlyUnlocked.length) {
            save();
            newlyUnlocked.forEach(a => {
                showToast(`${a.icon} Achievement unlocked: ${a.name}!`, 'achievement', 4000);
            });
        }
    }

    function renderAchievementsPreview() {
        const container = $('#achievements-preview');
        if (!container) return;
        const preview = ACHIEVEMENTS.slice(0, 8);
        container.innerHTML = preview.map(a => {
            const unlocked = state.unlockedAchievements.has(a.id);
            return `
                <div class="achievement-badge" title="${a.desc}">
                    <div class="achievement-icon ${unlocked ? 'unlocked' : 'locked'}">${a.icon}</div>
                    <span class="achievement-name ${unlocked ? '' : 'locked'}">${a.name}</span>
                </div>`;
        }).join('');
    }

    function renderAchievements() {
        const unlocked = state.unlockedAchievements.size;
        const total = ACHIEVEMENTS.length;
        const pct = total ? (unlocked / total * 100) : 0;
        $('#achievement-progress-fill').style.width = pct + '%';
        $('#achievement-progress-text').textContent = `${unlocked} / ${total} unlocked`;

        const container = $('#achievements-full-list');
        container.innerHTML = ACHIEVEMENTS.map(a => {
            const isUnlocked = state.unlockedAchievements.has(a.id);
            return `
                <div class="achievement-full-card ${isUnlocked ? 'unlocked' : 'locked'}">
                    <div class="achievement-icon ${isUnlocked ? 'unlocked' : 'locked'}">${a.icon}</div>
                    <div class="achievement-full-info">
                        <div class="achievement-full-name">${a.name}</div>
                        <div class="achievement-full-desc">${a.desc}</div>
                    </div>
                </div>`;
        }).join('');
    }

    // ─── Session Form ────────────────────────────────────────
    function renderLogForm() {
        // Set default date to today
        const dateInput = $('#session-date');
        if (!dateInput.value) dateInput.value = todayStr();

        // Populate spot dropdown
        populateSpotDropdown();
        populateEquipmentDropdown();
    }

    function populateSpotDropdown() {
        const sel = $('#session-spot');
        const current = sel.value;
        sel.innerHTML = '<option value="">Select or add new...</option>';
        state.spots.forEach(sp => {
            sel.innerHTML += `<option value="${sp.id}">${sp.name}</option>`;
        });
        if (current) sel.value = current;
    }

    function populateEquipmentDropdown() {
        const sel = $('#session-equipment');
        const current = sel.value;
        sel.innerHTML = '<option value="">Select or add new...</option>';
        state.equipment.forEach(eq => {
            sel.innerHTML += `<option value="${eq.id}">${eq.name} ${eq.size ? `(${eq.size})` : ''}</option>`;
        });
        if (current) sel.value = current;
    }

    function handleSessionSubmit(e) {
        e.preventDefault();
        const session = {
            id: state.editingSessionId || uuid(),
            sport: state.formSport,
            date: $('#session-date').value,
            time: $('#session-time').value,
            duration: parseInt($('#session-duration').value) || 60,
            windSpeed: parseFloat($('#wind-speed').value) || 0,
            windGusts: parseFloat($('#wind-gusts').value) || 0,
            windDirection: state.formWindDir,
            tide: $('#tide-state').value,
            waterState: $('#water-state').value,
            distance: parseFloat($('#session-distance').value) || 0,
            maxSpeed: parseFloat($('#max-speed').value) || 0,
            jumpCount: parseInt($('#jump-count').value) || 0,
            maxJumpHeight: parseFloat($('#max-jump-height').value) || 0,
            maxAirtime: parseFloat($('#max-airtime').value) || 0,
            spot: $('#session-spot').value,
            equipment: $('#session-equipment').value,
            rating: state.formRating,
            notes: $('#session-notes').value,
        };

        if (!session.date) {
            showToast('Please enter a date', 'error');
            return;
        }

        if (state.editingSessionId) {
            const idx = state.sessions.findIndex(s => s.id === state.editingSessionId);
            if (idx >= 0) state.sessions[idx] = session;
            state.editingSessionId = null;
            showToast('Session updated!', 'success');
        } else {
            state.sessions.push(session);
            showToast('Session saved! Nice one!', 'success');
        }

        save();
        checkAchievements();
        resetSessionForm();
        navigateTo('dashboard');
    }

    function resetSessionForm() {
        $('#session-form').reset();
        state.formRating = 0;
        state.formWindDir = '';
        state.formSport = 'kitesurf';
        state.editingSessionId = null;
        // Reset UI
        $$('#sport-selector .sport-btn').forEach(b => b.classList.toggle('active', b.dataset.sport === 'kitesurf'));
        $$('#direction-picker .dir-btn').forEach(b => b.classList.remove('active'));
        $$('#rating-selector .rating-btn').forEach(b => b.classList.remove('active'));
        $('#session-date').value = todayStr();
        $('#session-duration').value = '60';
        $('#submit-session').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Save Session';
    }

    function loadSessionIntoForm(session) {
        state.editingSessionId = session.id;
        state.formSport = session.sport || 'kitesurf';
        state.formWindDir = session.windDirection || '';
        state.formRating = session.rating || 0;

        $$('#sport-selector .sport-btn').forEach(b => b.classList.toggle('active', b.dataset.sport === state.formSport));
        $('#session-date').value = session.date;
        $('#session-time').value = session.time || '';
        $('#session-duration').value = session.duration || 60;
        $('#wind-speed').value = session.windSpeed || '';
        $('#wind-gusts').value = session.windGusts || '';
        $$('#direction-picker .dir-btn').forEach(b => b.classList.toggle('active', b.dataset.dir === state.formWindDir));
        $('#tide-state').value = session.tide || '';
        $('#water-state').value = session.waterState || '';
        $('#session-distance').value = session.distance || '';
        $('#max-speed').value = session.maxSpeed || '';
        $('#jump-count').value = session.jumpCount || '';
        $('#max-jump-height').value = session.maxJumpHeight || '';
        $('#max-airtime').value = session.maxAirtime || '';
        $('#session-spot').value = session.spot || '';
        $('#session-equipment').value = session.equipment || '';
        $$('#rating-selector .rating-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.rating) === state.formRating));
        $('#session-notes').value = session.notes || '';
        $('#submit-session').innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg> Update Session';
    }

    // ─── Session Detail ──────────────────────────────────────
    let viewingSessionId = null;

    function openSessionDetail(id) {
        const session = state.sessions.find(s => s.id === id);
        if (!session) return;
        viewingSessionId = id;

        const sportLabel = SPORT_LABELS[session.sport] || session.sport;
        const spotObj = state.spots.find(sp => sp.id === session.spot);
        const eqObj = state.equipment.find(eq => eq.id === session.equipment);
        const ratingLabel = RATING_LABELS[session.rating] || '--';

        $('#session-detail-title').textContent = `${SPORT_EMOJIS[session.sport] || ''} ${sportLabel} - ${formatDate(session.date)}`;
        $('#session-detail-content').innerHTML = `
            <div class="session-detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Duration</div>
                    <div class="detail-value">${durationLabel(session.duration)}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Rating</div>
                    <div class="detail-value">${ratingLabel} ${session.rating ? '(' + session.rating + '/5)' : ''}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Wind Speed</div>
                    <div class="detail-value">${session.windSpeed || '--'} kts${session.windGusts ? ` (G${session.windGusts})` : ''}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Direction</div>
                    <div class="detail-value">${session.windDirection || '--'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Distance</div>
                    <div class="detail-value">${session.distance ? session.distance + ' mi' : '--'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Max Speed</div>
                    <div class="detail-value">${session.maxSpeed ? session.maxSpeed + ' kts' : '--'}</div>
                </div>
                ${session.jumpCount ? `
                <div class="detail-item">
                    <div class="detail-label">Jumps</div>
                    <div class="detail-value">${session.jumpCount}</div>
                </div>` : ''}
                ${session.maxJumpHeight ? `
                <div class="detail-item">
                    <div class="detail-label">Max Jump</div>
                    <div class="detail-value">${session.maxJumpHeight}m</div>
                </div>` : ''}
                ${session.maxAirtime ? `
                <div class="detail-item">
                    <div class="detail-label">Max Airtime</div>
                    <div class="detail-value">${session.maxAirtime}s</div>
                </div>` : ''}
                <div class="detail-item">
                    <div class="detail-label">Tide</div>
                    <div class="detail-value">${session.tide || '--'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Water</div>
                    <div class="detail-value">${session.waterState || '--'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Spot</div>
                    <div class="detail-value">${spotObj ? spotObj.name : '--'}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Equipment</div>
                    <div class="detail-value">${eqObj ? eqObj.name : '--'}</div>
                </div>
                ${session.notes ? `
                <div class="detail-notes full-width">
                    <div class="detail-label">Notes</div>
                    <p>${session.notes}</p>
                </div>` : ''}
            </div>`;

        openModal('modal-session-detail');
    }

    // ─── Calendar ────────────────────────────────────────────
    function renderCalendar() {
        const date = state.calendarDate;
        const year = date.getFullYear();
        const month = date.getMonth();
        $('#cal-month-label').textContent = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);

        const firstDay = new Date(year, month, 1).getDay();
        // Adjust for Monday start
        const startOffset = firstDay === 0 ? 6 : firstDay - 1;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const today = todayStr();

        // Find days with sessions
        const sessionDays = {};
        state.sessions.forEach(s => {
            if (s.date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)) {
                sessionDays[s.date] = (sessionDays[s.date] || 0) + 1;
            }
        });

        let html = '';
        // Empty cells for offset
        for (let i = 0; i < startOffset; i++) {
            html += '<div class="cal-day empty"></div>';
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const count = sessionDays[dateStr] || 0;
            let cls = 'cal-day';
            if (dateStr === today) cls += ' today';
            if (count === 1) cls += ' has-session';
            else if (count >= 2) cls += ' has-multi-session';
            if (dateStr === state.selectedCalDay) cls += ' selected';
            html += `<div class="${cls}" data-date="${dateStr}">${day}</div>`;
        }

        $('#cal-body').innerHTML = html;

        // Click handlers
        $$('.cal-day:not(.empty)').forEach(el => {
            el.addEventListener('click', () => {
                state.selectedCalDay = el.dataset.date;
                renderCalendar();
                showDayDetail(el.dataset.date);
            });
        });
    }

    function showDayDetail(dateStr) {
        const panel = $('#day-detail');
        panel.style.display = 'block';
        $('#day-detail-title').textContent = formatDate(dateStr);

        const daySessions = state.sessions.filter(s => s.date === dateStr)
            .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

        const list = $('#day-sessions-list');
        if (!daySessions.length) {
            list.innerHTML = '<div class="empty-state small"><p>No sessions this day</p></div>';
        } else {
            list.innerHTML = daySessions.map(s => buildSessionCard(s)).join('');
            list.querySelectorAll('.session-card').forEach(card => {
                card.addEventListener('click', () => openSessionDetail(card.dataset.id));
            });
        }
    }

    // ─── Quiver (Equipment / Spots / Records) ────────────────
    function renderQuiver() {
        renderEquipment();
        renderSpots();
        renderRecords();
    }

    function renderEquipment() {
        const list = $('#equipment-list');
        if (!state.equipment.length) {
            list.innerHTML = '<div class="empty-state small"><p>No equipment added yet</p><span>Add your kites, boards, foils, and more</span></div>';
            return;
        }
        list.innerHTML = state.equipment.map(eq => {
            const emoji = EQ_EMOJIS[eq.type] || '\u2699\uFE0F';
            const meta = [eq.brand, eq.size].filter(Boolean).join(' \u00B7 ');
            return `
                <div class="equipment-item">
                    <div class="eq-type-icon ${eq.type}">${emoji}</div>
                    <div class="eq-info">
                        <div class="eq-name">${eq.name}</div>
                        ${meta ? `<div class="eq-meta">${meta}</div>` : ''}
                        ${eq.notes ? `<div class="eq-meta">${eq.notes}</div>` : ''}
                    </div>
                    <div class="eq-actions">
                        <button class="icon-btn" data-eq-delete="${eq.id}" title="Delete">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                </div>`;
        }).join('');

        list.querySelectorAll('[data-eq-delete]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.eqDelete;
                if (confirm('Delete this equipment?')) {
                    state.equipment = state.equipment.filter(eq => eq.id !== id);
                    save();
                    renderEquipment();
                    populateEquipmentDropdown();
                    showToast('Equipment removed', 'info');
                }
            });
        });
    }

    function renderSpots() {
        const list = $('#spots-list');
        if (!state.spots.length) {
            list.innerHTML = '<div class="empty-state small"><p>No spots saved yet</p><span>Save your favorite riding locations</span></div>';
            return;
        }
        list.innerHTML = state.spots.map(sp => {
            const tags = [];
            if (sp.waterType) tags.push(sp.waterType);
            if (sp.difficulty) tags.push(sp.difficulty);
            if (sp.bestWindDirs && sp.bestWindDirs.length) tags.push('Wind: ' + sp.bestWindDirs.join(', '));
            const sessionCount = state.sessions.filter(s => s.spot === sp.id).length;
            if (sessionCount) tags.push(`${sessionCount} session${sessionCount > 1 ? 's' : ''}`);

            return `
                <div class="spot-item">
                    <div class="spot-header">
                        <div class="spot-name">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                            ${sp.name}
                        </div>
                        <button class="icon-btn" data-spot-delete="${sp.id}" title="Delete">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                    ${sp.location ? `<div class="spot-location">${sp.location}</div>` : ''}
                    ${tags.length ? `<div class="spot-tags">${tags.map(t => `<span class="spot-tag">${t}</span>`).join('')}</div>` : ''}
                    ${sp.notes ? `<div class="spot-location" style="margin-top:6px">${sp.notes}</div>` : ''}
                </div>`;
        }).join('');

        list.querySelectorAll('[data-spot-delete]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.spotDelete;
                if (confirm('Delete this spot?')) {
                    state.spots = state.spots.filter(sp => sp.id !== id);
                    save();
                    renderSpots();
                    populateSpotDropdown();
                    showToast('Spot removed', 'info');
                }
            });
        });
    }

    function renderRecords() {
        const container = $('#records-list');
        const sessions = state.sessions;
        if (!sessions.length) {
            container.innerHTML = '<div class="empty-state small" style="grid-column:1/-1"><p>No records yet</p><span>Log sessions to track your personal bests</span></div>';
            return;
        }

        const records = [];

        // Max wind
        const maxWind = sessions.reduce((max, s) => s.windSpeed > (max.windSpeed || 0) ? s : max, {});
        if (maxWind.windSpeed) records.push({ label: 'Max Wind', value: maxWind.windSpeed + ' kts', date: maxWind.date });

        // Max speed
        const maxSpd = sessions.reduce((max, s) => (s.maxSpeed || 0) > (max.maxSpeed || 0) ? s : max, {});
        if (maxSpd.maxSpeed) records.push({ label: 'Max Speed', value: maxSpd.maxSpeed + ' kts', date: maxSpd.date });

        // Longest session
        const longest = sessions.reduce((max, s) => (s.duration || 0) > (max.duration || 0) ? s : max, {});
        if (longest.duration) records.push({ label: 'Longest Session', value: durationLabel(longest.duration), date: longest.date });

        // Max distance
        const maxDist = sessions.reduce((max, s) => (s.distance || 0) > (max.distance || 0) ? s : max, {});
        if (maxDist.distance) records.push({ label: 'Max Distance', value: maxDist.distance + ' mi', date: maxDist.date });

        // Max jump
        const maxJump = sessions.reduce((max, s) => (s.maxJumpHeight || 0) > (max.maxJumpHeight || 0) ? s : max, {});
        if (maxJump.maxJumpHeight) records.push({ label: 'Max Jump Height', value: maxJump.maxJumpHeight + ' m', date: maxJump.date });

        // Max airtime
        const maxAir = sessions.reduce((max, s) => (s.maxAirtime || 0) > (max.maxAirtime || 0) ? s : max, {});
        if (maxAir.maxAirtime) records.push({ label: 'Max Airtime', value: maxAir.maxAirtime + ' s', date: maxAir.date });

        // Total distance
        const totalDist = sessions.reduce((a, s) => a + (s.distance || 0), 0);
        records.push({ label: 'Total Distance', value: totalDist.toFixed(1) + ' mi', date: '' });

        // Total sessions
        records.push({ label: 'Total Sessions', value: sessions.length.toString(), date: '' });

        container.innerHTML = records.map(r => `
            <div class="record-card">
                <div class="record-value">${r.value}</div>
                <div class="record-label">${r.label}</div>
                ${r.date ? `<div class="record-date">${formatDateShort(r.date)}</div>` : ''}
            </div>
        `).join('');
    }

    // ─── Modal System ────────────────────────────────────────
    function openModal(id) {
        const modal = $(`#${id}`);
        if (modal) modal.style.display = 'flex';
    }

    function closeModal(id) {
        const modal = $(`#${id}`);
        if (modal) modal.style.display = 'none';
    }

    // ─── Equipment Form ──────────────────────────────────────
    function handleEquipmentSubmit(e) {
        e.preventDefault();
        const eq = {
            id: state.editingEquipmentId || uuid(),
            name: $('#eq-name').value.trim(),
            type: $('#eq-type').value,
            brand: $('#eq-brand').value.trim(),
            size: $('#eq-size').value.trim(),
            notes: $('#eq-notes').value.trim(),
        };
        if (!eq.name) return;

        if (state.editingEquipmentId) {
            const idx = state.equipment.findIndex(e => e.id === state.editingEquipmentId);
            if (idx >= 0) state.equipment[idx] = eq;
            state.editingEquipmentId = null;
        } else {
            state.equipment.push(eq);
        }

        save();
        closeModal('modal-equipment');
        $('#equipment-form').reset();
        renderEquipment();
        populateEquipmentDropdown();
        showToast('Equipment saved!', 'success');
    }

    // ─── Spot Form ───────────────────────────────────────────
    function handleSpotSubmit(e) {
        e.preventDefault();
        const spot = {
            id: uuid(),
            name: $('#spot-name').value.trim(),
            location: $('#spot-location').value.trim(),
            bestWindDirs: [...state.spotFormWindDirs],
            waterType: $('#spot-water').value,
            difficulty: $('#spot-difficulty').value,
            notes: $('#spot-notes').value.trim(),
        };
        if (!spot.name) return;

        state.spots.push(spot);
        save();
        closeModal('modal-spot');
        $('#spot-form').reset();
        state.spotFormWindDirs.clear();
        $$('#spot-direction-picker .dir-btn').forEach(b => b.classList.remove('active'));
        renderSpots();
        populateSpotDropdown();
        showToast('Spot saved!', 'success');
    }

    // ─── Settings ────────────────────────────────────────────
    function initSettings() {
        $('#setting-unit').value = state.settings.unit || 'mi';
        $('#setting-wind-unit').value = state.settings.windUnit || 'kts';
        $('#setting-name').value = state.settings.name || '';
    }

    function handleSettingsChange() {
        state.settings.unit = $('#setting-unit').value;
        state.settings.windUnit = $('#setting-wind-unit').value;
        state.settings.name = $('#setting-name').value.trim();
        save();
    }

    // ─── CSV Export ──────────────────────────────────────────
    function exportCSV() {
        let csv = 'Date,Time,Sport,Duration (min),Wind Speed (kts),Wind Gusts (kts),Wind Direction,Tide,Water State,Distance (mi),Max Speed (kts),Jumps,Max Jump Height (m),Max Airtime (s),Spot,Equipment,Rating,Notes\n';
        state.sessions.forEach(s => {
            const spot = state.spots.find(sp => sp.id === s.spot);
            const eq = state.equipment.find(e => e.id === s.equipment);
            const notes = (s.notes || '').replace(/"/g, '""').replace(/\n/g, ' ');
            csv += `"${s.date}","${s.time || ''}","${s.sport}",${s.duration || ''},${s.windSpeed || ''},${s.windGusts || ''},"${s.windDirection || ''}","${s.tide || ''}","${s.waterState || ''}",${s.distance || ''},${s.maxSpeed || ''},${s.jumpCount || ''},${s.maxJumpHeight || ''},${s.maxAirtime || ''},"${spot ? spot.name : ''}","${eq ? eq.name : ''}",${s.rating || ''},"${notes}"\n`;
        });
        downloadFile(csv, 'aero_sessions.csv', 'text/csv');
    }

    function exportJSON() {
        const data = {
            sessions: state.sessions,
            equipment: state.equipment,
            spots: state.spots,
            settings: state.settings,
            achievements: [...state.unlockedAchievements],
            exportDate: new Date().toISOString(),
        };
        downloadFile(JSON.stringify(data, null, 2), 'aero_backup.json', 'application/json');
    }

    function importJSON(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.sessions) state.sessions = data.sessions;
                if (data.equipment) state.equipment = data.equipment;
                if (data.spots) state.spots = data.spots;
                if (data.settings) state.settings = { ...state.settings, ...data.settings };
                if (data.achievements) state.unlockedAchievements = new Set(data.achievements);
                save();
                showToast('Data imported successfully!', 'success');
                navigateTo('dashboard');
            } catch (_) {
                showToast('Invalid backup file', 'error');
            }
        };
        reader.readAsText(file);
    }

    function downloadFile(content, filename, type) {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ─── Wind Particles ─────────────────────────────────────
    function initWindParticles() {
        const canvas = $('#wind-particles');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        let particles = [];
        const particleCount = 40;

        function resize() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }
        resize();
        window.addEventListener('resize', resize);

        function createParticle() {
            return {
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height,
                vx: 0.5 + Math.random() * 1.5,
                vy: -0.2 + Math.random() * 0.4,
                size: 1 + Math.random() * 2,
                alpha: 0.1 + Math.random() * 0.3,
                life: Math.random(),
            };
        }

        for (let i = 0; i < particleCount; i++) {
            particles.push(createParticle());
        }

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach((p, i) => {
                p.x += p.vx;
                p.y += p.vy;
                p.life += 0.002;

                if (p.x > canvas.width + 10 || p.life > 1) {
                    particles[i] = createParticle();
                    particles[i].x = -10;
                }

                ctx.beginPath();
                // Draw as small streak
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(p.x - p.vx * 4, p.y - p.vy * 4);
                ctx.strokeStyle = `rgba(0, 180, 255, ${p.alpha * (1 - p.life)})`;
                ctx.lineWidth = p.size;
                ctx.lineCap = 'round';
                ctx.stroke();
            });
            requestAnimationFrame(animate);
        }
        animate();
    }

    // ─── Event Binding ───────────────────────────────────────
    function bindEvents() {
        // Bottom nav
        $$('.nav-btn').forEach(btn => {
            btn.addEventListener('click', () => navigateTo(btn.dataset.view));
        });

        // FAB
        $('#fab-log').addEventListener('click', () => {
            resetSessionForm();
            navigateTo('log');
        });

        // Session form
        $('#session-form').addEventListener('submit', handleSessionSubmit);

        // Sport selector
        $$('#sport-selector .sport-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                state.formSport = btn.dataset.sport;
                $$('#sport-selector .sport-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        // Duration buttons
        $$('.duration-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = $('#session-duration');
                const delta = parseInt(btn.dataset.delta);
                input.value = Math.max(1, parseInt(input.value || 60) + delta);
            });
        });

        // Wind direction picker (session form)
        $$('#direction-picker .dir-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const dir = btn.dataset.dir;
                if (state.formWindDir === dir) {
                    state.formWindDir = '';
                    btn.classList.remove('active');
                } else {
                    state.formWindDir = dir;
                    $$('#direction-picker .dir-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                }
            });
        });

        // Spot direction picker (multi-select)
        $$('#spot-direction-picker .dir-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const dir = btn.dataset.dir;
                if (state.spotFormWindDirs.has(dir)) {
                    state.spotFormWindDirs.delete(dir);
                    btn.classList.remove('active');
                } else {
                    state.spotFormWindDirs.add(dir);
                    btn.classList.add('active');
                }
            });
        });

        // Rating selector
        $$('#rating-selector .rating-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const rating = parseInt(btn.dataset.rating);
                state.formRating = state.formRating === rating ? 0 : rating;
                $$('#rating-selector .rating-btn').forEach(b => {
                    b.classList.toggle('active', parseInt(b.dataset.rating) === state.formRating);
                });
            });
        });

        // Calendar nav
        $('#cal-prev').addEventListener('click', () => {
            state.calendarDate.setMonth(state.calendarDate.getMonth() - 1);
            state.selectedCalDay = null;
            $('#day-detail').style.display = 'none';
            renderCalendar();
        });
        $('#cal-next').addEventListener('click', () => {
            state.calendarDate.setMonth(state.calendarDate.getMonth() + 1);
            state.selectedCalDay = null;
            $('#day-detail').style.display = 'none';
            renderCalendar();
        });
        $('#day-detail-close').addEventListener('click', () => {
            $('#day-detail').style.display = 'none';
            state.selectedCalDay = null;
            renderCalendar();
        });

        // Add session from calendar
        $('#add-session-from-cal').addEventListener('click', () => {
            resetSessionForm();
            if (state.selectedCalDay) {
                $('#session-date').value = state.selectedCalDay;
            }
            navigateTo('log');
        });

        // Quiver tabs
        $$('#quiver-tabs .tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                $$('#quiver-tabs .tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                $$('.tab-content').forEach(tc => tc.classList.remove('active'));
                $(`#tab-${btn.dataset.tab}`).classList.add('active');
            });
        });

        // Equipment
        $('#btn-add-equipment').addEventListener('click', () => {
            state.editingEquipmentId = null;
            $('#equipment-form').reset();
            $('#equipment-modal-title').textContent = 'Add Equipment';
            openModal('modal-equipment');
        });
        $('#equipment-form').addEventListener('submit', handleEquipmentSubmit);

        // Spots
        $('#btn-add-spot').addEventListener('click', () => {
            $('#spot-form').reset();
            state.spotFormWindDirs.clear();
            $$('#spot-direction-picker .dir-btn').forEach(b => b.classList.remove('active'));
            openModal('modal-spot');
        });
        $('#add-spot-inline').addEventListener('click', () => {
            $('#spot-form').reset();
            state.spotFormWindDirs.clear();
            $$('#spot-direction-picker .dir-btn').forEach(b => b.classList.remove('active'));
            openModal('modal-spot');
        });
        $('#spot-form').addEventListener('submit', handleSpotSubmit);

        // Settings
        $('#btn-settings').addEventListener('click', () => {
            initSettings();
            openModal('modal-settings');
        });
        $('#setting-unit').addEventListener('change', handleSettingsChange);
        $('#setting-wind-unit').addEventListener('change', handleSettingsChange);
        $('#setting-name').addEventListener('input', handleSettingsChange);

        // Export/Import
        $('#btn-export-csv').addEventListener('click', exportCSV);
        $('#btn-export-json').addEventListener('click', exportJSON);
        $('#import-file').addEventListener('change', (e) => {
            if (e.target.files[0]) importJSON(e.target.files[0]);
        });
        $('#btn-reset-data').addEventListener('click', () => {
            if (confirm('This will permanently delete ALL your data. Are you sure?')) {
                if (confirm('Really? This cannot be undone!')) {
                    Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
                    location.reload();
                }
            }
        });

        // Session detail actions
        $('#btn-edit-session').addEventListener('click', () => {
            if (viewingSessionId) {
                const session = state.sessions.find(s => s.id === viewingSessionId);
                if (session) {
                    closeModal('modal-session-detail');
                    loadSessionIntoForm(session);
                    navigateTo('log');
                }
            }
        });
        $('#btn-delete-session').addEventListener('click', () => {
            if (viewingSessionId && confirm('Delete this session?')) {
                state.sessions = state.sessions.filter(s => s.id !== viewingSessionId);
                save();
                closeModal('modal-session-detail');
                viewingSessionId = null;
                showToast('Session deleted', 'info');
                renderView(state.currentView);
            }
        });

        // Modal close buttons
        $$('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => closeModal(btn.dataset.modal));
        });

        // Close modals on overlay click
        $$('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.style.display = 'none';
                }
            });
        });

        // Chart toggle
        $$('#chart-toggle .toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                chartMetric = btn.dataset.metric;
                $$('#chart-toggle .toggle-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderProgressChart();
            });
        });

        // View all sessions -> calendar
        if ($('#btn-view-all-sessions')) {
            $('#btn-view-all-sessions').addEventListener('click', () => navigateTo('calendar'));
        }

        // View achievements
        if ($('#btn-view-achievements')) {
            $('#btn-view-achievements').addEventListener('click', () => navigateTo('achievements'));
        }

        // Resize handler for chart
        window.addEventListener('resize', () => {
            if (state.currentView === 'dashboard') {
                renderProgressChart();
            }
        });
    }

    // ─── Init ────────────────────────────────────────────────
    function init() {
        load();
        bindEvents();
        initWindParticles();
        navigateTo('dashboard');
        checkAchievements();
    }

    // Start
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
