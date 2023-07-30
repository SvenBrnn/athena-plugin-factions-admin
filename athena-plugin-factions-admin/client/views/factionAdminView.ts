import * as alt from 'alt-client';
import * as AthenaClient from '@AthenaClient/api';
import { FACTION_ADMIN_EVENTS } from '../../shared/factionAdminEvents';
import { Faction } from '@AthenaPlugins/athena-plugin-factions/shared/interfaces';

const onOpen: Array<(view: alt.WebView, factions: Faction[]) => void> = [];
const onClose: Array<(view: alt.WebView, factions: Faction[]) => void> = [];
const onRefresh: Array<(factions: Faction[]) => void> = [];

let factions: Faction[];
let isOpen = false;

class InternalFunctions {
    static async open(_factions: Faction[], _isAdmin: boolean) {
        factions = _factions;

        // Just updates faction data dynamically for users.
        if (isOpen) {
            InternalFunctions.ready();

            for (const element of onRefresh) {
                element(factions);
            }

            return;
        }

        if (AthenaClient.webview.isAnyMenuOpen()) {
            return;
        }

        isOpen = true;

        // Must always be called first if you want to hide HUD.
        await AthenaClient.webview.setOverlaysVisible(false);

        const view = await AthenaClient.webview.get();
        view.on(FACTION_ADMIN_EVENTS.WEBVIEW.READY, InternalFunctions.ready);
        view.on(FACTION_ADMIN_EVENTS.WEBVIEW.CLOSE, InternalFunctions.close);
        view.on(FACTION_ADMIN_EVENTS.WEBVIEW.ACTION, InternalFunctions.action);

        for (const element of onOpen) {
            element(view, factions);
        }

        AthenaClient.webview.openPages([FACTION_ADMIN_EVENTS.WEBVIEW.NAME]);
        AthenaClient.webview.focus();
        AthenaClient.webview.showCursor(true);

        alt.toggleGameControls(false);
        alt.Player.local.isMenuOpen = true;

    }

    static refresh(_factions: Faction[]) {
        console.log('refresh emited!')
        if (!isOpen) {
            return;
        }
        if (!_factions) {
            InternalFunctions.close();
            return;
        }

        console.log("refreshing!");
        factions = _factions;
        InternalFunctions.ready();
    }

    static async close() {
        isOpen = false;
        factions = null;

        alt.toggleGameControls(true);
        AthenaClient.webview.setOverlaysVisible(true);

        const view = await AthenaClient.webview.get();
        view.off(FACTION_ADMIN_EVENTS.WEBVIEW.READY, InternalFunctions.ready);
        view.off(FACTION_ADMIN_EVENTS.WEBVIEW.CLOSE, InternalFunctions.close);
        view.off(FACTION_ADMIN_EVENTS.WEBVIEW.ACTION, InternalFunctions.action);

        for (const element of onClose) {
            element(view, factions);
        }

        AthenaClient.webview.closePages([FACTION_ADMIN_EVENTS.WEBVIEW.NAME]);
        AthenaClient.webview.unfocus();
        AthenaClient.webview.showCursor(false);

        alt.Player.local.isMenuOpen = false;
    }

    static async ready() {
        const view = await AthenaClient.webview.get();
        view.emit(
            FACTION_ADMIN_EVENTS.WEBVIEW.UPDATE_DATA,
            factions
        );
    }

    static action(functionName: string, ...args: any[]) {
        alt.emitServer(FACTION_ADMIN_EVENTS.PROTOCOL.INVOKE, functionName, ...args);
    }
}

export class FactionAdminView {
    static init() {
        alt.onServer(FACTION_ADMIN_EVENTS.PROTOCOL.OPEN, InternalFunctions.open);
        alt.onServer(FACTION_ADMIN_EVENTS.PROTOCOL.REFRESH, InternalFunctions.refresh);
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
    static onOpen(callback: (view: alt.WebView, factions: Faction[]) => void) {
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
    static onClose(callback: (view: alt.WebView, factions: Faction[]) => void) {
        onClose.push(callback);
    }

    /**
     * Called when data is updated from server-side and emitted to the faction members.
     *
     * @static
     * @param {(faction: Faction) => void} callback
     * @memberof FactionView
     */
    static onRefresh(callback: (factions: Faction[]) => void) {
        onRefresh.push(callback);
    }
}
