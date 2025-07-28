import { compilePack } from "@foundryvtt/foundryvtt-cli";

// Compile a LevelDB compendium pack.
await compilePack("packs/src/macros", "pf2e-eidolon-helper/packs/pf2e-eidolon-helper-macros");
await compilePack("packs/src/effects", "pf2e-eidolon-helper/packs/pf2e-eidolon-helper-effects");
