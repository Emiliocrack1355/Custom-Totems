import {
  Dimension,
  EntityComponentTypes,
  EntityHealBeforeEvent,
  EquipmentSlot,
  ItemStack,
  Player,
  system,
  Vector3,
  world,
} from "@minecraft/server";
import { MinecraftItemTypes } from "@minecraft/vanilla-data";
import { EffectDefinition, HandData, TotemData, TotemVariant } from "./types";
import { ProbData } from "../../../Stackeable Totems/src/system/types";
import { Totems } from "../totem/logic";

/**
 * Clase que contiene metodos auxiliares
 * @class
 * @author Emiliocrack1355 - 23/11/26 <11:10 am>
 * @LastModified 23/11/26 <04:10 pm>
 */
class Utils {
  /**
   * Variable estatica que define el World Dynamic para las configuraciones
   * @readonly
   * @public
   * @author Emiliocrack1355 - 23/11/26 <04:10 pm>
   */
  public readonly WorldDynamicID = "emi:TotemCustomConfig";

  /**
   * Variable estatica que contiene el ID del totem
   * @readonly
   * @public
   * @author Emiliocrack1355 - 23/11/26 <11:35 am>
   */
  public readonly totem = MinecraftItemTypes.TotemOfUndying;

  /**
   * Metodo para formatear el texto de una forma bonita
   * @param text Texto a ser formateado
   * @param title Si se desea con mayusculas por palabra
   * @returns texto formateado
   * @method
   * @public
   * @author Emiliocrack1355 - 23/11/26 <11:10 am>
   */
  public formatText(text: string, title = false): string {
    if (!text) return "";
    let outText = text.replaceAll("minecraft:", "").replaceAll("emi:", "");
    if (title) {
      outText = outText
        .replaceAll("_", " ")
        .split(" ")
        .map((word): string =>
          word ? word.charAt(0).toUpperCase() + word.slice(1) : word
        )
        .join("");
    }
    return outText;
  }

  /**
   * Metodo auxiliar que realiza el escaneo en el inventario
   * en busca de totems con DataValue
   * @param player Jugador al cual se le escanea
   * @method
   * @public
   * @author Emiliocrack1355 - 23/11/26 <03:40 pm>
   */
  public *scanInventory(player: Player): Generator<void, void, unknown> {
    const inv = player.getComponent(EntityComponentTypes.Inventory)?.container;
    if (!inv) return;
    for (let i = 0; i < inv.size; i++) {
      yield;
      const item = inv.getItem(i);
      if (!item || item.typeId !== this.totem) continue;
      if (item.getLore()[0]?.startsWith("§0")) continue;
      for (const variant of this.totemVariants) {
        const query =
          i <= 8
            ? `testfor @s[hasitem={item=${this.totem},location=slot.hotbar,slot=${i},data=${variant.data}}]`
            : `testfor @s[hasitem={item=${this.totem},location=slot.inventory,slot=${i - 9},data=${variant.data}}]`;
        if (!player.runCommand(query).successCount) continue;
        const newItem = item.clone();
        newItem.setLore([variant.id, ...variant.lore]);
        newItem.nameTag = variant.name;
        inv.setItem(i, newItem);
        break;
      }
    }
  }

  /**
   * Metodo para obtener la mano principal donde se posea el totem
   * @param player Jugador a analizar
   * @returns mano en donde se encuentra el totem
   * @method
   * @public
   * @author Emiliocrack1355 - 23/11/26 <11:30 am>
   */
  public GetHandTotem(player: Player): HandData | undefined {
    const comp = player.getComponent(EntityComponentTypes.Equippable);
    if (!comp) return;
    const main = comp.getEquipment(EquipmentSlot.Mainhand);
    const off = comp.getEquipment(EquipmentSlot.Offhand);
    let data = undefined;
    if (!main && off && off.typeId === this.totem) {
      data = { hand: EquipmentSlot.Offhand, item: off };
    } else if (main && !off && main.typeId === this.totem) {
      data = { hand: EquipmentSlot.Mainhand, item: main };
    } else if (
      main &&
      off &&
      main.typeId === this.totem &&
      off.typeId === this.totem
    ) {
      data = { hand: EquipmentSlot.Offhand, item: off };
    }
    if (!data) return;
    return data;
  }

