import * as FactionAdminCommands from "./src/commands";
import * as Athena from "@AthenaServer/api";
import alt from "alt-server";
import {FactionAdminFuncs} from "./src/funcs";
const PLUGIN_NAME = 'Athena Factions Admin';

Athena.systems.plugins.registerPlugin(PLUGIN_NAME, async () => {

    FactionAdminCommands.init();
    await FactionAdminFuncs.init();

    alt.log(`~lg~CORE ==> ${PLUGIN_NAME} was Loaded`);
});
