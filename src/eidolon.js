const moduleName = "pf2e-eidolon-helper";

const dcByLevel = new Map([
    [-1, 13],
    [0, 14],
    [1, 15],
    [2, 16],
    [3, 18],
    [4, 19],
    [5, 20],
    [6, 22],
    [7, 23],
    [8, 24],
    [9, 26],
    [10, 27],
    [11, 28],
    [12, 30],
    [13, 31],
    [14, 32],
    [15, 34],
    [16, 35],
    [17, 36],
    [18, 38],
    [19, 39],
    [20, 40],
    [21, 42],
    [22, 44],
    [23, 46],
    [24, 48],
    [25, 50],
]);

function messageType(message, type) {
    return type === message?.flags?.pf2e?.context?.type;
}

function hasEffect(actor, eff) {
    return actor?.itemTypes?.effect?.find((c => eff === c.slug))
}

async function setSummonerHP(actor) {
    if (!game.user.isGM) {
        ui.notifications.info(`Only GM can run script`);
        return
    }
    if (!actor) {
        ui.notifications.info(`Need to select Actor`);
        return
    }
    if (!isSummoner(actor)) {
        ui.notifications.info(`Actor should be Summoner`);
        return
    }
    if (game.user.targets.size !== 1) {
        ui.notifications.info(`Need to select 1 token of eidolon as target to set HP of summoner`);
        return
    }
    const target = game.user.targets.first().actor;
    if ("eidolon" !== target?.class?.slug && "Eidolon" !== target?.class?.name) {
        ui.notifications.info(`Need to select 1 token of eidolon as target to set HP of summoner`);
        return
    }

    if (actor.getFlag(moduleName, "eidolon") && target.getFlag(moduleName, "summoner")) {
        target.unsetFlag(moduleName, "summoner");
        actor.unsetFlag(moduleName, "eidolon");
        ui.notifications.info(`Summoner and Eidolon were unlinked`);
    } else {
        target.setFlag(moduleName, "summoner", actor.id);
        actor.setFlag(moduleName, "eidolon", target.id);
        ui.notifications.info(`Summoner and Eidolon were linked`);
    }
}

async function extendBoost(actor) {
    if (!actor) {
        ui.notifications.info(`Need to select Actor`);
        return
    }
    if (!isSummoner(actor)) {
        ui.notifications.info(`Actor should be Summoner`);
        return
    }
    if (!actor.system.resources.focus.value) {
        ui.notifications.info(`Actor don't have focus points`);
        return
    }
    if (game.user.targets.size !== 1) {
        ui.notifications.info(`Need to select 1 token of eidolon as target`);
        return
    }
    const target = game.user.targets.first().actor;
    if ("eidolon" !== target?.class?.slug && "Eidolon" !== target?.class?.name) {
        ui.notifications.info(`Need to select 1 token of eidolon as target`);
        return
    }

    const defDC = (dcByLevel.get(actor.level) ?? 50);

    const {dc, spell} = await foundry.applications.api.DialogV2.wait({
        window: {title: "Use spell"},
        content: `
            <h4>DC of check</h4>
            <input id="spell-dc" type="number" min="0" value=${defDC} />
            <h4>Spell</h4><select id="spells">
                <option value=0>Boost Eidolon</option>
                <option value=1>Reinforce Eidolon</option>
            </select><hr>
        `,
        buttons: [
            {
                action: 'ok',
                label: "Cast",
                icon: "<i class='fa-solid fa-magic'></i>",
                callback: (e) => {
                    return {
                        dc: parseInt(e.target.closest('form').querySelector("#spell-dc").value),
                        spell: parseInt(e.target.closest('form').querySelector("#spells").value)
                    }
                }
            },
            {
                action: 'cancel',
                label: "Cancel",
                icon: "<i class='fa-solid fa-ban'></i>",
            }
        ],
        default: "ok"
    });

    if (dc === undefined) {
        return;
    }

    const degreeOfSuccess = (await actor.skills[eidolonTraditionSkill[target.ancestry.slug] ?? 'arcana'].roll({
        dc: {value: dc},
        skipDialog: true
    })).degreeOfSuccess;

    const spellUuid = spell === 0
        ? 'Compendium.pf2e.spell-effects.Item.h0CKGrgjGNSg21BW'
        : 'Compendium.pf2e.spell-effects.Item.UVrEe0nukiSmiwfF';

    let spellObj = (await fromUuid(spellUuid)).toObject();
    spellObj.system.duration.unit = "rounds";

    if (degreeOfSuccess === 3) {
        spellObj.system.duration.value = 4;
    } else if (degreeOfSuccess === 2) {
        spellObj.system.duration.value = 3;
    }

    if (degreeOfSuccess === 3 || degreeOfSuccess === 2) {
        actor.update({"system.resources.focus.value": actor.system.resources.focus.value - 1})
    }

    target.createEmbeddedDocuments("Item", [spellObj]);
}

