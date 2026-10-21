# Brickyard

A 3D block game engine that runs in the browser. This website plays the built-in games and games people share by link, online with others. Making and publishing games in **Brickyard Studio** needs a free Brickyard account (email sign-up).

**Play:** https://froggiewins.github.io/brickyard/

## What's inside

- Built-in games: Brick Battle (online PvP), Lava Tower, Coin Rush, Skyline Sprint and a shared Free Build world.
- Brickyard Studio (with a Brickyard account): Explorer, Properties, a GUI editor (ScreenGui, Frame, TextLabel, TextButton), move/scale/rotate tools, a Toolbox of prefabs, rigs, tools, particle emitters, a mesh uploader, ReplicatedStorage and StarterPack, all scripted with Scratch-style blocks.
- Online play: peer-to-peer over WebRTC, using public Nostr relays only to find other players. No account needed to play.
- Accounts and Community games: Supabase (email sign-up). Run `brickyard-supabase.sql` in the Supabase SQL editor to create the tables and rules.
- Publishing: share a game as a link, or download it as a single web page you can host anywhere.
- Export to Roblox Studio as an `.rbxlx` place file, with block scripts converted to Lua.

## Files

- `index.html` and `boot.js` build the page; exported games load `boot.js` from this site.
- `engine.js` is the game engine and editor.
- `vendor/` holds third-party libraries: three.js r128 (MIT), Blockly 10.4.3 (Apache 2.0) and Trystero 0.25.4 (MIT).
