// File: src/main.ts
import { Application, Graphics, Rectangle, Container, Assets, Sprite } from 'pixi.js';
import { sound } from '@pixi/sound'; 
import { 
    createWorld, 
    query, 
    addEntity, 
    addComponent,
    removeEntity
} from 'bitecs';

// --- MOBILE VIEWPORT LOCK ---
if (!document.querySelector('meta[name="viewport"]')) {
    const meta = document.createElement('meta');
    meta.name = 'viewport';
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover';
    document.head.appendChild(meta);
}

// --- BITECS SETUP ---
const world = createWorld();

// --- COMPONENTS ---
export const GridPosition = { x: [] as number[], y: [] as number[] };
export const Dimensions = { width: [] as number[], height: [] as number[] };
export const Rotation = { angle: [] as number[] };
// 0: Source, 1: Receiver, 2: Mirror, 3: Plant, 4: Obstacle, 5: Poison
// 6: Crystal, 7: Portal, 8: Dampener, 9: Splitter
export const ObjectType = { type: [] as number[] };
export const Draggable = { isDragging: [] as number[] };
export const Interactable = { isInteractable: [] as number[] };

const spriteMap = new Map<number, Container>();

// --- UI DOM ELEMENTS ---
const uiLayer = document.createElement('div');
uiLayer.innerHTML = `
    <style>
        html, body { 
            width: 100%; height: 100%; margin: 0; padding: 0; 
            overflow: hidden; touch-action: none; background-color: #120f14; 
        }
        
        #ui-layer {
            font-family: 'Palatino Linotype', 'Book Antiqua', Palatino, serif;
            color: #fdf6e3; text-shadow: 1px 1px 3px rgba(0,0,0,0.9);
        }

        #main-menu {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background: radial-gradient(circle at center, #2a2122 0%, #120f14 100%);
            z-index: 500; display: flex; flex-direction: column; justify-content: center; align-items: center;
        }
        #main-menu h1 {
            color: #d4af37; font-size: clamp(32px, 8vw, 54px); text-transform: uppercase; letter-spacing: 8px; 
            margin-bottom: 0px; text-shadow: 0 0 20px rgba(212, 175, 55, 0.4); text-align: center;
            padding: 0 20px;
        }
        #main-menu p {
            color: #bca88e; font-size: 18px; font-style: italic; margin-top: 10px; 
            margin-bottom: 40px; letter-spacing: 2px; text-align: center;
        }
        
        #level-select-container {
            margin-top: 30px;
            display: flex; flex-direction: column; align-items: center;
        }
        #level-select-container p {
            margin-bottom: 15px; font-size: 14px; letter-spacing: 2px; color: #aa801e;
        }
        #level-grid {
            display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; max-width: 400px; padding: 0 20px;
        }
        .level-btn {
            background: transparent; border: 1px solid #aa801e; color: #d4af37;
            width: 44px; height: 44px; border-radius: 4px; font-family: 'Palatino Linotype', serif;
            font-size: 18px; font-weight: bold; cursor: pointer; transition: all 0.2s;
            box-shadow: inset 0 0 10px rgba(0,0,0,0.5);
            padding: 0; display: flex; justify-content: center; align-items: center;
        }
        .level-btn:hover {
            background: rgba(212, 175, 55, 0.15); transform: translateY(-2px); 
            border-color: #ffdf73; color: #ffdf73; box-shadow: 0 4px 8px rgba(212, 175, 55, 0.2);
        }

        #hud {
            position: absolute; top: 15px; left: 15px; z-index: 100; pointer-events: auto;
            display: none; 
        }
        #hud h2 { margin: 0; font-size: 18px; letter-spacing: 1.5px; color: #d4af37; pointer-events: none; }
        #level-title { font-size: 13px; color: #bca88e; margin-top: 4px; margin-bottom: 10px; font-style: italic; pointer-events: none; }
        
        #status-text { font-size: 14px; font-weight: bold; letter-spacing: 0.5px; pointer-events: none; }
        #status-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold; pointer-events: none; }
        
        #signal-bar-container { 
            width: 160px; height: 12px; background: #2a2122; 
            border: 2px solid #d4af37; border-radius: 6px; 
            margin-top: 6px; overflow: hidden; 
            box-shadow: 0 0 5px rgba(212, 175, 55, 0.3); 
            pointer-events: none;
        }
        #signal-bar-fill { 
            width: 0%; height: 100%; background: #c0392b; 
            transition: width 0.3s ease, background-color 0.3s ease; 
        }

        #hud-controls {
            margin-top: 12px;
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            max-width: 160px;
        }

        #toggle-vision-btn, #toggle-audio-btn {
            padding: 6px 12px;
            font-size: 11px;
            background: transparent;
            border: 1px solid #bca88e;
            color: #bca88e;
            box-shadow: none;
            cursor: pointer;
            border-radius: 4px;
        }
        #toggle-vision-btn:hover, #toggle-audio-btn:hover {
            background: rgba(188, 168, 142, 0.2);
            color: #fdf6e3;
            border-color: #fdf6e3;
        }
        
        dialog {
            background: #1a1525; border: 2px solid #d4af37; border-radius: 12px;
            color: #fdf6e3; text-align: center; padding: 40px 30px; 
            font-family: 'Palatino Linotype', 'Book Antiqua', Palatino, serif;
            box-shadow: 0 0 40px rgba(212, 175, 55, 0.2), inset 0 0 20px rgba(0,0,0,0.8); 
            width: 80%; max-width: 400px;
        }
        dialog::backdrop { background: rgba(10, 8, 15, 0.85); backdrop-filter: blur(4px); }
        dialog h1 { 
            color: #d4af37; font-size: 24px; text-transform: uppercase; 
            margin-top: 0; letter-spacing: 3px; 
            border-bottom: 1px solid #d4af37; padding-bottom: 10px; 
        }
        dialog p { color: #e6dac3; font-size: 15px; margin-bottom: 30px; line-height: 1.6; }
        
        button.primary-btn { 
            background: linear-gradient(135deg, #d4af37, #aa801e); color: #1a1525; 
            border: 1px solid #ffdf73; padding: 12px 28px; 
            font-size: 15px; font-weight: bold; cursor: pointer; border-radius: 6px; 
            text-transform: uppercase; letter-spacing: 1px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.5); transition: all 0.2s;
            pointer-events: auto;
        }
        button.primary-btn:hover { 
            background: linear-gradient(135deg, #ffdf73, #d4af37); 
            transform: translateY(-2px); 
            box-shadow: 0 6px 12px rgba(212, 175, 55, 0.3); 
        }
        button.primary-btn:active { transform: translateY(1px); }
    </style>
    
    <div id="ui-layer">
        <div id="main-menu">
            <h1>Signal & Sanctuary</h1>
            <p>A puzzle of spatial harmony.</p>
            <button id="start-btn" class="primary-btn">Begin Journey</button>
            
            <div id="level-select-container">
                <p>— OR SELECT A PHASE —</p>
                <div id="level-grid"></div>
            </div>
        </div>

        <div id="hud">
            <h2>Signal & Sanctuary</h2>
            <div id="level-title"></div>
            <div style="display: flex; align-items: baseline; gap: 12px;">
                <div id="status-text">Signal: 0%</div>
                <div id="status-label">BLOCKED</div>
            </div>
            <div id="signal-bar-container"><div id="signal-bar-fill"></div></div>
            <div id="hud-controls">
                <button id="toggle-vision-btn">Enable Signal Mode</button>
                <button id="toggle-audio-btn">Mute Audio</button>
            </div>
        </div>

        <dialog id="tutorial-dialog">
            <h1 id="tutorial-title">Guide</h1>
            <p id="tutorial-text"></p>
            <button id="tutorial-next-btn" class="primary-btn">Continue</button>
        </dialog>

        <dialog id="win-dialog">
            <h1>Perfect Balance</h1>
            <p>The room is calm.</p>
            <button id="next-level-btn" class="primary-btn">Next Phase</button>
        </dialog>

        <dialog id="end-dialog">
            <h1>Sanctuary Complete</h1>
            <p>Thank you for playing. All rooms are now balanced.</p>
            <button id="restart-btn" class="primary-btn">Restart Journey</button>
        </dialog>
    </div>
`;
document.body.appendChild(uiLayer);