const DECREASE_SIZE = {
    'med': [{label: 'PF2E.ActorSizeSmall', value: 'sm'}],
    'lg': [{label: 'PF2E.ActorSizeSmall', value: 'sm'}, {label: 'PF2E.ActorSizeMedium', value: 'med'}],
    'huge': [{label: 'PF2E.ActorSizeSmall', value: 'sm'}, {label: 'PF2E.ActorSizeMedium', value: 'med'}, {
        label: 'PF2E.ActorSizeLarge',
        value: 'lg'
    }],
    'grg': [
        {label: 'PF2E.ActorSizeSmall', value: 'sm'},
        {label: 'PF2E.ActorSizeMedium', value: 'med'},
        {label: 'PF2E.ActorSizeLarge', value: 'lg'},
        {label: 'PF2E.ActorSizeHuge', value: 'huge'}
    ]
}

async function shrinkDown(actor) {
    if (!actor) {
        ui.notifications.info(`Need to select Actor`);
        return
    }
    if ("eidolon" !== actor?.class?.slug && "Eidolon" !== actor?.class?.name) {
        ui.notifications.info(`Need to select 1 token of eidolon`);
        return
    }
    let currentSize = actor.system.traits.size.value;
    let dSizes = DECREASE_SIZE[currentSize];
    if (!dSizes?.length) {
        ui.notifications.info(`Eidolon can't be reduced in size`);
        return
    }

    let newSize;
    if (dSizes.length === 1) {
        newSize = dSizes[0].value;
    } else {
        let options = ''
        for (var ds of dSizes) {
            options += `<option value=${ds.value}>${game.i18n.localize(ds.label)}</option>`;
        }

        newSize = await foundry.applications.api.DialogV2.confirm({
            window: {title: "Shrink Down"},
            content: `Select new size</br></br><select id="map">
                        ${options}
                    </select></br></br>`,
            yes: {
                callback: (e) => {
                    return e.target.closest('form').querySelector("#map").value
                }
            }
        });
    }

    if (!newSize) {
        return
    }

    let effUuid = 'Compendium.pf2e-eidolon-helper.pf2e-eidolon-helper.Item.XMiNue3IsKi5kuoF';
    let item = await fromUuid(effUuid);
    item = item?.toObject();
    if (!item) {
        return
    }
    item._stats ??= {}
    item._stats.compendiumSource = effUuid;
    item.system.rules[0].value = newSize;

    actor.createEmbeddedDocuments("Item", [item]);
}

const checkCall = function (wrapped, ...args) {
    const context = args[1];
    const check = args[0];
    if (!context || !game.settings.get(moduleName, "eidolonRunes")) return wrapped(...args);

    let {actor} = args[1];
    if (actor) {
        const summoner = game.actors.get(actor.getFlag(moduleName, "summoner"))
        if (summoner && args[0].slug !== "strike") {
            let summonerStatistic = summoner.skills[args[0].slug]
            if (summonerStatistic) {
                let modifiersForUpdate = summonerStatistic.modifiers.filter(a => a.source && summoner.itemTypes.equipment.find(t => t.uuid === a.source)?.isInvested);
                check._modifiers.push(...modifiersForUpdate)
            }
        }
    }

    return wrapped(...args);
};

