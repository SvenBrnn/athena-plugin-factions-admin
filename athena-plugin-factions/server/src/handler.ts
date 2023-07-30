import Database from '@stuyk/ezmongodb';
import * as alt from 'alt-server';
import { Collections } from '@AthenaServer/database/collections';
import { sha256Random } from '@AthenaServer/utility/hash';
import { DefaultRanks } from '../../shared/defaultData';
import { Faction, FactionCore, FactionRank } from '../../shared/interfaces';
import { Character } from '../../../../shared/interfaces/character';
import { deepCloneObject } from '../../../../shared/utility/deepCopy';
import * as Athena from '@AthenaServer/api';
import { LOCALE_KEYS } from '@AthenaShared/locale/languages/keys';
import { FactionPlayerFuncs } from './playerFuncs';
import { LocaleController } from '@AthenaShared/locale/locale';
import { FACTION_EVENTS } from '@AthenaPlugins/athena-plugin-factions/shared/factionEvents';
import { InventoryView } from '@AthenaPlugins/core-inventory/server/src/view';

export const FACTION_COLLECTION = 'factions';
const factions: { [key: string]: Faction } = {};

class InternalFunctions {
    /**
     * Create the faction and add cache it to memory.
     *
     * @static
     * @param {Faction} faction
     * @memberof InternalFunctions
     */
    static create(faction: Faction) {
        alt.logWarning('Faction create...');
        faction._id = faction._id.toString();
        factions[faction._id as string] = faction;

        if (!faction.settings) {
            faction.settings = {};
        }
        alt.logWarning('Faction create end...');
        FactionHandler.updateSettings(faction);
    }
}

export class FactionHandler {
    /**
     * Faction Types.
     * Gang can do crime actions.
     * Neutral is Neutral.
     * State can do state actions ( arrest, cuff people, etc. )
     */
    static factionTypes = {
        gang: 'GANG',
        neutral: 'NEUTRAL',
        state: 'STATE',
    };

    /**
     * Initialize Factions on Startup
     *
     * @static
     * @memberof FactionCore
     */
    static async init() {
        const factions = await Database.fetchAllData<Faction>(FACTION_COLLECTION);

        if (factions.length <= 0) {
            alt.logWarning(`No Factions have been Created`);
            return;
        }

        for (let i = 0; i < factions.length; i++) {
            InternalFunctions.create(factions[i]);
        }

        // Used to initialize internal functions for factions.
        // factionFuncs.init();
    }

    /**
     * Add a faction and return a _id if created successfully added.
     *
     * @static
     * @param {alt.Player} player
     * @param {FactionCore} _faction
     * @return {Promise<IGenericResponse>} _id
     * @memberof FactionHandler
     */
    static async add(_faction: FactionCore): Promise<any> {
        alt.logWarning('Faction add...');
        if (!_faction.name) {
            alt.logWarning(`Cannot create faction, missing faction name.`);
            return { status: false, response: `Cannot create faction, missing faction name.` };
        }

        if (!this.factionTypes[_faction.type]) {
            alt.logWarning(
                'Cannot find faction-type ' + _faction.type + '! Type will be now ' + this.factionTypes.neutral,
            );
            _faction.type = this.factionTypes.neutral;
        }

        if (_faction.bank === null || _faction.bank === undefined) {
            _faction.bank = 0;
        }

        const defaultRanks = deepCloneObject<Array<FactionRank>>(DefaultRanks);
        for (let i = 0; i < defaultRanks.length; i++) {
            defaultRanks[i].uid = sha256Random(JSON.stringify(defaultRanks[i]));
        }

        const faction: Faction = {
            ..._faction,
            members: {},
            ranks: defaultRanks,
            vehicles: [],
            storages: [],
            actions: {},
            tickActions: [],
        };

        const document = await Database.insertData<Faction>(faction, FACTION_COLLECTION, true);
        if (!document) {
            alt.logWarning(`Cannot insert faction into database.`);
            return { status: false, response: `Cannot insert faction into database.` };
        }

        alt.logWarning('Faction add... END');
        InternalFunctions.create(document);
        return { status: true, response: document._id.toString() };
    }

