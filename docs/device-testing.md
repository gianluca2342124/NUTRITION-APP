# Real-device checks (iPhone)

Everything below was built and tested in the browser build only. These parts
depend on native hardware or OS behaviour and still need a run on a real
iPhone (internal EAS build installed on a registered device; nothing is
submitted to any store).

| Area | What to check | Expected |
| --- | --- | --- |
| Camera | First open of "+ → Código de barras" and "Foto de comida" | One permission prompt; live preview; "Abrir ajustes" if denied |
| Barcode | EAN-13, EAN-8 and UPC-A packs, also curved/shiny ones | Reads in ≤1 s, one success haptic, opens the product once (no double push) |
| Compare demo | Product → Comparar → Escanear otro → second pack | Returns straight to the side-by-side view with both scores |
| Plate photo / label | Capture, gallery pick, upload on 4G | "Analizando…" state, then review; needs `ANTHROPIC_API_KEY` on the server |
| Voice | Record in Spanish, stop, review | Needs `TRANSCRIPTION_*` on the server; microphone permission prompt |
| Haptics | Tab change (selection), "+" (medium), delete (medium), save (success), error, achievement (celebration) | One clear pulse each; none when "Vibración" is off in Ajustes |
| Motion | Score ring, nutrient count-up, feed add/delete, tab pill, streak flame | Smooth (60 fps); with iOS "Reduce Motion" on, no confetti and minimal movement |
| Celebrations | First entry, a streak milestone, an achievement | Confetti once; never on calorie limits; off with "Celebraciones" |
| Share card | Product → Compartir → TikTok / Instagram / Messages | System sheet with the 9:16 PNG; image matches the product |
| Liquid Glass | Floating navigation on iOS 26 | Glass island; content fades under it; "+" raised and tappable |
| Safe areas | iPhone with home indicator and with Dynamic Type at max | Last items of Hoy, Explorar and Perfil scroll clear of the navigation |
| Images | Avatar and recipe photo pickers (private storage) | Upload works; images load through signed URLs; nothing public until published or the profile is made public |

Run from Xcode on your own iPhone: `pnpm ios:xcode` (see `docs/run-on-iphone.md`).
Or an internal build: `npx eas build --profile preview --platform ios` from
`apps/mobile` (requires the owner's Expo and Apple developer accounts). The
server URL the app uses comes from `EXPO_PUBLIC_API_URL`.
