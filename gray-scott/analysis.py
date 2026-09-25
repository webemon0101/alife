"""Gray-Scott reaction-diffusion: numpy port of gray-scott/index.html for offline
investigation of the H (pattern Shannon entropy) / D (dissipation-rate proxy) survey.

Runs in float64 (no 8-bit quantization ambiguity), so any near-zero stdD or
decayed-to-zero results here are real PDE behavior, not a precision artifact.
"""
import numpy as np
from scipy.ndimage import convolve

GRID = 480  # match the WebGL version exactly (Du/Dv/seed radius are in absolute grid-cell units,
            # so shrinking GRID without rescaling the reaction-diffusion length scale is NOT equivalent)
Du, Dv = 0.16, 0.08
SEED_RADIUS = 14  # absolute pixels, same as the JS version at GRID=480 (was buggily grid-relative before)

_KERNEL = np.array([
    [0.05, 0.2, 0.05],
    [0.2, -1.0, 0.2],
    [0.05, 0.2, 0.05],
])

PRESETS = [
    ("Mitosis",  0.0367, 0.0649),
    ("Coral",    0.0545, 0.0620),
    ("Worms",    0.0580, 0.0650),
    ("Solitons", 0.0300, 0.0620),
    ("Spots",    0.0250, 0.0600),
    ("Waves",    0.0140, 0.0410),
    ("Holes",    0.0390, 0.0580),
    ("Chaos",    0.0260, 0.0510),
]


def laplacian(Z):
    # Same weighted 3x3 (Oono-Puri) stencil as the WebGL shader: edge 0.2, corner 0.05, center -1
    return convolve(Z, _KERNEL, mode='wrap')


def seed_state(rng):
    u = np.ones((GRID, GRID))
    v = np.zeros((GRID, GRID))
    cx, cy = GRID // 2, GRID // 2
    yy, xx = np.mgrid[0:GRID, 0:GRID]
    mask = (xx - cx) ** 2 + (yy - cy) ** 2 <= SEED_RADIUS ** 2
    v[mask] = rng.uniform(0.6, 1.0, size=mask.sum())
    u[mask] = 0.5
    return u, v


def step(u, v, F, k):
    lu = laplacian(u)
    lv = laplacian(v)
    react = u * v * v
    du = Du * lu - react + F * (1.0 - u)
    dv = Dv * lv + react - (F + k) * v
    u2 = np.clip(u + du, 0.0, 1.0)
    v2 = np.clip(v + dv, 0.0, 1.0)
    return u2, v2


def shannon_entropy(v, bins=32):
    hist, _ = np.histogram(v, bins=bins, range=(0.0, 1.0))
    p = hist / hist.sum()
    p = p[p > 0]
    H = -np.sum(p * np.log(p))
    return H / np.log(bins)


def dissipation(u, v, F, k):
    return np.mean(F * (1.0 - u) + k * v)


def run_preset(name, F, k, steps=8000, sample_every=25, seed_val=42, verbose_track=False):
    rng = np.random.default_rng(seed_val)
    u, v = seed_state(rng)

    hist_H, hist_D, hist_t = [], [], []
    active_frac_track = []  # fraction of cells with v > 0.05, tracked every sample for growth/decay diagnosis

    prev_u, prev_v = None, None
    frozen_at = None  # step index where state stopped changing (bitwise) if it does

    for t in range(steps):
        u, v = step(u, v, F, k)
        if t % sample_every == 0:
            H = shannon_entropy(v)
            D = dissipation(u, v, F, k)
            hist_H.append(H)
            hist_D.append(D)
            hist_t.append(t)
            active_frac_track.append(float(np.mean(v > 0.05)))
            if prev_v is not None and frozen_at is None:
                if np.array_equal(u, prev_u) and np.array_equal(v, prev_v):
                    frozen_at = t
            prev_u, prev_v = u.copy(), v.copy()

    n_tail = max(5, len(hist_H) // 5)
    tailH = hist_H[-n_tail:]
    tailD = hist_D[-n_tail:]

    result = dict(
        name=name, F=F, k=k,
        meanH=float(np.mean(tailH)), meanD=float(np.mean(tailD)), stdD=float(np.std(tailD)),
        final_v_max=float(v.max()), final_v_mean=float(v.mean()),
        active_frac_start=active_frac_track[1] if len(active_frac_track) > 1 else active_frac_track[0],
        active_frac_end=active_frac_track[-1],
        frozen_at=frozen_at,
    )
    if verbose_track:
        result["active_frac_track"] = active_frac_track
        result["hist_t"] = hist_t
        result["hist_D"] = hist_D
    return result


if __name__ == "__main__":
    import time
    print(f"{'preset':<10} {'F':>7} {'k':>7} {'H':>9} {'D':>12} {'stdD':>12} {'v_max':>7} {'active%end':>10} {'frozen_at':>9}  time")
    all_results = []
    for name, F, k in PRESETS:
        t0 = time.perf_counter()
        r = run_preset(name, F, k, steps=8000, sample_every=25)
        dt = time.perf_counter() - t0
        all_results.append(r)
        print(f"{name:<10} {F:7.4f} {k:7.4f} {r['meanH']:9.4f} {r['meanD']:12.6e} {r['stdD']:12.6e} "
              f"{r['final_v_max']:7.3f} {r['active_frac_end']*100:9.2f}% {str(r['frozen_at']):>9}  {dt:5.1f}s")
