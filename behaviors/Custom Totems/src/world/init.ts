import {
  CommandPermissionLevel,
  CustomCommandParamType,
  Player,
  system,
  world,
} from "@minecraft/server";
import {
  afterEventsSimplified,
  beforeEventsSimplified,
  worldToolsSimplified,
} from "simplified-mojang-api";
import { utils } from "../system/utils";

/**
 * Clase que controla todo lo relacionado a la inicializacion del mundo
 * @class
 * @author Emiliocrack1355 - 23/11/26 <10:30 am>
 * @LastModified 23/11/26 <04:10 pm>
 */
class WorldInit {
  /**
   * Variable global que indica la version del addon
   * @readonly
   * @private
   * @author Emiliocrack1355 - 23/11/26 <10:30 am>
   */
  private readonly addonVer = "1.0";

  /**
   * Variable global que indica el estado del addon
   * @readonly
   * @private
   * @author Emiliocrack1355 - 23/11/26 <10:30 am>
   */
  private readonly addonBeta = true;

  constructor() {
    this.onWorldInit();
    this.onPlayerSpawn();
    this.loadCustomCommands();
  }

  /**
   * Metodo que ejecuta todo lo necesario al iniciar el mundo
   * @method
   * @private
   * @author Emiliocrack1355 - 23/11/26 <10:30 am>
   * @LastModified 23/11/26 <04:15 pm>
   */
  private onWorldInit(): void {
    afterEventsSimplified.onWorldReady((): void => {
      const dynamic = world.getDynamicProperty(utils.WorldDynamicID);
      if (typeof dynamic === "undefined") {
        world.setDynamicProperty(
          utils.WorldDynamicID,
          JSON.stringify({ prob: 0, cost: 1 })
        );
        console.warn(`Creating World Dynamic Values of Config`);
      } else {
        console.warn(`Load World Dynamic Values of Config`);
      }
    });
  }

  /**
   * Metodo que inicializa al jugador
   * @method
   * @private
   * @author Emiliocrack1355 - 23/11/26 <10:45 am>
   */
  private onPlayerSpawn(): void {
    afterEventsSimplified.onPlayerSpawns((args): void => {
      const { player, initialSpawn } = args;
      if (initialSpawn) {
        system.runTimeout((): void => {
          player.sendMessage({
            translate: "emi.customT.system.welcome",
            with: [this.addonVer, this.addonBeta ? "-beta" : ""],
          });
        }, worldToolsSimplified.convertSecondsToTicks(30));
      }
    });
  }

  /**
   * Metodo que carga los comandos personalizados del addon
   * @method
   * @private
   * @author Emiliocrack1355 - 23/11/26 <10:50 am>
   * @LastModified 23/11/26 <04:10 pm>
   */
  private loadCustomCommands(): void {
    beforeEventsSimplified.createCustomCommand(
      {
        name: "emi:totem",
        description: "emi.customT.cmd.totem",
        cheatsRequired: false,
        permissionLevel: CommandPermissionLevel.Any,
        mandatoryParameters: [
          { name: "emi:totem_options", type: CustomCommandParamType.Enum },
          { name: "value", type: CustomCommandParamType.Integer },
        ],
      },
      (origin, option, value): undefined => {
        const player = origin.initiator ?? origin.sourceEntity;
        if (!(player instanceof Player)) return;
        if (!player.hasTag("admin")) {
          player.sendMessage({ translate: "emi.t1.cmd.notAdmin" });
          return;
        }
        const raw = world.getDynamicProperty(utils.WorldDynamicID);
        let config: { prob: number; cost: number } = { prob: 0, cost: 1 };
        if (typeof raw === "string") {
          try {
            config = { ...config, ...JSON.parse(raw) };
          } catch {
            console.warn("Error on Load World Dynamic Config");
          }
        }
        system.run((): void => {
          switch (option) {
            case "prob":
              config.prob = value;
              world.setDynamicProperty(
                utils.WorldDynamicID,
                JSON.stringify(config)
              );
              world.sendMessage({
                translate: "emi.totems.system.setProb",
                with: [String(value)],
              });
              break;
            case "cost":
              config.cost = value;
              world.setDynamicProperty(
                utils.WorldDynamicID,
                JSON.stringify(config)
              );
              world.sendMessage({
                translate: "emi.totems.system.setCost",
                with: [String(value)],
              });
              break;
          }
        });
      },
      { "emi:totem_options": ["prob", "cost"] }
    );
  }
}

new WorldInit();
