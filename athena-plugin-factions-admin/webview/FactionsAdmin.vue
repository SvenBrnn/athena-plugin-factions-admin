<template>
  <div class="factions-wrapper stack">
    <div class="toolbar split space-between">
      <span class="pl-2">Factions Admin</span>
      <Icon class="red--text red--hover hover pr-2" :size="24" icon="icon-times-circle" @click="close"/>
    </div>
    <div class="factions-box">
      <div class="pb-2">Create Faction:</div>
      <div class="split">
        <div style="flex-grow: 1;">
          <Input :onInput="(text) => inputChange(text)" style="height: 45px;" />
        </div>
        <div>
          <Button class="mr-2 ml-2"
                  style="padding: 10px !important;"
                  color="green"
                  @click="actionCreate"
          >Create
          </Button>
        </div>
      </div>
    </div>
    <div class="pl-1">
      Edit Faction:
    </div>
    <div style="width: 100%; overflow: auto;">
      <div class="factions-box" v-for="(faction, intex) in factions">
        <div class="split">
          <div class="mr-2 ml-2" style="font-size: 16pt; line-height: 42px;">{{ faction.name }}</div>
          <div class="split">
            <Button
                class="mr-2 ml-2"
                color="blue"
                @click="actionEdit(faction)"
            >Edit
            </Button>
            <Button
                class="mr-2 ml-2"
                color="red"
                @click="actionDelete(faction)"
            >Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, defineAsyncComponent} from 'vue';

import {Faction} from '@plugins/athena-plugin-factions/shared/interfaces';
import {FACTION_ADMIN_EVENTS} from '../shared/factionAdminEvents';
import {ExampleFactionData} from './utillity/exampleFactionData';

export const ComponentName = 'Factions';
export default defineComponent({
  name: ComponentName,
  components: {
    // Global Components
    Input: defineAsyncComponent(() => import('@components/Input.vue')),
    Button: defineAsyncComponent(() => import('@components/Button.vue')),
    Icon: defineAsyncComponent(() => import('@components/Icon.vue')),
  },
  props: {
    emit: Function,
  },
  data() {
    return {
      factions: null,
      factionName: ''
    };
  },
  methods: {
    setPage(pageIndex: number) {
      this.pageIndex = pageIndex;
    },
    updateFactions(
        factions: Faction[]
    ) {
      this.factions = factions;
    },
    close() {
      if (!('alt' in window)) {
        return;
      }

      alt.emit(FACTION_ADMIN_EVENTS.WEBVIEW.CLOSE);
    },
    handlePress(e: KeyboardEvent) {
      // Escape
      if (e.keyCode !== 27) {
        return;
      }

      this.close();
    },
    actionDelete(faction: Faction) {
      alt.emit(FACTION_ADMIN_EVENTS.WEBVIEW.ACTION, FACTION_ADMIN_EVENTS.PROTOCOL.DELETE_FACTION, faction._id);
    },
    actionEdit(faction: Faction) {
      this.close();
      alt.emit(FACTION_ADMIN_EVENTS.WEBVIEW.ACTION, FACTION_ADMIN_EVENTS.PROTOCOL.EDIT_FACTION, faction._id);
    },
    actionCreate() {
      console.log(this.factionName);
      if(this.factionName !== '') {
        alt.emit(FACTION_ADMIN_EVENTS.WEBVIEW.ACTION, FACTION_ADMIN_EVENTS.PROTOCOL.CREATE_FACTION, this.factionName);
      }
    },
    inputChange(text: string) {
      this.factionName = text;
    }
  },
  mounted() {
    document.addEventListener('keyup', this.handlePress);

    if ('alt' in window) {
      alt.on(FACTION_ADMIN_EVENTS.WEBVIEW.UPDATE_DATA, this.updateFactions);
      alt.emit(FACTION_ADMIN_EVENTS.WEBVIEW.READY);
    } else {
      this.factions = ExampleFactionData;
    }
  },
  unmounted() {
    if ('alt' in window) {
      alt.off(FACTION_ADMIN_EVENTS.WEBVIEW.UPDATE_DATA, this.updateFactions);
    }

    document.removeEventListener('keyup', this.handlePress);
  },
});
</script>

<style>
.toolbar {
  min-height: 35px;
  max-height: 35px;
  background-color: rgba(12, 12, 12, 1);
  border-bottom: 2px solid rgba(48, 48, 48, 1);
  border-top-right-radius: 6px;
  border-top-left-radius: 6px;
}

.factions-wrapper {
  display: flex;
  min-width: 800px;
  width: 900px;
  min-height: calc(75vh + 35px);
  max-height: calc(75vh + 35px);
  background-color: rgba(36, 36, 36, 1);
  overflow: hidden;
  border: 2px solid rgba(22, 22, 22, 1);
  box-shadow: 2px 2px 10px black;
  border-top-right-radius: 6px;
  border-top-left-radius: 6px;
}

.factions-box {
  padding: 20px 30px;
  border: 1px solid white;
  margin: 10px 2px;
}

</style>
