import { beforeEventsSimplified } from "simplified-mojang-api";
import { MinecraftBlockTypes } from "@minecraft/vanilla-data";
import { system } from "@minecraft/server";
import { utils } from "../system/utils";

/**
 * Clase que contiene los eventos del mundo
 * @class
 * @author Emiliocrack1355 - 23/11/26 <11:00 am>
 */
class WorldEvents {
  constructor() {
    this.onPlayerUseBlock();
  }

  /**
   * Metodo que se ejecuta cuando el jugador interactua con un bloque
   * @method
   * @private
   * @author Emiliocrack1355 - 23/11/26 <11:05 am>
   */
  private onPlayerUseBlock(): void {
    beforeEventsSimplified.onInteractBlock((args): void => {
      const { player, block } = args;
      if (!block || block.typeId !== MinecraftBlockTypes.Bed) return;
      if (!player.isSneaking) return;
      args.cancel = true;
      system.run((): void => {
        const tag = player
          .getTags()
          .find((t): boolean => t.startsWith("SpawnPoint:"));
        if (tag) player.removeTag(tag);
        const { x, y, z } = block.location;
        const dim = block.dimension.id.split(":")[1];
        player.sendMessage({
          translate: "emi.customT.system.saveSpawn",
          with: [String(x), String(y), String(z), utils.formatText(dim, true)],
        });
        player.addTag(`SpawnPoint:${x},${y},${z};${dim}`);
      });
    });
  }
}

new WorldEvents();
