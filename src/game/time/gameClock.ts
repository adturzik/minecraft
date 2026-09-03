import * as THREE from 'three';

/** Full day/night cycle length. Vanilla Minecraft uses 20 real minutes;
 * matched here per the design doc. */
export const DAY_LENGTH_SECONDS = 1200;

export interface SkyState {
  skyColor: THREE.Color;
  fogColor: THREE.Color;
  ambientDarkness: number; // 0 (full daylight) .. 1 (darkest midnight), for a cheap UI-overlay night effect
  sunDirection: THREE.Vector3;
  isNight: boolean;
}

const DAY_SKY = new THREE.Color(0x87ceeb);
const SUNSET_SKY = new THREE.Color(0xff9955);
const NIGHT_SKY = new THREE.Color(0x0a0e2a);

/** Drives the day/night cycle. `t` is 0..1 over one full cycle, with t=0 at
 * sunrise, 0.5 at sunset-start/dusk, matching a sine-based sun elevation. */
export class GameClock {
  elapsed = 0; // seconds, wraps every DAY_LENGTH_SECONDS

  constructor(startFraction = 0.25) {
    this.elapsed = startFraction * DAY_LENGTH_SECONDS;
  }

  update(dt: number) {
    this.elapsed = (this.elapsed + dt) % DAY_LENGTH_SECONDS;
  }

  getTimeFraction(): number {
    return this.elapsed / DAY_LENGTH_SECONDS;
  }

  getSky(): SkyState {
    const t = this.getTimeFraction();
    const sunAngle = t * Math.PI * 2; // 0 = sunrise on the horizon
    const elevation = Math.sin(sunAngle); // -1..1, >0 during the day

    const sunDirection = new THREE.Vector3(Math.cos(sunAngle), elevation, 0.3).normalize();

    let skyColor: THREE.Color;
    let ambientDarkness: number;
    if (elevation > 0.2) {
      skyColor = DAY_SKY.clone();
      ambientDarkness = 0;
    } else if (elevation > -0.1) {
      const k = 1 - (elevation + 0.1) / 0.3; // 0 at elevation=0.2, 1 at elevation=-0.1
      skyColor = DAY_SKY.clone().lerp(SUNSET_SKY, Math.min(1, k * 1.3)).lerp(NIGHT_SKY, Math.max(0, k - 0.5) * 1.4);
      ambientDarkness = Math.min(1, k);
    } else {
      skyColor = NIGHT_SKY.clone();
      ambientDarkness = 1;
    }

    return {
      skyColor,
      fogColor: skyColor.clone(),
      ambientDarkness,
      sunDirection,
      isNight: elevation < -0.05,
    };
  }
}