    /**
     * Deletes the faction forever
     * Remove all players from the faction
     * Remove all vehicles from the faction (deleted)
     * Remove all storages from the faction (deleted)
     * Faction Bank is sent to owner of faction
     *
     * @static
     * @param {string} _id
     * @memberof FactionCore
     */
    static async remove(_id: string): Promise<any> {
        // Find the faction...
        const faction = factions[_id];
        if (!faction) {
            return { status: false, response: `Faction was not found with id: ${_id}` };
        }

        // Remove the faction outright...
        const factionClone = deepCloneObject<Faction>(faction);

        // Fetch faction owner...
        const ownerIdentifier = await new Promise((resolve: Function) => {
            Object.keys(factionClone.members).forEach((key) => {
                if (!factionClone.members[key].hasOwnership) {
                    return;
                }

                return resolve(factionClone.members[key].id);
            });
            resolve(null);
        });

        // Clear all members...
        const members = await Database.fetchAllByField<Character>('faction', factionClone._id, Collections.Characters);
        let onlinePlayers: Array<alt.Player> = [];
        for (let i = 0; i < members.length; i++) {
            const member = members[i];
            member.faction = null;

            const xPlayer = alt.Player.all.find((p) => p && p.id === members[i]._id);
            const playerData = Athena.document.character.get(xPlayer);
            if (playerData && playerData.valid) {
                Athena.document.character.set(xPlayer, 'faction', null);

                // Add bank balance to owner character
                if (playerData._id === ownerIdentifier) {
                    Athena.document.character.set(xPlayer, 'bank', playerData.bank + factionClone.bank, true);
                    Athena.player.sync.currencyData(xPlayer);
                    Athena.player.emit.notification(xPlayer, `+$${factionClone.bank}`);
                }

                onlinePlayers.push(xPlayer);
            }

            // For non-logged in character owner add bank balance
            if (!xPlayer && member._id === ownerIdentifier) {
                member.bank += factionClone.bank;
                await Database.updatePartialData(
                    member._id.toString(),
                    { faction: null, bank: member.bank },
                    Collections.Characters,
                );
                continue;
            }

            // Remove faction from character
            await Database.updatePartialData(member._id.toString(), { faction: null }, Collections.Characters);
        }

        // Clear all vehicles...
        for (let i = 0; i < factionClone.vehicles.length; i++) {
            const vehicleId = factionClone.vehicles[i].id;
            const vehicle = alt.Vehicle.all.find((v) => v && v.valid && v && v.id.toString() === vehicleId);

            if (vehicle) {
                vehicle.destroy();
            }

            await Database.deleteById(vehicleId, Collections.Vehicles);
        }

        // Force close storage...
        for (let i = 0; i < onlinePlayers.length; i++) {
            if (!onlinePlayers[i] || !onlinePlayers[i].valid) {
                continue;
            }

            Athena.systems.storage.closeOnDisconnect(onlinePlayers[i], onlinePlayers[i].id.toString());
        }

        // Delete storage...
        if (factionClone.storages && Array.isArray(factionClone.storages)) {
            for (let i = 0; i < factionClone.storages.length; i++) {
                const storageId = factionClone.storages[i];
                Database.deleteById(storageId, Collections.Storage);
            }
        }

        delete factions[_id];
        await Database.deleteById(faction._id, Collections.Factions);

        return { status: true, response: `Deleted faction successfully` };
    }

