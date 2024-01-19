import { Bot } from "mineflayer";
import { Vec3 } from "vec3";
import { goals } from "../goals";
import { Move } from "../move";
import { World } from "../world/worldInterface";
import { Movement, MovementOptions } from "./movement";
import { CancelError } from "./exceptions";
import { BlockInfo } from "../world/cacheWorld";
import { BreakHandler, PlaceHandler } from "./utils";
import { onceWithCleanup } from "../../utils";
import { AABBUtils } from "@nxg-org/mineflayer-util-plugin";

export class IdleMovement extends Movement {
  provideMovements(start: Move, storage: Move[]): void {}
  performInit = async (thisMove: Move, goal: goals.Goal) => {};
  performPerTick = async (thisMove: Move, tickCount: number, goal: goals.Goal) => {
    return true;
  };
}

export class Forward extends Movement {
  constructor(bot: Bot, world: World, settings: Partial<MovementOptions>) {
    super(bot, world, settings);
  }

  provideMovements(start: Move, storage: Move[], goal: goals.Goal): void {
    for (const dir of Movement.cardinalDirs) {
      this.getMoveForward(start, dir, storage);
    }
  }

  align(thisMove: Move, tickCount: number, goal: goals.Goal): boolean {
    const offset = thisMove.toVec().offset(0.5, 0, 0.5)
    const bb = AABBUtils.getPlayerAABB({position: this.bot.entity.position, width: 1, height: 1.8})
    // console.log(bb.containsVec(offset), bb, offset)
    if (this.bot.entity.onGround && !bb.containsVec(offset)) {
      this.bot.clearControlStates()
      return true;
    }
    // await this.bot.lookAt(offset, true);
    this.bot.setControlState('forward', false)
    this.bot.setControlState("back", true);
    return false;
    
    // if (this.bot.entity.position.xzDistanceTo(thisMove.entryPos.offset(0.5, 0, 0.5)) < 0.2) return true;
    // this.bot.lookAt(thisMove., true);
    // this.bot.setControlState('forward', true);
    // return this.bot.entity.onGround;
  }

  performInit = async (thisMove: Move, goal: goals.Goal) => {
    // console.log("ForwardMove", thisMove.exitPos, thisMove.toPlace.length, thisMove.toBreak.length);

    for (const breakH of thisMove.toBreak) {
      await this.performInteraction(breakH);
    }

    if (thisMove.toPlace.length > 0) {
      const offset = this.bot.entity.position.minus(thisMove.exitPos).plus(this.bot.entity.position);

      console.log(thisMove.exitPos, offset, 'hi');

      await this.bot.lookAt(offset, true);
      this.bot.setControlState("sprint", false)
      this.bot.setControlState("back", true);
    } else {
      await this.bot.lookAt(thisMove.exitPos, true);
      this.bot.setControlState("forward", true);
      if (this.bot.food <= 6) this.bot.setControlState("sprint", false);
      else this.bot.setControlState("sprint", true);
    }

    for (const place of thisMove.toPlace) {
      await this.performInteraction(place);
    }

    // console.log("done move prehandle!");
  };

  performPerTick = (thisMove: Move, tickCount: number, goal: goals.Goal) => {
    if (this.cI && !this.cI.allowExternalInfluence(this.bot, 5)) {
      this.bot.clearControlStates();
      return false;
    }

    if (tickCount > 160) throw new CancelError("ForwardMove: tickCount > 160");
    if (!this.bot.entity.onGround) throw new CancelError("ForwardMove: not on ground");

    if (thisMove.toPlace.length > 0) {
      const offset = this.bot.entity.position.minus(thisMove.exitPos).plus(this.bot.entity.position);
      this.bot.lookAt(offset, true);
    } else {
      this.bot.lookAt(thisMove.exitPos, true);
    }
  
    if (this.bot.entity.position.xzDistanceTo(thisMove.exitPos) < 0.2) return true;
    return false;
  };

