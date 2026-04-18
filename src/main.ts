// File: src/main.ts
import { Application, Graphics, Rectangle, Container, Assets, Sprite } from 'pixi.js';
import { 
    createWorld, 
    query, 
    addEntity, 
    addComponent,
    removeEntity
} from 'bitecs';

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

const spriteMap = new Map<number, Container>();

// --- UI DOM ELEMENTS ---
const uiLayer = document.createElement('div');
uiLayer.innerHTML = `
    <style>
        body { margin: 0; overflow: hidden; background-color: #1a1a1a; }
        #ui-layer {
            position: absolute; top: 15px; left: 15px; z-index: 100; pointer-events: none;
            font-family: 'Courier New', Courier, monospace; color: white; text-shadow: 1px 1px 2px rgba(0,0,0,0.8);
        }
        h2 { margin: 0; font-size: 16px; letter-spacing: 1px; }
        #level-title { font-size: 11px; color: #aaa; margin-top: 2px; margin-bottom: 8px; }
        #status-text { font-size: 12px; font-weight: bold; }
        #signal-bar-container { width: 150px; height: 10px; background: #333; border: 1px solid #fff; margin-top: 4px; }
        #signal-bar-fill { width: 0%; height: 100%; background: #ff0000; transition: width 0.2s, background-color 0.2s; }
        
        dialog {
            background: rgba(26, 26, 26, 0.95); border: 2px solid #00ff00; border-radius: 8px;
            color: white; text-align: center; padding: 30px 50px; font-family: 'Courier New', Courier, monospace;
            box-shadow: 0 0 30px rgba(0, 255, 0, 0.2);
        }
        dialog::backdrop { background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(2px); }
        dialog h1 { color: #00ff00; font-size: 24px; text-transform: uppercase; margin-top: 0; letter-spacing: 2px; }
        dialog p { color: #ccc; font-size: 14px; margin-bottom: 25px; }
        
        #next-level-btn { 
            background: #00ff00; color: #000; border: none; padding: 12px 24px; 
            font-size: 14px; font-weight: bold; cursor: pointer; border-radius: 4px; text-transform: uppercase;
        }
        #next-level-btn:hover { background: #00cc00; }
    </style>
    <div id="ui-layer">
        <h2>Signal & Sanctuary</h2>
        <div id="level-title"></div>
        <div id="status-text">Signal: 0%</div>
        <div id="signal-bar-container"><div id="signal-bar-fill"></div></div>
    </div>
    <dialog id="win-dialog">
        <h1>Harmonic Resonance</h1>
        <p>The space is balanced. Qi flows freely.</p>
        <button id="next-level-btn">Next Phase</button>
    </dialog>
`;
document.body.appendChild(uiLayer);

const statusText = document.getElementById('status-text');
const signalBarFill = document.getElementById('signal-bar-fill');
const winDialog = document.getElementById('win-dialog') as HTMLDialogElement;
const nextLevelBtn = document.getElementById('next-level-btn');
const levelTitleText = document.getElementById('level-title');

let currentLevelIndex = 0;
let isLevelComplete = false;

