# Fight Tech — metronome sound profiles (2026-11-01)

> **2026-11-02:** «Общее» is compact (circle markers, no frame per option) and has three rows:
> «Сигналы отсчёта» (own clicks / electronic A·B·C choice, `fighttech.countdown.sound.v1`) — the prestart 4-3-2-1 and
> the `warning-tick`; «Сигналы метронома» (this document) — metronome accent/subdivision only; «Гонг» · «Стандартный»
> (static, the `cue_*` files). Nothing stored for the countdown = it follows the metronome profile, exactly what 0.2.208
> played, so an update changes nothing. Samples are still bundled and played as delivered (no equalising, no boost).

Settings → «Звук и сигналы» → «Общее», under «Сигналы таймера»: **«Сигналы метронома»**
- «Щелчки» — the original click samples (unchanged files, unchanged gains). **Default.**
- «Электронные» — tone A · 1400 Гц / B · 1600 Гц / C · 1800 Гц, chosen in the Fight Tech choice dialog.

Stored in `localStorage['fighttech.metronome.sound.v1']` as `{"kind":"click"|"electronic","tone":"A"|"B"|"C"}`,
apart from the per-preset settings. Nothing stored (every installation before this build) = clicks: an update never
changes the sound by itself. Code: `app/js/audio/sound-profile.js`, `app/js/ui/sound-profile-settings.js`.

## What follows the profile
The click family only — in 0.2.207 the countdown/warning tick `warning_tick_runtime.wav` is byte-identical to the
metronome click `metronome_single_runtime.wav` (SHA-256 `cffb0c62…c83c`).

| Event (timer-engine) | When | Clicks (file · gain) | Electronic X (file · gain) |
|---|---|---|---|
| metronome accent (screen metronome and stage metronome; direct = every beat, subdivided = beat 1 of 4) | work / phase 2 | `metronome_single_runtime.wav` · 1.5 | `X_*_strong.wav` · 1 |
| metronome subdivision (subdivided beats 2–4) | work / phase 2 | `metronome_split_upbeat_runtime.wav` · 1.35 | `X_*_weak.wav` · 1 |
| `prestart-count-4…1` (countdown profile since 2026-11-02) | 4-3-2-1 before the first round | `warning_tick_runtime.wav` · 1.25 | `X_*_strong.wav` · 1 |
| `warning-tick` (countdown profile since 2026-11-02) | last N s of work/phase 2/rest/block rest; N = «Предупреждение до конца этапа»: «5 сек» stores 4 → ticks at 4…1, «10 сек» → 10…1, «Нет» → none | `warning_tick_runtime.wav` · 1.2 | `X_*_strong.wav` · 1 |

Not changed: round start / rest start / block rest / phase 2 / workout end gongs (`cue_*`), the voice announcements,
warning timing, the metronome mute in the last 4 s of a phase and the existing «10 сек → метроном недоступен» lock.

«Сигналы таймера» keeps its meaning: one switch for every timer sound (gongs, ticks, metronome, either profile).
As before, a change made during a running workout applies from the next start (`applyPresetWithoutInterrupting`);
the metronome profile, by contrast, switches from the next beat without restarting the rhythm.

## Files (bundled offline in `app/assets/audio/metronome/electronic/`, never fetched)
Source: `FightTech_Audio_ABC_20261101.zip`, SHA-256 `e79a1b54964f8e415c4afab33736c54bab847e9eaa87b76d5d2dad5b431176cf`
(9 files: 3 pairs + 3 five-second demos; demos not bundled). Bundled byte for byte, no processing.

| File | SHA-256 | Dominant | Length | Peak | RMS (active) |
|---|---|---|---|---|---|
| A_soft_1400_strong.wav | 1e39488e…d112 | 1401 Hz | 140 ms | −3.6 dBFS | −7.7 dBFS |
| A_soft_1400_weak.wav | 719a8fa7…0629 | 1103 Hz | 95 ms | −6.95 dBFS | −11.4 dBFS |
| B_clear_1600_strong.wav | f0368e1d…e727 | 1602 Hz | 140 ms | −3.6 dBFS | −7.7 dBFS |
| B_clear_1600_weak.wav | 145d15bf…a867 | 1253 Hz | 95 ms | −6.95 dBFS | −11.4 dBFS |
| C_bright_1800_strong.wav | 5c5b4bb2…2a35 | 1802 Hz | 140 ms | −3.6 dBFS | −7.7 dBFS |
| C_bright_1800_weak.wav | b168ef9b…dc | 1454 Hz | 95 ms | −6.95 dBFS | −11.4 dBFS |

All: RIFF/WAVE PCM 16-bit mono 44.1 kHz, 0 clipped samples, DC 0, lead-in ≤0.5 ms, tail ≤1.2 ms. The file name's
frequency is the strong tone; each weak tone is ~0.78× lower in pitch and 3.3 dB lower in peak (3.7 dB RMS), so
subdivisions stay distinct from the accent (the click pair differs by 9.9 dB).

## Level against the clicks (at the gain the app plays them)
| Sound | Peak | Loudest 50 ms RMS | Active length |
|---|---|---|---|
| click accent × 1.5 | **+2.6 dBFS** (over full scale, pre-existing) | −12.4 dBFS | 28 ms |
| click subdivision × 1.35 | −7.3 dBFS | −22.3 dBFS | 28 ms |
| tick × 1.25 | +1.0 dBFS (pre-existing) | −14.0 dBFS | 28 ms |
| electronic strong × 1 | −3.6 dBFS | −6.8 dBFS | 137 ms |
| electronic weak × 1 | −6.9 dBFS | −10.1 dBFS | 92 ms |

Electronic tones play at their delivered level (gain 1, no boost — a boost would push them to full scale). They are
still ~5.6 dB louder (50 ms RMS) and five times longer than the click, and 1.4–1.8 kHz is where hearing is most
sensitive: expect them to sound clearly louder at the same device volume. Approved timbre and level were not altered.
Non-destructive −3 dB / −6 dB comparison copies are kept with the project evidence (not bundled) in case the owner
wants a quieter variant. Real-world audibility and comfort (gym noise, phone speaker, Bluetooth, high volume) are the
owner's phone test; nothing here claims them.
