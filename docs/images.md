# Images: sources, licences and fallbacks

| What | Source | Rule |
| --- | --- | --- |
| Logged meals | The user's own photo (private bucket, owner-only RLS, signed URLs) | Never substituted. Only kept if the user chooses "Guardar también la foto". |
| Avatars and publication photos | The user's own upload (private buckets since 2.2) | Signed URLs; others can read them only for published content or a profile the owner made public. |
| Packaged products | Open Food Facts product photos (CC BY-SA) | Authentic packaging only; no generated or retouched packs. |
| Generic foods | Curated Wikimedia Commons photos (CC0, CC BY, CC BY-SA) | Each file was reviewed visually and its licence re-checked by the build script. Credits are on `/creditos`, and under each food photo on the web. |
| Recipes | The curated photo of the main ingredient | Labelled "Foto ilustrativa del ingrediente principal". |
| Anything without a photo | Original illustrations (`packages/design/src/art.ts`) | Category, meal, product and recipe illustrations. |

## Curated set
1. **Input.** `data/food-images/curation.json` lists one hand-picked Commons file per generic food slug, with optional author overrides when the metadata is not a clean name.
2. **Build.** `node scripts/images/build-food-images.mjs`:
   - fetches each file's metadata
   - rejects any licence outside the allowlist
   - writes 1:1 (512 px) and 4:3 (960×720) WebP files to `apps/web/public/food-images/`
   - generates `packages/data/src/food-images.generated.ts` with the credits. Never edit that file by hand.
3. **Serving.** Images are static, cached files served by the web app. The mobile app loads them from `EXPO_PUBLIC_API_URL`.
4. **Loading.** Images load progressively (`expo-image` and `next/image`) and fall back to the illustration on error or when offline.
5. **Current set.** 61 foods (2.2 added 34, each picked from licence-filtered candidates and checked visually), about 6 MB. Every other food uses its category illustration.

## AI-generated images
Not used yet. If they are added:
- **Scope:** recipes only.
- **Labelling:** always "Imagen ilustrativa".
- **Generation:** on demand, never per view.
- **Caching and dedup:** stored once per recipe and aspect ratio, with the model and prompt recorded.

They will never stand in for a user's meal photo or a product's packaging.
