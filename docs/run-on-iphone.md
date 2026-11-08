# Run Fudyu on your iPhone from Xcode

On a Mac with Xcode, CocoaPods, Node 22 and Docker Desktop, with the Mac and
the iPhone on the same Wi-Fi:

```bash
pnpm ios:xcode
```

`scripts/dev/iphone.sh` installs dependencies, starts the local database,
points the app at the Mac's Wi-Fi address (`apps/mobile/.env.local`), creates
`apps/web/.env.local` if missing, generates `apps/mobile/ios` (not committed)
and opens it in Xcode. Then:

1. Keep `pnpm dev:web` (API) and `pnpm dev:mobile` (Metro) running.
2. In Xcode pick your iPhone, set **Signing & Capabilities → Team** to your
   Apple ID and press Run. The bundle id defaults to `dev.<your-user>.fudyu`
   (`com.example.*` cannot be signed); override with `APP_IOS_BUNDLE_ID`.
3. First run on the phone: enable **Developer Mode** and trust your
   certificate (Settings → General → VPN & Device Management).

To use the app without Metro, set the Run scheme to **Release** (the code is
bundled into the app; the API and database on the Mac are still needed).
Photo, label and voice analysis need `ANTHROPIC_API_KEY` (and
`TRANSCRIPTION_*` for voice) in `apps/web/.env.local`. What to check on the
device: `docs/device-testing.md`.