  /**
   * Metodo auxiliar para obtener toda la data del Totem
   * @param player Jugador que posee el totem
   * @param slot Slot de mano en donde se encuentra el totem
   * @param item Item de la mano
   * @param amount Cantidad de totem en la mano
   * @param cost Costo por el uso del totem
   * @param lore Lore del totem para su ID
   * @returns
   */
  public getTotemData(
    player: Player,
    slot: EquipmentSlot,
    item: ItemStack,
    amount: number,
    cost: number,
    lore: string
  ): TotemData {
    if (amount >= cost)
      return {
        hasStack: true,
        hand: slot,
        handItem: item,
        handAmount: amount - cost,
      };
    const inv = player.getComponent(EntityComponentTypes.Inventory)?.container;
    if (!inv) return { hasStack: false };
    let reqs = cost - amount;
    const itemsInv: { slot: number; amount: number }[] = [];
    for (let i = 0; i < inv.size; i++) {
      if (reqs <= 0) break;
      if (slot === EquipmentSlot.Mainhand && i === player.selectedSlotIndex)
        continue;
      const it = inv.getItem(i);
      if (!it || it.typeId !== this.totem) continue;
      if (it.getLore()[0] !== lore) continue;
      const take = Math.min(it.amount, reqs);
      itemsInv.push({ slot: i, amount: take });
      reqs -= take;
    }
    return reqs <= 0
      ? {
          hasStack: true,
          hand: slot,
          handItem: item,
          handAmount: 0,
          inv: itemsInv,
        }
      : { hasStack: false };
  }

  /**
   * Metodo auxiliar que busca la informacion de una
   * variante de totem
   * @param lore Variante a buscar
   * @returns Informacion de la variante
   * @method
   * @public
   * @author Emiliocrack1355 - 23/11/26 <01:48 pm>
   */
  public getVariant(lore: String): TotemVariant | undefined {
    return lore
      ? this.totemVariants.find((v): Boolean => v.id === lore)
      : undefined;
  }

  /**
   * Metodo auxiliar que anuncia por el chat cuyando al
   * usar un totem este falla
   * @param player Jugador que usa el totem
   * @param lore Lore para identificar el ID
   * @param totemData Informacion respecto al Totem
   * @param probData Informacion respecto a la probabilidad de uso
   * @method
   * @public
   * @author Emiliocrack1355 - 23/11/26 <01:55 pm>
   */
  public failedTotem(
    player: Player,
    variant: TotemVariant,
    totemData: TotemData,
    ev: EntityHealBeforeEvent,
    probData?: ProbData
  ): void {
    //  Void Totem
    ev.cancel = true;
    if (!totemData.hasStack) {
      world.sendMessage({
        translate: "emi.customT.useTotem.notEnought",
        with: [player.name],
      });
      return;
    }
    if (probData) {
      world.sendMessage({
        translate: "emi.customT.useTotem.fail",
        with: [
          player.name,
          variant.name,
          String(probData.rand),
          String(probData.prob),
        ],
      });
      return;
    }
  }

