import * as Athena from "@AthenaServer/api";
import {FactionAdminFuncs} from "./funcs";
import { AdminCommandPermissions } from "@AthenaPlugins/athena-plugin-factions/shared/config";


export function init() {
    Athena.systems.messenger.commands.register(
        'fadmin',
        '/fadmin - Open faction panel of faction.',
        AdminCommandPermissions,
        FactionAdminFuncs.openFactionList
    );
}