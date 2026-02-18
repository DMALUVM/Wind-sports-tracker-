#!/bin/bash
# ============================================================
# AERO - iOS TestFlight Setup Script
# Run this AFTER: npm run cap:sync
# Usage: bash scripts/setup-ios.sh
# ============================================================

set -e

PLIST="ios/App/App/Info.plist"
ENTITLEMENTS="ios/App/App/App.entitlements"

if [ ! -f "$PLIST" ]; then
    echo "❌ ios/App/App/Info.plist not found."
    echo "   Run 'npm run cap:sync' first to generate the iOS project."
    exit 1
fi

echo "🔧 Configuring AERO for TestFlight..."

# ──────────────────────────────────────────────────────────
# 1. Set Version & Build Number
# ──────────────────────────────────────────────────────────
echo "  → Setting version 1.0.0 (build 1)..."
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString 1.0.0" "$PLIST" 2>/dev/null || \
/usr/libexec/PlistBuddy -c "Add :CFBundleShortVersionString string 1.0.0" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion 1" "$PLIST" 2>/dev/null || \
/usr/libexec/PlistBuddy -c "Add :CFBundleVersion string 1" "$PLIST"

# ──────────────────────────────────────────────────────────
# 2. Privacy Usage Descriptions (required by App Store)
# ──────────────────────────────────────────────────────────
echo "  → Adding privacy usage descriptions..."

# HealthKit
/usr/libexec/PlistBuddy -c "Set :NSHealthShareUsageDescription 'AERO reads your workout sessions to import wind sport activities recorded on Apple Watch.'" "$PLIST" 2>/dev/null || \
/usr/libexec/PlistBuddy -c "Add :NSHealthShareUsageDescription string 'AERO reads your workout sessions to import wind sport activities recorded on Apple Watch.'" "$PLIST"

/usr/libexec/PlistBuddy -c "Set :NSHealthUpdateUsageDescription 'AERO does not write data to Apple Health but this permission is required by the system.'" "$PLIST" 2>/dev/null || \
/usr/libexec/PlistBuddy -c "Add :NSHealthUpdateUsageDescription string 'AERO does not write data to Apple Health but this permission is required by the system.'" "$PLIST"

# ──────────────────────────────────────────────────────────
# 3. HealthKit Required Device Capabilities
# ──────────────────────────────────────────────────────────
echo "  → Adding HealthKit to UIRequiredDeviceCapabilities..."
# Check if healthkit is already in the array
HAS_HEALTHKIT=$(/usr/libexec/PlistBuddy -c "Print :UIRequiredDeviceCapabilities" "$PLIST" 2>/dev/null | grep -c "healthkit" || true)
if [ "$HAS_HEALTHKIT" -eq 0 ]; then
    # Ensure the array exists
    /usr/libexec/PlistBuddy -c "Add :UIRequiredDeviceCapabilities array" "$PLIST" 2>/dev/null || true
    /usr/libexec/PlistBuddy -c "Add :UIRequiredDeviceCapabilities: string healthkit" "$PLIST"
fi

# ──────────────────────────────────────────────────────────
# 4. Entitlements File
# ──────────────────────────────────────────────────────────
echo "  → Creating entitlements with HealthKit capability..."
cat > "$ENTITLEMENTS" << 'ENTITLEMENTS_EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>com.apple.developer.healthkit</key>
	<true/>
	<key>com.apple.developer.healthkit.access</key>
	<array/>
</dict>
</plist>
ENTITLEMENTS_EOF

# ──────────────────────────────────────────────────────────
# 5. Set Background Modes (for HealthKit if needed later)
# ──────────────────────────────────────────────────────────

# ──────────────────────────────────────────────────────────
# 6. App Transport Security (allow Supabase HTTPS)
# ──────────────────────────────────────────────────────────
echo "  → Configuring App Transport Security..."
/usr/libexec/PlistBuddy -c "Set :NSAppTransportSecurity:NSAllowsArbitraryLoadsInWebContent true" "$PLIST" 2>/dev/null || \
(/usr/libexec/PlistBuddy -c "Add :NSAppTransportSecurity dict" "$PLIST" 2>/dev/null || true; \
 /usr/libexec/PlistBuddy -c "Add :NSAppTransportSecurity:NSAllowsArbitraryLoadsInWebContent bool true" "$PLIST")

# ──────────────────────────────────────────────────────────
# 7. Patch Xcode project to include entitlements
# ──────────────────────────────────────────────────────────
PBXPROJ="ios/App/App.xcodeproj/project.pbxproj"
if [ -f "$PBXPROJ" ]; then
    echo "  → Linking entitlements in Xcode project..."
    if ! grep -q "App.entitlements" "$PBXPROJ"; then
        # Add CODE_SIGN_ENTITLEMENTS to build settings
        sed -i '' 's/PRODUCT_BUNDLE_IDENTIFIER = com.aero.windsportstracker;/PRODUCT_BUNDLE_IDENTIFIER = com.aero.windsportstracker;\n\t\t\t\tCODE_SIGN_ENTITLEMENTS = App\/App.entitlements;/g' "$PBXPROJ"
        echo "    ✓ Entitlements linked in project.pbxproj"
    else
        echo "    ✓ Entitlements already linked"
    fi
fi

echo ""
echo "✅ iOS project configured for TestFlight!"
echo ""
echo "Next steps in Xcode:"
echo "  1. Open ios/App/App.xcworkspace"
echo "  2. Select the 'App' target → Signing & Capabilities"
echo "  3. Select your Team / Apple Developer account"
echo "  4. Verify 'HealthKit' appears under Capabilities"
echo "     (If not: + Capability → search 'HealthKit' → add it)"
echo "  5. Product → Archive"
echo "  6. Distribute App → TestFlight (App Store Connect)"
echo ""
