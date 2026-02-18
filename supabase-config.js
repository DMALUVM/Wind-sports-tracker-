/* ============================================================
   AERO - Configuration
   Supabase + App Store + Promo Codes
   ============================================================ */

const AERO_CONFIG = {
    // Supabase
    SUPABASE_URL: 'https://mjebjyjpeetrbgvqrbom.supabase.co',
    SUPABASE_ANON_KEY: 'sb_publishable_40_NzMX4-3kZvCuuudENlQ_RlGOtcNA',

    // Strava OAuth
    STRAVA_CLIENT_ID: '',
    STRAVA_REDIRECT_URI: '',

    // Promo codes that grant Pro access (case-insensitive)
    // These are checked locally first, then against the Supabase promo_codes table
    PROMO_CODES: {
        'BETA2026': { label: 'Beta Tester', expiresAt: '2027-01-01', maxUses: 50 },
        'FOUNDER': { label: 'Founder Access', expiresAt: '2030-01-01', maxUses: 10 },
        'AEROLAUNCH': { label: 'Launch Day', expiresAt: '2026-12-31', maxUses: 200 },
    },

    // Subscription tiers
    TIERS: {
        free: {
            name: 'Free',
            maxSessions: 15,
            features: [
                'Log up to 15 sessions',
                'Basic stats & wind rose',
                'Equipment & spot tracking',
                'Manual data export',
            ],
        },
        pro: {
            name: 'Pro',
            price: '$1.99/mo',
            features: [
                'Unlimited sessions',
                'Cloud sync across devices',
                'Strava auto-import',
                'Apple Health import',
                'Advanced analytics & trends',
                'Community spots',
                'Share cards & achievements',
                'GPX / FIT file import',
                'Priority support',
            ],
        },
    },
};
