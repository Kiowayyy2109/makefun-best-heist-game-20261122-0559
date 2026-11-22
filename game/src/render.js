// The Velvet Vault — everything on screen, drawn with the 2D canvas.
// One draw() per frame: floor, shadows and vents, walls, the exit, loot,
// smoke, the guards' and cameras' vision cones (raycast, so walls cut them
// exactly like the simulation), the thief, the HUD with its alarm meter,
// and the title / pause / caught / win overlays. All art is procedural:
// no images, no fonts from the network. The whole room is scaled to fit
// between the HUD bar and the hint bar, so one frame always shows the
// thief, the cones, the cameras, the loot and the alarm meter together.
import { COLS, ROWS, TILE, VIEW_W, VIEW_H, HUD_H, GUARD_CONE_HALF, GUARD_CONE_RANGE, CAMERA_CONE_HALF, CAMERA_RANGE } from './config.js';
import { TILE_SHADOW, TILE_VENT, TILE_WALL, isWallPixel, tileAt } from './levels.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_LEVEL_CLEAR = 'levelClear';
export const SCREEN_CAUGHT = 'caught';
export const SCREEN_WON = 'won';

/** The room is drawn scaled into the strip between HUD and hint bar. */
export const PLAY_SCALE = (VIEW_H - HUD_H - 30) / VIEW_H;
export const HINT_H = 30;
/** Horizontal offset that centres the scaled room in the canvas. */
export const PLAY_OFFSET_X = (VIEW_W - VIEW_W * PLAY_SCALE) / 2;

/** Convert a screen pixel (canvas space) back into world pixels. */
export function screenToWorld(px, py) {
  return { x: (px - PLAY_OFFSET_X) / PLAY_SCALE, y: (py - HUD_H) / PLAY_SCALE };
}

const PALETTE = {
  floorA: '#221a33',
  floorB: '#1d1529',
  shadow: '#141126',
  vent: '#3a2f1d',
  wall: '#3b3352',
  wallTop: '#574a75',
  gold: '#f2c14e',
  danger: '#e5484d',
  safe: '#3ddc97',
  panel: 'rgba(10, 7, 18, 0.86)',
};

function conePolygon(state, wx, wy, angle, range, half) {
  const points = [{ x: wx, y: wy }];
  const rays = 26;
  for (let i = 0; i <= rays; i += 1) {
    const a = angle - half + (2 * half * i) / rays;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let r = range;
    for (let step = 8; step <= range; step += 8) {
      const x = wx + dx * step;
      const y = wy + dy * step;
      if (isWallPixel(state.level, x, y)) {
        r = step;
        break;
      }
      let inSmoke = false;
      for (const smoke of state.smokes) {
        if (smoke.ttl > 0 && Math.hypot(x - smoke.x, y - smoke.y) < smoke.r) {
          inSmoke = true;
          break;
        }
      }
      if (inSmoke) {
        r = step;
        break;
      }
    }
    points.push({ x: wx + dx * r, y: wy + dy * r });
  }
  return points;
}

