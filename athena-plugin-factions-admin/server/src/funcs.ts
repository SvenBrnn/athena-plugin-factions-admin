import alt from "alt-server";
import {FactionHandler} from "@AthenaPlugins/athena-plugin-factions/server/src/handler";
import {FACTION_ADMIN_EVENTS} from "@AthenaPlugins/athena-plugin-factions-admin/shared/factionAdminEvents";
import * as Athena from "@AthenaServer/api";
import {FACTION_EVENTS} from "@AthenaPlugins/athena-plugin-factions/shared/factionEvents";
import { AdminCommandPermissions } from "@AthenaPlugins/athena-plugin-factions/shared/config";

export class FactionAdminFuncs {
    static async init() {
        alt.onClient(FACTION_ADMIN_EVENTS.PROTOCOL.INVOKE, this.invokeFunction)
    }

    /**
     * Verify a player is a Admin
     *
     * @static
     * @param {alt.Player} player
     * @return {*}
     * @memberof FactionPlayerFuncs
     */
    static isAdmin(player: alt.Player): boolean {
        for (const perm of AdminCommandPermissions) {
            if (Athena.player.permission.hasAccountPermission(player, perm)) {
                return true;
            }
        }
        return false;
    }

    static async openFactionList(player: alt.Player) {
        alt.emitClient(player, FACTION_ADMIN_EVENTS.PROTOCOL.OPEN, FactionHandler.getAllFactions());
    }

    static async adminFactionOpen(player: alt.Player, factionId: string) {
        const faction = FactionHandler.get(factionId);
        if (!faction) {
            Athena.player.emit.message(player, `Faction ${factionId} not found.`);
            return;
        }

        alt.emitClient(player, FACTION_EVENTS.PROTOCOL.OPEN, faction, true);
    }

    static async deleteFaction (player: alt.Player, factionId: string){
        await FactionHandler.remove(factionId);

        alt.emitClient(player, FACTION_ADMIN_EVENTS.PROTOCOL.REFRESH, FactionHandler.getAllFactions());
    }

    static async createFaction (player: alt.Player, name: string) {
        const result = await FactionHandler.add({
            bank: 0,
            canDisband: true,
            name: name,
            type: 'state',
        });

        if (!result.status) {
            Athena.player.emit.message(player, result.response);
            return;
        }

        alt.emitClient(player, FACTION_ADMIN_EVENTS.PROTOCOL.REFRESH, FactionHandler.getAllFactions());
    }

    static async invokeFunction(player: alt.Player, functionName: string, ...args: any) {
        if(!FactionAdminFuncs.isAdmin(player)) {
            console.log("Player is not an admin!")
            return;
        }

        switch (functionName) {
            case FACTION_ADMIN_EVENTS.PROTOCOL.EDIT_FACTION:
                await FactionAdminFuncs.adminFactionOpen(player, args[0]);
                break;
            case FACTION_ADMIN_EVENTS.PROTOCOL.DELETE_FACTION:
                await FactionAdminFuncs.deleteFaction(player, args[0]);
                break;
            case FACTION_ADMIN_EVENTS.PROTOCOL.CREATE_FACTION:
                await FactionAdminFuncs.createFaction(player, args[0]);
                break;
        }
    }
}