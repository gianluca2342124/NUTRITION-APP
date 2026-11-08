#!/usr/bin/env bash
# Prepares the iOS project and opens it in Xcode, with the local backend
# reachable from your iPhone over Wi-Fi. macOS only.
#
#   pnpm ios:xcode
#
# Optional: APP_IOS_BUNDLE_ID=com.yourname.fudyu pnpm ios:xcode
set -euo pipefail
cd "$(dirname "$0")/../.."

fail() { echo "✖ $1" >&2; exit 1; }

[[ "$(uname)" == "Darwin" ]] || fail "Esto necesita un Mac con Xcode."
xcode-select -p >/dev/null 2>&1 || fail "Instala Xcode (App Store), ábrelo una vez y acepta la licencia."
command -v pod >/dev/null 2>&1 || fail "Falta CocoaPods: brew install cocoapods"
command -v node >/dev/null 2>&1 || fail "Falta Node.js 22: brew install node@22"
command -v pnpm >/dev/null 2>&1 || corepack enable
docker info >/dev/null 2>&1 || fail "Abre Docker Desktop (la base de datos local corre ahí) y vuelve a ejecutar."

# An identifier your Apple ID can sign (com.example.* is reserved by Apple).
user_part="$(id -un | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9')"
export APP_IOS_BUNDLE_ID="${APP_IOS_BUNDLE_ID:-dev.${user_part:-local}.fudyu}"

# The iPhone reaches this Mac by its Wi-Fi address (same network for both).
ip="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
[[ -n "$ip" ]] || fail "No encuentro la IP Wi-Fi del Mac. Conecta el Mac y el iPhone a la misma red."

echo "→ Instalando dependencias"
pnpm install

echo "→ Arrancando la base de datos local (Supabase en Docker)"
pnpm db:start >/dev/null 2>&1 || true
status="$(pnpm exec supabase status -o json 2>/dev/null)"
read_key() { node -e 'const s=process.argv[1]; const j=JSON.parse(s.slice(s.indexOf("{"))); console.log(j[process.argv[2]] ?? "")' "$status" "$1"; }
anon="$(read_key ANON_KEY)"
service="$(read_key SERVICE_ROLE_KEY)"
[[ -n "$anon" && -n "$service" ]] || fail "La base de datos local no responde: ejecuta 'pnpm db:start' y revisa el error."

# Web API (runs on this Mac). Never overwrites a file you already have.
if [[ ! -f apps/web/.env.local ]]; then
  cat > apps/web/.env.local <<EOF
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=$anon
SUPABASE_SERVICE_ROLE_KEY=$service
PUBLIC_SITE_URL=http://$ip:3000
EOF
  echo "→ Creado apps/web/.env.local (añade ANTHROPIC_API_KEY ahí para la foto, la etiqueta y la voz)"
fi

# The app, pointed at this Mac.
cat > apps/mobile/.env.local <<EOF
EXPO_PUBLIC_SUPABASE_URL=http://$ip:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=$anon
EXPO_PUBLIC_API_URL=http://$ip:3000
EOF
echo "→ App apuntando a tu Mac: $ip"

echo "→ Generando el proyecto de Xcode ($APP_IOS_BUNDLE_ID)"
cd apps/mobile
cp package.json /tmp/fudyu-mobile-package.json
npx expo prebuild --platform ios
cp /tmp/fudyu-mobile-package.json package.json   # prebuild rewrites the run scripts
xed ios

cat <<EOF

✔ Xcode abierto con el proyecto Fudyu.

En dos terminales, desde la raíz del repositorio, deja corriendo:
   pnpm dev:web      (API en http://$ip:3000)
   pnpm dev:mobile   (Metro: sirve el código de la app al iPhone)

En Xcode:
   1. Conecta el iPhone por cable y elígelo arriba como destino.
   2. Proyecto "Fudyu" → Signing & Capabilities → Team: tu Apple ID.
   3. Pulsa ▶ (Run). La primera vez, en el iPhone: Ajustes → Privacidad y
      seguridad → Modo de desarrollador (activar), y Ajustes → General →
      VPN y gestión de dispositivos → confiar en tu certificado.
EOF
