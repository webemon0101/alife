"""Minimal reproduction of Zwicker et al. 2016 'Growth and Division of Active
Droplets: A Model for Protocells' (arXiv:1603.01571).

Physics: a phase-separating field c (Cahn-Hilliard, conserved dynamics with a
double-well free energy f(c) = (c^2-1)^2/4, giving a genuinely SHARP interface
via surface tension -- unlike Gray-Scott's smooth diffusion gradient) PLUS a
non-equilibrium chemical reaction term s(c) that produces droplet material in
the dilute background and degrades it inside the droplet. The reaction is what
breaks strict mass conservation (it represents an external fuel reservoir --
the same role F/k play in Gray-Scott).

    dc/dt = grad^2(c^3 - c) - kappa*grad^4 c + s(c)
    s(c)  = nu_plus*(1-c)/2 - nu_minus*(1+c)/2

Solved with a semi-implicit pseudo-spectral (FFT) scheme: the linear
-kappa*k^4 term is treated implicitly (unconditionally stable), the
nonlinear/reactive terms explicitly.

We seed one circular droplet and watch whether it grows, elongates, and
divides -- tracked via connected-component blob count over time.
"""
import numpy as np
from scipy.ndimage import label
from PIL import Image
import os
import time

N = 150
KAPPA = 1.0
DT = 0.08
OUT_DIR = os.path.join(os.path.dirname(__file__), "droplet_snapshots")
os.makedirs(OUT_DIR, exist_ok=True)

kx = np.fft.fftfreq(N, d=1.0) * 2 * np.pi
KX, KY = np.meshgrid(kx, kx, indexing='ij')
K2 = KX**2 + KY**2
K4 = K2**2


def seed_droplet(radius, rng):
    c = -np.ones((N, N))
    cx, cy = N // 2, N // 2
    yy, xx = np.mgrid[0:N, 0:N]
    mask = (xx - cx) ** 2 + (yy - cy) ** 2 <= radius ** 2
    c[mask] = 1.0 + 0.02 * rng.standard_normal(mask.sum())
    return c


def make_step(nu_plus, nu_minus, dt=DT, kappa=KAPPA):
    denom = 1.0 + dt * kappa * K4

    def step(c_hat):
        c = np.real(np.fft.ifft2(c_hat))
        g = c ** 3 - c
        s = nu_plus * (1 - c) / 2 - nu_minus * (1 + c) / 2
        g_hat = np.fft.fft2(g)
        s_hat = np.fft.fft2(s)
        numerator = c_hat - dt * K2 * g_hat + dt * s_hat
        return numerator / denom
    return step


def count_droplets(c, threshold=0.0):
    mask = c > threshold
    if not mask.any():
        return 0
    _, n = label(mask)
    return n


def save_snapshot(c, name):
    v = (c + 1) / 2  # map [-1,1] -> [0,1]
    v = np.clip(v, 0, 1)
    stops_x = [0.0, 0.35, 0.5, 0.65, 1.0]
    stops_rgb = [
        (0.03, 0.03, 0.08),
        (0.05, 0.10, 0.25),
        (0.90, 0.55, 0.15),
        (0.95, 0.80, 0.30),
        (1.00, 0.97, 0.80),
    ]
    stops = np.array(stops_rgb)
    r = np.interp(v, stops_x, stops[:, 0])
    g = np.interp(v, stops_x, stops[:, 1])
    b = np.interp(v, stops_x, stops[:, 2])
    rgb = (np.stack([r, g, b], axis=-1) * 255).astype(np.uint8)
    Image.fromarray(rgb, mode="RGB").save(os.path.join(OUT_DIR, name))


def run(name, nu_plus, nu_minus, kappa=KAPPA, radius=12, steps=12000, snapshot_every=1500, seed_val=1):
    rng = np.random.default_rng(seed_val)
    c = seed_droplet(radius, rng)
    c_hat = np.fft.fft2(c)
    stepper = make_step(nu_plus, nu_minus, kappa=kappa)

    print(f"\n=== {name}  (nu+={nu_plus}, nu-={nu_minus}, kappa={kappa}) ===")
    max_blobs = 1
    for t in range(steps + 1):
        if t % snapshot_every == 0:
            c_real = np.real(np.fft.ifft2(c_hat))
            n_blobs = count_droplets(c_real)
            max_blobs = max(max_blobs, n_blobs)
            frac = float(np.mean(c_real > 0))
            print(f"  t={t:6d}  blobs={n_blobs}  droplet_area_frac={frac*100:6.2f}%  "
                  f"c_range=[{c_real.min():.2f},{c_real.max():.2f}]")
            save_snapshot(c_real, f"{name}_t{t}.png")
        if t == steps:
            break
        c_hat = stepper(c_hat)
    return max_blobs


if __name__ == "__main__":
    # nu_plus/nu_minus tuned so the background's OWN reaction fixed point
    # c0=(nu_plus-nu_minus)/(nu_plus+nu_minus) sits safely inside the stable
    # well (|c0|>1/sqrt(3)=0.577), so the far-field background does not
    # spontaneously nucleate on its own -- only the pre-seeded droplet should
    # grow (fed by the mild background supersaturation) and, hopefully, divide.
    # push supersaturation as close as possible to the spinodal boundary
    # (|c0| > 1/sqrt(3) = 0.577) without crossing it, and lower kappa to
    # reduce the critical division radius; bigger seed to start closer to
    # (or past) threshold.
    nm = 0.02
    scan = [
        ("M_c0m065_k0.25", 0.2121 * nm, nm, 0.25, 20),
        ("N_c0m060_k0.25", 0.2500 * nm, nm, 0.25, 20),
        ("O_c0m0585_k0.15", 0.2618 * nm, nm, 0.15, 20),
        ("P_c0m060_k0.15", 0.2500 * nm, nm, 0.15, 24),
    ]
    summary = []
    for name, np_, nm_, kap, rad in scan:
        t0 = time.perf_counter()
        max_blobs = run(name, nu_plus=np_, nu_minus=nm_, kappa=kap, radius=rad,
                         steps=30000, snapshot_every=1500)
        dt_wall = time.perf_counter() - t0
        summary.append((name, np_, nm_, kap, max_blobs, dt_wall))

    print("\n\n=== SUMMARY ===")
    for name, np_, nm_, kap, max_blobs, dt_wall in summary:
        print(f"{name:<22} nu+={np_:<9.5f} nu-={nm_:<7} kappa={kap:<5} "
              f"max_blobs={max_blobs}  ({dt_wall:.1f}s)")