    /**
     * Used to update faction data, and automatically propogate changes for
     * users with faction panel open.
     *
     * @static
     * @param {string} _id
     * @param {Partial<Faction>} partialObject
     * @return {Promise<IGenericResponse<string>>}
     * @memberof FactionCore
     */
    static async update(_id: string, partialObject: Partial<Faction>): Promise<any> {
        const faction = factions[_id];
        if (!faction) {
            return { status: false, response: `Faction was not found with id: ${_id}` };
        }

        Object.keys(faction).forEach((key) => {
            if (!partialObject[key]) {
                return;
            }

            faction[key] = partialObject[key];
        });

        await Database.updatePartialData(faction._id, partialObject, FACTION_COLLECTION);
        return { status: true, response: `Updated Faction Data` };
    }

    /**
     * Get faction data by identifier...
     *
     * @static
     * @param {string} _id
     * @return {Faction}
     * @memberof FactionCore
     */
    static get(_id: string): Faction {
        return factions[_id];
    }

    /**
     * Find a faction by name.
     *
     * @static
     * @param {string} nameOrPartialName
     * @return {*}  {(Faction | null)}
     * @memberof FactionCore
     */
    static find(nameOrPartialName: string): Faction | null {
        let faction: Faction;

        nameOrPartialName = nameOrPartialName.replace(/ /g, '').toLowerCase();

        const factionsList = Object.values(faction) as Array<Faction>;
        const index = factionsList.findIndex((f) => {
            const adjustedName = f.name.replace(/ /g, '').toLowerCase();
            if (adjustedName.includes(nameOrPartialName)) {
                return true;
            }

            return false;
        });

        if (index <= -1) {
            return null;
        }

        return factionsList[index];
    }

    /**
     * Return an array of all factions
     *
     * @static
     * @return {*}
     * @memberof FactionCore
     */
    static getAllFactions() {
        return Object.values(factions) as Array<Faction>;
    }

    /**
     * Reloads blips, markers, parking spots, etc.
     *
     * @static
     * @param {Faction} faction
     * @memberof FactionFuncs
     */
    static updateSettings(faction: Faction) {
        alt.logWarning('Faction updateSettings...');
        if (faction.settings && faction.settings.blip) {
            // Remove old markings
            Athena.controllers.blip.remove(faction._id.toString());
            Athena.controllers.interaction.remove(faction._id.toString());
            Athena.controllers.marker.remove(faction._id.toString());

            Athena.controllers.blip.append({
                uid: faction._id.toString(),
                color: faction.settings.blipColor,
                sprite: faction.settings.blip,
                pos: faction.settings.position,
                scale: 1,
                text: faction.name,
                shortRange: true,
            });

            let factionPos = new alt.Vector3(
                faction.settings.position.x,
                faction.settings.position.y,
                faction.settings.position.z,
            );

            Athena.controllers.interaction.append({
                description: faction.name,
                uid: faction._id.toString(),
                position: factionPos,
                data: [faction._id.toString()],
                callback: FactionHandler.openFactionMenu,
            });

            Athena.controllers.marker.append({
                uid: faction._id.toString(),
                pos: factionPos,
                type: 31,
                color: new alt.RGBA(255, 255, 255, 100),
            });
        } else {
            Athena.controllers.blip.remove(faction._id.toString());
            Athena.controllers.interaction.remove(faction._id.toString());
            Athena.controllers.marker.remove(faction._id.toString());
        }

        Athena.controllers.interaction.remove(`${faction._id.toString()}-storage-0`);
        Athena.controllers.interaction.remove(`${faction._id.toString()}-storage-1`);
        Athena.controllers.interaction.remove(`${faction._id.toString()}-storage-2`);
        Athena.controllers.interaction.remove(`${faction._id.toString()}-storage-3`);
        Athena.controllers.marker.remove(`${faction._id.toString()}-storage-0`);
        Athena.controllers.marker.remove(`${faction._id.toString()}-storage-1`);
        Athena.controllers.marker.remove(`${faction._id.toString()}-storage-2`);
        Athena.controllers.marker.remove(`${faction._id.toString()}-storage-3`);

        //Add storages and parking spots
        // if (faction.settings && faction.settings.parkingSpots) {
        //     for (let i = 0; i < faction.settings.parkingSpots.length; i++) {
        //         let parkingSpot = faction.settings.parkingSpots[i];
        //         let parkingSpotID = `${faction._id.toString()}-parking-${i}`;
        //         let parkingSpotPos = new alt.Vector3(parkingSpot.pos.x, parkingSpot.pos.y, parkingSpot.pos.z - 1);
        //         InteractionController.add({
        //             description: `Use Faction Garage`,
        //             uid: parkingSpotID,
        //             position: parkingSpotPos,
        //             data: [parkingSpotID],
        //             isVehicleOnly: true,
        //             callback: FactionHandler.useParkingSpot,
        //         });

        //         ServerMarkerController.append({
        //             uid: parkingSpotID,
        //             pos: parkingSpotPos,
        //             type: 36,
        //             color: new alt.RGBA(255, 255, 255, 100),
        //         });
        //     }
        // }

        if (faction.storages) {
            for (let i = 0; i < faction.storages.length; i++) {
                let storage = faction.storages[i];
                let storagePos = new alt.Vector3(storage.pos.x, storage.pos.y, storage.pos.z - 1);
                Athena.controllers.interaction.append({
                    description: `Access Faction Storage`,
                    uid: storage.name,
                    position: storagePos,
                    data: [storage.name, storage.id],
                    callback: FactionHandler.openStorage,
                });

                Athena.controllers.marker.append({
                    uid: storage.name,
                    pos: storagePos,
                    type: 1,
                    color: new alt.RGBA(255, 255, 255, 100),
                });
            }
        }
        alt.logWarning('Faction updateSettings...end');
    }

