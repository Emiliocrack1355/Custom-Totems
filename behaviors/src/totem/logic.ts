import {
  EntityComponentTypes,
  EntityHealBeforeEvent,
  EntityHealCause,
  Player,
  system,
  world,
} from "@minecraft/server";
import { MinecraftBlockTypes } from "@minecraft/vanilla-data";
import { utils } from "../system/utils";
import { HandData, ProbData, TotemData, TotemVariant } from "../system/types";

/**
 * Clase que controla toda la logica de los Custom Totems
 * @class
 * @author Emiliocrack1355 - 23/11/26 <11:25 am>
 * @LastModified 23/11/26 <04:25 pm>
 */
class TotemLogic {
  /**
   * Variable estatica que indica los efectos vanila al usar el totem
   * @readonly
   * @private
   * @author Emiliocrack1355 - 23/11/26 <02:55 pm>
   */
  private readonly vanilaTotemEffects = [
    { eff: "fire_resistance" },
    { eff: "absorption" },
    { eff: "regeneration" },
  ];

  /**
   * Variable estatica dinamica que controla los
   * escaneos de inventario por jugador
   * @readonly
   * @private
   * @author Emiliocrak1355- 23/11/26 <03:30 pm>
   */
  private readonly activeScans = new Map<String, Generator>();

  constructor() {
    this.scanTotem();
    this.TotemDetect();
  }

  /**
   * Metodo que realiza el escaneo del inventario por jugador
   * @method
   * @private
   * @author Emiliocrack1355 - 23/11/26 <03:35 pm>
   */
  private scanTotem(): void {
    system.runInterval((): void => {
      for (const player of world.getPlayers()) {
        const running = this.activeScans.get(player.id);
        if (running) {
          const { done } = running.next();
          if (done) this.activeScans.delete(player.id);
          continue;
        }
        const gen = utils.scanInventory(player);
        const { done } = gen.next();
        if (!done) this.activeScans.set(player.id, gen);
      }
    });
  }

  /**
   * Metodo que detecta el uso de un Totem
   * @method
   * @private
   * @author Emiliocrack1355 - 23/11/26 <11:45 am>
   */
  private TotemDetect(): void {
    world.beforeEvents.entityHeal.subscribe((ev): void => {
      const { healSource, healedEntity } = ev;
      if (!(healedEntity instanceof Player)) return;
      if (healSource.cause !== EntityHealCause.TotemOfUndying) return;
      const data = utils.GetHandTotem(healedEntity);
      if (!data) return;
      //  Void Totem Logic
      this.onUseTotem(healedEntity, data, ev);
    });
  }

  /**
   * Metodo de logica al confirmar el uso de un Totem
   * @param player Jugador que uso el totem
   * @param data Informacion respecto al Item y Hand donde se encuentra el totem
   * @method
   * @private
   * @author Emiliocrack1355 - 23/11/26 <11:50 am>
   * @lastModified 23/11/26 <04:25 pm>
   */
  private onUseTotem(
    player: Player,
    data: HandData,
    ev: EntityHealBeforeEvent
  ): void {
    const raw = world.getDynamicProperty(utils.WorldDynamicID);
    let config: { prob: number; cost: number } = { prob: 0, cost: 1 };
    if (typeof raw === "string") {
      try {
        config = { ...config, ...JSON.parse(raw) };
      } catch {
        console.warn("Error on Load World Dynamic Config, Default Values");
      }
    }
    const amount = data.item.amount;
    const lore = data.item.getLore()[0];
    const totemData = utils.getTotemData(
      player,
      data.hand,
      data.item,
      amount,
      config.cost,
      lore
    );
    const variant = utils.getVariant(lore);
    if (!variant) return;
    if (!totemData.hasStack) {
      utils.failedTotem(player, variant, totemData, ev);
      return;
    }
    let probData: ProbData | undefined;
    if (config.prob < 100) {
      const random = Math.floor(Math.random() * 100) + 1;
      probData = {
        hasFailed: random >= config.prob,
        rand: random,
        prob: config.prob,
      };
    }
    if (probData?.hasFailed)
      utils.failedTotem(player, variant, totemData, ev, probData);
    else utils.successTotem(player, variant, totemData, probData);
  }