  getMoveForward(start: Move, dir: Vec3, neighbors: Move[]) {
    const pos = start.toVec();

    if (this.getBlockInfo(pos, 0, 0, 0).liquid) return; //cost += this.liquidCost

    const blockB = this.getBlockInfo(pos, dir.x, 1, dir.z);
    const blockC = this.getBlockInfo(pos, dir.x, 0, dir.z);
    const blockD = this.getBlockInfo(pos, dir.x, -1, dir.z);

    let cost = 1; // move cost

    const toBreak: BreakHandler[] = [];
    const toPlace: PlaceHandler[] = [];

    if (!blockD.physical && !blockC.liquid) {
      if (start.remainingBlocks === 0) return; // not enough blocks to place

      // if (this.getNumEntitiesAt(blockD.position, 0, 0, 0) > 0) return // D intersects an entity hitbox
      if (!blockD.replaceable) {
        if (!this.safeToBreak(blockD)) return;
        // cost += this.exclusionBreak(blockD)
        toBreak.push(BreakHandler.fromVec(blockD.position, "solid"));
      }
      // cost += this.exclusionPlace(blockC)
      toPlace.push(PlaceHandler.fromVec(blockD.position, "solid"));
      cost += 0.1; // this.placeCost // additional cost for placing a block
    }

    cost += this.safeOrBreak(blockC, toBreak);
    if (cost > 100) return;
    cost += this.safeOrBreak(blockB, toBreak);
    if (cost > 100) return;

    // set exitPos to center of wanted block
    neighbors.push(Move.fromPrevious(cost, pos.add(dir).translate(0.5, 0, 0.5), start, this, toPlace, toBreak));
  }
}

export class ForwardJump extends Movement {
  provideMovements(start: Move, storage: Move[], goal: goals.Goal): void {
    for (const dir of Movement.cardinalDirs) {
      this.getMoveJumpUp(start, dir, storage);
    }
  }

  align(thisMove: Move, tickCount: number, goal: goals.Goal): boolean {
    const offset = thisMove.toVec().offset(0.5, 0, 0.5)
    const bb = AABBUtils.getEntityAABBRaw({position: this.bot.entity.position, width: 1, height: 1.8})
    // console.log(bb.containsVec(offset), bb, offset)
    if (this.bot.entity.onGround && !bb.containsVec(offset)) return true;
    this.bot.lookAt(offset, true);
    this.bot.setControlState('forward', false)
    this.bot.setControlState("back", true);
    return false;
    
    // if (this.bot.entity.position.xzDistanceTo(thisMove.entryPos.offset(0.5, 0, 0.5)) < 0.2) return true;
    // this.bot.lookAt(thisMove., true);
    // this.bot.setControlState('forward', true);
    // return this.bot.entity.onGround;
  }

  performInit = async (thisMove: Move, goal: goals.Goal) => {
    console.log("ForwardJumpMove", thisMove.exitPos, thisMove.toPlace.length, thisMove.toBreak.length);
    await this.bot.lookAt(thisMove.exitPos, true);

    if (thisMove.toBreak.length > 0) {
    await this.bot.clearControlStates();
    for (const breakH of thisMove.toBreak) {
      await this.performInteraction(breakH);
    }
  }

    // do some fancy handling here, will think of something later.
    if (thisMove.toPlace.length === 2) {
      let info = await thisMove.toPlace[0].performInfo(this.bot, 0);
      if (info.raycasts.length === 0) {
        this.bot.setControlState('forward', true);
        await this.performInteraction(thisMove.toPlace[0]);
      } else {
        this.bot.setControlState('forward', false);
        await this.performInteraction(thisMove.toPlace[0], {info});
      }

      await this.bot.lookAt(thisMove.exitPos, true);
      this.bot.setControlState('back', false);
      this.bot.setControlState("sprint", false);
      this.bot.setControlState("forward", true);
      this.bot.setControlState("jump", true);

      while (this.bot.entity.position.y - thisMove.exitPos.y < 0.05) {
        await this.bot.lookAt(thisMove.exitPos, true);
        await this.bot.waitForTicks(1);
        console.log('loop 0')
        
      }
      info = await thisMove.toPlace[1].performInfo(this.bot, 0);
      while (info.raycasts.length === 0) {
        await this.bot.lookAt(thisMove.exitPos, true);
        await this.bot.waitForTicks(1);
        
        info = await thisMove.toPlace[1].performInfo(this.bot, 0);
        console.log('loop 1', this.bot.entity.position)
      }

      // console.log("YAY", thisMove.entryPos, this.bot.entity.position, info.raycasts[0].intersect)
      this.bot.setControlState("forward", true);
      this.bot.setControlState("jump", false);
      this.bot.setControlState("sprint", true);
      await this.performInteraction(thisMove.toPlace[1], { info });
      
   
      await this.bot.lookAt(thisMove.exitPos, true);
    } else {

      
      // 
  

      for (const place of thisMove.toPlace) {
        await this.performInteraction(place);
      }
      this.bot.setControlState("forward", true);
      this.bot.setControlState("jump", true);
      this.bot.setControlState("sprint", true);
    }
  };