  /**
   * Metodo auxiliar que anuncia por el chat cuando alguien
   * utiliza un totem
   * @param player Jugador que usa el totem
   * @param variant Variante del totem
   * @param totemData Informacion respecto al Totem
   * @param probData Informacion respecto a la probabilidad de uso
   * @method
   * @public
   * @author Emiliocrack1355 - 23/11/26 <02:30 pm>
   */
  public successTotem(
    player: Player,
    variant: TotemVariant,
    totemData: TotemData,
    probData?: ProbData
  ): void {
    //  Void Logic
    if (probData) {
      world.sendMessage({
        translate: "emi.customT.useTotem.prob",
        with: [
          player.name,
          variant.name,
          String(probData.rand),
          String(probData.prob),
        ],
      });
    } else {
      world.sendMessage({
        translate: "emi.customT.useTotem",
        with: [player.name, variant.name],
      });
    }
    system.run((): void => {
      Totems.onTotemEffect(player, variant);
      Totems.onConsumeTotem(player, totemData);
    });
  }

  /**
   * Metodo auxiliar que permite agregar o eliminar
   * efectos del jugador
   * @param type Accion del effecto
   * @param player Jugador afectado
   * @param effects Lista de effectos
   * @method
   * @public
   * @author Emiliocrack1355 - 23/11/26 <02:55 pm>
   */
  public applyEffects(
    type: "add" | "remove",
    player: Player,
    effects: EffectDefinition[]
  ): void {
    for (const { eff, dur, amp } of effects) {
      if (type === "remove") player.removeEffect(eff);
      else if ((type = "add"))
        player.addEffect(eff, (dur ?? 10) * 20, { amplifier: amp ?? 0 });
    }
  }

  /**
   * Metodo auxiliar para obtener el spawnpoint del jugador,
   * en caso de no existir, se retorna el world spawn
   * @param player El jugador que uso el totem
   * @returns Retorna el SpawnPoint del jugador o el Spawn por defecto del mundo
   * @method
   * @public
   * @author Emiliocrack1355 - 23/11/26 <03:00 pm>
   */
  public getSpawnPoint(player: Player): {
    x: number;
    y: number;
    z: number;
    dim: Dimension;
  } {
    const spawnPoint = player
      .getTags()
      .find((t): boolean => t.startsWith("SpawnPoint:"));
    if (!spawnPoint) {
      // world.sendMessage("def world spawn");
      const { x, z } = world.getDefaultSpawnLocation();
      const dim = world.getDimension("overworld");
      const topBlock = dim.getTopmostBlock({ x, z });
      const y = topBlock ? topBlock.y + 1 : 100;
      return { x: x, y: y, z: z, dim: dim };
    } else {
      // world.sendMessage("spawnpoint");
      const spawn = spawnPoint.split(":")[1];
      const [coords, dimension] = spawn.split(";");
      const [x, y, z] = coords.split(",");
      const dim = world.getDimension(dimension);
      return { x: Number(x), y: Number(y), z: Number(z), dim: dim };
    }
  }

