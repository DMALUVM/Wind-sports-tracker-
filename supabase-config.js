/* ============================================================
   AERO - Supabase Configuration
   Replace with your Supabase project credentials
   ============================================================ */

const AERO_CONFIG = {
    // Supabase
    SUPABASE_URL: 'https://YOUR_PROJECT.supabase.co',
    SUPABASE_ANON_KEY: 'YOUR_ANON_KEY',

    // Stripe (for subscription management)
    STRIPE_PUBLISHABLE_KEY: 'pk_live_YOUR_KEY',
    STRIPE_PRICE_ID: 'price_YOUR_PRICE_ID',

    // Strava OAuth
    STRAVA_CLIENT_ID: '',
    STRAVA_REDIRECT_URI: '',

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
                'Advanced analytics & trends',
                'Community spots',
                'Share cards & achievements',
                'GPX / FIT file import',
                'Priority support',
            ],
        },
    },
};
