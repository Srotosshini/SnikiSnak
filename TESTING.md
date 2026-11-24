# Testing voice chat on 3 laptops (same Wi-Fi)

Use this for the Phase 4 acceptance test and the LAN Party (PLAN.md Sections 10 and 16).

## Before you start

- All 3 laptops on the **same Wi-Fi**. If the venue Wi-Fi stops laptops seeing each other, switch everyone to one phone hotspot.
- Chrome, Edge or Firefox on every laptop.
- **Headphones** on everyone. Without them, laptop speakers feed back into the other mics and cause echo.
- Charge the host laptop.

## On the host laptop

1. Open a terminal in the `snikisnak` folder and run:

   ```powershell
   npm run dev
   ```

   Wait for `Listening on http://localhost:2567` and Vite's `Network: https://<IP>:5173` line.
2. If Windows asks whether to let Node.js through the firewall, tick **Private networks** and click **Allow**.
3. Find the laptop's address: run `ipconfig` and copy the **IPv4 Address** of the Wi-Fi adapter (for example `10.209.82.215`). Vite also prints it as `Network:`.
4. Open `https://localhost:5173`, type a name, and click **Host a heist**. Read the 4-letter code out loud.

## On the other two laptops

1. Open `https://<host IP>:5173`, for example `https://10.209.82.215:5173`.
2. The browser warns about the certificate (it's self-signed). Click **Advanced**, then **Continue / Proceed**. You only do this once.
3. Type a name, click **Join with code**, and type the 4 letters.

## In the lobby (everyone)

1. Click a character card to claim it. Each person needs a different one.
2. Click **Test mic** and allow the microphone when the browser asks. The meter should move when you speak.
3. **Hold V and talk.** The other two should hear you, and your character card should bounce on their screens.
4. Press **M** to mute. Your card shows "(mic off)" for the others. Press **M** again to unmute.
5. Optional: untick **Push-to-talk** for open mic, or tick **Walkie-talkie filter** for the radio sound.
6. Tick **Ready**. The host presses **GO!**

## In the game

- Hold **V** to talk. Little sound waves appear over the talking character's head, and their portrait shows "talking".
- **Jar muffle:** let the cat catch someone. While they're jarred, their voice sounds muffled to the other two, like they're stuck in a jar. It clears when they're rescued.
- **No mic:** on one laptop, click "Block" when the browser asks for the mic (or open the page with `?nomic=1`). That player still hears everyone, the others see "mic off" on their card, and the game works normally.

## If something goes wrong

| Problem | Fix |
| --- | --- |
| Others can't open the page | Same Wi-Fi? Firewall allowed for Node.js on private networks? Try a phone hotspot. |
| No microphone prompt | The page must be `https://`. Check the address bar's site settings: the mic may be blocked. Allow it and reload. |
| Joined, but no voice between two laptops | Some routers block direct connections. Reload both pages. If it still fails, use a Discord or phone call for voice; the game works without voice. |
| Echo or feedback | Headphones, or keep push-to-talk on. |
| Everyone hears a player too quietly | That player can move closer to the mic; the browser's auto gain usually fixes it within a few seconds. |
| The game froze for everyone | The server probably stopped. Look at the host's terminal, run `npm run dev` again, and rejoin with a new code. |

## Testing voice alone on one computer

Open two tabs:

- `https://localhost:5173/?fakemic=1&debug=1`: host a heist.
- `https://localhost:5173/?join=CODE&fakemic=1&debug=1`: join it.

`?fakemic=1` sends a beeping tone instead of your microphone, so you can watch the speaking indicator and card bounce without talking.
