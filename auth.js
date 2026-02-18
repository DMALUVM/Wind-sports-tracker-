/* ============================================================
   AERO - Authentication, Promo Codes, Subscription & Integrations
   ============================================================ */

const AeroAuth = (function () {
    'use strict';

    let supabase = null;
    let currentUser = null;
    let subscription = null;
    let authListeners = [];

    // ─── Initialization ────────────────────────────────────
    function init() {
        if (typeof window.supabase !== 'undefined' &&
            AERO_CONFIG.SUPABASE_URL &&
            !AERO_CONFIG.SUPABASE_URL.includes('YOUR_PROJECT')) {
            try {
                const { createClient } = window.supabase;
                supabase = createClient(AERO_CONFIG.SUPABASE_URL, AERO_CONFIG.SUPABASE_ANON_KEY);
                setupAuthListener();
            } catch (e) {
                console.warn('Supabase init failed, running in local mode:', e.message);
            }
        }
        renderAuthState();
    }

    function setupAuthListener() {
        if (!supabase) return;
        supabase.auth.onAuthStateChange((event, session) => {
            currentUser = session?.user || null;
            if (currentUser) {
                loadSubscription();
                syncFromCloud();
            }
            renderAuthState();
            authListeners.forEach(fn => fn(currentUser, event));
        });
    }

    // ─── Auth Methods ──────────────────────────────────────
    async function signUp(email, password, name) {
        if (!supabase) return { error: { message: 'Backend not available. Try again later.' } };
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: name } }
        });
        if (!error && data.user) {
            currentUser = data.user;
        }
        return { data, error };
    }

    async function signIn(email, password) {
        if (!supabase) return { error: { message: 'Backend not available. Try again later.' } };
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error && data.user) {
            currentUser = data.user;
        }
        return { data, error };
    }

    async function resetPassword(email) {
        if (!supabase) return { error: { message: 'Backend not available.' } };
        return await supabase.auth.resetPasswordForEmail(email);
    }

    async function signOut() {
        if (supabase) {
            await supabase.auth.signOut();
        }
        currentUser = null;
        subscription = null;
        renderAuthState();
        return { error: null };
    }

    async function getSession() {
        if (!supabase) return null;
        const { data } = await supabase.auth.getSession();
        return data?.session || null;
    }

    // ─── Promo Code System ─────────────────────────────────
    function getRedeemedPromo() {
        try {
            const stored = localStorage.getItem('aero_promo');
            return stored ? JSON.parse(stored) : null;
        } catch { return null; }
    }

    function isPromoActive() {
        const promo = getRedeemedPromo();
        if (!promo) return false;
        if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) return false;
        return true;
    }

    async function redeemPromo(code) {
        const normalized = (code || '').trim().toUpperCase();
        if (!normalized) return { error: 'Please enter a promo code.' };

        // Check against local config codes first
        const localCode = AERO_CONFIG.PROMO_CODES[normalized];
        if (localCode) {
            if (localCode.expiresAt && new Date(localCode.expiresAt) < new Date()) {
                return { error: 'This promo code has expired.' };
            }
            const promoData = {
                code: normalized,
                label: localCode.label,
                redeemedAt: new Date().toISOString(),
                expiresAt: localCode.expiresAt,
            };
            localStorage.setItem('aero_promo', JSON.stringify(promoData));

            // If user is signed in, record to Supabase
            if (supabase && currentUser) {
                try {
                    await supabase.from('redeemed_promos').upsert({
                        user_id: currentUser.id,
                        code: normalized,
                        label: localCode.label,
                        redeemed_at: promoData.redeemedAt,
                    });
                } catch (e) { /* non-critical */ }
            }

            return { success: true, label: localCode.label };
        }

        // Check against Supabase promo_codes table
        if (supabase) {
            try {
                const { data, error } = await supabase
                    .from('promo_codes')
                    .select('*')
                    .eq('code', normalized)
                    .eq('active', true)
                    .single();

                if (error || !data) {
                    return { error: 'Invalid promo code.' };
                }

                if (data.expires_at && new Date(data.expires_at) < new Date()) {
                    return { error: 'This promo code has expired.' };
                }

                if (data.max_uses && data.used_count >= data.max_uses) {
                    return { error: 'This promo code has reached its limit.' };
                }

                // Increment usage count
                await supabase
                    .from('promo_codes')
                    .update({ used_count: (data.used_count || 0) + 1 })
                    .eq('id', data.id);

                const promoData = {
                    code: normalized,
                    label: data.label || 'Promo',
                    redeemedAt: new Date().toISOString(),
                    expiresAt: data.expires_at,
                };
                localStorage.setItem('aero_promo', JSON.stringify(promoData));

                if (currentUser) {
                    try {
                        await supabase.from('redeemed_promos').upsert({
                            user_id: currentUser.id,
                            code: normalized,
                            label: promoData.label,
                            redeemed_at: promoData.redeemedAt,
                        });
                    } catch (e) { /* non-critical */ }
                }

                return { success: true, label: promoData.label };
            } catch (e) {
                return { error: 'Invalid promo code.' };
            }
        }

        return { error: 'Invalid promo code.' };
    }

    // ─── Subscription ──────────────────────────────────────
    async function loadSubscription() {
        if (!supabase || !currentUser) return;
        try {
            const { data } = await supabase
                .from('subscriptions')
                .select('*')
                .eq('user_id', currentUser.id)
                .in('status', ['trialing', 'active'])
                .single();
            subscription = data;
        } catch (e) {
            subscription = null;
        }
    }

    function isPro() {
        // Pro via promo code
        if (isPromoActive()) return true;
        // Pro via App Store subscription
        if (subscription && ['active', 'trialing'].includes(subscription.status)) return true;
        return false;
    }

    function getSessionLimit() {
        return isPro() ? Infinity : AERO_CONFIG.TIERS.free.maxSessions;
    }

    function getProLabel() {
        if (isPromoActive()) {
            const promo = getRedeemedPromo();
            return promo.label || 'Promo';
        }
        if (subscription) return 'Pro Subscriber';
        return null;
    }

    // ─── Cloud Sync ────────────────────────────────────────
    async function syncToCloud(sessions, equipment, spots) {
        if (!supabase || !currentUser) return;
        if (sessions.length > 0) {
            const rows = sessions.map(s => ({
                id: s.id,
                user_id: currentUser.id,
                sport: s.sport,
                session_date: s.date,
                start_time: s.time,
                duration_minutes: s.duration,
                wind_speed: s.windSpeed,
                wind_gusts: s.windGusts,
                wind_direction: s.windDirection,
                tide: s.tide,
                water_state: s.waterState,
                distance: s.distance,
                max_speed: s.maxSpeed,
                jump_count: s.jumpCount,
                max_jump_height: s.maxJumpHeight,
                max_airtime: s.maxAirtime,
                spot_id: s.spot || null,
                equipment_id: s.equipment || null,
                rating: s.rating,
                notes: s.notes,
            }));
            await supabase.from('sessions').upsert(rows);
        }
    }

    async function syncFromCloud() {
        if (!supabase || !currentUser) return null;
        try {
            const { data: sessions } = await supabase
                .from('sessions')
                .select('*')
                .order('session_date', { ascending: false });
            return sessions;
        } catch (e) {
            return null;
        }
    }

    // ─── Strava Integration ────────────────────────────────
    function connectStrava() {
        if (!AERO_CONFIG.STRAVA_CLIENT_ID) {
            showToast('Strava not configured yet', 'info');
            return;
        }
        const authUrl = `https://www.strava.com/oauth/authorize?client_id=${AERO_CONFIG.STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(AERO_CONFIG.STRAVA_REDIRECT_URI)}&scope=activity:read_all&approval_prompt=auto`;
        window.location.href = authUrl;
    }

    function isStravaConnected() {
        return !!localStorage.getItem('aero_strava_token');
    }

    // ─── GPX / FIT Import ──────────────────────────────────
    function parseGPX(xmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'text/xml');
        const trkpts = doc.querySelectorAll('trkpt');
        if (!trkpts.length) {
            const rtepts = doc.querySelectorAll('rtept');
            if (!rtepts.length) return null;
            return parseGPXPoints(rtepts);
        }
        return parseGPXPoints(trkpts);
    }

    function parseGPXPoints(points) {
        const track = [];
        let totalDist = 0;
        let maxSpeed = 0;
        let startTime = null;
        let endTime = null;

        points.forEach((pt, i) => {
            const lat = parseFloat(pt.getAttribute('lat'));
            const lon = parseFloat(pt.getAttribute('lon'));
            const timeEl = pt.querySelector('time');
            const time = timeEl ? new Date(timeEl.textContent) : null;
            const speedEl = pt.querySelector('speed');
            const speed = speedEl ? parseFloat(speedEl.textContent) : 0;

            if (i === 0 && time) startTime = time;
            if (time) endTime = time;

            if (speed > maxSpeed) maxSpeed = speed;

            if (i > 0) {
                const prev = track[track.length - 1];
                totalDist += haversine(prev.lat, prev.lon, lat, lon);
            }

            track.push({ lat, lon, time, speed });
        });

        const durationMs = (startTime && endTime) ? endTime - startTime : 0;
        const durationMin = Math.round(durationMs / 60000);
        const dateStr = startTime ? startTime.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        const timeStr = startTime ? startTime.toTimeString().slice(0, 5) : '12:00';

        return {
            date: dateStr,
            time: timeStr,
            duration: durationMin || 60,
            distance: Math.round(totalDist * 100) / 100,
            maxSpeed: Math.round(maxSpeed * 1.94384 * 10) / 10, // m/s to knots
            trackPoints: track.length,
        };
    }

    function haversine(lat1, lon1, lat2, lon2) {
        const R = 3958.8; // Earth radius in miles
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    function parseFIT(arrayBuffer) {
        // FIT file binary header parsing
        // FIT format: 14-byte header, then data records, then 2-byte CRC
        const view = new DataView(arrayBuffer);
        if (arrayBuffer.byteLength < 14) return null;

        const headerSize = view.getUint8(0);
        const dataSize = view.getUint32(4, true);

        // Check FIT signature ".FIT"
        if (headerSize >= 14) {
            const sig = String.fromCharCode(
                view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11)
            );
            if (sig !== '.FIT') return null;
        }

        // For full FIT parsing we'd need a dedicated library.
        // Return a marker that tells the UI to prompt for manual entry with file metadata.
        return {
            isFIT: true,
            fileSize: arrayBuffer.byteLength,
            dataSize: dataSize,
            date: new Date().toISOString().split('T')[0],
            time: '12:00',
            duration: 60,
            distance: 0,
            maxSpeed: 0,
            needsManualEntry: true,
        };
    }

    async function importFile(file) {
        const name = file.name.toLowerCase();

        if (name.endsWith('.gpx')) {
            const text = await file.text();
            const data = parseGPX(text);
            if (!data) return { error: 'Could not parse GPX file. No track points found.' };
            return { data, type: 'gpx' };
        }

        if (name.endsWith('.fit')) {
            const buffer = await file.arrayBuffer();
            const data = parseFIT(buffer);
            if (!data) return { error: 'Invalid FIT file.' };
            return { data, type: 'fit' };
        }

        if (name.endsWith('.tcx')) {
            const text = await file.text();
            const data = parseTCX(text);
            if (!data) return { error: 'Could not parse TCX file.' };
            return { data, type: 'tcx' };
        }

        return { error: 'Unsupported file type. Use .gpx, .fit, or .tcx files.' };
    }

    function parseTCX(xmlText) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(xmlText, 'text/xml');
        const trackpoints = doc.querySelectorAll('Trackpoint');
        if (!trackpoints.length) return null;

        let totalDist = 0;
        let maxSpeed = 0;
        let startTime = null;
        let endTime = null;
        let prevLat = null, prevLon = null;

        trackpoints.forEach((tp) => {
            const timeEl = tp.querySelector('Time');
            const time = timeEl ? new Date(timeEl.textContent) : null;
            const posEl = tp.querySelector('Position');
            const lat = posEl?.querySelector('LatitudeDegrees');
            const lon = posEl?.querySelector('LongitudeDegrees');
            const distEl = tp.querySelector('DistanceMeters');
            const speedEl = tp.querySelector('Speed');

            if (!startTime && time) startTime = time;
            if (time) endTime = time;
            if (speedEl) {
                const s = parseFloat(speedEl.textContent);
                if (s > maxSpeed) maxSpeed = s;
            }

            if (lat && lon) {
                const la = parseFloat(lat.textContent);
                const lo = parseFloat(lon.textContent);
                if (prevLat !== null) {
                    totalDist += haversine(prevLat, prevLon, la, lo);
                }
                prevLat = la;
                prevLon = lo;
            }

            if (distEl && totalDist === 0) {
                // Use accumulated distance from TCX if available
                const dMeters = parseFloat(distEl.textContent);
                totalDist = dMeters * 0.000621371; // meters to miles
            }
        });

        const durationMs = (startTime && endTime) ? endTime - startTime : 0;
        const durationMin = Math.round(durationMs / 60000);
        const dateStr = startTime ? startTime.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
        const timeStr = startTime ? startTime.toTimeString().slice(0, 5) : '12:00';

        return {
            date: dateStr,
            time: timeStr,
            duration: durationMin || 60,
            distance: Math.round(totalDist * 100) / 100,
            maxSpeed: Math.round(maxSpeed * 1.94384 * 10) / 10,
            trackPoints: trackpoints.length,
        };
    }

    // ─── HealthKit (Capacitor bridge) ──────────────────────
    // These functions call into the Capacitor native layer when available.
    // On web, they show an informational message.

    function isCapacitor() {
        return typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform();
    }

    async function requestHealthKitPermissions() {
        if (!isCapacitor()) {
            return { error: 'Apple Health requires the native iOS app.' };
        }
        try {
            const { CapacitorHealthkit } = await import('@perfood/capacitor-healthkit');
            const available = await CapacitorHealthkit.isAvailable();
            if (!available) {
                return { error: 'HealthKit is not available on this device.' };
            }
            await CapacitorHealthkit.requestAuthorization({
                all: [''],
                read: ['activity', 'calories', 'distance', 'duration', 'weight'],
                write: [''],
            });
            return { granted: true };
        } catch (e) {
            return { error: e.message || 'HealthKit not available.' };
        }
    }

    async function importHealthKitSessions(daysBack) {
        if (!isCapacitor()) {
            return { error: 'Apple Health requires the native iOS app.', sessions: [] };
        }
        try {
            const { CapacitorHealthkit } = await import('@perfood/capacitor-healthkit');
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - (daysBack || 30));

            const result = await CapacitorHealthkit.queryHKitSampleType({
                sampleName: 'workoutType',
                startDate: startDate.toISOString(),
                endDate: new Date().toISOString(),
                limit: 0,
            });

            const workouts = result.resultData || [];

            return {
                sessions: workouts.map(w => ({
                    date: new Date(w.startDate).toISOString().split('T')[0],
                    time: new Date(w.startDate).toTimeString().slice(0, 5),
                    duration: Math.round((new Date(w.endDate) - new Date(w.startDate)) / 60000),
                    distance: w.totalDistance ? Math.round(w.totalDistance * 0.000621371 * 100) / 100 : 0,
                    calories: w.totalEnergyBurned || 0,
                    heartRate: w.averageHeartRate || 0,
                    source: w.sourceName || 'Apple Health',
                    sourceBundle: w.sourceBundleId || '',
                })),
            };
        } catch (e) {
            return { error: e.message, sessions: [] };
        }
    }

    function isHealthKitAvailable() {
        return isCapacitor();
    }

    // ─── UI Rendering ──────────────────────────────────────
    function renderAuthState() {
        const authScreen = document.getElementById('auth-screen');
        const appShell = document.getElementById('app');

        if (!authScreen) return;

        if (currentUser) {
            authScreen.style.display = 'none';
            if (appShell) appShell.style.display = 'flex';
            updateSettingsAccountUI();
        } else if (localStorage.getItem('aero_skipped_auth')) {
            authScreen.style.display = 'none';
            if (appShell) appShell.style.display = 'flex';
            updateSettingsAccountUI();
        } else {
            authScreen.style.display = 'flex';
            if (appShell) appShell.style.display = 'none';
        }
    }

    function updateSettingsAccountUI() {
        const emailEl = document.getElementById('setting-account-email');
        const tierEl = document.getElementById('setting-account-tier');
        const signoutBtn = document.getElementById('btn-signout');
        const subStatus = document.getElementById('setting-sub-status');
        const upgradeBtn = document.getElementById('btn-upgrade');

        if (currentUser && emailEl) {
            emailEl.textContent = currentUser.email || currentUser.user_metadata?.full_name || 'Signed in';
            if (signoutBtn) signoutBtn.style.display = '';
        } else if (emailEl) {
            emailEl.textContent = 'Not signed in';
            if (signoutBtn) signoutBtn.style.display = 'none';
        }

        if (isPro()) {
            if (tierEl) tierEl.textContent = getProLabel() || 'Pro';
            if (subStatus) subStatus.textContent = getProLabel() || 'Active';
            if (upgradeBtn) upgradeBtn.style.display = 'none';
        } else {
            if (tierEl) tierEl.textContent = 'Free plan';
            if (subStatus) subStatus.textContent = 'Free plan';
            if (upgradeBtn) upgradeBtn.style.display = '';
        }
    }

    function showToast(msg, type) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast ${type || ''}`;
        toast.textContent = msg;
        container.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ─── Auth Screen Logic ─────────────────────────────────
    function bindAuthEvents() {
        // Tab switching
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const mode = tab.dataset.mode;
                document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
                const targetForm = document.getElementById(`form-${mode}`);
                if (targetForm) targetForm.style.display = 'block';
            });
        });

        // Sign Up
        const signupForm = document.getElementById('form-signup');
        if (signupForm) {
            signupForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = document.getElementById('signup-name').value.trim();
                const email = document.getElementById('signup-email').value.trim();
                const password = document.getElementById('signup-password').value;
                const btn = signupForm.querySelector('.auth-submit-btn');
                btn.classList.add('loading');
                btn.disabled = true;

                const { data, error } = await signUp(email, password, name);
                btn.classList.remove('loading');
                btn.disabled = false;

                if (error) {
                    showAuthError(signupForm, error.message);
                } else if (data.user && !data.session) {
                    showAuthSuccess(signupForm, 'Check your email to confirm your account!');
                }
            });
        }

        // Sign In
        const signinForm = document.getElementById('form-signin');
        if (signinForm) {
            signinForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('signin-email').value.trim();
                const password = document.getElementById('signin-password').value;
                const btn = signinForm.querySelector('.auth-submit-btn');
                btn.classList.add('loading');
                btn.disabled = true;

                const { error } = await signIn(email, password);
                btn.classList.remove('loading');
                btn.disabled = false;

                if (error) {
                    showAuthError(signinForm, error.message);
                }
            });
        }

        // Forgot password
        document.querySelectorAll('.auth-forgot-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
                const resetForm = document.getElementById('form-reset');
                if (resetForm) resetForm.style.display = 'block';
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
            });
        });

        // Password Reset
        const resetForm = document.getElementById('form-reset');
        if (resetForm) {
            resetForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const email = document.getElementById('reset-email').value.trim();
                const btn = resetForm.querySelector('.auth-submit-btn');
                btn.classList.add('loading');
                btn.disabled = true;

                const { error } = await resetPassword(email);
                btn.classList.remove('loading');
                btn.disabled = false;

                if (error) {
                    showAuthError(resetForm, error.message);
                } else {
                    showAuthSuccess(resetForm, 'Password reset link sent to your email!');
                }
            });

            resetForm.querySelector('.auth-back-link')?.addEventListener('click', (e) => {
                e.preventDefault();
                resetForm.style.display = 'none';
                document.getElementById('form-signin').style.display = 'block';
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                document.querySelector('.auth-tab[data-mode="signin"]')?.classList.add('active');
            });
        }

        // Skip auth
        const skipBtn = document.getElementById('auth-skip-btn');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => {
                const authScreen = document.getElementById('auth-screen');
                const appShell = document.getElementById('app');
                if (authScreen) authScreen.style.display = 'none';
                if (appShell) appShell.style.display = 'flex';
                localStorage.setItem('aero_skipped_auth', '1');
            });
        }

        // Paywall + promo code
        bindPaywallEvents();

        // Settings auth
        const signoutBtn = document.getElementById('btn-signout');
        if (signoutBtn) {
            signoutBtn.addEventListener('click', async () => {
                await signOut();
                localStorage.removeItem('aero_skipped_auth');
            });
        }

        const upgradeBtn = document.getElementById('btn-upgrade');
        if (upgradeBtn) {
            upgradeBtn.addEventListener('click', showPaywall);
        }

        // GPX/FIT file import
        const gpxInput = document.getElementById('import-gpx-file');
        if (gpxInput) {
            gpxInput.addEventListener('change', async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                gpxInput.value = '';

                const result = await importFile(file);
                if (result.error) {
                    showToast(result.error, 'error');
                    return;
                }

                // Dispatch event so app.js can handle importing into the log form
                window.dispatchEvent(new CustomEvent('aero-file-import', {
                    detail: { ...result.data, fileType: result.type, fileName: file.name }
                }));
                showToast(`Imported from ${file.name} - check the Log form!`, 'success');
            });
        }

        // HealthKit button
        const healthBtn = document.getElementById('btn-connect-health');
        if (healthBtn) {
            healthBtn.addEventListener('click', async () => {
                if (!isHealthKitAvailable()) {
                    showToast('Apple Health requires the native iOS app (coming soon)', 'info');
                    return;
                }
                const { error } = await requestHealthKitPermissions();
                if (error) {
                    showToast(error, 'error');
                    return;
                }
                showToast('Apple Health connected!', 'success');
                healthBtn.classList.add('connected');
                healthBtn.innerHTML = '<span class="connect-dot"></span>Connected';
            });
        }

        // Strava
        const stravaBtn = document.getElementById('btn-connect-strava');
        if (stravaBtn) {
            stravaBtn.addEventListener('click', connectStrava);
        }
    }

    function showAuthError(form, message) {
        const el = form.querySelector('.auth-error');
        if (el) {
            el.textContent = message;
            el.style.display = 'block';
            setTimeout(() => el.style.display = 'none', 5000);
        }
    }

    function showAuthSuccess(form, message) {
        const el = form.querySelector('.auth-success');
        if (el) {
            el.textContent = message;
            el.style.display = 'block';
        }
    }

    // ─── Paywall ───────────────────────────────────────────
    function showPaywall() {
        const modal = document.getElementById('modal-paywall');
        if (modal) {
            modal.style.display = 'flex';
            // Reset promo input
            const input = modal.querySelector('#promo-input');
            const msg = modal.querySelector('#promo-message');
            if (input) input.value = '';
            if (msg) { msg.textContent = ''; msg.className = 'promo-message'; }
        }
    }

    function hidePaywall() {
        const modal = document.getElementById('modal-paywall');
        if (modal) modal.style.display = 'none';
    }

    function bindPaywallEvents() {
        const modal = document.getElementById('modal-paywall');
        if (!modal) return;

        modal.querySelector('.modal-close')?.addEventListener('click', hidePaywall);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) hidePaywall();
        });

        // Promo code redemption
        const promoBtn = document.getElementById('btn-redeem-promo');
        const promoInput = document.getElementById('promo-input');

        if (promoBtn && promoInput) {
            const handleRedeem = async () => {
                const code = promoInput.value.trim();
                if (!code) return;

                promoBtn.classList.add('loading');
                promoBtn.disabled = true;

                const result = await redeemPromo(code);

                promoBtn.classList.remove('loading');
                promoBtn.disabled = false;

                const msgEl = document.getElementById('promo-message');
                if (result.error) {
                    if (msgEl) {
                        msgEl.textContent = result.error;
                        msgEl.className = 'promo-message error';
                    }
                } else {
                    if (msgEl) {
                        msgEl.textContent = `Pro unlocked! ${result.label}`;
                        msgEl.className = 'promo-message success';
                    }
                    updateSettingsAccountUI();
                    setTimeout(() => hidePaywall(), 1500);
                    showToast('Pro access activated!', 'success');
                }
            };

            promoBtn.addEventListener('click', handleRedeem);
            promoInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); handleRedeem(); }
            });
        }

        // App Store subscribe button (informational for now)
        const subscribeBtn = document.getElementById('btn-subscribe');
        if (subscribeBtn) {
            subscribeBtn.addEventListener('click', () => {
                showToast('App Store subscription coming soon!', 'info');
            });
        }
    }

    function checkSessionLimit(currentCount) {
        const limit = getSessionLimit();
        if (currentCount >= limit) {
            showPaywall();
            return false;
        }
        return true;
    }

    // ─── Public API ────────────────────────────────────────
    return {
        init,
        bindAuthEvents,
        signUp,
        signIn,
        signOut,
        resetPassword,
        getSession,
        isPro,
        getProLabel,
        getSessionLimit,
        checkSessionLimit,
        showPaywall,
        hidePaywall,
        redeemPromo,
        isPromoActive,
        getRedeemedPromo,
        connectStrava,
        isStravaConnected,
        importFile,
        isHealthKitAvailable,
        importHealthKitSessions,
        syncToCloud,
        syncFromCloud,
        onAuthChange: (fn) => authListeners.push(fn),
        getUser: () => currentUser,
        getSubscription: () => subscription,
        isConfigured: () => AERO_CONFIG.SUPABASE_URL && !AERO_CONFIG.SUPABASE_URL.includes('YOUR_PROJECT'),
    };
})();
