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

function actorFeat(actor, feat) {
    return actor?.itemTypes?.feat?.find((c => feat === c.slug))
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
    if (game.user.targets.size != 1) {
        ui.notifications.info(`Need to select 1 token of eidolon as target to set HP of summoner`);
        return
    }
    const target = game.user.targets.first().actor;
    if ("eidolon" != target?.class?.slug && "Eidolon" != target?.class?.name) {
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
};

Hooks.on("preCreateItem", (item, data) => {
    if ("condition" === data.type && data.system.slug === "drained") {
        if ("character" === item.actor?.type && "eidolon" === item.actor?.class?.slug) {
            let summoner = game.actors.get(item.actor?.getFlag(moduleName, 'summoner'))
            if (summoner) {
                addDrainedToSummoner(summoner, data);
                return false;
            }
        }
    }
});

Hooks.on("preCreateItem", async (item, data) => {
    if ("character" === item.actor?.type && "eidolon" === item.actor?.class?.slug) {
        if ("condition" === data.type && item.actor?.system?.attributes?.hp?.value === 0) {
            if ("dying" === item.slug) {
                const summonerId = item.actor.getFlag(moduleName, 'summoner')
                if (summonerId) {
                    const summoner = game.actors.get(summonerId);

                    const as = await fromUuid(f.flags.summoner);
                    as.increaseCondition('dying')
                }
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

async function addDrainedToSummoner(summoner, data) {
    const sumDrained = summoner.hasCondition(data.system.slug)
    if (!sumDrained) {
        await summoner.createEmbeddedDocuments("Item", [data]);
    }
};

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
    if (game.user.targets.size != 1) {
        ui.notifications.info(`Need to select 1 token of eidolon as target`);
        return
    }
    const target = game.user.targets.first().actor;
    if ("eidolon" != target?.class?.slug && "Eidolon" != target?.class?.name) {
        ui.notifications.info(`Need to select 1 token of eidolon as target`);
        return
    }

    const defDC = (dcByLevel.get(actor.level) ?? 50);

    const { dc, spell } = await Dialog.wait({
        title:"Use spell",
        content: `
            <h3>DC of check</h3>
            <input id="spell-dc" type="number" min="0" value=${defDC} />
            <hr><h3>Spell</h3><select id="spells">
                <option value=0>Boost Eidolon</option>
                <option value=1>Reinforce Eidolon</option>
            </select><hr>
        `,
        buttons: {
                ok: {
                    label: "Cast",
                    icon: "<i class='fa-solid fa-magic'></i>",
                    callback: (html) => { return { dc: parseInt(html[0].querySelector("#spell-dc").value), spell: parseInt(html[0].querySelector("#spells").value)} }
                },
                cancel: {
                    label: "Cancel",
                    icon: "<i class='fa-solid fa-ban'></i>",
                }
        },
        render: (html) => {
            html.parent().parent()[0].style.cssText += 'box-shadow: 0 0 10px purple;';
        },
        default: "ok"
    });

    if ( dc === undefined ) { return; }

    const degreeOfSuccess = (await actor.skills[eidolonTraditionSkill[target.ancestry.slug]??'arcana'].roll({dc:{value: dc}, skipDialog: true})).degreeOfSuccess;

    const spellUuid = spell === 0 ? 'Compendium.pf2e.spell-effects.Item.h0CKGrgjGNSg21BW' : 'Compendium.pf2e.spell-effects.Item.UVrEe0nukiSmiwfF';

    let spellObj = (await fromUuid(spellUuid)).toObject();
    spellObj.system.duration.unit = "rounds";

    if (degreeOfSuccess === 3) {
        spellObj.system.duration.value = 4;
    } else if (degreeOfSuccess === 2) {
        spellObj.system.duration.value = 3;
    }

    if (degreeOfSuccess === 3 || degreeOfSuccess === 2) {
        await actor.update({ "system.resources.focus.value": actor.system.resources.focus.value - 1})
    }

    await target.createEmbeddedDocuments("Item", [spellObj]);
};

const DECREASE_SIZE = {
    'med': [{label: 'PF2E.ActorSizeSmall', value: 'sm'}],
    'lg': [{label: 'PF2E.ActorSizeSmall', value: 'sm'}, {label: 'PF2E.ActorSizeMedium', value: 'med'}],
    'huge': [{label: 'PF2E.ActorSizeSmall', value: 'sm'}, {label: 'PF2E.ActorSizeMedium', value: 'med'}, {label: 'PF2E.ActorSizeLarge', value: 'lg'}],
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
    if ("eidolon" != actor?.class?.slug && "Eidolon" != actor?.class?.name) {
        ui.notifications.info(`Need to select 1 token of eidolon`);
        return
    }
    let currentSize = actor.system.traits.size.value;
    let dSizes = DECREASE_SIZE[currentSize];
    if (!dSizes?.length) {
        ui.notifications.info(`Eidolon can't be reduced in size`);
        return
    }

    let newSize = undefined
    if (dSizes.length === 1) {
        newSize = dSizes[0].value;
    } else {
        let options = ''
        for (var ds of dSizes) {
            options += `<option value=${ds.value}>${game.i18n.localize(ds.label)}</option>`;
        }

        newSize = await Dialog.confirm({
            title: "Shrink Down",
            content: `Select new size</br></br><select id="map">
                        ${options}
                    </select></br></br>`,
            yes: (html) => { return html.find("#map").val() }
        });
    }

    if (!newSize) {return}

    let item = await fromUuid('Compendium.pf2e-eidolon-helper.pf2e-eidolon-helper.Item.XMiNue3IsKi5kuoF');
    item = item?.toObject();
    if (!item) {return}
    item.flags = foundry.utils.mergeObject(item.flags ?? {}, { core: { sourceId: 'Compendium.pf2e-eidolon-helper.pf2e-eidolon-helper.Item.XMiNue3IsKi5kuoF' } });
    item.system.rules[0].value = newSize;

    actor.createEmbeddedDocuments("Item", [item]);
};

const checkCall = function(wrapped, ...args) {
    const context = args[1];
    const check = args[0];
    if (!context || !game.settings.get(moduleName, "eidolonRunes")) return wrapped(...args);

    let {actor} = args[1];
    if (actor) {
        const summoner = game.actors.get(actor.getFlag(moduleName, "summoner"))
        if (summoner) {
            console.log(args);
            if (args[0].slug === "strike") {
                let summonerStatistic = summoner.system.actions.find(a=>a.slug==="basic-unarmed")
                if (summonerStatistic) {
                    let modifiersForUpdate = summonerStatistic._modifiers.filter(m=>m.slug === 'weapon-potency')
                    check._modifiers.push(...modifiersForUpdate)
                }
            } else {
                let summonerStatistic = summoner.skills[args[0].slug]
                if (summonerStatistic) {
                    let modifiersForUpdate = summonerStatistic.modifiers.filter(a=>a.source && summoner.itemTypes.equipment.find(t=>t.uuid === a.source)?.isInvested);
                    check._modifiers.push(...modifiersForUpdate)
                }
            }
        }
    }

    return wrapped(...args);
};

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
        CONFIG.PF2E.Item.documentClasses.spell.prototype.getChatData = async function(htmlOptions={}, _rollOptions2={}) {
            const r = await originGetChatData.call(this, htmlOptions, _rollOptions2);
            if ("character" === this.actor?.type && "eidolon" === this.actor?.class?.slug) {
                const summonerId = this.actor.getFlag(moduleName, 'summoner')
                if (summonerId) {
                    const summoner = game.actors.get(summonerId);

                    const originStatistic = this.trickData?.statistic ?? this.spellcasting?.statistic;
                    const summonerStatistic = summoner?.spellcasting?.find(a=>a.attribute === originStatistic.attribute)

                    if (summonerStatistic && r?.isSave) {
                        const saveKey = this.system.defense.save.basic ? "PF2E.SaveDCLabelBasic" : "PF2E.SaveDCLabel";

                        r['save']['label'] = game.i18n.format(saveKey, { dc: summonerStatistic.statistic.dc.value, type: r.save.type });
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

    }


    if (game.settings.get(moduleName, "eidolonRunes")) {
        const originPrepareDerivedData = CONFIG.PF2E.Actor.documentClasses.character.prototype.prepareDerivedData;
        CONFIG.PF2E.Actor.documentClasses.character.prototype.prepareDerivedData = function() {
            originPrepareDerivedData.call(this);
            let summonerId = this.getFlag(moduleName, 'summoner')
            let eidolonId = this.getFlag(moduleName, 'eidolon')
            if (summonerId) {
                const summoner = game.actors.get(summonerId);

                const summonerStatistic = summoner?.saves
                const eidolonStatistic = this?.saves;

                const summonerArmorStatistic = summoner?.armorClass
                const eidolonArmorStatistic = this?.armorClass;

                if (eidolonStatistic && summonerStatistic) {
                    updateEidolonSaves(eidolonStatistic, summonerStatistic, "resilient")
                    updateEidolonSaves(eidolonStatistic, summonerStatistic, 'bracers-of-armor')
                }
                if (eidolonArmorStatistic && summonerArmorStatistic) {
                    updateEidolonAC(eidolonArmorStatistic, summonerArmorStatistic, " Resilient ")
                    updateEidolonAC(eidolonArmorStatistic, summonerArmorStatistic, 'bracers-of-armor')
                }
            } else if (eidolonId) {
                const eidolon = game.actors.get(eidolonId);

                const summonerStatistic = this?.saves;
                const eidolonStatistic = eidolon?.saves;

                const summonerArmorStatistic = this?.armorClass
                const eidolonArmorStatistic = eidolon?.armorClass;

                if (eidolonStatistic && summonerStatistic) {
                    updateEidolonSaves(eidolonStatistic, summonerStatistic, "resilient")
                    updateEidolonSaves(eidolonStatistic, summonerStatistic, 'bracers-of-armor')
                }
                if (eidolonArmorStatistic && summonerArmorStatistic) {
                    updateEidolonAC(eidolonArmorStatistic, summonerArmorStatistic, " Resilient ")
                    updateEidolonAC(eidolonArmorStatistic, summonerArmorStatistic, 'bracers-of-armor')
                }
            }
        }
    }

    libWrapper.register(moduleName, 'CONFIG.Actor.documentClass.prototype.prepareData', actorPrepareData, 'WRAPPER')
    libWrapper.register(moduleName, "game.pf2e.Check.roll", checkCall, "WRAPPER");

    game.pf2eeidolonhelper = foundry.utils.mergeObject(game.pf2eeidolonhelper ?? {}, {
        "setSummonerHP": setSummonerHP,
        "extendBoost": extendBoost,
        "shrinkDown": shrinkDown,
    })
});

function updateEidolonSaves(eidolonStatistic, summonerStatistic, slug) {
    let resilient = summonerStatistic.will.modifiers.find(m=>m.slug === slug)?.clone();
    let eidolonResilient = eidolonStatistic.will.modifiers.find(m=>m.slug === slug)?.clone();
    if (resilient && !eidolonResilient) {
        for (const save of Object.keys(CONFIG.PF2E.saves)) {
            eidolonStatistic[save].modifiers.push(resilient)
            eidolonStatistic[save].dc.modifiers.push(resilient)
            eidolonStatistic[save].check.modifiers.push(resilient)
        }
    } else if (!resilient && eidolonResilient) {
        let idx = eidolonStatistic.will.modifiers.indexOf(eidolonResilient)
        if (idx != -1) {
            for (const save of Object.keys(CONFIG.PF2E.saves)) {
                eidolonStatistic[save].modifiers.splice(idx, 1)
                eidolonStatistic[save].dc.modifiers.splice(idx, 1)
                eidolonStatistic[save].check.modifiers.splice(idx, 1)
            }
        }
    } else if (resilient && eidolonResilient && resilient.modifier != eidolonResilient.modifier) {
        let idx = eidolonStatistic.will.modifiers.indexOf(eidolonResilient)
        if (idx != -1) {
            for (const save of Object.keys(CONFIG.PF2E.saves)) {
                eidolonStatistic[save].modifiers.splice(idx, 1)
                eidolonStatistic[save].dc.modifiers.splice(idx, 1)
                eidolonStatistic[save].check.modifiers.splice(idx, 1)
            }
        }
        for (const save of Object.keys(CONFIG.PF2E.saves)) {
            eidolonStatistic[save].modifiers.push(resilient)
            eidolonStatistic[save].dc.modifiers.push(resilient)
            eidolonStatistic[save].check.modifiers.push(resilient)
        }
    }
}

function updateEidolonAC(eidolonStatistic, summonerStatistic, label) {
    let resilient = summonerStatistic.modifiers.find(m=>m.label.includes(label) || m.slug === label)?.clone();
    let eidolonResilient = eidolonStatistic.modifiers.find(m=>m.label.includes(label) || m.slug === label)?.clone();

    if (resilient && !eidolonResilient) {
        eidolonStatistic.modifiers.push(resilient)
    } else if (!resilient && eidolonResilient) {
        let idx = eidolonStatistic.modifiers.indexOf(eidolonResilient)
        if (idx != -1) {
            eidolonStatistic.modifiers.splice(idx, 1)
        }
    } else if (resilient && eidolonResilient && resilient.modifier != eidolonResilient.modifier) {
        let idx = eidolonStatistic.modifiers.indexOf(eidolonResilient)
        if (idx != -1) {
            eidolonStatistic.modifiers.splice(idx, 1)
        }
        eidolonStatistic.modifiers.push(resilient)
    }
}

Hooks.on('pf2e.startTurn', async (combatant, encounter, user_id) => {
    if (!game.settings.get(moduleName, "eidolonCondition")) {return}
    const actor = combatant.actor;
    if (isSummoner(actor)) {
        let ei = actor.getFlag(moduleName, "eidolon");
        if (ei) {
            ei = game.actors.get(ei);

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
                 ui.notifications.info(`${ei.name} has only ${lastAction} action${lastAction <= 1?"":"s"}`);
            }

            for (const effect of ei.itemTypes.effect) {
                await effect.onTurnStartEnd('start');
                effect.prepareBaseData();
            }
        }
    }
})

Hooks.on('pf2e.endTurn', async (combatant, encounter, user_id) => {
    if (!game.settings.get(moduleName, "eidolonCondition")) {return}
    const actor = combatant.actor;
    if (isSummoner(actor)) {
        let ei = actor.getFlag(moduleName, "eidolon");
        if (ei) {
            ei = game.actors.get(ei);
            const frightened = ei.getCondition("frightened")
            if (frightened && !frightened.isLocked) {
                await ei.decreaseCondition("frightened");
            }
            const token = game.canvas.scene.tokens.find(a=>a.actorId===ei.id);
            for (const condition of ei.conditions.active) {
                await condition.onEndTurn({ token });
            }
            for (const effect of ei.itemTypes.effect) {
                await effect.onTurnStartEnd('end');
                effect.prepareBaseData();
            }
        }
    }
});

function isSummoner(actor) {
    return "character" === actor?.type && ("summoner" === actor?.class?.slug || actor.itemTypes.feat.find(a=>a.slug==='summoner-dedication'))
};

async function dismissEidolon(actorId) {
    game.scenes.current.tokens.filter(a=>a?.actor?.id === actorId)
        .forEach(t=>{
            window?.warpgate?.dismiss(t.id)
        });
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

Hooks.on('preCreateChatMessage', async (message, user, _options, userId)=>{
    if (!message?.flags?.pf2e?.origin?.type) {return;}
    if (!messageType(message, undefined) && !messageType(message, "spell-cast")){return}
    const _obj = message.item ?? (await fromUuid(message?.flags?.pf2e?.origin?.uuid));

    const ei = game.actors.get(message.actor.getFlag(moduleName, "eidolon"));
    if (!ei) {return}
    if (!game.modules.get("pf2e-action-support-engine")?.active) {
        if (_obj?.slug === "boost-eidolon") {
            setEffectToActor(ei, "Compendium.pf2e.spell-effects.Item.h0CKGrgjGNSg21BW")
        } else if (_obj?.slug === "reinforce-eidolon") {
            setEffectToActor(ei, "Compendium.pf2e.spell-effects.Item.UVrEe0nukiSmiwfF")
        }
    }
});

async function setEffectToActor(actor, effUuid) {
    let source = await fromUuid(effUuid)
    source = source.toObject();
    source.flags = foundry.utils.mergeObject(source.flags ?? {}, { core: { sourceId: effUuid } });
    await actor.createEmbeddedDocuments("Item", [source]);
};

function actorPrepareData(wrapped) {
    wrapped()

    const actor = this
    const summonerId = actor.getFlag(moduleName, 'summoner')
    const summoner = summonerId ? game.actors.get(summonerId) : undefined

    if (!summoner) return

    if (game.settings.get(moduleName, "sharedHP")) {
        Object.defineProperty(actor.system.attributes, 'hp', {
            get() {
                return foundry.utils.deepClone(summoner.system.attributes.hp)
            },
            enumerable: true,
        })
    }

    if (game.settings.get(moduleName, "sharedHero")) {
        Object.defineProperty(actor.system.resources, 'heroPoints', {
            get() {
                return foundry.utils.deepClone(summoner.system.resources.heroPoints)
            },
            enumerable: true,
        })
    }
};

Hooks.on('preUpdateActor', (actor, updates) => {
    if (!game.settings.get(moduleName, "sharedHP")) { return }

    const summoner = game.actors.get(actor.getFlag(moduleName, "summoner"))
    const hpUpdate = updates?.system?.attributes?.hp
    if (summoner && hpUpdate) {
        summoner.update({ 'system.attributes.hp': hpUpdate }, { noHook: true })
        delete updates.system.attributes.hp
    }
});

Hooks.on('updateActor', (actor, updates, _options, id) => {
    if (!game.settings.get(moduleName, "sharedHP")) { return }
    if (!game.user.isGM) { return }

    const eidolon = game.actors.get(actor.getFlag(moduleName, "eidolon"))
    if (eidolon) {
        if (updates?.system?.attributes?.hp) {
            const data = { 'system.attributes.hp': updates.system.attributes.hp }
            eidolon.update(data, { noHook: true })
        }
    }
});

Hooks.on('preUpdateActor', (actor, updates) => {
    if (!game.settings.get(moduleName, "sharedHero")) { return }

    const summoner = game.actors.get(actor.getFlag(moduleName, "summoner"))
    const hpUpdate = updates?.system?.resources?.heroPoints
    if (summoner && hpUpdate) {
        summoner.update({ 'system.resources.heroPoints': hpUpdate }, { noHook: true })
        delete updates.system.resources.heroPoints
    }
});

Hooks.on('updateActor', (actor, updates, _options, id) => {
    if (!game.settings.get(moduleName, "sharedHero")) { return }
    if (!game.user.isGM) { return }

    const eidolon = game.actors.get(actor.getFlag(moduleName, "eidolon"))
    if (eidolon) {
        if (updates?.system?.resources?.heroPoints) {
            const data = { 'system.resources.heroPoints': updates.system.resources.heroPoints }
            eidolon.update(data, { noHook: true })
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
                eidolon.render(false, { action: 'update' })
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
                eidolon.render(false, { action: 'update' })
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
                eidolon.render(false, { action: 'update' })
            }
        }
    } else if ("character" === item.actor?.type && "eidolon" === item.actor?.class?.slug && item.slug === "drained-eidolon") {
        let summoner = game.actors.get(item.actor.getFlag(moduleName, "summoner"));
        if (summoner) {
            summoner.decreaseCondition("drained", {forceRemove: true})
        }
    }
});