const weaponData = function (wrapped) {
    if (this.actor) {
        const summoner = game.actors.get(this.actor.getFlag(moduleName, 'summoner'));
        if (summoner) {
            let weapon = summoner.itemTypes.weapon.find(w => w.slug === "handwraps-of-mighty-blows" && w.isInvested)
            if (weapon) {
                this.system.runes.potency = weapon.system.runes.potency;
                this.system.runes.striking = weapon.system.runes.striking;
                this.system.runes.property = weapon.system.runes.property.slice();
            }
        }
    }
    wrapped();

};

function isSummoner(actor) {
    return "character" === actor?.type && ("summoner" === actor?.class?.slug || actor.itemTypes.feat.find(a => a.slug === 'summoner-dedication'))
}

const eidolonTraditionSkill = {
    'angel-eidolon': 'religion',
    'anger-phantom-eidolon': 'occultism',
    'beast-eidolon': 'nature',
    'construct-eidolon': 'arcana',
    'demon-eidolon': 'religion',
    'devotion-phantom-eidolon': 'occultism',
    'dragon-eidolon': 'arcana',
    'elemental-eidolon': 'nature',
    'fey-eidolon': 'nature',
    'plant-eidolon': 'nature',
    'psychopomp-eidolon': 'religion',
    'undead-eidolon': 'religion',
}

async function setEffectToActor(actor, effUuid) {
    let source = await fromUuid(effUuid)
    source = source.toObject();
    source._stats ??= {}
    source._stats.compendiumSource = effUuid;
    actor.createEmbeddedDocuments("Item", [source]);
}

function actorPrepareData(wrapped) {
    wrapped()
    if (!game.ready) return;

    const actor = this
    const summoner = game.actors.get(actor.getFlag(moduleName, "summoner"))
    const eidolon = game.actors.get(actor.getFlag(moduleName, "eidolon"))

    if (eidolon) {
        eidolon.reset();
        eidolon.sheet?.render();
    }

    if (game.settings.get(moduleName, "sharedHP") && summoner) {
        Object.defineProperty(actor.system.attributes, 'hp', {
            get() {
                return foundry.utils.deepClone(summoner.system.attributes.hp)
            },
            enumerable: true,
        })
    }

    if (game.settings.get(moduleName, "sharedHero") && summoner) {
        Object.defineProperty(actor.system.resources, 'heroPoints', {
            get() {
                return foundry.utils.deepClone(summoner.system.resources.heroPoints)
            },
            enumerable: true,
        })
    }
}

