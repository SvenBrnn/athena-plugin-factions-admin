<template>
    <div class="invite-frame">
        <span class="item-info mb-4">Invite</span>
        <div class="players">
            <div class="player" v-for="(player, index) in players" :key="index">
                <div class="split">
                    <span class="pr-6">{{ player.id }}</span>
                    <span>{{ player.name }}</span>
                </div>
                <Button class="" color="green" @click="finish(player.id)">
                    <Icon :size="14" icon="icon-arrow-bold-right"></Icon>
                </Button>
            </div>
        </div>
        <div class="split split-full-width mt-4 space-between">
            <Button class="" color="red" @click="$emit('cancel-invite')">Cancel</Button>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, defineAsyncComponent } from 'vue';
import WebViewEvents from '@ViewUtility/webViewEvents';
import {FACTION_EVENTS} from "@AthenaPlugins/athena-plugin-factions/shared/factionEvents";
import {FACTION_PFUNC} from "@AthenaPlugins/athena-plugin-factions/shared/funcNames";
import { Faction } from '../../shared/interfaces';

type PlayerList = Array<{ id: number; name: string }>;

export default defineComponent({
    name: 'Invite',
    components: {
        Button: defineAsyncComponent(() => import('@ViewComponents/Button.vue')),
        Icon: defineAsyncComponent(() => import('@ViewComponents/Icon.vue')),
    },
    data() {
        return {
            players: [] as PlayerList
        };
    },
    props: {
      faction: Object as () => Faction,
      isAdmin: Boolean
    },
    methods: {
        adjust(value: number) {
            this.amount += value;
            if (this.amount < 1) {
                this.amount = 1;
            }

            if (this.amount >= this.quantity) {
                this.amount = this.quantity - 1;
            }
        },
        finish(id: number) {
          alt.emit(FACTION_EVENTS.WEBVIEW.ACTION, FACTION_PFUNC.INVITE, id, this.faction._id);
          this.$emit('cancel-invite');
        },
        setClosestPlayers(players: PlayerList) {
            this.players = players;
        },
    },
    mounted() {
        if ('alt' in window) {
            WebViewEvents.on(FACTION_EVENTS.PROTOCOL.SET_CLOSEST_PLAYERS, this.setClosestPlayers);
            WebViewEvents.emitClient(FACTION_EVENTS.WEBVIEW.GET_CLOSEST_PLAYERS, this.isAdmin);
            return;
        }

        const players = [];

        for (let i = 0; i < 25; i++) {
            players.push({ name: 'Stuyk' + '_' + i, id: i });
        }

        this.players = players;
    },
});
</script>

<style>
.invite-frame {
    display: flex;
    position: absolute;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(5px);
    width: 900px;
    min-height: calc(75vh + 35px);
    max-height: calc(75vh + 35px);
    z-index: 199;
    padding: 24px;
    box-sizing: border-box;
    flex-direction: column;
}

.split-input {
    padding: 11px;
    min-width: 36px;
    max-width: 36px;
    border: 2px solid rgba(48, 48, 48, 1);
    background: rgba(12, 12, 12, 1);
    color: white;
    font-family: 'Consolas';
}

.players {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    overflow-y: scroll;
    width: 100%;
    padding: 12px;
    box-sizing: border-box;
    border: 2px solid rgba(255, 255, 255, 0.2);
    background: rgba(0, 0, 0, 0.5);
}

.player {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    width: 100%;
    box-sizing: border-box;
    margin-bottom: 12px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-radius: 6px;
    align-items: center;
    padding: 12px;
    background: rgba(255, 255, 255, 0.1);
}
</style>
