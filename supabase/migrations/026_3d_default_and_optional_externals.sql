-- =============================================================================
-- Migration 026: Default 3D externals + optional external libraries
-- =============================================================================
-- 1. Update all 3D boilerplates to include the full default external set
-- 2. Register optional external libraries for 3D game development
-- =============================================================================

-- ─── 1. Update 3D boilerplate default externals ────────────────────────────────

UPDATE genre_boilerplates
SET externals = ARRAY['three_js', 'atomic_assets', 'buu_assets', 'gaussian_splats_3d', 'three_gltf_loader']
WHERE game_format = '3d';

-- ─── 2. Register optional external libraries ───────────────────────────────────

-- Cannon.js (ES) — Lightweight 3D physics engine
INSERT INTO external_registry (
  name, display_name, package_name, version, cdn_url, global_name,
  description, load_type, api_surface
)
VALUES (
  'cannon_es',
  'Cannon.js (ES)',
  'cannon-es',
  '0.20.0',
  'https://cdn.jsdelivr.net/npm/cannon-es@0.20.0/dist/cannon-es.cjs.js',
  'CANNON',
  'Lightweight 3D physics engine — rigid bodies, gravity, collisions, constraints, raycasting.',
  'script',
  '// Cannon-ES v0.20.0 - Available API (window.CANNON)
//
// === World ===
// new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) })
// world.addBody(body)
// world.removeBody(body)
// world.step(fixedTimeStep, deltaTime, maxSubSteps)
//
// === Bodies ===
// new CANNON.Body({ mass, shape, position, material })
// body.position: CANNON.Vec3
// body.quaternion: CANNON.Quaternion
// body.velocity: CANNON.Vec3
// body.angularVelocity: CANNON.Vec3
// body.applyForce(force, worldPoint)
// body.applyImpulse(impulse, worldPoint)
// body.type: CANNON.Body.STATIC | DYNAMIC | KINEMATIC
//
// === Shapes ===
// new CANNON.Box(halfExtents)
// new CANNON.Sphere(radius)
// new CANNON.Plane()
// new CANNON.Cylinder(radiusTop, radiusBottom, height, numSegments)
// new CANNON.ConvexPolyhedron({ vertices, faces })
// new CANNON.Trimesh(vertices, indices)
// new CANNON.Heightfield(data, { elementSize })
//
// === Materials & Contact ===
// new CANNON.Material(name)
// new CANNON.ContactMaterial(matA, matB, { friction, restitution })
// world.addContactMaterial(contactMaterial)
//
// === Constraints ===
// new CANNON.DistanceConstraint(bodyA, bodyB, distance)
// new CANNON.PointToPointConstraint(bodyA, pivotA, bodyB, pivotB)
// new CANNON.HingeConstraint(bodyA, bodyB, options)
// new CANNON.LockConstraint(bodyA, bodyB)
// world.addConstraint(constraint)
//
// === Events ===
// body.addEventListener("collide", (event) => { event.body, event.contact })
// world.addEventListener("postStep", callback)
//
// === Raycasting ===
// world.raycastClosest(from, to, options, result)
// world.raycastAll(from, to, options, callback)
//
// === Math ===
// new CANNON.Vec3(x, y, z)
// new CANNON.Quaternion(x, y, z, w)
// vec3.copy(other), vec3.vadd(other, target), vec3.scale(scalar, target)
//
// === Three.js Integration Pattern ===
// mesh.position.copy(body.position)
// mesh.quaternion.copy(body.quaternion)'
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  version = EXCLUDED.version,
  cdn_url = EXCLUDED.cdn_url,
  description = EXCLUDED.description,
  api_surface = EXCLUDED.api_surface;

-- Howler.js — Audio library with spatial 3D sound
INSERT INTO external_registry (
  name, display_name, package_name, version, cdn_url, global_name,
  description, load_type, api_surface
)
VALUES (
  'howler_js',
  'Howler.js',
  'howler',
  '2.2.4',
  'https://cdn.jsdelivr.net/npm/howler@2.2.4/dist/howler.min.js',
  'Howl',
  'Audio library with spatial 3D sound, sprites, and Web Audio API support for game sound effects and music.',
  'script',
  '// Howler.js v2.2.4 - Available API
//
// === Sound Creation ===
// new Howl({ src: ["sound.mp3"], volume: 1.0, loop: false, autoplay: false })
// new Howl({ src: ["sprite.mp3"], sprite: { blast: [0, 3000], laser: [4000, 1000] } })
//
// === Playback ===
// sound.play(spriteOrId?)
// sound.pause(id?)
// sound.stop(id?)
// sound.seek(position?, id?)
// sound.playing(id?)
//
// === Volume & Rate ===
// sound.volume(vol?, id?)
// sound.rate(rate?, id?)
// sound.fade(from, to, duration, id?)
// sound.mute(muted, id?)
//
// === Spatial / 3D Audio ===
// sound.pos(x, y, z, id?)
// sound.orientation(x, y, z, xUp, yUp, zUp, id?)
// sound.pannerAttr({ panningModel, distanceModel, refDistance, maxDistance, rolloffFactor }, id?)
// Howler.pos(x, y, z)  // listener position
// Howler.orientation(x, y, z, xUp, yUp, zUp)  // listener orientation
//
// === Events ===
// sound.on("load", callback)
// sound.on("play", callback)
// sound.on("end", callback)
// sound.on("stop", callback)
// sound.on("fade", callback)
//
// === Global Controls ===
// Howler.volume(vol?)
// Howler.mute(muted)
// Howler.stop()
// Howler.unload()'
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  version = EXCLUDED.version,
  cdn_url = EXCLUDED.cdn_url,
  description = EXCLUDED.description,
  api_surface = EXCLUDED.api_surface;

-- OrbitControls — Three.js camera controls addon
INSERT INTO external_registry (
  name, display_name, package_name, version, cdn_url, global_name,
  description, load_type, module_imports, api_surface
)
VALUES (
  'three_orbit_controls',
  'OrbitControls',
  'three',
  '0.160.0',
  'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/controls/OrbitControls.js',
  'THREE',
  'Three.js camera orbit/pan/zoom controls addon — drag to rotate, scroll to zoom, right-click to pan.',
  'module',
  '{"three": "THREE"}'::jsonb,
  '// OrbitControls (Three.js addon) - Available API
//
// import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
//
// === Setup ===
// const controls = new OrbitControls(camera, renderer.domElement)
//
// === Properties ===
// controls.enableDamping = true      // smooth camera movement
// controls.dampingFactor = 0.05
// controls.enableZoom = true
// controls.enableRotate = true
// controls.enablePan = true
// controls.autoRotate = false
// controls.autoRotateSpeed = 2.0
// controls.minDistance = 1            // zoom limits
// controls.maxDistance = 100
// controls.minPolarAngle = 0         // vertical rotation limits
// controls.maxPolarAngle = Math.PI
// controls.target: THREE.Vector3     // orbit center point
//
// === Methods ===
// controls.update()                  // call in animation loop (required with damping)
// controls.dispose()                 // clean up event listeners
// controls.reset()                   // reset to initial state
//
// === Events ===
// controls.addEventListener("change", callback)
// controls.addEventListener("start", callback)
// controls.addEventListener("end", callback)
//
// - Requires three_js to be installed first (module addon)'
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  version = EXCLUDED.version,
  cdn_url = EXCLUDED.cdn_url,
  description = EXCLUDED.description,
  load_type = EXCLUDED.load_type,
  module_imports = EXCLUDED.module_imports,
  api_surface = EXCLUDED.api_surface;

-- Simplex Noise — Procedural noise generation
INSERT INTO external_registry (
  name, display_name, package_name, version, cdn_url, global_name,
  description, load_type, module_imports, api_surface
)
VALUES (
  'simplex_noise',
  'Simplex Noise',
  'simplex-noise',
  '4.0.3',
  'https://cdn.jsdelivr.net/npm/simplex-noise@4.0.3/dist/esm/simplex-noise.js',
  'SimplexNoise',
  'Fast procedural noise generation for terrain, textures, and natural patterns — Simplex and Perlin noise in 2D/3D/4D.',
  'module',
  '{}'::jsonb,
  '// Simplex Noise v4.0.3 - Available API
//
// import { createNoise2D, createNoise3D, createNoise4D } from "simplex-noise";
//
// === 2D Noise ===
// const noise2D = createNoise2D()           // optional: createNoise2D(randomFn)
// noise2D(x, y)                              // returns -1 to 1
//
// === 3D Noise ===
// const noise3D = createNoise3D()
// noise3D(x, y, z)                           // returns -1 to 1
//
// === 4D Noise ===
// const noise4D = createNoise4D()
// noise4D(x, y, z, w)                        // returns -1 to 1
//
// === Common Patterns ===
// // Terrain heightmap:
// const height = noise2D(x * 0.01, z * 0.01) * amplitude
//
// // Octave noise (fractal Brownian motion):
// let value = 0, freq = 1, amp = 1;
// for (let i = 0; i < octaves; i++) {
//   value += noise2D(x * freq, y * freq) * amp;
//   freq *= lacunarity; amp *= persistence;
// }
//
// // Animated noise:
// noise3D(x * scale, y * scale, time * speed)'
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  version = EXCLUDED.version,
  cdn_url = EXCLUDED.cdn_url,
  description = EXCLUDED.description,
  load_type = EXCLUDED.load_type,
  module_imports = EXCLUDED.module_imports,
  api_surface = EXCLUDED.api_surface;

-- GSAP — Professional animation/tweening library
INSERT INTO external_registry (
  name, display_name, package_name, version, cdn_url, global_name,
  description, load_type, api_surface
)
VALUES (
  'gsap',
  'GSAP',
  'gsap',
  '3.12.5',
  'https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js',
  'gsap',
  'Professional animation library — tweening, timelines, easing functions for smooth object and UI animations.',
  'script',
  '// GSAP v3.12.5 - Available API (window.gsap)
//
// === Basic Tweens ===
// gsap.to(target, { x: 100, duration: 1 })          // animate TO values
// gsap.from(target, { x: 100, duration: 1 })         // animate FROM values
// gsap.fromTo(target, { x: 0 }, { x: 100, duration: 1 })
// gsap.set(target, { x: 100 })                       // instant set
//
// === Tween Properties ===
// duration, delay, repeat, repeatDelay, yoyo
// ease: "power1.out", "power2.inOut", "elastic.out", "bounce.out", "back.out"
// ease: "none" (linear), "steps(5)" (stepped)
// onStart, onUpdate, onComplete, onRepeat, onReverseComplete
// stagger: 0.1  // for arrays of targets
//
// === Timelines ===
// const tl = gsap.timeline({ repeat: -1, yoyo: true })
// tl.to(target, { x: 100, duration: 1 })
// tl.to(target, { y: 50, duration: 0.5 }, "-=0.3")   // overlap
// tl.to(target, { scale: 2 }, "+=0.5")                // gap
// tl.play(), tl.pause(), tl.reverse(), tl.seek(time)
//
// === Three.js Integration ===
// gsap.to(mesh.position, { x: 5, y: 2, duration: 2, ease: "power2.out" })
// gsap.to(mesh.rotation, { y: Math.PI * 2, duration: 3, repeat: -1, ease: "none" })
// gsap.to(material, { opacity: 0, duration: 1, onComplete: () => scene.remove(mesh) })
//
// === Utility ===
// gsap.ticker.add(callback)           // runs every frame
// gsap.killTweensOf(target)
// gsap.getProperty(target, "x")
// gsap.utils.random(min, max)
// gsap.utils.mapRange(inMin, inMax, outMin, outMax, value)
// gsap.utils.clamp(min, max, value)'
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  version = EXCLUDED.version,
  cdn_url = EXCLUDED.cdn_url,
  description = EXCLUDED.description,
  api_surface = EXCLUDED.api_surface;

-- PathFinding.js — A* grid-based pathfinding
INSERT INTO external_registry (
  name, display_name, package_name, version, cdn_url, global_name,
  description, load_type, api_surface
)
VALUES (
  'pathfinding_js',
  'PathFinding.js',
  'pathfinding',
  '0.4.18',
  'https://cdn.jsdelivr.net/npm/pathfinding@0.4.18/lib/pathfinding-browser.min.js',
  'PF',
  'A* grid-based pathfinding for AI enemy movement, NPC navigation, and strategic game logic.',
  'script',
  '// PathFinding.js v0.4.18 - Available API (window.PF)
//
// === Grid Setup ===
// const grid = new PF.Grid(width, height)
// grid.setWalkableAt(x, y, walkable)       // true = walkable, false = obstacle
// grid.isWalkableAt(x, y)
// grid.clone()                              // clone for reuse (finders modify grid)
//
// === Finders ===
// const finder = new PF.AStarFinder()
// const finder = new PF.AStarFinder({ allowDiagonal: true, dontCrossCorners: true })
// const finder = new PF.BestFirstFinder()
// const finder = new PF.DijkstraFinder()
// const finder = new PF.BreadthFirstFinder()
// const finder = new PF.JumpPointFinder({ diagonalMovement: PF.DiagonalMovement.Always })
// const finder = new PF.BiAStarFinder()
//
// === Pathfinding ===
// const path = finder.findPath(startX, startY, endX, endY, grid.clone())
// // path = [[x1,y1], [x2,y2], ...]
//
// === Path Smoothing ===
// const smoothPath = PF.Util.smoothenPath(grid, path)
// const compressedPath = PF.Util.compressPath(path)
//
// === Diagonal Movement Options ===
// PF.DiagonalMovement.Always
// PF.DiagonalMovement.Never
// PF.DiagonalMovement.IfAtMostOneObstacle
// PF.DiagonalMovement.OnlyWhenNoObstacles'
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  version = EXCLUDED.version,
  cdn_url = EXCLUDED.cdn_url,
  description = EXCLUDED.description,
  api_surface = EXCLUDED.api_surface;
