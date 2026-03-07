# Buu 3D Model & World Generation API

Reference documentation for generating, fetching, and loading AI-generated 3D models and worlds via buu.fun.

---

## Overview

Buu is an AI-powered 3D asset generation platform. The workflow is asynchronous:

1. **Generate** — Send a text prompt to the API. You get back a `modelId` or `worldId` immediately.
2. **Poll** — The asset is generated in the background (takes seconds to minutes).
3. **Fetch** — Poll the public endpoint until the asset status is `"ready"`.
4. **Load** — Use the returned mesh/splat URLs to load the 3D asset into a Three.js scene.

**Base URL:** `https://dev.api.buu.fun`

---

## Authentication

All requests require a Bearer token in the `Authorization` header:

```
Authorization: Bearer <BUU_API_KEY>
```

---

## 1. Generate a 3D Model

Create an AI-generated 3D model from a text description.

### Request

```
POST /v1/tools/generate-model-from-prompt
Content-Type: application/json
Authorization: Bearer <BUU_API_KEY>
```

```json
{
  "prompt": "a red spaceship with wings",
  "options": {
    "isPublic": true,
    "texture": "fast",
    "numberOfModels": 1,
    "modelType": "buu_v1"
  }
}
```

| Field                  | Type    | Required | Description                                  |
|------------------------|---------|----------|----------------------------------------------|
| `prompt`               | string  | yes      | Text description of the 3D model             |
| `options.isPublic`     | boolean | no       | Make the model publicly accessible            |
| `options.texture`      | string  | no       | Texture quality: `"fast"` or `"quality"`      |
| `options.numberOfModels`| number | no       | Number of models to generate (default `1`)    |
| `options.modelType`    | string  | no       | Generation pipeline: `"buu_v1"`               |

### Response

```json
{
  "modelId": "abc123",
  "status": "pending",
  ...
}
```

The `modelId` is the key you use for all subsequent fetch/load operations.

---

## 2. Generate a 3D World

Create an AI-generated 3D environment (Gaussian splat scene) from a text description.

### Request

```
POST /v1/tools/generate-world-from-prompt
Content-Type: application/json
Authorization: Bearer <BUU_API_KEY>
```

```json
{
  "textPrompt": "a medieval castle courtyard at sunset",
  "modelType": "world-v1-micro",
  "displayName": "Castle Courtyard",
  "seed": 42
}
```

| Field          | Type   | Required | Description                                  |
|----------------|--------|----------|----------------------------------------------|
| `textPrompt`   | string | yes      | Text description of the world/environment    |
| `modelType`    | string | yes      | Pipeline: `"world-v1-micro"`                 |
| `displayName`  | string | no       | Human-readable name for the world            |
| `seed`         | number | no       | Random seed for reproducible generation      |

### Response

```json
{
  "worldId": "xyz789",
  "status": "pending",
  ...
}
```

---

## 3. Fetch Model Data

Poll this endpoint to check generation status and get mesh URLs once ready.

### Request

```
GET /api/v1/models/public/:modelId
```

No auth required for public models.

### Response

```json
{
  "modelId": "abc123",
  "status": "pending | ready | failed",
  "mesh": {
    "url": "https://..."
  },
  "optimizedMesh": {
    "url": "https://..."
  },
  "texturedMesh": {
    "url": "https://..."
  }
}
```

### Mesh URL Priority

When multiple mesh formats are available, use this priority order:

1. `texturedMesh.url` — highest quality, includes textures
2. `optimizedMesh.url` — optimized geometry
3. `mesh.url` — basic mesh fallback

All mesh URLs point to `.glb` (binary glTF) files loadable by Three.js GLTFLoader.

---

## 4. Fetch World Data

Poll this endpoint to check world generation status and get splat/asset URLs.

### Request

```
GET /api/v1/worlds/public/:worldId
```

### Response

```json
{
  "worldId": "xyz789",
  "displayName": "Castle Courtyard",
  "status": "pending | ready | failed",
  "splatUrl": "https://...",
  "splats": {
    "lowRes": "https://...",
    "mediumRes": "https://...",
    "highRes": "https://..."
  },
  "panoramaUrl": "https://...",
  "thumbnailUrl": "https://...",
  "colliderMeshUrl": "https://..."
}
```

### Splat URL Priority

1. `splats.highRes` — best quality
2. `splats.mediumRes` — balanced
3. `splats.lowRes` — fastest loading

Splat files are `.spz` format (compressed Gaussian splat), rendered via the GaussianSplats3D library.