  /**
   * Metodo que maneja la logica para consumir los
   * totems de la mano y del inventario
   * @param player Jugador que usa el totem
   * @param totemData Informacion respecto al totem en mano
   * @method
   * @public
   * @author Emiliocrack1355 - 23/11/26 <02:40 pm>
   */
  public onConsumeTotem(player: Player, totemData: TotemData): void {
    if (!totemData.hasStack) return;
    const equip = player.getComponent(EntityComponentTypes.Equippable);
    if (!equip) return;
    if (totemData.handAmount > 0) {
      const newHandItem = totemData.handItem.clone();
      newHandItem.amount = totemData.handAmount;
      equip.setEquipment(totemData.hand, newHandItem);
    } else {
      equip.setEquipment(totemData.hand, undefined);
    }
    if (totemData.inv) {
      const inv = player.getComponent(
        EntityComponentTypes.Inventory
      )?.container;
      if (!inv) return;
      for (const { slot, amount } of totemData.inv) {
        const it = inv.getItem(slot);
        if (!it) return;
        const remaining = it.amount - Math.min(amount, it.amount);
        if (remaining > 0) {
          const newItem = it.clone();
          newItem.amount = remaining;
          inv.setItem(slot, newItem);
        } else {
          inv.setItem(slot, undefined);
        }
      }
    }
  }

  /**
   * Metodo que otorga los efectos y/o acciones
   * al usar un totem custom
   * @param player Jugador que usa el totem
   * @param variant Variante del totem usado
   * @method
   * @public
   * @author Emiliocrack1355 - 23/11/26 <02:40 pm>
   */
  public onTotemEffect(player: Player, variant: TotemVariant): void {
    utils.applyEffects("remove", player, this.vanilaTotemEffects);
    utils.applyEffects("add", player, variant.effects);
    if (variant.sound)
      player.dimension.playSound(variant.sound, player.location);
    const { x, y, z, dim } = utils.getSpawnPoint(player);
    switch (variant.id) {
      case "§0tnt_totem":
        this.spawnTNT(player);
        break;
      case "§0ender_totem":
        // world.sendMessage(`x:${x}, y:${y}, z:${z}, dim:${dim.id}`);
        player.teleport({ x: x, y: y, z: z }, { dimension: dim });
        break;
      case "§0tp_totem":
        this.randomTp(player);
        break;
      // case "§0void_totem": break;
    }
  }

  /**
   * Metodo auxiliar que spawnea TNT alrededor
   * del jugador
   * @param player Jugador que sera el punto central
   * @method
   * @private
   * @author Emiliocrack1355 - 23/11/26 <03:00 pm>
   */
  private spawnTNT(player: Player): void {
    const { x, y, z } = player.location;
    const dim = player.dimension;
    const offsets: [number, number][] = [
      [4, 0],
      [3, 3],
      [0, 4],
      [-3, 3],
      [-4, 0],
      [-3, -3],
      [0, -4],
      [3, -3],
    ];
    for (const [ox, oz] of offsets) {
      dim.spawnEntity(
        "minecraft:tnt",
        { x: x + ox, y: y + 3, z: z + oz },
        { spawnEvent: "emi:from_totem" }
      );
    }
  }

  /**
   * Metodo auxiliar que hace tp a un punto aleatorio
   * alrededor del jugador
   * @param player Jugador afectado
   * @method
   * @private
   * @author Emiliocrack1355 - 23/11/26 <03:00 pm>
   */
  private randomTp(player: Player): void {
    const origin = { ...player.location };
    const { x, y, z } = player.location;
    const range = 16;
    const dim = player.dimension;
    const nx = x + (Math.random() * range * 2 - range);
    const nz = z + (Math.random() * range * 2 - range);
    let ny = Math.floor(y);
    while (ny < dim.heightRange.max - 1) {
      const block = dim.getBlock({ x: nx, y: ny + 1, z: nz });
      if (block?.typeId === MinecraftBlockTypes.Air) break;
      ny++;
    }
    const destination = { x: nx, y: ny + 1, z: nz };
    player.teleport(destination, { dimension: dim });
    system.runJob(utils.spawnTrail(dim, origin, destination));
  }
}

export const Totems = new TotemLogic();
