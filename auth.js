/* ============================================================
   AERO - Authentication & Subscription Module
   Handles Supabase auth, subscription state, and data sync
   ============================================================ */

const AeroAuth = (function () {
    'use strict';

    let supabase = null;
    let currentUser = null;
    let subscription = null;
    let authListeners = [];

    // ─── Initialization ────────────────────────────────────
    function init() {
        // Initialize Supabase client
        if (typeof window.supabase !== 'undefined' && AERO_CONFIG.SUPABASE_URL !== 'https://YOUR_PROJECT.supabase.co') {
            const { createClient } = window.supabase;
            supabase = createClient(AERO_CONFIG.SUPABASE_URL, AERO_CONFIG.SUPABASE_ANON_KEY);
            setupAuthListener();
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
        if (!supabase) return { error: { message: 'Supabase not configured. Add your credentials to supabase-config.js' } };
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
        if (!supabase) return { error: { message: 'Supabase not configured. Add your credentials to supabase-config.js' } };
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (!error && data.user) {
            currentUser = data.user;
        }
        return { data, error };
    }

    async function signInWithOtp(email) {
        if (!supabase) return { error: { message: 'Supabase not configured' } };
        return await supabase.auth.signInWithOtp({ email });
    }

    async function verifyOtp(email, token) {
        if (!supabase) return { error: { message: 'Supabase not configured' } };
        return await supabase.auth.verifyOtp({ email, token, type: 'email' });
    }

    async function resetPassword(email) {
        if (!supabase) return { error: { message: 'Supabase not configured' } };
        return await supabase.auth.resetPasswordForEmail(email);
    }

    async function signOut() {
        if (!supabase) {
            currentUser = null;
            renderAuthState();
            return { error: null };
        }
        const { error } = await supabase.auth.signOut();
        if (!error) {
            currentUser = null;
            subscription = null;
        }
        renderAuthState();
        return { error };
    }

    async function getSession() {
        if (!supabase) return null;
        const { data } = await supabase.auth.getSession();
        return data?.session || null;
    }

    // ─── Subscription ──────────────────────────────────────
    async function loadSubscription() {
        if (!supabase || !currentUser) return;
        try {
            const { data } = await supabase
                .from('subscriptions')
                .select('*, prices(*, products(*))')
                .in('status', ['trialing', 'active'])
                .single();
            subscription = data;
        } catch (e) {
            subscription = null;
        }
    }

    function isPro() {
        // Pro if: has active subscription, or Supabase not configured (local-only mode)
        if (AERO_CONFIG.SUPABASE_URL === 'https://YOUR_PROJECT.supabase.co') return true;
        return subscription && ['active', 'trialing'].includes(subscription.status);
    }

    function getSessionLimit() {
        return isPro() ? Infinity : AERO_CONFIG.TIERS.free.maxSessions;
    }

    async function createCheckoutSession() {
        if (!supabase || !currentUser) return null;
        try {
            const { data } = await supabase.functions.invoke('create-checkout-session', {
                body: { priceId: AERO_CONFIG.STRIPE_PRICE_ID }
            });
            return data?.url || null;
        } catch (e) {
            return null;
        }
    }

    async function openCustomerPortal() {
        if (!supabase || !currentUser) return null;
        try {
            const { data } = await supabase.functions.invoke('create-portal-session');
            if (data?.url) window.location.href = data.url;
        } catch (e) {
            return null;
        }
    }

    // ─── Cloud Sync ────────────────────────────────────────
    async function syncToCloud(sessions, equipment, spots, settings) {
        if (!supabase || !currentUser) return;
        // Upsert sessions
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

    // ─── UI Rendering ──────────────────────────────────────
    function renderAuthState() {
        const authScreen = document.getElementById('auth-screen');
        const appShell = document.getElementById('app');
        const authBtn = document.getElementById('auth-status-btn');

        if (!authScreen) return;

        if (AERO_CONFIG.SUPABASE_URL === 'https://YOUR_PROJECT.supabase.co') {
            // Demo mode - hide auth, show app
            authScreen.style.display = 'none';
            if (appShell) appShell.style.display = 'flex';
            return;
        }

        if (currentUser) {
            authScreen.style.display = 'none';
            if (appShell) appShell.style.display = 'flex';
            if (authBtn) {
                authBtn.innerHTML = `<span class="auth-avatar">${(currentUser.user_metadata?.full_name || currentUser.email || '?')[0].toUpperCase()}</span>`;
            }
        } else {
            authScreen.style.display = 'flex';
            if (appShell) appShell.style.display = 'none';
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

        // Forgot password link
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

        // Skip auth (continue without account)
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

        // Paywall
        bindPaywallEvents();

        // Settings auth section
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
        if (modal) modal.style.display = 'flex';
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

        const subscribeBtn = document.getElementById('btn-subscribe');
        if (subscribeBtn) {
            subscribeBtn.addEventListener('click', async () => {
                if (!currentUser) {
                    hidePaywall();
                    const authScreen = document.getElementById('auth-screen');
                    if (authScreen) authScreen.style.display = 'flex';
                    document.getElementById('app').style.display = 'none';
                    return;
                }
                const url = await createCheckoutSession();
                if (url) {
                    window.location.href = url;
                } else {
                    showToast('Unable to start checkout. Please try again.', 'error');
                }
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
        getSessionLimit,
        checkSessionLimit,
        showPaywall,
        hidePaywall,
        connectStrava,
        isStravaConnected,
        syncToCloud,
        syncFromCloud,
        onAuthChange: (fn) => authListeners.push(fn),
        getUser: () => currentUser,
        getSubscription: () => subscription,
        isConfigured: () => AERO_CONFIG.SUPABASE_URL !== 'https://YOUR_PROJECT.supabase.co',
    };
})();