  /**
   * Metodo auxiliar generador que crea un rastro de particulas
   * entre dos puntos, repartido en varios ticks para evitar lag,
   * con una dispersion aleatoria alrededor de cada punto de la linea
   * @param dim La dimension en donde se genera el rastro
   * @param start Posicion inicial del rastro
   * @param end Posicion final del rastro
   * @param particlesPerStep Cantidad de particulas generadas por cada punto del rastro
   * @param spreadRadius Radio maximo de dispersion aleatoria por particula
   * @method
   * @public
   * @author Emiliocrack1355 - 23/11/26 <03:00 pm>
   */
  public *spawnTrail(
    dim: Dimension,
    start: Vector3,
    end: Vector3,
    particlesPerStep: number = 6,
    spreadRadius: number = 0.75
  ): Generator<void, void, unknown> {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dz = end.z - start.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const steps = Math.max(1, Math.ceil(distance * 2));

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const point = {
        x: start.x + dx * t,
        y: start.y + dy * t + 1.75,
        z: start.z + dz * t,
      };
      for (let p = 0; p < particlesPerStep; p++) {
        const offset = this.randomSphereOffset(spreadRadius);
        const finalPoint = {
          x: point.x + offset.x,
          y: point.y + offset.y,
          z: point.z + offset.z,
        };
        try {
          dim.spawnParticle("minecraft:basic_portal_particle", finalPoint);
        } catch {}
      }
      yield;
    }
  }

  /**
   * Metodo auxiliar que genera un offset aleatorio dentro de una esfera,
   * con distribucion uniforme en volumen
   * @param radius Radio maximo de la esfera
   * @returns Retorna un vector {x, y, z} dentro del radio dado
   * @method
   * @private
   * @author Emiliocrack1355 - 23/11/26 <03:00 pm>
   * @nota Me apoye de IA porque la matematica esta compleja xD
   */
  private randomSphereOffset(radius: number): {
    x: number;
    y: number;
    z: number;
  } {
    const r = radius * Math.cbrt(Math.random());
    const theta = Math.random() * 2 * Math.PI; // angulo azimutal
    const phi = Math.acos(2 * Math.random() - 1); // angulo polar
    return {
      x: r * Math.sin(phi) * Math.cos(theta),
      y: r * Math.sin(phi) * Math.sin(theta),
      z: r * Math.cos(phi),
    };
  }

  /**
   * Variable donde se almacenan todos los tipos de totems custom
   * @readonly
   * @readonly
   * @author Emiliocrack1355 - 23/11/26 <01:50 pm>
   */
  public readonly totemVariants: TotemVariant[] = [
    {
      id: "§0vanila_totem",
      data: 0,
      name: "§r§eVanila Totem",
      lore: ["§r§9On Use: Normal Totem"],
      effects: [
        { eff: "fire_resistance", dur: 15, amp: 0 },
        { eff: "absorption", dur: 15, amp: 0 },
        { eff: "regeneration", dur: 45, amp: 0 },
      ],
    },
    {
      id: "§0tnt_totem",
      data: 1,
      name: "§r§cTNT Totem",
      lore: ["§r§9On Use: Genera 6 tnt"],
      effects: [
        { eff: "resistance", dur: 2, amp: 4 },
        { eff: "regeneration", dur: 10, amp: 1 },
      ],
      sound: "totems.tnt",
    },
    {
      id: "§0fly_totem",
      data: 2,
      name: "§r§rFly Totem",
      lore: ["§r§9On Use: Otorga Levitacion"],
      effects: [
        { eff: "levitation", dur: 1, amp: 59 },
        { eff: "slow_falling", dur: 12, amp: 0 },
        { eff: "regeneration", dur: 15, amp: 1 },
      ],
      sound: "totems.fly",
    },
    {
      id: "§0ender_totem",
      data: 3,
      name: "§r§dEnder Totem",
      lore: ["§r§9On Use: Tp al ultimo SpawnPoint"],
      effects: [
        { eff: "health_boost", dur: 45, amp: 6 },
        { eff: "regeneration", dur: 30, amp: 1 },
        { eff: "fire_resistance", dur: 3, amp: 0 },
      ],
      sound: "totems.ender",
    },
    // {
    //   id: "§0void_totem",
    //   data: 4,
    //   name: "§r§8Void Totem",
    //   lore: ["§r§9On Use: Tp al ultimo SpawnPoint", "> Solo funciona en Vacio"],
    //   effects: [
    //     { eff: "nausea", dur: 15, amp: 0 },
    //     { eff: "resistance", dur: 15, amp: 1 },
    //     { eff: "regeneration", dur: 10, amp: 1 },
    //     { eff: "fire_resistance", dur: 3, amp: 0 },
    //   ],
    //   sound: "totem.void",
    // },
    {
      id: "§0tp_totem",
      data: 4,
      name: "§r§4Tp Totem",
      lore: ["§r§9On Use: Random Tp"],
      effects: [
        { eff: "nausea", dur: 5, amp: 0 },
        { eff: "resistance", dur: 15, amp: 2 },
        { eff: "regeneration", dur: 15, amp: 2 },
        { eff: "absorption", dur: 15, amp: 2 },
      ],
    },
  ];
}

export const utils = new Utils();
