import * as alt from 'alt-client';
import * as AthenaClient from '@AthenaClient/api';
import { PLAYER_SYNCED_META } from '../../../../shared/enums/playerSynced';
import { VEHICLE_SYNCED_META } from '../../../../shared/enums/vehicleSyncedMeta';
import { FACTION_EVENTS } from '../../shared/factionEvents';
import { Faction } from '../../shared/interfaces';
import {isMenuOpen} from "alt-client";

const onOpen: Array<(view: alt.WebView, faction: Faction, isAdmin: boolean) => void> = [];
const onClose: Array<(view: alt.WebView, faction: Faction) => void> = [];
const onRefresh: Array<(faction: Faction, isAdmin: boolean) => void> = [];

let faction: Faction;
let isAdmin = false;
let isOpen = false;

export const KEY_BINDS_FACTIONS = {
    OPEN: 71,
    ACCEPT: 38,
}

class InternalFunctions {
    static async open(_faction: Faction, _isAdmin: boolean) {
        faction = _faction;
        isAdmin = _isAdmin;

        // Just updates faction data dynamically for users.
        if (isOpen) {
            InternalFunctions.ready();

            for (const element of onRefresh) {
                element(faction, isAdmin);
            }

            return;
        }

        if (AthenaClient.webview.isAnyMenuOpen() && !_isAdmin) {
            return;
        }

        isOpen = true;

        // Must always be called first if you want to hide HUD.
        await AthenaClient.webview.setOverlaysVisible(false);

        const view = await AthenaClient.webview.get();
        view.on(FACTION_EVENTS.WEBVIEW.READY, InternalFunctions.ready);
        view.on(FACTION_EVENTS.WEBVIEW.CLOSE, InternalFunctions.close);
        view.on(FACTION_EVENTS.WEBVIEW.ACTION, InternalFunctions.action);

        for (const element of onOpen) {
            element(view, faction, isAdmin);
        }

        AthenaClient.webview.openPages([FACTION_EVENTS.WEBVIEW.NAME]);
        AthenaClient.webview.focus();
        AthenaClient.webview.showCursor(true);

        alt.toggleGameControls(false);
        alt.Player.local.isMenuOpen = true;
    }

    static refresh(_faction: Faction) {
        if (!isOpen) {
            return;
        }

        if (isAdmin && faction._id !== _faction._id) {
            return;
        }
        if (!_faction) {
            InternalFunctions.close();
            return;
        }

        faction = _faction;
        InternalFunctions.ready();
    }

    static async close() {
        isOpen = false;
        faction = null;

        alt.toggleGameControls(true);
        AthenaClient.webview.setOverlaysVisible(true);

        const view = await AthenaClient.webview.get();
        view.off(FACTION_EVENTS.WEBVIEW.READY, InternalFunctions.ready);
        view.off(FACTION_EVENTS.WEBVIEW.CLOSE, InternalFunctions.close);
        view.off(FACTION_EVENTS.WEBVIEW.ACTION, InternalFunctions.action);

        for (const element of onClose) {
            element(view, faction);
        }

        AthenaClient.webview.closePages([FACTION_EVENTS.WEBVIEW.NAME]);
        AthenaClient.webview.unfocus();
        AthenaClient.webview.showCursor(false);

        alt.Player.local.isMenuOpen = false;
    }

    static async ready() {
        const view = await AthenaClient.webview.get();
        const vehicleList = InternalFunctions.getFactionVehicles(faction);

        view.emit(
            FACTION_EVENTS.WEBVIEW.UPDATE_DATA,
            faction,
            alt.Player.local.getSyncedMeta(PLAYER_SYNCED_META.DATABASE_ID),
            alt.Player.local.meta.cash + alt.Player.local.meta.bank,
            alt.Player.local.pos,
            alt.Player.local.rot,
            vehicleList,
            isAdmin
        );
    }

    /**
     * Returns an array of matching spawned vehicles for the faction.
     *
     * @static
     * @param {Faction} faction
     * @return {*}
     * @memberof InternalFunctions
     */
    private static getFactionVehicles(factionRef: Faction) {
        const spawnedVehicles = [];

        const currentVehicles = [...alt.Vehicle.all];
        for (const element of currentVehicles) {
            if (!element.hasSyncedMeta(VEHICLE_SYNCED_META.DATABASE_ID)) {
                continue;
            }

            const id = element.getSyncedMeta(VEHICLE_SYNCED_META.DATABASE_ID);
            if (factionRef.vehicles.findIndex((veh) => veh.id === id) <= -1) {
                continue;
            }

            spawnedVehicles.push(id);
        }

        return spawnedVehicles;
    }

    static action(functionName: string, ...args: any[]) {
        alt.emitServer(FACTION_EVENTS.PROTOCOL.INVOKE, functionName, ...args);
    }
}

export class FactionView {
    static init() {
        AthenaClient.systems.hotkeys.add({
            key: KEY_BINDS_FACTIONS.OPEN,
            description: 'Open Faction Window',
            identifier: 'open-faction-window',
            keyDown: function () {
                if(!isMenuOpen()) {
                    alt.emitServer(FACTION_EVENTS.PROTOCOL.OPEN);
                }
            },
        });

        AthenaClient.webview.on(FACTION_EVENTS.WEBVIEW.GET_CLOSEST_PLAYERS, FactionView.getClosestPlayers);

        alt.onServer(FACTION_EVENTS.PROTOCOL.OPEN, InternalFunctions.open);
        alt.onServer(FACTION_EVENTS.PROTOCOL.REFRESH, InternalFunctions.refresh);
    }

    static getClosestPlayers(isAdmin: boolean) {
        const playerList = [...alt.Player.all];
        const validPlayers: Array<{ name: string; id: number }> = [];

        for (let i = 0; i < playerList.length; i++) {
            if (!playerList[i].valid) {
                continue;
            }

            if (!isAdmin && playerList[i].id === alt.Player.local.id) {
                continue;
            }

            const id: number = playerList[i].getSyncedMeta(PLAYER_SYNCED_META.IDENTIFICATION_ID) as number;
            const name: string = playerList[i].getSyncedMeta(PLAYER_SYNCED_META.NAME) as string;

            if (typeof id === 'undefined' || typeof name === 'undefined') {
                continue;
            }

            const dist = AthenaClient.utility.vector.distance(alt.Player.local.pos, playerList[i].pos);
            if (dist > 10) {
                continue;
            }

            validPlayers.push({ name, id });
        }

        AthenaClient.webview.emit(FACTION_EVENTS.PROTOCOL.SET_CLOSEST_PLAYERS, validPlayers);
    }

    /**
     * Triggers a callback when the WebView is opening.
     * This is just after event registration.
     *
     * Useful for registering custom 'on' events.
     *
     * @static
     * @param {(view: alt.WebView) => void} callback
     * @memberof FactionView
     */
    static onOpen(callback: (view: alt.WebView, faction: Faction) => void) {
        onOpen.push(callback);
    }

    /**
     * Triggers a callback when the WebView is closed.
     *
     * Useful for registering custom 'off' events.
     *
     * @static
     * @param {(view: alt.WebView) => void} callback
     * @memberof FactionView
     */
    static onClose(callback: (view: alt.WebView, faction: Faction) => void) {
        onClose.push(callback);
    }

    /**
     * Called when data is updated from server-side and emitted to the faction members.
     *
     * @static
     * @param {(faction: Faction) => void} callback
     * @memberof FactionView
     */
    static onRefresh(callback: (faction: Faction) => void) {
        onRefresh.push(callback);
    }
}
