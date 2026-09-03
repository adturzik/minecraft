const HUNGER_DRAIN_INTERVAL = 12; // seconds per hunger point (tuned faster than vanilla for easier testing/demoing)
const STARVE_DAMAGE_INTERVAL = 4;
const REGEN_INTERVAL = 4;

const DROWN_DAMAGE_INTERVAL = 2;

export class SurvivalState {
  health = 20;
  maxHealth = 20;
  hunger = 20;
  maxHunger = 20;
  breath = 10;
  maxBreath = 10;
  dead = false;

  private hungerAccum = 0;
  private regenAccum = 0;
  private starveAccum = 0;
  private drownAccum = 0;

  takeDamage(amount: number) {
    if (this.dead || amount <= 0) return;
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this.dead = true;
  }

  heal(amount: number) {
    this.health = Math.min(this.maxHealth, this.health + amount);
  }

  eat(restore: number): boolean {
    if (this.hunger >= this.maxHunger) return false;
    this.hunger = Math.min(this.maxHunger, this.hunger + restore);
    return true;
  }

  respawn() {
    this.health = this.maxHealth;
    this.hunger = Math.max(this.hunger, 10);
    this.breath = this.maxBreath;
    this.dead = false;
  }

  updateBreath(dt: number, headUnderwater: boolean) {
    if (this.dead) return;
    if (headUnderwater) {
      this.breath = Math.max(0, this.breath - dt);
      if (this.breath <= 0) {
        this.drownAccum += dt;
        if (this.drownAccum >= DROWN_DAMAGE_INTERVAL) {
          this.drownAccum = 0;
          this.takeDamage(2);
        }
      }
    } else {
      this.breath = Math.min(this.maxBreath, this.breath + dt * 4);
      this.drownAccum = 0;
    }
  }

  update(dt: number, sprinting: boolean) {
    if (this.dead) return;

    this.hungerAccum += dt * (sprinting ? 1.6 : 1);
    if (this.hungerAccum >= HUNGER_DRAIN_INTERVAL) {
      this.hungerAccum -= HUNGER_DRAIN_INTERVAL;
      this.hunger = Math.max(0, this.hunger - 1);
    }

    if (this.hunger <= 0) {
      this.starveAccum += dt;
      if (this.starveAccum >= STARVE_DAMAGE_INTERVAL) {
        this.starveAccum = 0;
        this.takeDamage(1);
      }
    } else {
      this.starveAccum = 0;
    }

    if (this.hunger >= this.maxHunger * 0.9 && this.health < this.maxHealth && this.health > 0) {
      this.regenAccum += dt;
      if (this.regenAccum >= REGEN_INTERVAL) {
        this.regenAccum = 0;
        this.heal(1);
      }
    } else {
      this.regenAccum = 0;
    }
  }
}
