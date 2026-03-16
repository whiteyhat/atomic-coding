-- =============================================================================
-- Migration 031: Loader runtime fixes for Three.js and PathFinding.js
-- =============================================================================
-- Align registry metadata with the active game player loader:
-- - three_js should emit the ESM build to avoid deprecated UMD warnings
-- - pathfinding_js should emit the working browser bundle path
-- =============================================================================

UPDATE external_registry
SET
  cdn_url = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js',
  load_type = 'module',
  module_imports = NULL
WHERE name = 'three_js';

UPDATE external_registry
SET
  cdn_url = 'https://cdn.jsdelivr.net/npm/pathfinding@0.4.18/visual/lib/pathfinding-browser.min.js',
  load_type = 'script',
  module_imports = NULL
WHERE name = 'pathfinding_js';