Hooks.once("init", () => {

    game.settings.register(moduleName, "sharedHP", {
        name: "Summoner-Eidolon shared HP",
        hint: "Make the hp on your summoner go down when you damage their Eidolon. Need to run macro to link summoner and eidolon",
        scope: "world",
        requiresReload: true,
        config: true,
        default: false,
        type: Boolean,
    });
    game.settings.register(moduleName, "sharedHero", {
        name: "Share Hero Points between Summoner and Eidolon",
        scope: "world",
        requiresReload: true,
        config: true,
        default: false,
        type: Boolean,
    });
    game.settings.register(moduleName, "eidolonCondition", {
        name: "Handle Eidolon conditions during combat",
        hint: "Decrease eidolon effect/condition when start/end turn happens",
        scope: "world",
        config: true,
        default: false,
        type: Boolean,
    });
    game.settings.register(moduleName, "eidolonSpell", {
        name: "Use summoner save dc for spells",
        hint: "Need to reload after change",
        scope: "world",
        config: true,
        requiresReload: true,
        default: false,
        type: Boolean,
    });
    game.settings.register(moduleName, "eidolonRunes", {
        name: "Apply summoner runes bonuses to eidolon",
        hint: "",
        scope: "world",
        config: true,
        requiresReload: true,
        default: false,
        type: Boolean,
    });

    if (game.settings.get(moduleName, "eidolonSpell")) {

        const originGetChatData = CONFIG.PF2E.Item.documentClasses.spell.prototype.getChatData;
        CONFIG.PF2E.Item.documentClasses.spell.prototype.getChatData = async function (htmlOptions = {}, _rollOptions2 = {}) {
            const r = await originGetChatData.call(this, htmlOptions, _rollOptions2);
            if ("character" === this.actor?.type && "eidolon" === this.actor?.class?.slug) {
                const summonerId = this.actor.getFlag(moduleName, 'summoner')
                if (summonerId) {
                    const summoner = game.actors.get(summonerId);

                    const originStatistic = this.trickData?.statistic ?? this.spellcasting?.statistic;
                    const summonerStatistic = summoner?.spellcasting?.find(a => a.attribute === originStatistic.attribute)

                    if (summonerStatistic && r?.isSave) {
                        const saveKey = this.system.defense.save.basic ? "PF2E.SaveDCLabelBasic" : "PF2E.SaveDCLabel";

                        r['save']['label'] = game.i18n.format(saveKey, {dc: summonerStatistic.statistic.dc.value, type: r.save.type});
                        r['save']['breakdown'] = summonerStatistic.statistic.dc.breakdown;
                        r['save']['value'] = summonerStatistic.statistic.dc.value;
                    }

                    if (summonerStatistic && r?.isAttack) {
                        r['check']['mod'] = summonerStatistic.statistic.check.mod
                        r['check']['breakdown'] = summonerStatistic.statistic.check.breakdown
                        originStatistic.modifiers = summonerStatistic.statistic.modifiers;
                        originStatistic.check.modifiers = summonerStatistic.statistic.modifiers;
                    }
                }
            }
            return r;
        }

        libWrapper.register(moduleName, "game.pf2e.TextEditor.enrichString", function (wrapped, ...args) {
            let data = args[0]
            if (data && data[1] === 'Check' && data[2]?.includes("against:spell")) {
                if (args[1] && args[1]?.rollData && args[1]?.rollData?.actor) {
                    let actor = args[1]?.rollData?.actor;
                    if (actor?.flags?.["pf2e-eidolon-helper"]?.summoner) {
                        let summoner = game.actors.get(actor.flags["pf2e-eidolon-helper"].summoner);
                        if (summoner) {
                            args[1].rollData.actor = summoner;
                        }
                    }
                }
            }
            return wrapped(...args);
        }, "WRAPPER");
    }

    if (game.settings.get(moduleName, "eidolonRunes")) {
        const originPrepareDerivedData = CONFIG.PF2E.Actor.documentClasses.character.prototype.prepareDerivedData;
        CONFIG.PF2E.Actor.documentClasses.character.prototype.prepareDerivedData = function () {
            if (!game.ready) {
                return originPrepareDerivedData.call(this);
            }
            const summoner = game.actors.get(this.getFlag(moduleName, 'summoner'));
            if (!summoner) {
                return originPrepareDerivedData.call(this);
            }

            let acSlugs = ['bracers-of-armor']
            let savingSlugs = ['bracers-of-armor', 'resilient']
            if (summoner.wornArmor?.slug) {
                acSlugs.push(summoner.wornArmor.slug)
            }

            let bracersArmorM = summoner.system.attributes.ac.modifiers.filter(m => acSlugs.includes(m.slug));
            if (bracersArmorM.length) {
                const mm = (this.synthetics.modifiers['ac'] ??= []);

                for (const m of bracersArmorM) {
                    mm.push((options) => {
                        let modi = new game.pf2e.Modifier({
                            slug: m.slug,
                            label: m.label,
                            modifier: m.modifier,
                            type: m.type,
                        })
                        if (options.test) modi.test(options.test);
                        return modi;
                    });
                }
            }

            let savingMods = summoner.saves.fortitude.modifiers.filter(m => savingSlugs.includes(m.slug))
            if (savingMods.length) {
                const mmm = (this.synthetics.modifiers['saving-throw'] ??= []);

                for (const m of savingMods) {
                    mmm.push((options) => {
                        let modi = new game.pf2e.Modifier({
                            slug: m.slug,
                            label: m.label,
                            modifier: m.modifier,
                            type: m.type,
                        })
                        if (options.test) modi.test(options.test);
                        return modi;
                    });
                }
            }

            originPrepareDerivedData.call(this);
        }

        libWrapper.register(moduleName, 'CONFIG.PF2E.Item.documentClasses.weapon.prototype.prepareBaseData', weaponData, 'WRAPPER')
    }

    libWrapper.register(moduleName, 'CONFIG.Actor.documentClass.prototype.prepareData', actorPrepareData, 'WRAPPER')
    libWrapper.register(moduleName, "game.pf2e.Check.roll", checkCall, "WRAPPER");

    game.pf2eeidolonhelper = foundry.utils.mergeObject(game.pf2eeidolonhelper ?? {}, {
        "setSummonerHP": setSummonerHP,
        "extendBoost": extendBoost,
        "shrinkDown": shrinkDown,
    })
});

