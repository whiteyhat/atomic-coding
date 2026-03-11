-- =============================================================================
-- Migration 025: Optional 2D External Libraries
--
-- Adds curated optional libraries for 2D (Phaser) games: physics, audio,
-- procedural generation, pathfinding, and multiplayer.
-- =============================================================================

-- Matter.js — Advanced 2D physics (Phaser Matter plugin dependency)
INSERT INTO external_registry (
  name, display_name, package_name, version, cdn_url, global_name,
  description, load_type, api_surface
)
VALUES (
  'matter_js',
  'Matter.js',
  'matter-js',
  '0.20.0',
  'https://cdn.jsdelivr.net/npm/matter-js@0.20.0/build/matter.min.js',
  'Matter',
  'Advanced 2D rigid body physics — polygon collisions, joints, constraints, composites. Required for Phaser Matter plugin.',
  'script',
  '// Matter.js 0.20.0 - Available API
//
// === Engine ===
// Matter.Engine.create(options)
// Matter.Engine.update(engine, delta)
// Matter.Engine.clear(engine)
//
// === World ===
// Matter.World.add(world, body)
// Matter.World.remove(world, body)
// Matter.Composite.add(composite, body)
// Matter.Composite.allBodies(composite)
//
// === Bodies ===
// Matter.Bodies.rectangle(x, y, width, height, options)
// Matter.Bodies.circle(x, y, radius, options)
// Matter.Bodies.polygon(x, y, sides, radius, options)
// Matter.Bodies.trapezoid(x, y, width, height, slope, options)
// Matter.Bodies.fromVertices(x, y, vertexSets, options)
//
// === Body ===
// Matter.Body.setVelocity(body, { x, y })
// Matter.Body.setAngularVelocity(body, velocity)
// Matter.Body.applyForce(body, position, force)
// Matter.Body.setPosition(body, { x, y })
// Matter.Body.setAngle(body, angle)
// Matter.Body.setStatic(body, isStatic)
// body.position, body.velocity, body.angle, body.speed
//
// === Constraints ===
// Matter.Constraint.create({ bodyA, bodyB, length, stiffness })
// Matter.Constraint.create({ bodyA, pointB: { x, y } })
//
// === Composites ===
// Matter.Composites.stack(x, y, cols, rows, gap, gap, callback)
// Matter.Composites.chain(composite, xOffsetA, yOffsetA, xOffsetB, yOffsetB, options)
// Matter.Composites.softBody(x, y, cols, rows, gap, gap, crossBrace, radius, options)
//
// === Events ===
// Matter.Events.on(engine, "collisionStart", callback)
// Matter.Events.on(engine, "collisionActive", callback)
// Matter.Events.on(engine, "collisionEnd", callback)
// Matter.Events.on(engine, "beforeUpdate", callback)
//
// === Runner ===
// Matter.Runner.create()
// Matter.Runner.run(runner, engine)
// Matter.Runner.stop(runner)
//
// === Vector ===
// Matter.Vector.create(x, y)
// Matter.Vector.add(a, b), .sub(a, b), .mult(v, scalar)
// Matter.Vector.magnitude(v), .normalise(v), .dot(a, b)
//
// === Notes ===
// - Phaser can use Matter.js via: physics: { default: "matter", matter: { ... } }
// - When using with Phaser, Phaser wraps Matter internally but needs this lib loaded.
// - Can also be used standalone without Phaser for pure physics simulations.'
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  package_name = EXCLUDED.package_name,
  version = EXCLUDED.version,
  cdn_url = EXCLUDED.cdn_url,
  global_name = EXCLUDED.global_name,
  description = EXCLUDED.description,
  load_type = EXCLUDED.load_type,
  api_surface = EXCLUDED.api_surface;

-- Howler.js — Audio library
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
  'Howler',
  'Audio library with sprite support, spatial audio, crossfades, and cross-browser compatibility.',
  'script',
  '// Howler.js 2.2.4 - Available API
//
// === Howl (sound instance) ===
// new Howl({ src: [url], volume: 0-1, loop: bool, rate: 1.0, sprite: { name: [start, duration] } })
// sound.play(spriteOrId)
// sound.pause(id), sound.stop(id)
// sound.volume(vol, id)
// sound.fade(from, to, duration, id)
// sound.seek(seconds, id)
// sound.rate(speed, id)
// sound.loop(bool, id)
// sound.mute(bool, id)
// sound.stereo(pan, id)         // -1 (left) to 1 (right)
// sound.pos(x, y, z, id)       // 3D spatial position
// sound.playing(id)             // returns bool
// sound.duration(id)
// sound.state()                 // "unloaded", "loading", "loaded"
// sound.unload()
//
// === Events ===
// sound.on("load", callback)
// sound.on("play", callback)
// sound.on("end", callback)
// sound.on("stop", callback)
// sound.on("fade", callback)
// sound.on("loaderror", callback)
//
// === Howler (global) ===
// Howler.volume(vol)            // master volume 0-1
// Howler.mute(bool)             // master mute
// Howler.stop()                 // stop all sounds
// Howler.codecs(ext)            // check codec support
//
// === Notes ===
// - Supports mp3, wav, ogg, webm, m4a formats
// - Audio sprites let you pack multiple sounds into one file
// - Persists across Phaser scene transitions (independent of Phaser audio)'
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  package_name = EXCLUDED.package_name,
  version = EXCLUDED.version,
  cdn_url = EXCLUDED.cdn_url,
  global_name = EXCLUDED.global_name,
  description = EXCLUDED.description,
  load_type = EXCLUDED.load_type,
  api_surface = EXCLUDED.api_surface;

-- rot.js — Roguelike toolkit
INSERT INTO external_registry (
  name, display_name, package_name, version, cdn_url, global_name,
  description, load_type, api_surface
)
VALUES (
  'rot_js',
  'rot.js',
  'rot-js',
  '2.2.1',
  'https://cdn.jsdelivr.net/npm/rot-js@2.2.1/dist/rot.min.js',
  'ROT',
  'Roguelike toolkit — dungeon generators, FOV, A*/Dijkstra pathfinding, turn scheduling, seeded RNG.',
  'script',
  '// rot.js 2.2.1 - Available API
//
// === Map Generators ===
// new ROT.Map.Digger(width, height, options)
// new ROT.Map.Uniform(width, height, options)
// new ROT.Map.Cellular(width, height, options)
// new ROT.Map.Rogue(width, height, options)
// new ROT.Map.DividedMaze(width, height)
// new ROT.Map.EllerMaze(width, height)
// new ROT.Map.IceyMaze(width, height)
// map.create(callback(x, y, wall))  // wall=1, floor=0
// map.getRooms()                    // Digger/Uniform: array of Room objects
// room.getCenter(), room.getLeft(), room.getRight(), room.getTop(), room.getBottom()
//
// === FOV (Field of View) ===
// new ROT.FOV.PreciseShadowcasting(lightPassesCallback)
// new ROT.FOV.RecursiveShadowcasting(lightPassesCallback)
// fov.compute(x, y, range, callback(x, y, r, visibility))
//
// === Pathfinding ===
// new ROT.Path.AStar(toX, toY, passableCallback, options)
// new ROT.Path.Dijkstra(toX, toY, passableCallback, options)
// path.compute(fromX, fromY, callback(x, y))
//
// === Scheduler (turn management) ===
// new ROT.Scheduler.Simple()
// new ROT.Scheduler.Speed()
// new ROT.Scheduler.Action()
// scheduler.add(actor, repeat, time?)
// scheduler.next()
// scheduler.remove(actor)
// scheduler.clear()
//
// === RNG ===
// ROT.RNG.setSeed(seed)
// ROT.RNG.getUniform()           // 0-1
// ROT.RNG.getUniformInt(min, max)
// ROT.RNG.getNormal(mean, stddev)
// ROT.RNG.getWeightedValue(table) // { "a": 1, "b": 2 } → weighted pick
//
// === Noise ===
// new ROT.Noise.Simplex()
// noise.get(x, y)                // returns -1 to 1
//
// === Color ===
// ROT.Color.fromString(str)      // "rgb()" or "#hex" → [r,g,b]
// ROT.Color.interpolate(c1, c2, factor)
// ROT.Color.toHex(color)
//
// === Notes ===
// - Map generators produce 2D tile data via callbacks, not rendering.
// - Wire map output into Phaser tilemaps or draw with rectangles/sprites.
// - Great for roguelikes, dungeon crawlers, procedural RPGs.'
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  package_name = EXCLUDED.package_name,
  version = EXCLUDED.version,
  cdn_url = EXCLUDED.cdn_url,
  global_name = EXCLUDED.global_name,
  description = EXCLUDED.description,
  load_type = EXCLUDED.load_type,
  api_surface = EXCLUDED.api_surface;

-- seedrandom — Seeded PRNG
INSERT INTO external_registry (
  name, display_name, package_name, version, cdn_url, global_name,
  description, load_type, api_surface
)
VALUES (
  'seedrandom_js',
  'seedrandom',
  'seedrandom',
  '3.0.5',
  'https://cdn.jsdelivr.net/npm/seedrandom@3.0.5/seedrandom.min.js',
  'seedrandom',
  'Seeded pseudorandom number generator for reproducible procedural generation and replays.',
  'script',
  '// seedrandom 3.0.5 - Available API
//
// === Global Usage (replaces Math.random) ===
// Math.seedrandom("my-seed")     // patches Math.random with seeded PRNG
// Math.random()                  // now deterministic for given seed
//
// === Standalone Generator ===
// var rng = new Math.seedrandom("my-seed")
// rng()                          // returns 0-1 float
// rng.int32()                    // returns 32-bit signed integer
// rng.quick()                    // faster, lower quality 0-1 float
// rng.double()                   // 56-bit precision 0-1 float
//
// === Algorithms ===
// new Math.seedrandom(seed, { entropy: true })  // mix in browser entropy
// Algorithms: alea, xor128, xorwow, xorshift7, xor4096, tychei
//
// === Notes ===
// - Tiny library (~1.6KB minified)
// - Use for reproducible level generation from seed strings
// - Essential for fair leaderboards (same seed = same level)
// - Create standalone generators to avoid patching Math.random globally'
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  package_name = EXCLUDED.package_name,
  version = EXCLUDED.version,
  cdn_url = EXCLUDED.cdn_url,
  global_name = EXCLUDED.global_name,
  description = EXCLUDED.description,
  load_type = EXCLUDED.load_type,
  api_surface = EXCLUDED.api_surface;

-- Noise.js — Perlin and Simplex noise
INSERT INTO external_registry (
  name, display_name, package_name, version, cdn_url, global_name,
  description, load_type, api_surface
)
VALUES (
  'noisejs',
  'Noise.js',
  'noisejs',
  '2.1.0',
  'https://cdn.jsdelivr.net/npm/noisejs@2.1.0/index.js',
  'Noise',
  'Perlin and Simplex noise for procedural terrain, textures, clouds, and organic randomness.',
  'script',
  '// Noise.js 2.1.0 - Available API
//
// === Constructor ===
// var noise = new Noise(seed)    // seed is a number
//
// === Simplex Noise ===
// noise.simplex2(x, y)           // 2D simplex, returns -1 to 1
// noise.simplex3(x, y, z)        // 3D simplex, returns -1 to 1
//
// === Perlin Noise ===
// noise.perlin2(x, y)            // 2D perlin, returns -1 to 1
// noise.perlin3(x, y, z)         // 3D perlin, returns -1 to 1
//
// === Seeding ===
// noise.seed(value)              // re-seed the generator
//
// === Common Patterns ===
// // Octave noise (fractal detail):
// function fbm(x, y, octaves) {
//   var total = 0, freq = 1, amp = 1, maxAmp = 0;
//   for (var i = 0; i < octaves; i++) {
//     total += noise.simplex2(x * freq, y * freq) * amp;
//     maxAmp += amp; amp *= 0.5; freq *= 2;
//   }
//   return total / maxAmp;
// }
//
// === Notes ===
// - Use for terrain heightmaps, cloud textures, organic movement
// - Scale inputs to control feature size (e.g., x*0.01 for large features)
// - Combine with seedrandom for fully reproducible procedural worlds'
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  package_name = EXCLUDED.package_name,
  version = EXCLUDED.version,
  cdn_url = EXCLUDED.cdn_url,
  global_name = EXCLUDED.global_name,
  description = EXCLUDED.description,
  load_type = EXCLUDED.load_type,
  api_surface = EXCLUDED.api_surface;

-- Planck.js — Box2D physics port
INSERT INTO external_registry (
  name, display_name, package_name, version, cdn_url, global_name,
  description, load_type, api_surface
)
VALUES (
  'planck_js',
  'Planck.js',
  'planck-js',
  '1.3.0',
  'https://cdn.jsdelivr.net/npm/planck-js@1.3.0/dist/planck.min.js',
  'planck',
  'Box2D physics port — precise 2D simulation for billiards, pinball, Angry Birds-style games.',
  'script',
  '// Planck.js 1.3.0 - Available API
//
// === World ===
// var world = planck.World({ gravity: planck.Vec2(0, -10) })
// world.step(timeStep, velocityIters?, positionIters?)
// world.createBody({ type: "dynamic"|"static"|"kinematic", position: planck.Vec2(x,y) })
// world.destroyBody(body)
// world.on("begin-contact", callback(contact))
// world.on("end-contact", callback(contact))
//
// === Body ===
// body.createFixture(shape, density)
// body.createFixture({ shape, density, friction, restitution })
// body.setLinearVelocity(planck.Vec2(x, y))
// body.setAngularVelocity(omega)
// body.applyForce(planck.Vec2(fx, fy), point)
// body.applyLinearImpulse(planck.Vec2(ix, iy), point)
// body.getPosition()              // returns Vec2
// body.getAngle()                 // returns radians
// body.getLinearVelocity()
// body.setPosition(planck.Vec2(x, y))
// body.setActive(bool)
// body.setUserData(data)
// body.getUserData()
//
// === Shapes ===
// planck.Box(halfWidth, halfHeight)
// planck.Circle(radius)
// planck.Circle(planck.Vec2(x,y), radius)
// planck.Polygon([planck.Vec2(x,y), ...])
// planck.Edge(planck.Vec2(x1,y1), planck.Vec2(x2,y2))
// planck.Chain([planck.Vec2(x,y), ...], loop?)
//
// === Joints ===
// planck.RevoluteJoint({}, bodyA, bodyB, anchor)
// planck.DistanceJoint({}, bodyA, anchorA, bodyB, anchorB)
// planck.PrismaticJoint({}, bodyA, bodyB, anchor, axis)
// planck.WheelJoint({}, bodyA, bodyB, anchor, axis)
// planck.PulleyJoint({}, bodyA, bodyB, groundA, groundB, anchorA, anchorB, ratio)
// planck.RopeJoint({}, bodyA, bodyB, { maxLength })
//
// === Math ===
// planck.Vec2(x, y)
// planck.Vec2.add(a, b), .sub(a, b)
// planck.Vec2.mul(scalar, v)
// planck.Vec2.distance(a, b)
// planck.Vec2.lengthOf(v)
//
// === Notes ===
// - Faithful Box2D port — very accurate continuous collision detection
// - Better than Matter.js for precise simulations (billiards, pinball)
// - Units are meters; use a pixels-per-meter scale factor (e.g., 30)
// - Render by reading body.getPosition()/getAngle() each frame'
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  package_name = EXCLUDED.package_name,
  version = EXCLUDED.version,
  cdn_url = EXCLUDED.cdn_url,
  global_name = EXCLUDED.global_name,
  description = EXCLUDED.description,
  load_type = EXCLUDED.load_type,
  api_surface = EXCLUDED.api_surface;

-- Socket.IO Client — Real-time multiplayer
INSERT INTO external_registry (
  name, display_name, package_name, version, cdn_url, global_name,
  description, load_type, api_surface
)
VALUES (
  'socket_io_client',
  'Socket.IO Client',
  'socket.io-client',
  '4.8.3',
  'https://cdn.jsdelivr.net/npm/socket.io-client@4.8.3/dist/socket.io.min.js',
  'io',
  'Real-time WebSocket client for multiplayer — auto-reconnection, rooms, and event-based messaging.',
  'script',
  '// Socket.IO Client 4.8.3 - Available API
//
// === Connection ===
// const socket = io(url)
// const socket = io(url, { transports: ["websocket"], autoConnect: true })
// const socket = io(url, { auth: { token: "..." } })
// socket.connect()
// socket.disconnect()
// socket.id                      // unique socket ID
// socket.connected                // boolean
//
// === Sending Events ===
// socket.emit(eventName, data)
// socket.emit(eventName, data, ackCallback)
// socket.volatile.emit(event, data)     // drop if not ready
// socket.timeout(5000).emit(event, data, (err, response) => {})
//
// === Receiving Events ===
// socket.on(eventName, callback)
// socket.once(eventName, callback)
// socket.off(eventName, callback?)
// socket.onAny((event, ...args) => {})
//
// === Built-in Events ===
// socket.on("connect", () => {})
// socket.on("disconnect", (reason) => {})
// socket.on("connect_error", (error) => {})
// socket.on("reconnect", (attemptNumber) => {})
// socket.on("reconnect_attempt", (attemptNumber) => {})
//
// === Notes ===
// - Requires a Socket.IO server (not a plain WebSocket server)
// - Auto-reconnects with exponential backoff
// - Supports binary data (ArrayBuffer, Blob)
// - For multiplayer games: emit player state, listen for world updates
// - Typical pattern: socket.emit("move", {x, y}), socket.on("state", render)'
)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  package_name = EXCLUDED.package_name,
  version = EXCLUDED.version,
  cdn_url = EXCLUDED.cdn_url,
  global_name = EXCLUDED.global_name,
  description = EXCLUDED.description,
  load_type = EXCLUDED.load_type,
  api_surface = EXCLUDED.api_surface;
