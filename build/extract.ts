import {extractPack} from "@foundryvtt/foundryvtt-cli";

// Extract a NeDB compendium pack.
await extractPack("packs/pf2e-eidolon-helper.db", "packs/src/effects", {nedb: true, documentType: "Item"});
await extractPack("packs/pf2e-eidolon-helper-macros.db", "packs/src/macros", {nedb: true, documentType: "Macro"});