Hooks.on('preUpdateActor', (actor, updates) => {
    if (!game.settings.get(moduleName, "sharedHP")) {
        return
    }

    const summoner = game.actors.get(actor.getFlag(moduleName, "summoner"))
    const hpUpdate = updates?.system?.attributes?.hp
    if (summoner && hpUpdate) {
        summoner.update({'system.attributes.hp': hpUpdate}, {noHook: true})
        delete updates.system.attributes.hp
    }
});

Hooks.on('preUpdateActor', (actor, updates) => {
    if (!game.settings.get(moduleName, "sharedHero")) {
        return
    }

    const summoner = game.actors.get(actor.getFlag(moduleName, "summoner"))
    const hpUpdate = updates?.system?.resources?.heroPoints
    if (summoner && hpUpdate) {
        summoner.update({'system.resources.heroPoints': hpUpdate}, {noHook: true})
        delete updates.system.resources.heroPoints
    }
});

Hooks.on('updateActor', (actor, updates, _options) => {
    if (!game.settings.get(moduleName, "sharedHP")) {
        return
    }
    if (game.user !== game.users.activeGM) {
        return
    }

    const eidolon = game.actors.get(actor.getFlag(moduleName, "eidolon"))
    if (eidolon) {
        if (updates?.system?.attributes?.hp) {
            const data = {'system.attributes.hp': updates.system.attributes.hp}
            eidolon.update(data, {noHook: true})
        }
    }
});

Hooks.on('updateActor', (actor, updates, _options) => {
    if (!game.settings.get(moduleName, "sharedHero")) {
        return
    }
    if (game.user !== game.users.activeGM) {
        return
    }

    const eidolon = game.actors.get(actor.getFlag(moduleName, "eidolon"))
    if (eidolon) {
        if (updates?.system?.resources?.heroPoints) {
            const data = {'system.resources.heroPoints': updates.system.resources.heroPoints}
            eidolon.update(data, {noHook: true})
        }
    }
});

Hooks.on("updateItem", (item) => {
    if ("condition" === item.type && item.system.slug === "drained") {
        if (isSummoner(item.actor)) {
            let eidolon = game.actors.get(item.actor.getFlag(moduleName, "eidolon"));
            if (eidolon) {
                let eff = hasEffect(eidolon, "drained-eidolon");
                if (eff) {
                    eff.update({
                        system: {
                            badge: {
                                value: item.system.value.value
                            }
                        }
                    })
                }
                eidolon.render(false, {action: 'update'})
            }
        }
    }
});

Hooks.on("createItem", async (item) => {
    if ("condition" === item.type && item.system.slug === "drained") {
        if (isSummoner(item.actor)) {
            let eidolon = game.actors.get(item.actor.getFlag(moduleName, "eidolon"));
            if (eidolon) {
                let eff = hasEffect(eidolon, "drained-eidolon");
                if (!eff) {
                    eff = (await fromUuid("Compendium.pf2e-eidolon-helper.pf2e-eidolon-helper.Item.4HfdagPN5nq5BBDV")).toObject();
                    eidolon.createEmbeddedDocuments("Item", [eff]);
                }
                eidolon.render(false, {action: 'update'})
            }
        }
    }
});

Hooks.on("deleteItem", (item) => {
    if ("condition" === item.type && item.system.slug === "drained") {
        if (isSummoner(item.actor)) {
            let eidolon = game.actors.get(item.actor.getFlag(moduleName, "eidolon"));
            if (eidolon) {
                const eff = hasEffect(eidolon, "drained-eidolon");
                if (eff) {
                    eff.delete();
                }
                eidolon.render(false, {action: 'update'})
            }
        }
    } else if ("character" === item.actor?.type && "eidolon" === item.actor?.class?.slug && item.slug === "drained-eidolon") {
        let summoner = game.actors.get(item.actor.getFlag(moduleName, "summoner"));
        if (summoner) {
            summoner.decreaseCondition("drained", {forceRemove: true})
        }
    }
});

