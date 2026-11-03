#!/usr/bin/env python3
"""
Churpie's own music: three original background pieces, composed and rendered in code so they are owned outright
(no licences, no credits, nothing anyone can claim later). Each loops seamlessly under a reel of any length.

  uplifting      Postcard, Confetti pop, Locker note   104 bpm, C major, ukulele strum + glockenspiel + soft bass
  warm-acoustic  Milestone gold, Airmail, Kraft        84 bpm, D major, fingerpicked guitar + piano + warm pad
                 (melody quotes Pachelbel's Canon, 1680s, public domain)
  gentle-piano   Quiet note, Pressed flower            72 bpm in 3/4, C major, solo piano with room

The signature: a rising four-note "chirp" (sol-la-do-mi) closes phrases in every piece, so every reel sounds like churpie.
Re-render with:  python3 stitcher/music/compose.py   (needs numpy, scipy, ffmpeg)
"""
import os, subprocess, numpy as np
from scipy.signal import fftconvolve, butter, sosfilt

SR = 48000
HERE = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(7)

def hz(m): return 440.0 * 2 ** ((m - 69) / 12)

# ── instruments ─────────────────────────────────────────────────────────────
_ks = {}
def pluck(m, dur, bright=0.5, decay=0.996):
    """Karplus-Strong string: ukulele when bright, nylon guitar when darker. Cached per pitch."""
    key = (m, round(dur, 2), bright, decay)
    if key not in _ks:
        f = hz(m); N = max(2, int(round(SR / f))); n = int((dur + 1.2) * SR)
        buf = rng.uniform(-1, 1, N)
        for _ in range(int(3 * (1 - bright)) + 1): buf = 0.5 * (buf + np.roll(buf, 1))  # darker attack
        out = np.zeros(n); pos = 0
        while pos < n:
            k = min(N, n - pos); out[pos:pos + k] = buf[:k]
            buf = decay * 0.5 * (buf + np.roll(buf, -1)); pos += k
        env = np.ones(n); rel = int(0.08 * SR); stop = int(dur * SR)
        if stop + rel < n: env[stop:stop + rel] = np.linspace(1, 0, rel); env[stop + rel:] = 0
        _ks[key] = out * env
    return _ks[key]

_pn = {}
def piano(m, dur):
    """Soft felt piano: slightly inharmonic partials, upper partials fade first, gentle hammer."""
    key = (m, round(dur, 2))
    if key not in _pn:
        f = hz(m); n = int((dur + 1.6) * SR); t = np.arange(n) / SR; x = np.zeros(n)
        for k in range(1, 9):
            fk = f * k * np.sqrt(1 + 0.0004 * k * k)
            if fk > 16000: break
            x += (1 / k ** 1.4) * np.sin(2 * np.pi * fk * t + rng.uniform(0, 6.28)) * np.exp(-t * (0.5 + 0.45 * k) * (f / 262) ** 0.35)
        att = np.minimum(1, t / 0.006); stop = dur
        rel = np.where(t > stop, np.exp(-(t - stop) / 0.28), 1.0)
        _pn[key] = x * att * rel * 0.5
    return _pn[key]

def glock(m, dur):
    f = hz(m); n = int((dur + 1.4) * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) * np.exp(-t * 2.2) + 0.25 * np.sin(2 * np.pi * f * 2.756 * t) * np.exp(-t * 6) + 0.08 * np.sin(2 * np.pi * f * 5.404 * t) * np.exp(-t * 11)
    return x * np.minimum(1, t / 0.002) * 0.45

def bass(m, dur):
    f = hz(m); n = int((dur + 0.5) * SR); t = np.arange(n) / SR
    x = np.sin(2 * np.pi * f * t) + 0.18 * np.sin(4 * np.pi * f * t)
    env = np.minimum(1, t / 0.01) * np.exp(-t * 1.6) * np.where(t > dur, np.exp(-(t - dur) / 0.08), 1)
    return x * env * 0.6

def pad(ms, dur):
    n = int((dur + 1.0) * SR); t = np.arange(n) / SR; x = np.zeros(n)
    for m in ms:
        for c in (-4, 4):
            f = hz(m) * 2 ** (c / 1200)
            x += np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) + 0.3 * np.sin(4 * np.pi * f * t)
    env = np.minimum(1, t / 0.7) * np.where(t > dur, np.exp(-(t - dur) / 0.5), 1)
    return x * env / (2 * len(ms)) * 0.5

_shk = sosfilt(butter(4, [5000, 11000], btype='band', fs=SR, output='sos'), rng.uniform(-1, 1, int(0.08 * SR)))
def shaker(v): t = np.arange(len(_shk)) / SR; return _shk * np.exp(-t * 55) * v * 0.5