    /**
     * External callable function for opening faction storages.
     * @static
     * @param {alt.Player} player
     * @param {FACTION_STORAGE} storageName
     * @memberof FactionSystem
     */
    static async openStorage(player: alt.Player, storageName: string, storageID: string): Promise<Boolean> {
        const playerData = Athena.document.character.get(player);
        if (!playerData.faction) {
            Athena.player.emit.message(player, LocaleController.get(LOCALE_KEYS.FACTION_STORAGE_NO_ACCESS));
            return false;
        }

        const faction = FactionHandler.get(playerData.faction);
        if (!faction) {
            Athena.player.emit.message(player, LocaleController.get(LOCALE_KEYS.FACTION_STORAGE_NO_ACCESS));
            return false;
        }

        let rank = FactionPlayerFuncs.getPlayerFactionRank(player);
        if (!rank || !rank.rankPermissions.canOpenStorages) {
            if (!FactionPlayerFuncs.isAdmin(player)) {
                Athena.player.emit.notification(player, LocaleController.get(LOCALE_KEYS.FACTION_STORAGE_NO_ACCESS));
                return false;
            }
        }

        let storageIndex = faction.storages.findIndex((x) => x.name === storageName);
        if (storageIndex < 0) {
            Athena.player.emit.message(player, LocaleController.get(LOCALE_KEYS.FACTION_STORAGE_NO_ACCESS));
            return false;
        }

        //TODO Check storage rank permissions based on individual storage
        if (faction.storages[storageIndex].allowRanks.length > 0) {
        }

        const id = await Athena.systems.storage.create([]);
        const storedItems = await Athena.systems.storage.get(id);
        InventoryView.storage.open(player, storageID, storedItems, 256, true);
        return true;
    }

    static async openFactionMenu(player: alt.Player, factionID: string): Promise<Boolean> {
        const playerData = Athena.document.character.get(player);
        if (!playerData.faction) {
            Athena.player.emit.message(player, 'You have no access to this faction');
            return false;
        }

        const faction = FactionHandler.get(playerData.faction);
        if (!faction) {
            Athena.player.emit.message(player, 'You have no access to this faction');
            return false;
        }

        if (faction._id.toString() !== factionID) {
            Athena.player.emit.message(player, 'You have no access to this faction');
            return false;
        }

        alt.emitClient(player, FACTION_EVENTS.PROTOCOL.OPEN, faction);
        return true;
    }
}