Hooks.on('preCreateChatMessage', async (message, user, _options) => {
    if (!message?.flags?.pf2e?.origin?.type) {
        return;
    }
    if (!messageType(message, undefined) && !messageType(message, "spell-cast")) {
        return
    }
    const _obj = message.item ?? (await fromUuid(message?.flags?.pf2e?.origin?.uuid));

    const ei = game.actors.get(message.actor.getFlag(moduleName, "eidolon"));
    if (!ei) {
        return
    }
    if (!game.modules.get("pf2e-action-support-engine")?.active) {
        if (_obj?.slug === "boost-eidolon") {
            setEffectToActor(ei, "Compendium.pf2e.spell-effects.Item.h0CKGrgjGNSg21BW")
        } else if (_obj?.slug === "reinforce-eidolon") {
            setEffectToActor(ei, "Compendium.pf2e.spell-effects.Item.UVrEe0nukiSmiwfF")
        }
    }
});

Hooks.on('pf2e.startTurn', async (combatant) => {
    if (!game.settings.get(moduleName, "eidolonCondition")) {
        return
    }
    const actor = combatant.actor;
    if (isSummoner(actor)) {
        let ei = game.actors.get(actor.getFlag(moduleName, "eidolon"));
        if (ei) {
            const stunned = ei.getCondition("stunned") ?? ei.getCondition("slowed");
            if (stunned && !stunned.isLocked) {
                const actionCount = (3 + (ei.hasCondition("quickened") ? 1 : 0));
                let lastAction = 0;
                if (actionCount >= stunned.value) {
                    ei.decreaseCondition(ei.getCondition("stunned") ? "stunned" : "slowed", {forceRemove: true})
                    lastAction = actionCount - stunned.value;
                } else {
                    await game.pf2e.ConditionManager.updateConditionValue(stunned.id, ei, stunned.value - actionCount)
                }
                ui.notifications.info(`${ei.name} has only ${lastAction} action${lastAction <= 1 ? "" : "s"}`);
            }

            for (const effect of ei.itemTypes.effect) {
                await effect.onTurnStartEnd('start');
                effect.prepareBaseData();
            }
        }
    }
})

Hooks.on('pf2e.endTurn', async (combatant) => {
    if (!game.settings.get(moduleName, "eidolonCondition")) {
        return
    }
    const actor = combatant.actor;
    if (isSummoner(actor)) {
        let ei = game.actors.get(actor.getFlag(moduleName, "eidolon"));
        if (ei) {
            const frightened = ei.getCondition("frightened")
            if (frightened && !frightened.isLocked) {
                await ei.decreaseCondition("frightened");
            }
            const token = game.canvas.scene.tokens.find(a => a.actorId === ei.id);
            for (const condition of ei.conditions.active) {
                await condition.onEndTurn({token});
            }
            for (const effect of ei.itemTypes.effect) {
                await effect.onTurnStartEnd('end');
                effect.prepareBaseData();
            }
        }
    }
});

Hooks.on("preCreateItem", (item, data) => {
    if ("condition" === data.type && data.system.slug === "drained") {
        if ("character" === item.actor?.type && "eidolon" === item.actor?.class?.slug) {
            let summoner = game.actors.get(item.actor?.getFlag(moduleName, 'summoner'))
            if (summoner) {
                const sumDrained = summoner.hasCondition(data.system.slug)
                if (!sumDrained) {
                    summoner.createEmbeddedDocuments("Item", [data]);
                }
                return false;
            }
        }
    }
});

Hooks.on("preCreateItem", (item, data) => {
    if ("character" === item.actor?.type && "eidolon" === item.actor?.class?.slug) {
        if ("condition" === data.type && item.actor?.system?.attributes?.hp?.value === 0) {
            return false;
        }
    }
});

Hooks.on("preCreateItem", async (item, data) => {
    if ("character" === item.actor?.type && "eidolon" === item.actor?.class?.slug) {
        if ("condition" === data.type && item.actor?.system?.attributes?.hp?.value === 0) {
            if ("dying" === item.slug) {
                const summoner = game.actors.get(item.actor.getFlag(moduleName, 'summoner'))
                if (summoner) {
                    summoner.increaseCondition('dying')
                }
            }
        }
    }
});