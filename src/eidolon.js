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
    if ("summoner" != actor?.class?.slug) {
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

    const sHP = actor.system.attributes.hp.max;
    const feat = (await fromUuid("Compendium.pf2e-eidolon-helper.pf2e-eidolon-helper.Item.LnCPBh2F5tiDprR0")).toObject();
    feat.system.rules[0].value = sHP;
    feat.flags.summoner = actor.uuid

    const curFeat = actorFeat(target, "summoner-hp");
    if (curFeat) {
        curFeat.delete()
    }

    await target.createEmbeddedDocuments("Item", [feat]);
    actor.setFlag(moduleName, "eidolon", target.uuid);

    target.update({
        "system.attributes.hp.value": actor.system.attributes.hp.value,
        "system.attributes.hp.temp": actor.system.attributes.hp.temp,
    }, { "noHook": true })
    ui.notifications.info(`Summoner and Eidolon were linked`);
};

Hooks.on("preCreateItem", (item, data) => {
    if ("condition" === data.type && data.system.slug === "drained") {
        if ("character" === item.actor?.type && "eidolon" === item.actor?.class?.slug) {
            addDrainedToSummoner(item.actor, actorFeat(item.actor, "summoner-hp"), data);
            return false;
        }
    }
});

Hooks.on("preCreateItem", async (item, data) => {
    if ("character" === item.actor?.type && "eidolon" === item.actor?.class?.slug) {
        if ("condition" === data.type && item.actor?.system?.attributes?.hp?.value === 0) {
            if ("dying" === item.slug) {
                const f = actorFeat(item.actor, "summoner-hp")
                if (f && f?.flags?.summoner) {
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

async function addDrainedToSummoner(eidolon, feat, data) {
    if (!feat) {return;}
    const summoner = await fromUuid(feat.flags.summoner);
    const sumDrained = summoner.hasCondition(data.system.slug)
    if (!sumDrained) {
        await summoner.createEmbeddedDocuments("Item", [data]);
    }
}

Hooks.on("updateItem", async (item) => {
    if ("condition" === item.type && item.system.slug === "drained") {
        if ("character" === item.actor?.type && "summoner" === item.actor?.class?.slug) {

            let ei = item.actor.getFlag(moduleName, "eidolon");
            if (ei) {
                const eidolon = await fromUuid(ei);

                let eff = hasEffect(eidolon, "drained-eidolon");
                if (eff) {
                    eff = eff.toObject();
                    eff.system.rules[0].value = -(item.system.value.value ?? 1) * item.actor.level;
                    await eidolon.updateEmbeddedDocuments("Item", [eff]);
                }
            }

        }
    }
});

Hooks.on("createItem", async (item) => {
    if ("condition" === item.type && item.slug === "drained") {
        if ("character" === item.actor?.type && "summoner" === item.actor?.class?.slug) {
            let ei = item.actor.getFlag(moduleName, "eidolon");
            if (ei) {
                const eidolon = await fromUuid(ei);

                let eff = hasEffect(eidolon, "drained-eidolon");
                if (!eff) {
                    eff = (await fromUuid("Compendium.pf2e-eidolon-helper.pf2e-eidolon-helper.Item.4HfdagPN5nq5BBDV")).toObject();
                    eff.system.rules[0].value = -(item.system.value.value ?? 1) * item.actor.level;
                    await eidolon.createEmbeddedDocuments("Item", [eff]);
                }
            }
        }
    }
});

Hooks.on("deleteItem", async (item) => {
    if ("condition" === item.type && item.slug === "drained") {
        if ("character" === item.actor?.type && "summoner" === item.actor?.class?.slug) {
            let ei = item.actor.getFlag(moduleName, "eidolon");
            if (ei) {
                const eidolon = await fromUuid(ei);
                const eff = hasEffect(eidolon, "drained-eidolon");
                if (eff) {
                    await eff.delete();
                }
            }
        }
    } else if ("character" === item.actor?.type && "eidolon" === item.actor?.class?.slug && item.slug === "drained-eidolon") {
        const curFeat = actorFeat(item.actor, "summoner-hp");
        if (curFeat) {
            const summoner = await fromUuid(curFeat.flags.summoner);
            await summoner.decreaseCondition("drained", {forceRemove: true})
        }
    }
});

async function extendBoost(actor) {
    if (!actor) {
        ui.notifications.info(`Need to select Actor`);
        return
    }
    if ("summoner" != actor?.class?.slug) {
        ui.notifications.info(`Actor should be Summoner`);
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

    const defDC = (dcByLevel.get(actor.level) ?? 50) + 5;

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

    const degreeOfSuccess = (await actor.skills[eidolonTraditionSkill[target.ancestry.slug]??'arcana'].roll({dc:{value: dc}, skipDialog: true})).degreeOfSuccess;

    const spellUuid = spell === 0 ? 'Compendium.pf2e.spell-effects.Item.h0CKGrgjGNSg21BW' : 'Compendium.pf2e.spell-effects.Item.UVrEe0nukiSmiwfF';

    let spellObj = (await fromUuid(spellUuid)).toObject();
    spellObj.system.duration.unit = "rounds";

    if (degreeOfSuccess === 3) {
        spellObj.system.duration.value = 4;
    } else if (degreeOfSuccess === 2) {
        spellObj.system.duration.value = 3;
    }

    await target.createEmbeddedDocuments("Item", [spellObj]);
}

Hooks.once("init", () => {

    game.settings.register(moduleName, "sharedHP", {
        name: "Summoner-Eidolon shared HP",
        hint: "Make the hp on your summoner go down when you damage their Eidolon. Need to run marco to link summoner and eidolon",
        scope: "world",
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
        name: "Use summoner save dc for spells (Under dev)",
        hint: "Need to reload after change",
        scope: "world",
        config: true,
        default: false,
        type: Boolean,
    });

    if (game.settings.get(moduleName, "eidolonSpell")) {

        const originGetChatData = CONFIG.PF2E.Item.documentClasses.spell.prototype.getChatData;
        CONFIG.PF2E.Item.documentClasses.spell.prototype.getChatData = async function(htmlOptions={}, _rollOptions2={}) {
            const r = await originGetChatData.call(this, htmlOptions, _rollOptions2);
            if ("character" === this.actor?.type && "eidolon" === this.actor?.class?.slug) {
                const f = actorFeat(this.actor, "summoner-hp")
                if (f && f?.flags?.summoner) {
                    const summoner = await fromUuid(f.flags.summoner);

                    const originStatistic = this.trickData?.statistic ?? this.spellcasting?.statistic;
                    const summonerStatistic = summoner?.spellcasting?.find(a=>a.attribute === originStatistic.ability)

                    if (summonerStatistic && r?.isSave) {
                        const saveKey = this.system.save.basic ? "PF2E.SaveDCLabelBasic" : "PF2E.SaveDCLabel";

                        r['save']['label'] = game.i18n.format(saveKey, { dc: summonerStatistic.statistic.dc.value, type: r.save.type });
                        r['save']['breakdown'] = summonerStatistic.statistic.dc.breakdown;
                        r['save']['value'] = summonerStatistic.statistic.dc.value;
                    }

                    if (summonerStatistic && r?.isAttack) {
                        r['check']['mod'] = summonerStatistic.statistic.check.mod
                        r['check']['breakdown'] = summonerStatistic.statistic.check.breakdown
                    }
                }
            }
            return r;
        }

    }

    game.pf2eeidolonhelper = mergeObject(game.pf2eeidolonhelper ?? {}, {
        "setSummonerHP": setSummonerHP,
        "extendBoost": extendBoost,
    })
});

Hooks.on('pf2e.startTurn', async (combatant, encounter, user_id) => {
    if (!game.settings.get(moduleName, "eidolonCondition")) {return}
    const actor = combatant.actor;
    if ("character" === actor?.type && "summoner" === actor?.class?.slug) {
        let ei = actor.getFlag(moduleName, "eidolon");
        if (ei) {
            ei = await fromUuid(ei);

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
                effect.prepareBaseData();
                await effect.onTurnStart();
            }
        }
    }
})

Hooks.on('pf2e.endTurn', async (combatant, encounter, user_id) => {
    if (!game.settings.get(moduleName, "eidolonCondition")) {return}
    const actor = combatant.actor;
    if ("character" === actor?.type && "summoner" === actor?.class?.slug) {
        let ei = actor.getFlag(moduleName, "eidolon");
        if (ei) {
            ei = await fromUuid(ei);
            const frightened = ei.getCondition("frightened")
            if (frightened && !frightened.isLocked) {
                await ei.decreaseCondition("frightened");
            }
            const token = game.canvas.scene.tokens.find(a=>a.actorId===ei.id);
            for (const condition of ei.conditions.active) {
                await condition.onEndTurn({ token });
            }
            for (const effect of ei.itemTypes.effect) {
                effect.prepareBaseData();
                await effect.onTurnStart();
            }
        }
    }
});


Hooks.on('pf2e.restForTheNight', async (actor) => {
    if ("character" === actor?.type && "summoner" === actor?.class?.slug) {
        const ei = actor.getFlag(moduleName, "eidolon");
        if (ei) {
            (await fromUuid(ei)).update({
                "system.attributes.hp.value": actor.system.attributes.hp.value
            }, { "noHook": true });
        }
    }
});

Hooks.on('preUpdateActor', async (actor, data, diff, id) => {
    if (!game.settings.get(moduleName, "sharedHP")) {
        return
    }
    if (data?.system?.attributes?.hp) {
        if ("character" === actor?.type && "eidolon" === actor?.class?.slug) {
            if (data?.system?.attributes?.hp?.value === 0) {
                dismissEidolon(actor.id);
            }
            const f = actorFeat(actor, "summoner-hp")
            if (f && f?.flags?.summoner) {
                const as = await fromUuid(f.flags.summoner);

                const hp = as.system.attributes.hp;
                hp.value = data?.system?.attributes?.hp?.value;
                hp.temp = data?.system?.attributes?.hp?.temp;

                await as.update({
                    "system.attributes.hp": hp
                }, { "noHook": true })
            }
        } else if ("character" === actor?.type && "summoner" === actor?.class?.slug) {
            const ei = actor.getFlag(moduleName, "eidolon");
            if (ei) {
                const as = await fromUuid(ei);

                const hp = as.system.attributes.hp;
                hp.value = data?.system?.attributes?.hp?.value;
                hp.temp = data?.system?.attributes?.hp?.temp;

                as.update({
                    "system.attributes.hp": hp
                }, { "noHook": true });
                if (hp.value === 0) {
                    dismissEidolon(as.id);
                }
            }
        }
    }
});

async function dismissEidolon(actorId) {
    game.scenes.current.tokens.filter(a=>a?.actor?.id === actorId)
        .forEach(t=>{
            t.actor.itemTypes.effect.forEach(e=>e.delete());
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

    if (_obj.slug === "boost-eidolon") {
        const ei = await fromUuid(message.actor.getFlag(moduleName, "eidolon"));
        if (ei) {
            setEffectToActor(ei, "Compendium.pf2e.spell-effects.Item.h0CKGrgjGNSg21BW")
        }
    } else if (_obj.slug === "reinforce-eidolon") {
        const ei = await fromUuid(message.actor.getFlag(moduleName, "eidolon"));
        if (ei) {
            setEffectToActor(ei, "Compendium.pf2e.spell-effects.Item.UVrEe0nukiSmiwfF")
        }
    }
});