const mainMenu = document.getElementById('main-menu');
const startBtn = document.getElementById('start-btn');
const levelGrid = document.getElementById('level-grid');
const hud = document.getElementById('hud');

const statusText = document.getElementById('status-text');
const statusLabel = document.getElementById('status-label');
const signalBarFill = document.getElementById('signal-bar-fill');
const toggleVisionBtn = document.getElementById('toggle-vision-btn');
const toggleAudioBtn = document.getElementById('toggle-audio-btn');
const winDialog = document.getElementById('win-dialog') as HTMLDialogElement;
const nextLevelBtn = document.getElementById('next-level-btn');
const levelTitleText = document.getElementById('level-title');

const tutorialDialog = document.getElementById('tutorial-dialog') as HTMLDialogElement;
const tutorialText = document.getElementById('tutorial-text');
let tutorialNextBtn = document.getElementById('tutorial-next-btn');

const endDialog = document.getElementById('end-dialog') as HTMLDialogElement;
const restartBtn = document.getElementById('restart-btn');

let currentLevelIndex = 0;
let isLevelComplete = false;
let tutorialQueue: string[] = [];
let isAudioMuted = false;

// --- INITIALISATION ---
async function init() {
    const app = new Application();
    await app.init({ resizeTo: window, backgroundColor: 0x120f14, resolution: window.devicePixelRatio || 1, autoDensity: true });
    document.body.appendChild(app.canvas as HTMLCanvasElement);
    
    // Strict mobile touch lock for canvas
    (app.canvas as HTMLCanvasElement).style.touchAction = 'none';
    app.stage.eventMode = 'static';
    
    // --- ASSET LOADER ---
    const assetsToLoad = [
        { alias: 'source', src: './assets/source.png' },
        { alias: 'receiver', src: './assets/receiver.png' },
        { alias: 'mirror', src: './assets/mirror.png' },
        { alias: 'plant', src: './assets/plant.png' },
        { alias: 'bed', src: './assets/bed.png' },
        { alias: 'sofa', src: './assets/sofa.png' },
        { alias: 'desk', src: './assets/desk.png' },
        { alias: 'crystal', src: './assets/crystal.png' },
        { alias: 'portal', src: './assets/portal.png' },
        { alias: 'dampener', src: './assets/dampener.png' },
        { alias: 'splitter', src: './assets/splitter.png' },
        { alias: 'poison', src: './assets/poison.png' },
        { alias: 'bgm', src: './assets/bgm.mp3' },            
        { alias: 'sfx_pickup', src: './assets/pickup.mp3' },  
        { alias: 'sfx_drop', src: './assets/drop.mp3' },      
        { alias: 'sfx_rotate', src: './assets/rotate.mp3' },  
        { alias: 'sfx_win', src: './assets/win.mp3' } 
    ];

    // Add all assets to the cache configuration
    assetsToLoad.forEach(asset => Assets.add(asset));

    // Progressively load each asset and handle errors individually
    await Promise.all(assetsToLoad.map(async (asset) => {
        try {
            await Assets.load(asset.alias);
        } catch (err) {
            console.warn(`Asset failed to load: ${asset.alias}. Continuing with fallback.`);
        }
    }));

    // --- AUDIO TOGGLE LOGIC ---
    toggleAudioBtn?.addEventListener('click', () => {
        isAudioMuted = !isAudioMuted;
        if (isAudioMuted) {
            sound.muteAll();
            if (toggleAudioBtn) toggleAudioBtn.innerText = "Unmute Audio";
        } else {
            sound.unmuteAll();
            if (toggleAudioBtn) toggleAudioBtn.innerText = "Mute Audio";
        }
    });

    // --- GAME START & AUDIO UNLOCKER ---
    startBtn?.addEventListener('click', () => {
        if (mainMenu) mainMenu.style.display = 'none';
        if (hud) hud.style.display = 'block';
        
        if (sound.exists('bgm')) {
            sound.play('bgm', { loop: true, volume: 0.3 }); 
        }
        
        loadLevel(0);
    });

    // --- GRID & LAYER SETUP ---
    let COLUMNS = 8, ROWS = 8, TILE_SIZE = 0, offsetX = 0, offsetY = 0;
    
    const roomBackground = new Graphics();
    app.stage.addChild(roomBackground);
    
    const entityLayer = new Container();
    app.stage.addChild(entityLayer);
    
    const darknessOverlay = new Graphics();
    darknessOverlay.eventMode = 'none'; 
    darknessOverlay.visible = false;
    app.stage.addChild(darknessOverlay);
    
    const signalLine = new Graphics();
    signalLine.eventMode = 'none';      
    app.stage.addChild(signalLine);

    const particleContainer = new Container();
    particleContainer.eventMode = 'none'; 
    app.stage.addChild(particleContainer);

    let isSignalMode = false;

    toggleVisionBtn?.addEventListener('click', () => {
        isSignalMode = !isSignalMode;
        darknessOverlay.visible = isSignalMode;
        if (toggleVisionBtn) {
            toggleVisionBtn.innerText = isSignalMode ? "Disable Signal Mode" : "Enable Signal Mode";
        }
    });

    function calculateGridBounds() {
        // Reduced margin slightly for mobile screens
        const margin = window.innerWidth < 600 ? 80 : 120; 
        TILE_SIZE = Math.floor(Math.min(window.innerWidth, window.innerHeight - margin) / Math.max(COLUMNS, ROWS));
        offsetX = Math.floor((window.innerWidth - (COLUMNS * TILE_SIZE)) / 2);
        offsetY = Math.floor((window.innerHeight - (ROWS * TILE_SIZE)) / 2) + 20; 

        roomBackground.clear();
        roomBackground.rect(offsetX, offsetY, COLUMNS * TILE_SIZE, ROWS * TILE_SIZE)
                      .fill(0xcd853f).stroke({ width: 2, color: 0x444444 }); 
        app.stage.hitArea = new Rectangle(0, 0, window.innerWidth, window.innerHeight);

        darknessOverlay.clear();
        darknessOverlay.rect(0, 0, window.innerWidth, window.innerHeight)
                       .fill({ color: 0x0a0815, alpha: 0.75 }); 
    }
    window.addEventListener('resize', calculateGridBounds);

    // --- PARTICLE SYSTEM ---
    interface Particle { sprite: Graphics, vx: number, vy: number, life: number, decay: number }
    const particles: Particle[] = [];

    function triggerWinParticles() {
        const entities = query(world, [GridPosition, ObjectType]);
        let targetX = window.innerWidth / 2, targetY = window.innerHeight / 2; 
        
        for (let i = 0; i < entities.length; i++) {
            if (ObjectType.type[entities[i]] === 1) { 
                targetX = offsetX + (GridPosition.x[entities[i]] * TILE_SIZE) + (TILE_SIZE / 2);
                targetY = offsetY + (GridPosition.y[entities[i]] * TILE_SIZE) + (TILE_SIZE / 2);
                break;
            }
        }

        for (let i = 0; i < 40; i++) {
            const p = new Graphics();
            p.rect(-4, -4, 8, 8).fill(Math.random() > 0.5 ? 0x00ced1 : 0xd4af37);
            p.x = targetX; p.y = targetY;
            p.rotation = Math.random() * Math.PI;
            particleContainer.addChild(p);

            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 6 + 2;
            particles.push({
                sprite: p,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                decay: Math.random() * 0.02 + 0.015
            });
        }
    }

    function updateParticles() {
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.sprite.x += p.vx;
            p.sprite.y += p.vy;
            p.sprite.rotation += 0.1;
            p.life -= p.decay;
            p.sprite.alpha = Math.max(0, p.life);
            
            if (p.life <= 0) {
                particleContainer.removeChild(p.sprite);
                p.sprite.destroy();
                particles.splice(i, 1);
            }
        }
    }

    // --- LEVEL DATA ---
    interface EntityData { x: number, y: number, w: number, h: number, type: number, col: number, asset: string, interactive: boolean }
    interface LevelData { name: string, cols: number, rows: number, tutorial?: string[], entities: EntityData[] }

  const levels: LevelData[] = [
        { name: "Phase 1: Direct Path", cols: 6, rows: 4, tutorial: ["Welcome. Guide light from the Lantern to the Cushion.", "Drag the wooden screen away to clear the path."], entities: [{ x: 0, y: 1, w: 1, h: 1, type: 0, col: 0xffffff, asset: 'source', interactive: false }, { x: 5, y: 1, w: 1, h: 1, type: 1, col: 0xff00ff, asset: 'receiver', interactive: false }, { x: 2, y: 1, w: 1, h: 2, type: 4, col: 0x8b4513, asset: 'sofa', interactive: true }] },
        { name: "Phase 2: The Turn", cols: 6, rows: 6, tutorial: ["Mirrors bounce light 90 degrees.", "TAP an item to rotate it. Drag it into the light."], entities: [{ x: 1, y: 4, w: 1, h: 1, type: 0, col: 0xffffff, asset: 'source', interactive: false }, { x: 4, y: 1, w: 1, h: 1, type: 1, col: 0xff00ff, asset: 'receiver', interactive: false }, { x: 4, y: 4, w: 1, h: 1, type: 2, col: 0x00ffff, asset: 'mirror', interactive: true }] },
        { name: "Phase 3: Vitality", cols: 8, rows: 5, tutorial: ["Signals weaken over distance.", "Pass the light through a Plant to boost its strength."], entities: [{ x: 0, y: 2, w: 1, h: 1, type: 0, col: 0xffffff, asset: 'source', interactive: false }, { x: 7, y: 2, w: 1, h: 1, type: 1, col: 0xff00ff, asset: 'receiver', interactive: false }, { x: 3, y: 2, w: 1, h: 1, type: 3, col: 0x00ff00, asset: 'plant', interactive: true }, { x: 5, y: 0, w: 1, h: 1, type: 4, col: 0x555555, asset: 'wall', interactive: true }] },
        { name: "Phase 4: The Star Splitter", cols: 7, rows: 7, tutorial: ["Splitters divide one beam into two.", "Combine their strength to reach the goal."], entities: [{ x: 3, y: 6, w: 1, h: 1, type: 0, col: 0xffffff, asset: 'source', interactive: false }, { x: 3, y: 0, w: 1, h: 1, type: 1, col: 0xff00ff, asset: 'receiver', interactive: false }, { x: 3, y: 3, w: 1, h: 1, type: 9, col: 0xaaaaaa, asset: 'splitter', interactive: true }, { x: 1, y: 3, w: 1, h: 1, type: 2, col: 0x00ffff, asset: 'mirror', interactive: true }, { x: 5, y: 3, w: 1, h: 1, type: 2, col: 0x00ffff, asset: 'mirror', interactive: true }, { x: 1, y: 1, w: 1, h: 1, type: 2, col: 0x00ffff, asset: 'mirror', interactive: true }, { x: 5, y: 1, w: 1, h: 1, type: 2, col: 0x00ffff, asset: 'mirror', interactive: true }] },
        { name: "Phase 5: The Spatial Bridge", cols: 9, rows: 5, tutorial: ["Astrolabes link two distant spots.", "Use them to pass through solid stone."], entities: [{ x: 0, y: 2, w: 1, h: 1, type: 0, col: 0xffffff, asset: 'source', interactive: false }, { x: 8, y: 2, w: 1, h: 1, type: 1, col: 0xff00ff, asset: 'receiver', interactive: false }, { x: 4, y: 0, w: 1, h: 5, type: 4, col: 0x555555, asset: 'sofa', interactive: false }, { x: 2, y: 2, w: 1, h: 1, type: 7, col: 0xffff00, asset: 'portal', interactive: true }, { x: 6, y: 2, w: 1, h: 1, type: 7, col: 0xffff00, asset: 'portal', interactive: true }] },
        { name: "Phase 6: Amplification", cols: 8, rows: 8, entities: [{ x: 0, y: 7, w: 1, h: 1, type: 0, col: 0xffffff, asset: 'source', interactive: false }, { x: 7, y: 0, w: 1, h: 1, type: 1, col: 0xff00ff, asset: 'receiver', interactive: false }, { x: 0, y: 0, w: 1, h: 1, type: 6, col: 0xffd700, asset: 'crystal', interactive: true }, { x: 7, y: 7, w: 1, h: 1, type: 2, col: 0x00ffff, asset: 'mirror', interactive: true }] },
        { name: "Phase 7: The Course", cols: 10, rows: 6, entities: [{ x: 0, y: 2, w: 1, h: 1, type: 0, col: 0xffffff, asset: 'source', interactive: false }, { x: 9, y: 2, w: 1, h: 1, type: 1, col: 0xff00ff, asset: 'receiver', interactive: false }, { x: 4, y: 2, w: 2, h: 1, type: 5, col: 0x8b0000, asset: 'poison', interactive: false }, { x: 4, y: 0, w: 1, h: 1, type: 6, col: 0xffd700, asset: 'crystal', interactive: true }, { x: 2, y: 0, w: 1, h: 1, type: 2, col: 0x00ffff, asset: 'mirror', interactive: true }, { x: 7, y: 0, w: 1, h: 1, type: 2, col: 0x00ffff, asset: 'mirror', interactive: true }] },
        { name: "Phase 8: Divided", cols: 8, rows: 8, entities: [{ x: 3, y: 7, w: 1, h: 1, type: 0, col: 0xffffff, asset: 'source', interactive: false }, { x: 4, y: 0, w: 1, h: 1, type: 1, col: 0xff00ff, asset: 'receiver', interactive: false }, { x: 0, y: 4, w: 8, h: 1, type: 4, col: 0x555555, asset: 'wall', interactive: false }, { x: 0, y: 2, w: 1, h: 1, type: 7, col: 0xffff00, asset: 'portal', interactive: true }, { x: 7, y: 6, w: 1, h: 1, type: 7, col: 0xffff00, asset: 'portal', interactive: true }, { x: 3, y: 2, w: 1, h: 1, type: 3, col: 0x00ff00, asset: 'plant', interactive: true }] },
        { name: "Phase 9: Grand Hall", cols: 10, rows: 10, entities: [{ x: 0, y: 0, w: 1, h: 1, type: 0, col: 0xffffff, asset: 'source', interactive: false }, { x: 9, y: 9, w: 1, h: 1, type: 1, col: 0xff00ff, asset: 'receiver', interactive: false }, { x: 5, y: 5, w: 1, h: 1, type: 9, col: 0xaaaaaa, asset: 'splitter', interactive: true }, { x: 2, y: 5, w: 1, h: 1, type: 6, col: 0xffd700, asset: 'crystal', interactive: true }, { x: 8, y: 5, w: 1, h: 1, type: 3, col: 0x00ff00, asset: 'plant', interactive: true }, { x: 0, y: 9, w: 1, h: 1, type: 2, col: 0x00ffff, asset: 'mirror', interactive: true }, { x: 9, y: 0, w: 1, h: 1, type: 2, col: 0x00ffff, asset: 'mirror', interactive: true }] },
        { name: "Phase 10: Mastery", cols: 12, rows: 10, entities: [{ x: 0, y: 0, w: 1, h: 1, type: 0, col: 0xffffff, asset: 'source', interactive: false }, { x: 11, y: 9, w: 1, h: 1, type: 1, col: 0xff00ff, asset: 'receiver', interactive: false }, { x: 6, y: 0, w: 1, h: 10, type: 4, col: 0x555555, asset: 'wall', interactive: false }, { x: 3, y: 0, w: 1, h: 1, type: 7, col: 0xffff00, asset: 'portal', interactive: true }, { x: 9, y: 9, w: 1, h: 1, type: 7, col: 0xffff00, asset: 'portal', interactive: true }, { x: 1, y: 5, w: 1, h: 1, type: 6, col: 0xffd700, asset: 'crystal', interactive: true }, { x: 10, y: 5, w: 1, h: 1, type: 3, col: 0x00ff00, asset: 'plant', interactive: true }] }
    ];

    // --- GAME START & LEVEL SELECT LOGIC ---
    function startGame(index: number) {
        if (mainMenu) mainMenu.style.display = 'none';
        if (hud) hud.style.display = 'block';
        
        if (sound.exists('bgm') && !isAudioMuted) {
            sound.play('bgm', { loop: true, volume: 0.3 }); 
        }
        
        currentLevelIndex = index;
        loadLevel(currentLevelIndex);
    }

    if (levelGrid) {
        levels.forEach((_, index) => {
            const btn = document.createElement('button');
            btn.className = 'level-btn';
            btn.innerText = (index + 1).toString();
            btn.addEventListener('click', () => startGame(index));
            levelGrid.appendChild(btn);
        });
    }

    // --- TUTORIAL LOGIC ---
    function playTutorialSequence(messages: string[]) {
        if (!tutorialDialog || !tutorialText) return;
        
        tutorialQueue = [...messages];
        
        const showNextMessage = () => {
            if (tutorialQueue.length > 0) {
                tutorialText.innerText = tutorialQueue.shift()!;
                tutorialDialog.showModal();
            } else {
                tutorialDialog.close();
            }
        };

        if (tutorialNextBtn) {
            tutorialNextBtn.replaceWith(tutorialNextBtn.cloneNode(true));
            tutorialNextBtn = document.getElementById('tutorial-next-btn');
            tutorialNextBtn?.addEventListener('click', () => {
                tutorialDialog.close(); 
                setTimeout(showNextMessage, 50); 
            });
        }

        showNextMessage();
    }

    function loadLevel(index: number) {
        const oldEntities = query(world, [GridPosition]);
        for (let i = 0; i < oldEntities.length; i++) {
            const eid = oldEntities[i];
            const sprite = spriteMap.get(eid);
            if (sprite) { entityLayer.removeChild(sprite); sprite.destroy({ children: true }); }
            spriteMap.delete(eid);
            removeEntity(world, eid);
        }

        const level = levels[index];
        COLUMNS = level.cols;
        ROWS = level.rows;
        calculateGridBounds();
        
        if (levelTitleText) levelTitleText.innerText = level.name;
        isLevelComplete = false;
        if (winDialog) winDialog.close();
        if (endDialog) endDialog.close();

        level.entities.forEach(data => {
            spawnEntity(data.x, data.y, data.w, data.h, data.type, data.col, data.asset, data.interactive);
        });

        if (level.tutorial && level.tutorial.length > 0) {
            playTutorialSequence(level.tutorial);
        }
    }

    // --- GAME STATE ---
    function updateGameState(strength: number) {
        if (!statusText || !signalBarFill || !winDialog) return;

        const finalStrength = Math.max(0, Math.min(100, Math.floor(strength)));
        statusText.innerText = `Signal: ${finalStrength}%`;
        signalBarFill.style.width = `${finalStrength}%`;
        
        let hexColor = '#c0392b'; 
        let labelText = 'BLOCKED';

        if (finalStrength >= 80) {
            hexColor = '#00ced1'; 
            labelText = 'HARMONIC';
        } else if (finalStrength >= 40) {
            hexColor = '#d4af37'; 
            labelText = 'FLOWING';
        }

        signalBarFill.style.backgroundColor = hexColor;
        
        if (statusLabel) {
            statusLabel.innerText = labelText;
            statusLabel.style.color = hexColor;
        }

        if (finalStrength >= 80 && !isLevelComplete) {
            isLevelComplete = true;
            triggerWinParticles();
            
            if (sound.exists('sfx_win') && !isAudioMuted) sound.play('sfx_win', { volume: 1.0 });
            
            if (currentLevelIndex >= levels.length - 1 && nextLevelBtn) {
                nextLevelBtn.innerText = "Complete Journey";
            } else if (nextLevelBtn) {
                nextLevelBtn.innerText = "Next Phase";
            }
            
            winDialog.showModal();
        } 
    }

    // --- EVENT LISTENERS ---
    if (nextLevelBtn) {
        nextLevelBtn.addEventListener('click', () => {
            winDialog.close();
            if (currentLevelIndex < levels.length - 1) {
                currentLevelIndex++;
                loadLevel(currentLevelIndex);
            } else {
                if (endDialog) endDialog.showModal();
            }
        });
    }

    if (restartBtn) {
        restartBtn.addEventListener('click', () => {
            if (endDialog) endDialog.close();
            if (hud) hud.style.display = 'none';
            if (mainMenu) mainMenu.style.display = 'flex';
        });
    }

    // --- SYSTEMS ---
    function isAreaOccupied(targetX: number, targetY: number, targetW: number, targetH: number, ignoreEid: number): boolean {
        const entities = query(world, [GridPosition, Dimensions]);
        for (let i = 0; i < entities.length; i++) {
            const otherEid = entities[i];
            if (otherEid === ignoreEid) continue;
            if (targetX < GridPosition.x[otherEid] + Dimensions.width[otherEid] && targetX + targetW > GridPosition.x[otherEid] &&
                targetY < GridPosition.y[otherEid] + Dimensions.height[otherEid] && targetY + targetH > GridPosition.y[otherEid]) {
                return true;
            }
        }
        return false;
    }

    const renderSystem = (world: any) => {
        const entities = query(world, [GridPosition, ObjectType]);
        for (let i = 0; i < entities.length; i++) {
            const eid = entities[i];
            const container = spriteMap.get(eid);
            if (container) {
                const currentW = Dimensions.width[eid] || 1;
                const currentH = Dimensions.height[eid] || 1;

                if (Draggable.isDragging[eid] === 0) {
                    const targetX = offsetX + (GridPosition.x[eid] * TILE_SIZE) + ((TILE_SIZE * currentW) / 2);
                    const targetY = offsetY + (GridPosition.y[eid] * TILE_SIZE) + ((TILE_SIZE * currentH) / 2);
                    
                    container.x += (targetX - container.x) * 0.25;
                    container.y += (targetY - container.y) * 0.25;
                }
                
                // Fetch the original unrotated dimensions saved during spawn
                const baseW = (container as any).baseW || 1;
                const baseH = (container as any).baseH || 1;
                
                const spriteContainer = container.children[1] as Container;
                if (spriteContainer && spriteContainer.children[0]) {
                    const child = spriteContainer.children[0] as any;
                    const targetW = (TILE_SIZE * baseW) - (TILE_SIZE * 0.1);
                    const targetH = (TILE_SIZE * baseH) - (TILE_SIZE * 0.1);
                    
                    if (child.texture && child.texture.width > 0) {
                        const texW = child.texture.width;
                        const texH = child.texture.height;
                        const scaleFactor = Math.min(targetW / texW, targetH / texH);
                        child.scale.set(scaleFactor);
                    } else {
                        child.width = targetW;
                        child.height = targetH;
                    }
                }

                // Handle the dynamic interactivity indicator
                const indicator = container.children[0] as Graphics;
                if (indicator) {
                    const isInteractive = Interactable.isInteractable[eid] === 1;
                    const wPx = (TILE_SIZE * baseW) - (TILE_SIZE * 0.1);
                    const hPx = (TILE_SIZE * baseH) - (TILE_SIZE * 0.1);
                    
                    indicator.clear();
                    if (isInteractive) {
                        indicator.roundRect(-wPx / 2, -hPx / 2, wPx, hPx, 8)
                                 .stroke({ width: 2, color: 0xd4af37, alpha: Math.sin(Date.now() / 200) * 0.3 + 0.5 });
                    } else {
                        indicator.roundRect(-wPx / 2, -hPx / 2, wPx, hPx, 8)
                                 .stroke({ width: 2, color: 0x444444, alpha: 0.8 })
                                 .fill({ color: 0x1a1525, alpha: 0.5 });
                    }
                }
                
                if (Rotation.angle[eid] !== undefined) {
                    container.rotation += (Rotation.angle[eid] - container.rotation) * 0.2;
                }
            }
        }
        return world;
    };

    const raycastSystem = (world: any) => {
        signalLine.clear();
        const entities = query(world, [GridPosition, ObjectType]);
        const gridMap = new Map<string, number>();
        let sourceEid = -1;

        for (let i = 0; i < entities.length; i++) {
            const eid = entities[i];
            const w = Dimensions.width[eid] || 1;
            const h = Dimensions.height[eid] || 1;
            for (let dx = 0; dx < w; dx++) {
                for (let dy = 0; dy < h; dy++) {
                    gridMap.set(`${GridPosition.x[eid] + dx},${GridPosition.y[eid] + dy}`, eid);
                }
            }
            if (ObjectType.type[eid] === 0) sourceEid = eid;
        }

        if (sourceEid === -1) return world;

        let maxReceiverStrength = 0;
        let hitReceiver = false;
        
        const rays = [{ x: GridPosition.x[sourceEid], y: GridPosition.y[sourceEid], dx: 1, dy: 0, strength: 100 }];
        let safetyCounter = 0;

        while (rays.length > 0 && safetyCounter < 200) {
            safetyCounter++;
            const ray = rays.pop()!;
            let { x: currentX, y: currentY, dx: dirX, dy: dirY, strength: currentStrength } = ray;

            signalLine.moveTo(offsetX + (currentX * TILE_SIZE) + (TILE_SIZE / 2), offsetY + (currentY * TILE_SIZE) + (TILE_SIZE / 2));

            for (let step = 0; step < 50; step++) {
                currentX += dirX; currentY += dirY; currentStrength -= 2; 
                signalLine.lineTo(offsetX + (currentX * TILE_SIZE) + (TILE_SIZE / 2), offsetY + (currentY * TILE_SIZE) + (TILE_SIZE / 2));

                if (currentX < 0 || currentX >= COLUMNS || currentY < 0 || currentY >= ROWS) break; 

                const key = `${currentX},${currentY}`;
                if (gridMap.has(key)) {
                    const hitEid = gridMap.get(key)!;
                    const type = ObjectType.type[hitEid];

                    if (type === 1) { hitReceiver = true; maxReceiverStrength = Math.max(maxReceiverStrength, currentStrength); break; } 
                    else if (type === 4) break;
                    else if (type === 5) currentStrength -= 30; 
                    else if (type === 3) currentStrength = Math.min(100, currentStrength + 25);
                    else if (type === 6) currentStrength = Math.min(100, currentStrength + 40);
                    else if (type === 8) currentStrength -= 15;
                    else if (type === 9) { 
                        currentStrength -= 10; 
                        if (dirX !== 0) {
                            rays.push({ x: currentX, y: currentY, dx: 0, dy: -1, strength: currentStrength });
                            rays.push({ x: currentX, y: currentY, dx: 0, dy: 1, strength: currentStrength });
                        } else {
                            rays.push({ x: currentX, y: currentY, dx: -1, dy: 0, strength: currentStrength });
                            rays.push({ x: currentX, y: currentY, dx: 1, dy: 0, strength: currentStrength });
                        }
                        break; 
                    } 
                    else if (type === 7) { 
                        let pairedX = -1, pairedY = -1;
                        gridMap.forEach((otherEid, coordKey) => {
                            if (otherEid !== hitEid && ObjectType.type[otherEid] === 7) {
                                const coords = coordKey.split(',');
                                pairedX = parseInt(coords[0]); pairedY = parseInt(coords[1]);
                            }
                        });
                        if (pairedX !== -1) rays.push({ x: pairedX, y: pairedY, dx: dirX, dy: dirY, strength: currentStrength - 10 });
                        break; 
                    } 
                    else if (type === 2) { 
                        currentStrength -= 5;
                        const angle = Rotation.angle[hitEid];
                        const isForwardSlash = Math.abs(angle % Math.PI) > 0.1; 
                        if (isForwardSlash) { 
                            if (dirX === 1) { dirX = 0; dirY = -1; } else if (dirX === -1) { dirX = 0; dirY = 1; } 
                            else if (dirY === 1) { dirX = -1; dirY = 0; } else if (dirY === -1) { dirX = 1; dirY = 0; } 
                        } else { 
                            if (dirX === 1) { dirX = 0; dirY = 1; } else if (dirX === -1) { dirX = 0; dirY = -1; }
                            else if (dirY === 1) { dirX = 1; dirY = 0; } else if (dirY === -1) { dirX = -1; dirY = 0; }
                        }
                    }
                }
            }
        }

        updateGameState(hitReceiver ? maxReceiverStrength : 0);
        
        let beamThickness = 6;
        let beamAlpha = 0.5;
        let beamColor = 0xc0392b;

        if (maxReceiverStrength >= 80) {
            beamColor = 0x00ced1; 
            beamThickness = 10;   
            beamAlpha = Math.sin(Date.now() / 150) * 0.2 + 0.8; 
        } else if (maxReceiverStrength > 40) {
            beamColor = 0xd4af37; 
            beamThickness = 6;
            beamAlpha = Math.sin(Date.now() / 300) * 0.15 + 0.6; 
        } else {
            beamThickness = 4;    
            beamAlpha = 0.3;      
        }
        
        if (isSignalMode) {
            signalLine.stroke({ width: beamThickness * 3, color: beamColor, alpha: beamAlpha * 0.2 });
            signalLine.stroke({ width: beamThickness, color: beamColor, alpha: beamAlpha });
            if (maxReceiverStrength > 40) {
                signalLine.stroke({ width: beamThickness * 0.3, color: 0xffffff, alpha: 0.9 });
            }
        } else {
            signalLine.stroke({ width: beamThickness, color: beamColor, alpha: beamAlpha });
        }
        
        return world;
    };

    // --- ENTITY SPAWNER ---
    function spawnEntity(x: number, y: number, w: number, h: number, type: number, fallbackCol: number, assetAlias: string, interactive: boolean = false) {
        const eid = addEntity(world);
        addComponent(world, eid, GridPosition); GridPosition.x[eid] = x; GridPosition.y[eid] = y;
        addComponent(world, eid, Dimensions); Dimensions.width[eid] = w; Dimensions.height[eid] = h;
        addComponent(world, eid, ObjectType); ObjectType.type[eid] = type;
        addComponent(world, eid, Rotation); Rotation.angle[eid] = 0;
        addComponent(world, eid, Draggable); Draggable.isDragging[eid] = 0;
        addComponent(world, eid, Interactable); Interactable.isInteractable[eid] = interactive ? 1 : 0;
        
        const container = new Container();
        
        // Save the original unrotated dimensions to the container
        (container as any).baseW = w;
        (container as any).baseH = h;

        // Base plate/indicator for interactivity rendering
        const indicator = new Graphics();
        container.addChild(indicator);

        // Sub-container specifically for the visual sprite/graphic so it scales independently of the indicator logic
        const spriteContainer = new Container();
        
        try {
            if (Assets.cache.has(assetAlias)) {
                const sprite = Sprite.from(assetAlias);
                sprite.anchor.set(0.5); 
                spriteContainer.addChild(sprite);
            } else {
                throw new Error("Asset not in cache");
            }
        } catch (e) {
            const graphics = new Graphics();
            graphics.rect(-50, -50, 100, 100).fill(fallbackCol);
            spriteContainer.addChild(graphics);
        }

        container.addChild(spriteContainer);

        container.x = offsetX + (x * TILE_SIZE) + ((TILE_SIZE * w) / 2);
        container.y = offsetY + (y * TILE_SIZE) + ((TILE_SIZE * h) / 2);
        
        if (interactive) {
            container.eventMode = 'static'; container.cursor = 'pointer';
            let dragStartX = 0, dragStartY = 0, originalGridX = x, originalGridY = y;

            container.on('pointerdown', (e) => {
                Draggable.isDragging[eid] = 1; dragStartX = e.global.x; dragStartY = e.global.y;
                originalGridX = GridPosition.x[eid]; originalGridY = GridPosition.y[eid]; container.alpha = 0.7;
                
                if (sound.exists('sfx_pickup') && !isAudioMuted) sound.play('sfx_pickup', { volume: 0.6 });
            });

            container.on('globalpointermove', (e) => {
                if (Draggable.isDragging[eid] === 1) { container.x = e.global.x; container.y = e.global.y; }
            });

            const onPointerRelease = (e: any) => {
                if (Draggable.isDragging[eid] === 1) {
                    Draggable.isDragging[eid] = 0; container.alpha = 1.0;
                    const dist = Math.hypot(e.global.x - dragStartX, e.global.y - dragStartY);
                    const currentW = Dimensions.width[eid], currentH = Dimensions.height[eid];

                    if (dist < 10) {
                        const newW = currentH, newH = currentW;
                        if (originalGridX + newW <= COLUMNS && originalGridY + newH <= ROWS && !isAreaOccupied(originalGridX, originalGridY, newW, newH, eid)) {
                            Dimensions.width[eid] = newW; Dimensions.height[eid] = newH;
                            Rotation.angle[eid] += Math.PI / 2;
                            
                            if (sound.exists('sfx_rotate') && !isAudioMuted) sound.play('sfx_rotate', { volume: 0.7 });
                        }
                    } else {
                        const topLeftXPx = (container.x - offsetX) - ((TILE_SIZE * currentW) / 2);
                        const topLeftYPx = (container.y - offsetY) - ((TILE_SIZE * currentH) / 2);
                        const targetX = Math.max(0, Math.min(COLUMNS - currentW, Math.round(topLeftXPx / TILE_SIZE)));
                        const targetY = Math.max(0, Math.min(ROWS - currentH, Math.round(topLeftYPx / TILE_SIZE)));
                        
                        if (isAreaOccupied(targetX, targetY, currentW, currentH, eid)) {
                            GridPosition.x[eid] = originalGridX; GridPosition.y[eid] = originalGridY;
                        } else {
                            GridPosition.x[eid] = targetX; GridPosition.y[eid] = targetY;
                        }
                        
                        if (sound.exists('sfx_drop') && !isAudioMuted) sound.play('sfx_drop', { volume: 0.8 });
                    }
                }
            };
            container.on('pointerup', onPointerRelease); container.on('pointerupoutside', onPointerRelease);
        }
        
        entityLayer.addChild(container); 
        spriteMap.set(eid, container);
    }

    app.ticker.add(() => { 
        renderSystem(world); 
        raycastSystem(world); 
        updateParticles();
    });
}

init();