  performPerTick = (thisMove: Move, tickCount: number, goal: goals.Goal) => {
    if (this.cI && !this.cI.allowExternalInfluence(this.bot, 5)) {
      this.bot.clearControlStates();
      return false;
    }

    this.bot.lookAt(thisMove.exitPos, true);

    if (tickCount > 160) throw new CancelError("ForwardJumpMove: tickCount > 160");
    if (this.bot.entity.position.y - thisMove.exitPos.y < -1) throw new CancelError("ForwardJumpMove: too low (1)");

    if (tickCount > 0 && this.bot.entity.onGround) {
      this.bot.setControlState("jump", false);
      this.bot.setControlState("sprint", true);
      if (this.bot.entity.position.y - thisMove.exitPos.y < 0) throw new CancelError("ForwardJumpMove: too low (2)");
      if (this.bot.entity.position.xzDistanceTo(thisMove.exitPos) < 0.3) return true;
    }

    return false;
  };

  /**
   * TODO: provide both non-sprint and sprint-jump moves here.
   * Saves time.
   * @param node
   * @param dir
   * @param neighbors
   * @returns
   */
  getMoveJumpUp(node: Move, dir: Vec3, neighbors: Move[]) {
    // const pos = node.exitRounded(1)
    const pos = node.toVec();
    const blockA = this.getBlockInfo(pos, 0, 2, 0);
    const blockH = this.getBlockInfo(pos, dir.x, 2, dir.z);
    const blockB = this.getBlockInfo(pos, dir.x, 1, dir.z);
    const blockC = this.getBlockInfo(pos, dir.x, 0, dir.z);

    let cost = 2; // move cost (move+jump)
    const toBreak: BreakHandler[] = [];
    const toPlace: PlaceHandler[] = [];

    let cHeight = blockC.height;

    // if (blockA.physical && (this.getNumEntitiesAt(blockA.position, 0, 1, 0) > 0)) return // Blocks A, B and H are above C, D and the player's space, we need to make sure there are no entities that will fall down onto our building space if we break them
    // if (blockH.physical && (this.getNumEntitiesAt(blockH.position, 0, 1, 0) > 0)) return
    // if (blockB.physical && !blockH.physical && !blockC.physical && (this.getNumEntitiesAt(blockB.position, 0, 1, 0) > 0)) return // It is fine if an ent falls on B so long as we don't need to replace block C

    if (!blockC.physical) {
      if (node.remainingBlocks === 0) return; // not enough blocks to place

      // if (this.getNumEntitiesAt(blockC.position, 0, 0, 0) > 0) return // Check for any entities in the way of a block placement

      const blockD = this.getBlockInfo(pos, dir.x, -1, dir.z);
      if (!blockD.physical) {
        if (node.remainingBlocks === 1) return; // not enough blocks to place

        // if (this.getNumEntitiesAt(blockD.position, 0, 0, 0) > 0) return // Check for any entities in the way of a block placement

        if (!blockD.replaceable) {
          if (!this.safeToBreak(blockD)) return;
          // cost += this.exclusionBreak(blockD)
          toBreak.push(BreakHandler.fromVec(blockD.position, "solid"));
        }
        // cost += this.exclusionPlace(blockD)
        toPlace.push(PlaceHandler.fromVec(blockD.position, "solid"));
        cost += 0.1; // this.placeCost // additional cost for placing a block
      }

      if (!blockC.replaceable) {
        if (!this.safeToBreak(blockC)) return;
        // cost += this.exclusionBreak(blockC)
        toBreak.push(BreakHandler.fromVec(blockC.position, "solid"));
      }
      // cost += this.exclusionPlace(blockC)
      toPlace.push(PlaceHandler.fromVec(blockC.position, "solid"));
      cost += 0.1; // this.placeCost // additional cost for placing a block

      cHeight += 1;
    }

    const block0 = this.getBlockInfo(pos, 0, -1, 0);
    if (cHeight - block0.height > 1.2) return; // Too high to jump

    cost += this.safeOrBreak(blockA, toBreak);
    if (cost > 100) return;
    cost += this.safeOrBreak(blockB, toBreak);
    if (cost > 100) return;
    cost += this.safeOrBreak(blockH, toBreak);
    if (cost > 100) return;

    // if (toPlace.length === 2) return;
    // set exitPos to center of block we want.
    neighbors.push(Move.fromPrevious(cost, blockB.position.offset(0.5, 0, 0.5), node, this, toPlace, toBreak));
  }
}