# ── a little mixer ──────────────────────────────────────────────────────────
class Track:
    # made to sit under voices: no deep lows, no fizz, and a gentle dip where speech lives (about 2.5 kHz)
    def __init__(self, bpm, beats, bars, tail=5.0, lp=8500):
        self.lp = lp
        self.spb = 60 / bpm; self.beats = beats; self.bars = bars
        self.len = int(bars * beats * self.spb * SR); self.buf = np.zeros((self.len + int(tail * SR), 2))
    def t(self, bar, beat): return (bar * self.beats + beat) * self.spb
    def add(self, sig, sec, vel=1.0, pan=0.0, human=True):
        if human: sec += rng.normal(0, 0.006); vel *= 1 + rng.normal(0, 0.06)
        i = max(0, int(sec * SR)); sig = sig[: max(0, len(self.buf) - i)]
        l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
        self.buf[i:i + len(sig), 0] += sig * vel * l * 1.41; self.buf[i:i + len(sig), 1] += sig * vel * r * 1.41
    def render(self, name, room=1.6, wet=0.28):
        n = int(room * 2.2 * SR); t = np.arange(n) / SR
        lp = butter(2, 5500, fs=SR, output='sos')
        ir = [sosfilt(lp, rng.normal(0, 1, n)) * np.exp(-t * 6.9 / room) for _ in range(2)]
        ir = [i / np.sqrt(np.sum(i ** 2)) for i in ir]
        wetsig = np.stack([fftconvolve(self.buf[:, c], ir[c])[: len(self.buf)] for c in range(2)], 1)
        mix = self.buf * (1 - wet) + wetsig * wet * 2.2
        # seamless loop: whatever rings past the last bar is folded back onto the start
        out = mix[: self.len].copy(); tail = mix[self.len:]; out[: len(tail)] += tail
        out = out / (np.max(np.abs(out)) + 1e-9) * 0.89
        raw = os.path.join(HERE, f'.{name}.f32'); out.astype(np.float32).tofile(raw)
        dst = os.path.join(HERE, f'{name}.mp3')
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', raw,
                        '-af', f'highpass=f=90,lowpass=f={self.lp},equalizer=f=2500:t=q:w=1:g=-3,loudnorm=I=-18:TP=-1.5:LRA=9', '-ar', '48000', '-c:a', 'libmp3lame', '-b:a', '80k', dst], check=True)
        os.remove(raw); print(f'wrote {dst}  ({self.len / SR:.0f}s loop)')

CHIRP = [(0, 0.25), (2, 0.25), (5, 0.25), (9, 1.25)]  # sol-la-do-mi, as semitones above sol
def chirp(tr, inst, bar, beat, sol, vel=0.8, pan=0.2):
    b = beat
    for st, d in CHIRP:
        tr.add(inst(sol + st, d * tr.spb), tr.t(bar, b), vel, pan); b += d if d < 1 else 0