// --- INITIALISATION ---
async function init() {
    const app = new Application();
    await app.init({ resizeTo: window, backgroundColor: 0x1a1a1a, resolution: window.devicePixelRatio || 1, autoDensity: true });
    document.body.appendChild(app.canvas as HTMLCanvasElement);
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
        { alias: 'wall', src: './assets/wall.png' },
        { alias: 'crystal', src: './assets/crystal.png' },
        { alias: 'portal', src: './assets/portal.png' },
        { alias: 'dampener', src: './assets/dampener.png' },
        { alias: 'splitter', src: './assets/splitter.png' },
        { alias: 'poison', src: './assets/poison.png' }
    ];

    try {
        assetsToLoad.forEach(asset => Assets.add(asset));
        await Assets.load(assetsToLoad.map(a => a.alias));
    } catch (err) {
        console.warn("Assets not found. Using coloured box fallbacks. Ensure your SVGs are exported as PNGs to the /assets/ folder.");
    }

    // --- GRID SETUP ---
    let COLUMNS = 8, ROWS = 8, TILE_SIZE = 0, offsetX = 0, offsetY = 0;
    const roomBackground = new Graphics();
    app.stage.addChild(roomBackground);
    const signalLine = new Graphics();
    app.stage.addChild(signalLine);

    function calculateGridBounds() {
        const margin = 120; 
        TILE_SIZE = Math.floor(Math.min(window.innerWidth, window.innerHeight - margin) / Math.max(COLUMNS, ROWS));
        offsetX = Math.floor((window.innerWidth - (COLUMNS * TILE_SIZE)) / 2);
        offsetY = Math.floor((window.innerHeight - (ROWS * TILE_SIZE)) / 2) + 40; 

        roomBackground.clear();
        roomBackground.rect(offsetX, offsetY, COLUMNS * TILE_SIZE, ROWS * TILE_SIZE)
                      .fill(0x2a2a2a).stroke({ width: 2, color: 0x444444 });
        app.stage.hitArea = new Rectangle(0, 0, window.innerWidth, window.innerHeight);
    }
    window.addEventListener('resize', calculateGridBounds);

    // --- LEVEL DATA ---
    interface EntityData { x: number, y: number, w: number, h: number, type: number, col: number, asset: string, interactive: boolean }
    interface LevelData { name: string, cols: number, rows: number, entities: EntityData[] }

    const levels: LevelData[] = [
        {
            name: "Level 1: The Direct Path (Tutorial)",
            cols: 6, rows: 4,
            entities: [
                { x: 0, y: 1, w: 1, h: 1, type: 0, col: 0xffffff, asset: 'source', interactive: false },
                { x: 5, y: 1, w: 1, h: 1, type: 1, col: 0xff00ff, asset: 'receiver', interactive: false },
                { x: 2, y: 1, w: 1, h: 2, type: 4, col: 0x8b4513, asset: 'wall', interactive: true }
            ]
        },
        {
            name: "Level 2: Reflection & Filtering (Beginner)",
            cols: 8, rows: 8,
            entities: [
                { x: 0, y: 6, w: 1, h: 1, type: 0, col: 0xffffff, asset: 'source', interactive: false },
                { x: 7, y: 1, w: 1, h: 1, type: 1, col: 0xff00ff, asset: 'receiver', interactive: false },
                { x: 4, y: 3, w: 2, h: 2, type: 4, col: 0x4444ff, asset: 'bed', interactive: true },
                { x: 3, y: 6, w: 1, h: 1, type: 5, col: 0x8b0000, asset: 'poison', interactive: true },
                { x: 2, y: 6, w: 1, h: 1, type: 2, col: 0x00ffff, asset: 'mirror', interactive: true },
                { x: 7, y: 6, w: 1, h: 1, type: 2, col: 0x00ffff, asset: 'mirror', interactive: true },
                { x: 5, y: 4, w: 1, h: 1, type: 3, col: 0x00ff00, asset: 'plant', interactive: true }
            ]
        },
        {
            name: "Level 3: The Broken Space (Advanced)",
            cols: 10, rows: 8,
            entities: [
                { x: 0, y: 2, w: 1, h: 1, type: 0, col: 0xffffff, asset: 'source', interactive: false },
                { x: 9, y: 7, w: 1, h: 1, type: 1, col: 0xff00ff, asset: 'receiver', interactive: false },
                // Split the wall into individual 1x1 segments
                { x: 4, y: 0, w: 1, h: 1, type: 4, col: 0x555555, asset: 'wall', interactive: false },
                { x: 4, y: 1, w: 1, h: 1, type: 4, col: 0x555555, asset: 'wall', interactive: false },
                { x: 4, y: 2, w: 1, h: 1, type: 4, col: 0x555555, asset: 'wall', interactive: false },
                { x: 4, y: 3, w: 1, h: 1, type: 4, col: 0x555555, asset: 'wall', interactive: false },
                { x: 4, y: 4, w: 1, h: 1, type: 4, col: 0x555555, asset: 'wall', interactive: false },
                { x: 4, y: 5, w: 1, h: 1, type: 4, col: 0x555555, asset: 'wall', interactive: false },
                { x: 4, y: 6, w: 1, h: 1, type: 4, col: 0x555555, asset: 'wall', interactive: false },
                { x: 4, y: 7, w: 1, h: 1, type: 4, col: 0x555555, asset: 'wall', interactive: false },
                // Tools
                { x: 1, y: 2, w: 1, h: 1, type: 7, col: 0xffff00, asset: 'portal', interactive: true },
                { x: 7, y: 2, w: 1, h: 1, type: 7, col: 0xffff00, asset: 'portal', interactive: true },
                { x: 8, y: 5, w: 1, h: 1, type: 2, col: 0x00ffff, asset: 'mirror', interactive: true },
                { x: 5, y: 6, w: 1, h: 1, type: 2, col: 0x00ffff, asset: 'mirror', interactive: true },
                { x: 2, y: 5, w: 1, h: 1, type: 6, col: 0xff69b4, asset: 'crystal', interactive: true },
                { x: 6, y: 3, w: 1, h: 1, type: 3, col: 0x00ff00, asset: 'plant', interactive: true }
            ]
        }
    ];

    function loadLevel(index: number) {
        const oldEntities = query(world, [GridPosition]);
        for (let i = 0; i < oldEntities.length; i++) {
            const eid = oldEntities[i];
            const sprite = spriteMap.get(eid);
            if (sprite) { app.stage.removeChild(sprite); sprite.destroy({ children: true }); }
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

        level.entities.forEach(data => {
            spawnEntity(data.x, data.y, data.w, data.h, data.type, data.col, data.asset, data.interactive);
        });
    }

    // --- GAME STATE ---
    function updateGameState(strength: number) {
        if (!statusText || !signalBarFill || !winDialog) return;

        const finalStrength = Math.max(0, Math.min(100, Math.floor(strength)));
        statusText.innerText = `Signal: ${finalStrength}%`;
        signalBarFill.style.width = `${finalStrength}%`;
        signalBarFill.style.backgroundColor = finalStrength < 40 ? '#ff4444' : finalStrength < 80 ? '#ffaa00' : '#00ff00'; 

        if (finalStrength >= 80 && !isLevelComplete) {
            isLevelComplete = true;
            winDialog.showModal();
            if (currentLevelIndex >= levels.length - 1 && nextLevelBtn) {
                nextLevelBtn.innerText = "Game Complete!";
                nextLevelBtn.style.pointerEvents = "none";
            }
        } 
    }

    if (nextLevelBtn) {
        nextLevelBtn.addEventListener('click', () => {
            if (currentLevelIndex < levels.length - 1) {
                winDialog.close();
                currentLevelIndex++;
                loadLevel(currentLevelIndex);
            }
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
                const w = Dimensions.width[eid] || 1;
                const h = Dimensions.height[eid] || 1;
                const maxDim = Math.max(w, h); 

                if (Draggable.isDragging[eid] === 0) {
                    container.x = offsetX + (GridPosition.x[eid] * TILE_SIZE) + ((TILE_SIZE * w) / 2);
                    container.y = offsetY + (GridPosition.y[eid] * TILE_SIZE) + ((TILE_SIZE * h) / 2);
                }
                
                container.width = (TILE_SIZE * maxDim) - (TILE_SIZE * 0.2);
                container.height = (TILE_SIZE * maxDim) - (TILE_SIZE * 0.2);
                
                if (Rotation.angle[eid] !== undefined) {
                    container.rotation = Rotation.angle[eid];
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
        signalLine.stroke({ width: 6, color: maxReceiverStrength >= 80 ? 0x00ff00 : (maxReceiverStrength > 40 ? 0xffaa00 : 0xff4444), alpha: 0.8 });
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
        
        const container = new Container();

        try {
            if (Assets.cache.has(assetAlias)) {
                const sprite = Sprite.from(assetAlias);
                sprite.anchor.set(0.5); 
                container.addChild(sprite);
            } else {
                throw new Error("Asset not in cache");
            }
        } catch (e) {
            const graphics = new Graphics();
            graphics.rect(-50, -50, 100, 100).fill(fallbackCol);
            container.addChild(graphics);
        }
        
        if (interactive) {
            container.eventMode = 'static'; container.cursor = 'pointer';
            let dragStartX = 0, dragStartY = 0, originalGridX = x, originalGridY = y;

            container.on('pointerdown', (e) => {
                Draggable.isDragging[eid] = 1; dragStartX = e.global.x; dragStartY = e.global.y;
                originalGridX = GridPosition.x[eid]; originalGridY = GridPosition.y[eid]; container.alpha = 0.7;
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
                    }
                }
            };
            container.on('pointerup', onPointerRelease); container.on('pointerupoutside', onPointerRelease);
        }
        app.stage.addChild(container); spriteMap.set(eid, container);
    }

    loadLevel(0);
    app.ticker.add(() => { renderSystem(world); raycastSystem(world); });
}

init();