"""Why does the classic 'Mitosis' (F=0.0367, k=0.0649) preset die out with our
circular seed? Test whether it's seed SIZE (subcritical mass) or seed SHAPE
(too rotationally symmetric to trigger finger/splitting instability), by
trying a bigger circle and square seeds of two sizes.

Tracks: active area fraction over time (growing vs shrinking) and connected
blob count (via scipy.ndimage.label) to detect an actual division event.
Saves snapshot PNGs so the results can be inspected visually.
"""
import numpy as np
from scipy.ndimage import label
import os

from analysis import GRID, Du, Dv, laplacian, step, shannon_entropy, dissipation

F, K = 0.0367, 0.0649
OUT_DIR = os.path.join(os.path.dirname(__file__), "mitosis_snapshots")
os.makedirs(OUT_DIR, exist_ok=True)


def seed_circle(radius, rng):
    u = np.ones((GRID, GRID))
    v = np.zeros((GRID, GRID))
    cx, cy = GRID // 2, GRID // 2
    yy, xx = np.mgrid[0:GRID, 0:GRID]
    mask = (xx - cx) ** 2 + (yy - cy) ** 2 <= radius ** 2
    v[mask] = rng.uniform(0.6, 1.0, size=mask.sum())
    u[mask] = 0.5
    return u, v


def seed_square(half_size, rng):
    u = np.ones((GRID, GRID))
    v = np.zeros((GRID, GRID))
    cx, cy = GRID // 2, GRID // 2
    sl_y = slice(cy - half_size, cy + half_size)
    sl_x = slice(cx - half_size, cx + half_size)
    block_shape = (2 * half_size, 2 * half_size)
    v[sl_y, sl_x] = rng.uniform(0.6, 1.0, size=block_shape)
    u[sl_y, sl_x] = 0.5
    return u, v


def save_snapshot(v, name):
    from PIL import Image
    # simple inferno-ish colormap: black -> purple -> orange -> yellow
    stops = np.array([
        [0.00, 0.00, 0.00, 0.05],
        [0.25, 0.25, 0.02, 0.35],
        [0.55, 0.65, 0.10, 0.10],
        [0.85, 0.95, 0.55, 0.05],
        [1.00, 1.00, 0.95, 0.55],
    ])
    xs = stops[:, 0]
    r = np.interp(v, xs, stops[:, 1])
    g = np.interp(v, xs, stops[:, 2])
    b = np.interp(v, xs, stops[:, 3])
    rgb = (np.stack([r, g, b], axis=-1) * 255).astype(np.uint8)
    Image.fromarray(rgb, mode="RGB").save(os.path.join(OUT_DIR, name))


def count_blobs(v, threshold=0.1):
    mask = v > threshold
    if not mask.any():
        return 0
    labeled, n = label(mask)
    return n


def run_variant(name, u, v, steps=12000, sample_every=200, snapshot_steps=(0, 1500, 4000, 8000, 12000)):
    print(f"\n=== {name} ===")
    for t in range(steps + 1):
        if t in snapshot_steps:
            active = float(np.mean(v > 0.05))
            blobs = count_blobs(v)
            print(f"  t={t:6d}  active={active*100:6.2f}%  v_max={v.max():.3f}  blobs={blobs}")
            save_snapshot(v, f"{name}_t{t}.png")
        if t == steps:
            break
        u, v = step(u, v, F, K)
    return u, v


if __name__ == "__main__":
    variants = [
        ("circle_r14_original", lambda rng: seed_circle(14, rng)),
        ("circle_r28_bigger", lambda rng: seed_circle(28, rng)),
        ("square_h10_small", lambda rng: seed_square(10, rng)),
        ("square_h20_big", lambda rng: seed_square(20, rng)),
    ]
    for name, seed_fn in variants:
        rng = np.random.default_rng(42)
        u0, v0 = seed_fn(rng)
        run_variant(name, u0, v0)
