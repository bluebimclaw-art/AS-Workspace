# AS Workspace Infinite Canvas adapter

Upstream: https://github.com/basketikun/infinite-canvas ; MIT ; pinned 9f2bd9f1b27c45fd1b8f5323072b07243f9e0fac (UI v0.20.0). Preserve upstream LICENSE and bundled THIRD_PARTY_NOTICES.txt.

This directory contains the reviewed company entry point, volatile localforage shim, image RPC, canonical dirty detector and dedicated package/lock. The host persists projects and images; browser localStorage is volatile inside an opaque-origin iframe. The server never accepts arbitrary fetch RPC or forwards an API key to the frame.

Rebuild only the new platform:

1. Clone upstream into tools/infinite-canvas-source, checkout the exact commit above. Do not point this at a user's working checkout.
2. From this platform root: npm run canvas:build. The script verifies the source commit, applies explicit patches, uses the dedicated lock (npm ci --ignore-scripts --legacy-peer-deps), and builds /canvas-web/.
3. npm run build ; npm test. Browser test image generation, shared insert, save/reopen and conflict. The legacy peer flag is limited to the isolated upstream build; the main platform does not use it.
4. node scripts/package-canvas-web.mjs builds the versioned Web ZIP and pinned config. npm run canvas:install -- release verifies the ZIP and every manifest asset.
5. npm run package:source includes compiled Web assets, so deployment does not need the upstream source, Rust, or React19 in the host bundle.

Removed unused ProComponents from the company build dependencies to eliminate its moderate Prism dependency chain. Upstream source outside the ignored tools copy is untouched. Plugin/Agent bridges are disabled. No arbitrary remote networks, iframe allow-same-origin, unsafe-eval or frontend provider secrets. Some upstream controls remain visible with unsupported-action notices; this is a constrained company integration, not all upstream functionality.

Board snapshot schema=1; maps Blob values to __asBlob/base64, validates supported stores and node types server-side. Hydration may regenerate blob URLs and add an empty images array; canonical dirty detection ignores only those changes and timestamps. Node geometry, sources and prompt changes remain edits. Viewport changes alone do not mark dirty; explicit Save still captures viewport. Max board JSON including image bytes:5MB.