# ── 1. uplifting ─────────────────────────────────────────────────────────────
def uplifting():
    tr = Track(104, 4, 64, lp=8000)
    V = {'C': [67, 60, 64, 72], 'G': [67, 62, 67, 71], 'Am': [69, 60, 64, 69], 'F': [69, 60, 65, 69], 'Em': [67, 64, 67, 71]}
    R = {'C': 48, 'G': 43, 'Am': 45, 'F': 41, 'Em': 40}
    A, B = ['C', 'G', 'Am', 'F'], ['F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'C']
    form = [('intro', A)] + [('A', A)] * 4 + [('B', B)] + [('A2', A)] * 4 + [('B2', B)] + [('out', A)] * 3
    mel1 = [[(0, 76, 1.5), (1.5, 74, .5), (2, 72, 1), (3, 67, 1)], [(0, 74, 2), (2, 71, 1), (3, 74, 1)], [(0, 72, 1.5), (1.5, 71, .5), (2, 69, 2)], [(0, 69, 1), (1, 72, 1), (2, 77, 1.5), (3.5, 76, .5)]]
    mel2 = [[(0, 76, 1), (1, 79, 1), (2, 76, 1), (3, 72, 1)], [(0, 74, 3), (3, 71, 1)], [(0, 72, 1), (1, 76, 1), (2, 74, 2)], []]
    melB = [[(0, 77, 2), (2, 76, 2)], [(0, 74, 4)], [(0, 71, 2), (2, 72, 2)], [(0, 76, 4)], [(0, 77, 2), (2, 81, 2)], [(0, 79, 3), (3, 77, 1)], [(0, 76, 4)], []]
    strum = [(0, 'D', .8), (1, 'D', .6), (1.5, 'U', .45), (2.5, 'U', .5), (3, 'D', .65), (3.5, 'U', .45)]
    bar = 0; phrase = 0
    for sec, prog in form:
        for i, ch in enumerate(prog):
            for beat, d, v in strum:
                notes = V[ch] if d == 'D' else V[ch][::-1]
                for k, m in enumerate(notes):
                    tr.add(pluck(m, .45, .6, .993), tr.t(bar, beat) + k * .012, v * (.55 if sec in ('intro', 'out') else .7), -.25)
            if sec not in ('intro',):
                tr.add(bass(R[ch], 1.4 * tr.spb), tr.t(bar, 0), .7, 0); tr.add(bass(R[ch] + 7 if ch != 'F' else R[ch] + 12, .9 * tr.spb), tr.t(bar, 2), .5, 0)
            if sec in ('A', 'A2', 'B', 'B2'):
                for e in range(8): tr.add(shaker(.18 if e % 2 else .1), tr.t(bar, e * .5), 1, .4)
            if sec in ('A', 'A2'):
                mel = (mel1 if phrase % 2 == 0 else mel2)[i]
                for b, m, d in mel:
                    tr.add(glock(m, d * tr.spb), tr.t(bar, b), .55, .25)
                    if sec == 'A2': tr.add(piano(m - 12, d * tr.spb), tr.t(bar, b), .35, .1)
                if i == 3 and phrase % 2 == 1: chirp(tr, glock, bar, 2, 67, .6)
            if sec in ('B', 'B2'):
                for b, m, d in melB[i]: tr.add(piano(m, d * tr.spb), tr.t(bar, b), .45, .1)
                if i == 7: chirp(tr, glock, bar, 2, 67, .55)
            bar += 1
        if sec in ('A', 'A2'): phrase += 1
    tr.render('uplifting', room=1.3, wet=.22)

# ── 2. warm acoustic ─────────────────────────────────────────────────────────
def warm():
    tr = Track(84, 4, 48)
    prog = ['D', 'A', 'Bm', 'F#m', 'G', 'D', 'G', 'A']
    C = {'D': (50, [57, 62, 66, 69]), 'A': (45, [57, 61, 64, 69]), 'Bm': (47, [54, 59, 62, 66]), 'F#m': (42, [54, 57, 61, 66]), 'G': (43, [55, 59, 62, 67])}
    canon = [78, 76, 74, 73, 71, 69, 71, 73]              # Pachelbel's opening line (public domain)
    tops = {'D': [74, 78], 'A': [73, 76], 'Bm': [74, 78], 'F#m': [73, 76], 'G': [71, 74]}
    pick = [0, 2, 3, 2, 4, 2, 3, 1]                          # thumb on the root, fingers walk the chord
    for bar in range(48):
        sec = bar // 8; ch = prog[bar % 8]; root, tones = C[ch]; pool = [root, tones[0], tones[1], tones[2], tones[3]]
        for e, p in enumerate(pick):
            m = pool[0] if e == 0 else pool[1 + (p % 4)]
            tr.add(pluck(m, (1.2 if e == 0 else .7) * tr.spb, .35, .9965), tr.t(bar, e * .5), (.75 if e == 0 else .5) * (.85 if sec == 5 else 1), -.3)
        if sec in (2, 3, 4):
            tr.add(pad([tones[0], tones[1], tones[2]], 4 * tr.spb), tr.t(bar, 0), .22 if sec != 3 else .3, .3)
        if sec in (1, 4):
            tr.add(piano(canon[bar % 8], 3.6 * tr.spb), tr.t(bar, 0), .6, .2)
        if sec == 2:
            a, b = tops[ch]
            tr.add(piano(b, 1.8 * tr.spb), tr.t(bar, 0), .5, .2); tr.add(piano(a, 1.8 * tr.spb), tr.t(bar, 2), .45, .2)
        if bar % 8 == 7 and sec in (1, 2, 4): chirp(tr, piano, bar, 2, 69, .45)
    tr.render('warm-acoustic', room=1.8, wet=.26)

# ── 3. gentle piano ──────────────────────────────────────────────────────────
def gentle():
    tr = Track(72, 3, 48, lp=7000)
    H = {'Cmaj7': (36, [52, 55, 59]), 'Fmaj7': (41, [52, 57, 60]), 'Am7': (45, [55, 60, 64]), 'Dm7': (38, [53, 57, 60]), 'G': (43, [55, 59, 62]), 'C': (36, [52, 55, 60])}
    form = ['Cmaj7', 'Fmaj7'] * 4 + ['Am7', 'Dm7'] * 2 + ['Fmaj7', 'G', 'C', 'C']
    mel = [[(1, 76, 2)], [(0, 77, 1), (1, 76, 1), (2, 72, 1)], [(0, 71, 3)], [(0, 69, 3)], [(1, 76, 2)], [(0, 81, 1), (1, 79, 1), (2, 76, 1)], [(0, 74, 3)], [(0, 72, 3)],
           [(0, 76, 3)], [(0, 77, 2), (2, 76, 1)], [(0, 72, 3)], [(0, 69, 3)], [(0, 69, 2), (2, 72, 1)], [(0, 74, 3)], [(0, 72, 3)], []]
    for bar in range(48):
        sec = bar // 16; i = bar % 16; ch = form[i]; root, chord = H[ch]
        tr.add(piano(root, 2.8 * tr.spb), tr.t(bar, 0), .55, -.2)
        for k, m in enumerate(chord): tr.add(piano(m, 1.8 * tr.spb), tr.t(bar, 1) + k * .008, .32, -.05)
        if sec == 0 or sec == 1 or (sec == 2 and i < 8):
            for b, m, d in mel[i]: tr.add(piano(m + (12 if sec == 1 and i < 8 else 0), d * tr.spb), tr.t(bar, b), .5, .15)
        if i == 15 and sec != 2: chirp(tr, piano, bar, 0, 67, .38)
    tr.render('gentle-piano', room=2.6, wet=.34)

if __name__ == '__main__':
    uplifting(); warm(); gentle()