export class ForwardDropDown extends Movement {
  maxDropDown = 3;
  infiniteLiquidDropdownDistance = true;

  provideMovements(start: Move, storage: Move[], goal: goals.Goal): void {
    for (const dir of Movement.cardinalDirs) {
      this.getMoveDropDown(start, dir, storage);
    }
  }
  performInit = async (thisMove: Move, goal: goals.Goal) => {
    await this.bot.lookAt(thisMove.exitPos, true);

    for (const breakH of thisMove.toBreak) {
      await this.performInteraction(breakH);
    }

    for (const place of thisMove.toPlace) {
      await this.performInteraction(place);
    }

    console.log(thisMove.exitPos, thisMove.x, thisMove.y, thisMove.z);
    this.bot.setControlState("forward", true);
    this.bot.setControlState("sprint", true);
  };
  performPerTick = (thisMove: Move, tickCount: number, goal: goals.Goal) => {
    if (this.cI && !this.cI.allowExternalInfluence(this.bot, 5)) {
      this.bot.clearControlStates();
      return false;
    }

    if (tickCount > 160) throw new CancelError("ForwardDropDown: tickCount > 160");

    this.bot.lookAt(thisMove.exitPos, true);
    if (!this.bot.entity.onGround) return false;
    if (this.bot.entity.position.y - thisMove.exitPos.y != 0) return false;

    if (this.bot.entity.position.xzDistanceTo(thisMove.exitPos) < 0.2) return true;

    this.bot.setControlState("forward", true);
    if (this.bot.food <= 6) this.bot.setControlState("sprint", false);
    else this.bot.setControlState("sprint", true);
    return false;
  };

  getLandingBlock(node: Move, dir: Vec3) {
    let blockLand = this.getBlockInfo(node, dir.x, -2, dir.z);
    while (blockLand.position && blockLand.position.y > (this.bot.game as any).minY) {
      if (blockLand.liquid && blockLand.safe) return blockLand;
      if (blockLand.physical) {
        if (node.y - blockLand.position.y <= this.maxDropDown) return this.getBlock(blockLand.position, 0, 1, 0);
        return null;
      }
      if (!blockLand.safe) return null;
      blockLand = this.getBlockInfo(blockLand.position, 0, -1, 0);
    }
    return null;
  }