function drawCone(ctx, state, wx, wy, angle, range, half, fill, stroke) {
  const points = conePolygon(state, wx, wy, angle, range, half);
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  const ctx = canvas.getContext('2d');

  function drawFloor(state) {
    for (let ty = 0; ty < ROWS; ty += 1) {
      for (let tx = 0; tx < COLS; tx += 1) {
        const kind = tileAt(state.level, tx, ty);
        const x = tx * TILE;
        const y = ty * TILE;
        if (kind === TILE_WALL) {
          ctx.fillStyle = PALETTE.wall;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = PALETTE.wallTop;
          ctx.fillRect(x, y, TILE, 6);
          ctx.fillStyle = 'rgba(201, 162, 39, 0.35)';
          ctx.fillRect(x, y + TILE - 2, TILE, 2);
        } else if (kind === TILE_SHADOW) {
          ctx.fillStyle = PALETTE.shadow;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = 'rgba(120, 140, 255, 0.10)';
          ctx.fillRect(x + 6, y + 6, 4, 4);
          ctx.fillRect(x + 26, y + 24, 4, 4);
        } else if (kind === TILE_VENT) {
          ctx.fillStyle = PALETTE.vent;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.strokeStyle = '#6b5322';
          ctx.lineWidth = 2;
          for (let i = 1; i < 4; i += 1) {
            ctx.beginPath();
            ctx.moveTo(x + 4, y + i * 10);
            ctx.lineTo(x + TILE - 4, y + i * 10);
            ctx.stroke();
          }
        } else {
          ctx.fillStyle = (tx + ty) % 2 === 0 ? PALETTE.floorA : PALETTE.floorB;
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
          ctx.fillRect(x, y, TILE, 1);
        }
      }
    }
  }

  function drawExit(state) {
    const exit = state.level.exit;
    const open = state.exitOpen;
    const pulse = 0.6 + 0.4 * Math.sin(state.time * 4);
    ctx.save();
    ctx.translate(exit.x, exit.y);
    ctx.fillStyle = open ? `rgba(61, 220, 151, ${0.25 + 0.35 * pulse})` : 'rgba(229, 72, 77, 0.18)';
    ctx.beginPath();
    ctx.arc(0, 0, 26 + (open ? 4 * pulse : 0), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = open ? PALETTE.safe : PALETTE.danger;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = open ? PALETTE.safe : '#c9a227';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(open ? 'EXIT' : 'LOCK', 0, 0);
    if (open) {
      ctx.fillStyle = PALETTE.safe;
      ctx.beginPath();
      ctx.moveTo(0, -34 - 4 * pulse);
      ctx.lineTo(-7, -24 - 4 * pulse);
      ctx.lineTo(7, -24 - 4 * pulse);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawLoot(state) {
    for (const item of state.loot) {
      if (item.taken) continue;
      const twinkle = 0.7 + 0.3 * Math.sin(state.time * 3 + item.sparkle);
      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.fillStyle = `rgba(242, 193, 78, ${0.16 * twinkle})`;
      ctx.beginPath();
      ctx.arc(0, 0, 24, 0, Math.PI * 2);
      ctx.fill();
      if (item.locked) {
        ctx.fillStyle = '#4a3f66';
        roundRect(ctx, -13, -13, 26, 26, 5);
        ctx.fill();
        ctx.strokeStyle = PALETTE.gold;
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = PALETTE.gold;
        ctx.beginPath();
        ctx.arc(0, -2, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-2, 2, 4, 7);
      } else {
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = PALETTE.gold;
        ctx.fillRect(-9, -9, 18, 18);
        ctx.fillStyle = '#fff3c4';
        ctx.fillRect(-9, -9, 18, 6);
      }
      ctx.restore();
      ctx.fillStyle = 'rgba(242, 193, 78, 0.9)';
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(item.name, item.x, item.y + 30);
    }
  }

  function drawCones(state) {
    for (const camera of state.cameras) {
      drawCone(ctx, state, camera.x, camera.y, camera.angle, CAMERA_RANGE, CAMERA_CONE_HALF,
        camera.seeing ? 'rgba(229, 72, 77, 0.34)' : 'rgba(229, 72, 77, 0.13)',
        camera.seeing ? 'rgba(229, 72, 77, 0.8)' : 'rgba(229, 72, 77, 0.35)');
    }
    for (const guard of state.guards) {
      const fill = guard.mode === 'chase'
        ? 'rgba(229, 72, 77, 0.32)'
        : guard.mode === 'investigate'
          ? 'rgba(255, 165, 0, 0.28)'
          : 'rgba(242, 193, 78, 0.20)';
      const stroke = guard.mode === 'chase'
        ? 'rgba(229, 72, 77, 0.75)'
        : guard.mode === 'investigate'
          ? 'rgba(255, 165, 0, 0.6)'
          : 'rgba(242, 193, 78, 0.45)';
      drawCone(ctx, state, guard.x, guard.y, guard.angle, GUARD_CONE_RANGE, GUARD_CONE_HALF, fill, stroke);
    }
  }

  function drawCameras(state) {
    for (const camera of state.cameras) {
      ctx.save();
      ctx.translate(camera.x, camera.y);
      ctx.fillStyle = '#2c2438';
      ctx.beginPath();
      ctx.arc(0, 0, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = camera.seeing ? PALETTE.danger : '#8a7ba8';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.rotate(camera.angle);
      ctx.fillStyle = '#e5484d';
      ctx.beginPath();
      ctx.arc(6, 0, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawGuards(state) {
    for (const guard of state.guards) {
      ctx.save();
      ctx.translate(guard.x, guard.y);
      if (guard.suspicion > 0.05) {
        ctx.strokeStyle = guard.mode === 'chase' ? PALETTE.danger : '#ffa500';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 18, -Math.PI / 2, -Math.PI / 2 + guard.suspicion * Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = '#2e3a67';
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#7d8fd4';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.rotate(guard.angle);
      ctx.fillStyle = '#d8defa';
      ctx.beginPath();
      ctx.moveTo(12, 0);
      ctx.lineTo(4, -5);
      ctx.lineTo(4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      if (guard.mode === 'chase' || guard.mode === 'investigate') {
        ctx.fillStyle = guard.mode === 'chase' ? PALETTE.danger : '#ffa500';
        ctx.font = 'bold 22px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(guard.mode === 'chase' ? '!' : '?', guard.x, guard.y - 24);
      }
    }
  }

  function drawPlayer(state) {
    const player = state.player;
    ctx.save();
    ctx.translate(player.x, player.y);
    if (player.sneaking) {
      ctx.fillStyle = 'rgba(20, 16, 40, 0.9)';
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#8b7fd4';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else {
      ctx.fillStyle = '#171226';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#a78bfa';
      ctx.lineWidth = 2;
      ctx.stroke();
      // The mask: a violet band across the face, with the eyes.
      ctx.rotate(player.angle);
      ctx.fillStyle = '#7c3aed';
      ctx.fillRect(-2, -8, 9, 16);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(4, -5, 2, 3);
      ctx.fillRect(4, 3, 2, 3);
    }
    ctx.restore();
    if (state.lockpick) {
      const progress = state.lockpick.progress / 1.6;
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(player.x, player.y, 20, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawHud(state, ui) {
    ctx.fillStyle = 'rgba(8, 5, 15, 0.88)';
    ctx.fillRect(0, 0, VIEW_W, HUD_H);
    ctx.fillStyle = 'rgba(201, 162, 39, 0.4)';
    ctx.fillRect(0, HUD_H - 2, VIEW_W, 2);

    ctx.fillStyle = '#e8e2f5';
    ctx.font = 'bold 17px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`${ui.levelName}  ·  Room ${ui.levelIndex + 1}/3`, 16, 26);
    const taken = state.loot.filter((item) => item.taken).length;
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText(`Loot ${taken}/${state.loot.length}   $${state.score.toLocaleString('en-US')}`, 16, 50);

    const meterW = 340;
    const meterX = (VIEW_W - meterW) / 2;
    ctx.fillStyle = '#e8e2f5';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const alarmWord = state.alarm >= 75 ? 'ALARM!' : state.alarm >= 40 ? 'HUNTED' : state.alarm > 5 ? 'SUSPICIOUS' : 'ALARM';
    ctx.fillText(`${alarmWord}  ${Math.round(state.alarm)}%`, VIEW_W / 2, 24);
    ctx.fillStyle = '#241d38';
    roundRect(ctx, meterX, 30, meterW, 16, 8);
    ctx.fill();
    const alarmColor = state.alarm >= 75 ? PALETTE.danger : state.alarm >= 40 ? '#ffa500' : PALETTE.safe;
    if (state.alarm > 0.5) {
      ctx.fillStyle = alarmColor;
      roundRect(ctx, meterX, 30, (meterW * state.alarm) / 100, 16, 8);
      ctx.fill();
    }
    ctx.strokeStyle = 'rgba(232, 226, 245, 0.5)';
    ctx.lineWidth = 1;
    roundRect(ctx, meterX, 30, meterW, 16, 8);
    ctx.stroke();

    ctx.textAlign = 'right';
    ctx.fillStyle = '#e8e2f5';
    ctx.font = '15px system-ui, sans-serif';
    const time = Math.floor(state.time);
    const clock = `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;
    ctx.fillText(`Coins ${state.coinCount} (Q)   Smoke ${state.smokeCount} (F)   ${clock}${ui.muted ? '   MUTED (M)' : ''}`, VIEW_W - 16, 26);
    ctx.fillStyle = state.exitOpen ? PALETTE.safe : '#8a7ba8';
    ctx.fillText(state.exitOpen ? 'EXIT OPEN — GO!' : 'Steal all the loot to open the exit', VIEW_W - 16, 50);

    ctx.fillStyle = 'rgba(8, 5, 15, 0.72)';
    ctx.fillRect(0, VIEW_H - HINT_H, VIEW_W, HINT_H);
    ctx.fillStyle = '#cfc6e8';
    ctx.font = '14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.hint, VIEW_W / 2, VIEW_H - 10);

    if (state.flashLeft > 0 && state.flash) {
      ctx.fillStyle = PALETTE.gold;
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.fillText(state.flash, VIEW_W / 2, HUD_H + 30);
    }
  }

  function panel(title, lines, accent) {
    const w = 680;
    const h = 120 + lines.length * 30;
    const x = (VIEW_W - w) / 2;
    const y = (VIEW_H - h) / 2;
    ctx.fillStyle = PALETTE.panel;
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = accent || PALETTE.gold;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = accent || PALETTE.gold;
    ctx.font = 'bold 32px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, VIEW_W / 2, y + 54);
    ctx.fillStyle = '#e8e2f5';
    ctx.font = '16px system-ui, sans-serif';
    lines.forEach((line, i) => {
      ctx.fillText(line, VIEW_W / 2, y + 94 + i * 30);
    });
  }

  function drawTitle(state, ui) {
    ctx.fillStyle = 'rgba(8, 5, 15, 0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = 'bold 62px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.fillText('THE VELVET VAULT', VIEW_W / 2, 150);
    ctx.fillStyle = '#cfc6e8';
    ctx.font = 'italic 21px Georgia, serif';
    ctx.fillText('A quiet heist in three rooms — cones, cameras and one very loud alarm.', VIEW_W / 2, 190);
    panel(`${ui.levelIndex + 1}. ${ui.levelName}`, [
      ui.briefing,
      '',
      'WASD / Arrows — move      Shift — sneak      Space — run',
      'Q — toss a coin (distract)      F — smoke bomb      E — grab loot (hold E on safes)',
      'Click — walk there      P — pause      R — restart      M — mute',
      '',
      'Press Enter to begin the heist',
    ], PALETTE.gold);
    if (ui.best > 0) {
      ctx.fillStyle = '#8a7ba8';
      ctx.font = '15px system-ui, sans-serif';
      ctx.fillText(`Best haul so far: $${ui.best.toLocaleString('en-US')}`, VIEW_W / 2, VIEW_H - 44);
    }
  }

  function drawVignette() {
    const gradient = ctx.createRadialGradient(
      VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45,
      VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85,
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.35)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  function draw(state, screen, ui) {
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = '#0e0a16';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (!state) return;
    ctx.save();
    ctx.setTransform(PLAY_SCALE, 0, 0, PLAY_SCALE, PLAY_OFFSET_X, HUD_H);
    drawFloor(state);
    drawExit(state);
    drawLoot(state);
    for (const coin of state.coins) {
      ctx.fillStyle = PALETTE.gold;
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff3c4';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    drawCones(state);
    drawCameras(state);
    drawGuards(state);
    drawPlayer(state);
    for (const smoke of state.smokes) {
      ctx.fillStyle = 'rgba(200, 200, 210, 0.45)';
      ctx.beginPath();
      ctx.arc(smoke.x, smoke.y, smoke.r * (0.9 + 0.1 * Math.sin(state.time * 5)), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    drawVignette();
    drawHud(state, ui);
    if (screen === SCREEN_TITLE) drawTitle(state, ui);
    else if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(8, 5, 15, 0.6)';
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      panel('PAUSED', ['Press P or Enter to keep stealing.', 'R — restart this room      M — mute'], PALETTE.gold);
    } else if (screen === SCREEN_LEVEL_CLEAR) {
      panel('ROOM CLEARED', [
        `${ui.levelName} — haul $${state.score.toLocaleString('en-US')}`,
        `Total so far: $${ui.totalScore.toLocaleString('en-US')}   Time ${Math.floor(state.time)}s`,
        '',
        'Press Enter for the next room',
      ], PALETTE.safe);
    } else if (screen === SCREEN_CAUGHT) {
      panel('CAUGHT!', [
        'The alarm hit 100% — the crew is in cuffs.',
        `${ui.levelName} — loot kept: $${state.score.toLocaleString('en-US')}`,
        '',
        'Press R to try the room again',
      ], PALETTE.danger);
    } else if (screen === SCREEN_WON) {
      panel('THE VAULT IS YOURS', [
        `Every room cleared — total haul $${ui.totalScore.toLocaleString('en-US')}`,
        `Total time ${Math.floor(ui.totalTime)}s   Best $${Math.max(ui.best, ui.totalScore).toLocaleString('en-US')}`,
        '',
        'Press R to run it back',
      ], PALETTE.safe);
    }
  }

  return { draw };
}
