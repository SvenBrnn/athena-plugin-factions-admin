import * as alt from 'alt-server';
import * as Athena from '@AthenaServer/api';
import { FactionFuncs } from './funcs';
import { FactionHandler } from './handler';
import { AdminCommandPermissions } from '@AthenaPlugins/athena-plugin-factions/shared/config';


/**
 * It creates a new faction.
 * @param player - alt.Player - The player who created the faction.
 * @param {string[]} name - The name of the faction.
 * @returns The result of the add function.
 */
Athena.systems.messenger.commands.register(
    'fcreate',
    '/fcreate [type: (Neutral, State, Gang)] [name] - Open faction panel if in faction.',
    AdminCommandPermissions,
    async (player: alt.Player, type: string, ...name: string[]) => {
        const playerData = Athena.document.character.get(player);
        const factionName = name.join(' ');
        if (!playerData._id) {
            Athena.player.emit.message(player, 'playerData._id is: ' + playerData._id);
            return;
        }
        const result = await FactionHandler.add({
            bank: 0,
            canDisband: true,
            name: factionName,
            type: type.toLowerCase(),
        });

        if (!result.status) {
            Athena.player.emit.message(player, result.response);
            return;
        }

        const id = result.response;
        Athena.player.emit.message(player, `Created Faction with ID: ${id}`);
    },
);

export class FactionCommands {
    static init() {
        // leave empty
    }
}