  getMoveDropDown(node: Move, dir: Vec3, neighbors: Move[]) {
    const blockA = this.getBlockInfo(node, dir.x, 2, dir.z);
    const blockB = this.getBlockInfo(node, dir.x, 1, dir.z);
    const blockC = this.getBlockInfo(node, dir.x, 0, dir.z);
    const blockD = this.getBlockInfo(node, dir.x, -1, dir.z);

    let cost = 1; // move cost
    const toBreak: BreakHandler[] = [];
    const toPlace: PlaceHandler[] = [];

    const blockLand = this.getLandingBlock(node, dir);
    if (!blockLand) return;

    if (!this.infiniteLiquidDropdownDistance && node.y - blockLand.position.y > this.maxDropDown) return; // Don't drop down into water

    cost += this.safeOrBreak(blockA, toBreak);
    if (cost > 100) return;
    cost += this.safeOrBreak(blockB, toBreak);
    if (cost > 100) return;
    cost += this.safeOrBreak(blockC, toBreak);
    if (cost > 100) return;
    cost += this.safeOrBreak(blockD, toBreak);
    if (cost > 100) return;

    if (blockC.liquid) return; // dont go underwater

    // cost += this.getNumEntitiesAt(blockLand.position, 0, 0, 0) * this.entityCost // add cost for entities
    neighbors.push(Move.fromPrevious(cost, blockLand.position.offset(0.5, 0, 0.5), node, this, toPlace, toBreak));
  }
}

export class Diagonal extends Movement {
  static diagonalCost = 1.4142135623730951; // sqrt(2)

  provideMovements(start: Move, storage: Move[], goal: goals.Goal): void {
    for (const dir of Movement.diagonalDirs) {
      this.getMoveDiagonal(start, dir, storage);
    }
  }

  performInit = async (thisMove: Move, goal: goals.Goal) => {
    await this.bot.lookAt(thisMove.exitPos, true);
    this.bot.setControlState("forward", true);
    this.bot.setControlState("sprint", this.bot.food > 6);

    for (const breakH of thisMove.toBreak) {
      await this.performInteraction(breakH);
    }
  };

  performPerTick = (thisMove: Move, tickCount: number, goal: goals.Goal) => {
    if (this.cI && !this.cI.allowExternalInfluence(this.bot, 5)) {
      this.bot.clearControlStates();
      return false;
    }

    if (tickCount > 160) throw new CancelError("ForwardMove: tickCount > 160");
    if (!this.bot.entity.onGround) throw new CancelError("ForwardMove: not on ground");

    this.bot.lookAt(thisMove.targetPos, true);

    if (this.bot.entity.position.xzDistanceTo(thisMove.exitPos) < 0.2) return true;
    return false;
  };

  getMoveDiagonal(node: Move, dir: Vec3, neighbors: Move[]) {
    let cost = Diagonal.diagonalCost;
    const toBreak: BreakHandler[] = [];
    const toPlace: PlaceHandler[] = [];
    const block00 = this.getBlockInfo(node, 0, 0, 0);

    const block0 = this.getBlockInfo(node, dir.x, 0, dir.z);
    if (block00.height - block0.height > 0.6) return; // Too high to walk up
    const needSideClearance = block00.height - block0.height < 0;
    const block1 = this.getBlockInfo(node, dir.x, 1, dir.z);
    const blockN1 = this.getBlockInfo(node, dir.x, -1, dir.z);
    if (!blockN1.physical) {
      // target block not solid
      return;
    }
    cost += this.safeOrBreak(block0, toBreak);
    cost += this.safeOrBreak(block1, toBreak);
    cost += this.safeOrBreak(this.getBlockInfo(node, dir.x, 0, 0), toBreak);
    cost += this.safeOrBreak(this.getBlockInfo(node, 0, 0, dir.z), toBreak);
    cost += this.safeOrBreak(this.getBlockInfo(node, dir.x, 1, 0), toBreak);
    cost += this.safeOrBreak(this.getBlockInfo(node, 0, 1, dir.z), toBreak);
    if (cost > 100) return;
    if (needSideClearance) {
      const blockN1A = this.getBlockInfo(node, dir.x, -1, 0);
      const blockN1B = this.getBlockInfo(node, 0, -1, dir.z);
      if (blockN1A.physical || blockN1B.physical) return;
    }

    neighbors.push(Move.fromPrevious(cost, node.toVec().add(dir).offset(0.5, 0, 0.5), node, this, toPlace, toBreak));
  }
}