---

## 5. Client-Side Loading (BUU JavaScript Library)

The `buu-assets` library (`window.BUU`) provides high-level loading with automatic polling, placeholder rendering, and mesh swapping.

**CDN:** `https://cdn.jsdelivr.net/gh/victormer/buu-assets@1.0.6/dist/buu-assets.min.js`
**Global:** `window.BUU`

### Configuration

```javascript
BUU.setApiUrl(url)              // Set API base (default: https://dev.api.buu.fun)
BUU.getApiUrl()                 // Get current API base URL
BUU.setGLTFLoader(LoaderClass)  // Register GLTFLoader for ES module setups
BUU.setGaussianSplats3D(module) // Register GaussianSplats3D module for splat loading
```

### BUU.loadModel(modelId, options?)

Loads a 3D model by ID. Returns a `THREE.Group` immediately containing a gray placeholder box. Polls the API in the background and swaps in the real mesh when ready.

```javascript
const group = await BUU.loadModel("abc123", {
  width: 1,            // Placeholder box dimensions
  height: 1,
  depth: 1,
  color: "#888888",    // Placeholder color
  poll: true,          // Keep polling if mesh not ready (default true)
  pollInterval: 5000,  // Ms between polls (default 5000)
  maxPollTime: 300000, // Max poll duration in ms (default 300000 = 5 min)
  onSwap: (mesh, modelData) => {
    // Called when placeholder is replaced with real mesh
  },
  onError: (error) => {
    // Called on failure
  },
  onProgress: (modelData) => {
    // Called on each poll with current model data
  }
});

scene.add(group);
```

**Returns:** `Promise<THREE.Group>` — add directly to scene. Placeholder has `._isPlaceholder = true`.

### BUU.fetchModel(modelId)

Low-level fetch. Returns raw API response without loading or polling.

```javascript
const modelData = await BUU.fetchModel("abc123");
const meshUrl = BUU.resolveMeshUrl(modelData);
// meshUrl = best available URL (textured > optimized > basic)
```

### BUU.loadWorld(worldId, options?)

Fetches world data with polling support.

```javascript
const world = await BUU.loadWorld("xyz789", {
  poll: true,
  pollInterval: 5000,
  maxPollTime: 300000,
  onReady: () => { /* world data available */ },
  onError: (error) => {},
  onProgress: (worldData) => {}
});

// world = { worldId, splatUrl, splats, panoramaUrl, thumbnailUrl,
//           colliderMeshUrl, displayName, status, ... }
```

### BUU.loadWorldSplat(worldId, options?)

Convenience method: fetches world data + loads the best splat into a renderable viewer.

```javascript
const { world, viewer } = await BUU.loadWorldSplat("xyz789", {
  splatResolution: "auto",  // "high", "medium", "low", or "auto" (default)
  world: { /* loadWorld options */ },
  splat: { /* loadSplat options */ },
  onLoad: ({ world, viewer }) => {},
  onError: (error) => {}
});

scene.add(viewer); // viewer is a THREE.Object3D
```

### BUU.loadSplat(url, options?)

Load a Gaussian Splat file directly by URL. Requires GaussianSplats3D to be available.

```javascript
const viewer = await BUU.loadSplat("https://...file.spz", {
  position: [0, 0, 0],
  rotation: [0, 0, 0, 1],  // Quaternion [x,y,z,w]
  scale: [1, 1, 1],
  splatAlphaRemovalThreshold: 5,
  showLoadingUI: false,
  progressiveLoad: false,
  onLoad: (viewer) => {},
  onError: (error) => {}
});

if (viewer) scene.add(viewer);
```

**Returns:** `Promise<DropInViewer|null>` — returns `null` if GaussianSplats3D is not loaded.

### BUU.disposeSplat(viewer)

Clean up a splat viewer: removes from parent scene, releases GPU resources.

```javascript
BUU.disposeSplat(viewer);
```

### URL Resolvers

```javascript
BUU.resolveMeshUrl(modelData)        // → string|null (best mesh URL)
BUU.resolveAllFormats(modelData)     // → { glb, obj, fbx }
BUU.resolveSplatUrl(worldData)       // → string|null (best splat URL)
BUU.resolveAllSplatUrls(worldData)   // → { lowRes, mediumRes, highRes }
```

### Polling Control

```javascript
BUU.cancelPoll(modelId)    // Cancel polling for a specific model/world
BUU.cancelAllPolls()       // Cancel all active polls
```

### Utility Methods

