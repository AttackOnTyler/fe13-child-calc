# Azahar play harness

Drives Fire Emblem Awakening in Azahar from a Claude Code session: scripted keypresses in, window screenshots out.
From the ticket "Can Claude drive Azahar from a session?" (#225).

```powershell
scripts/play/az.ps1 launch            # boots the decrypted .cci (path in the script)
scripts/play/az.ps1 press a           # one button; chords with +, repeats with *N, pauses with waitMS
scripts/play/az.ps1 press down*2 a wait1500 start
scripts/play/az.ps1 shot out.png      # client-area capture, 1280x542, both 3DS screens at 1x
scripts/play/az.ps1 save              # Ctrl+C: save state to the oldest non-quicksave slot
scripts/play/az.ps1 load              # Ctrl+V: load the newest non-quicksave slot
scripts/play/az.ps1 press enter       # dismisses Azahar's modal dialogs (e.g. the first-load savestate warning)
```

Buttons (Azahar profile 1 in `qt-config.ini`): a b x y, up down left right (D-pad), l r, start select, cup cdown cleft cright (circle pad).

- **Azahar has to stay in the foreground.** SendInput goes to the foreground window, so the user can't type elsewhere while a session plays.
- **Look between presses.** Menus change what a button means (an A that dismissed a tip also opened the name keyboard), so blind sequences of more than a couple of presses go wrong.
- `AzCtl.cs` is compiled to `AzCtl.dll` on the first run (gitignored).
- States live in `%APPDATA%\Azahar\states\00040000000A0500.NN.cst`. Loading one the first time shows a warning dialog; `press enter` clears it.
- Touch input isn't implemented: Awakening's menus all work with buttons.