```javascript
BUU.isThreeAvailable()              // Check if THREE.js is loaded
BUU.isGLTFLoaderAvailable()         // Check if GLTFLoader is available
BUU.isGaussianSplats3DAvailable()   // Check if GaussianSplats3D is loaded
BUU.getCachedModel(id)              // → { group, loaded } | null
BUU.getCachedWorld(id)              // → object | null
BUU.clearCache()                    // Clear all cached models/worlds, cancel polls
BUU.createPlaceholderBox(options?)   // → THREE.Mesh (._isPlaceholder = true)
```

---

## 6. MCP Tool Interface

These APIs are also exposed as MCP tools for AI agent orchestration via the `buu-tools` MCP server.

### Tool: `generate_model`

```json
{
  "name": "generate_model",
  "input": {
    "prompt": "a red spaceship with wings"
  }
}
```

Returns JSON with `modelId` and generation metadata.

### Tool: `generate_world`

```json
{
  "name": "generate_world",
  "input": {
    "prompt": "a medieval castle courtyard at sunset",
    "display_name": "Castle Courtyard",
    "seed": 42
  }
}
```

Returns JSON with `worldId` and generation metadata.

### MCP Server Configuration

The MCP server reads two custom headers:

| Header           | Required | Description                                    |
|------------------|----------|------------------------------------------------|
| `x-buu-api-key`  | yes      | Buu API key for authentication                 |
| `x-buu-api-url`  | no       | API base URL (default: `https://dev.api.buu.fun`) |

---

## 7. Required Dependencies

To use Buu models and worlds in a Three.js scene, these libraries must be loaded in order:

| Library              | Package                              | Global          | Required For       |
|----------------------|--------------------------------------|-----------------|--------------------|
| Three.js             | `three@0.160.0`                      | `window.THREE`  | All 3D rendering   |
| GLTFLoader           | `three@0.160.0` (examples/jsm)       | `window.THREE`  | Loading .glb models|
| Buu Assets           | `@victormer/buu-assets@1.0.6`        | `window.BUU`    | Model/world loading|
| Gaussian Splats 3D   | `@mkkellogg/gaussian-splats-3d@0.4.7`| `window.GaussianSplats3D` | World splat rendering (optional) |

**Load order matters:** Three.js must be loaded before GLTFLoader and Buu Assets. Gaussian Splats 3D is only needed for world/splat rendering.

---

## 8. End-to-End Examples

### Generate and Load a 3D Model

```javascript
// Step 1: Generate (via API or MCP tool)
const res = await fetch("https://dev.api.buu.fun/v1/tools/generate-model-from-prompt", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer <BUU_API_KEY>"
  },
  body: JSON.stringify({
    prompt: "a low-poly treasure chest",
    options: { isPublic: true, texture: "fast", numberOfModels: 1, modelType: "buu_v1" }
  })
});
const { modelId } = await res.json();

// Step 2: Load in-game (BUU library handles polling automatically)
const group = await BUU.loadModel(modelId, {
  onSwap: (mesh) => {
    mesh.scale.set(2, 2, 2);
    mesh.position.set(0, 0, 0);
  }
});
scene.add(group);
```

### Generate and Load a 3D World

```javascript
// Step 1: Generate
const res = await fetch("https://dev.api.buu.fun/v1/tools/generate-world-from-prompt", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Authorization": "Bearer <BUU_API_KEY>"
  },
  body: JSON.stringify({
    textPrompt: "a tropical island with palm trees",
    modelType: "world-v1-micro"
  })
});
const { worldId } = await res.json();

// Step 2: Load splat into scene
const { world, viewer } = await BUU.loadWorldSplat(worldId, {
  splatResolution: "auto",
  onLoad: ({ world, viewer }) => {
    console.log("World loaded:", world.displayName);
  }
});
if (viewer) scene.add(viewer);
```

### Polling a Model Manually (without BUU library)

```javascript
async function waitForModel(modelId, maxWaitMs = 300000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const res = await fetch(`https://dev.api.buu.fun/api/v1/models/public/${modelId}`);
    const data = await res.json();

    if (data.status === "ready") {
      // Priority: texturedMesh > optimizedMesh > mesh
      const url = data.texturedMesh?.url || data.optimizedMesh?.url || data.mesh?.url;
      return url;
    }

    if (data.status === "failed") throw new Error("Model generation failed");

    await new Promise(r => setTimeout(r, 5000)); // Poll every 5s
  }
  throw new Error("Timed out waiting for model");
}
```
