// Simulated scientific readings derived from the simulation state. Display-ready strings
// plus 0..1 levels, so any HUD can bind them without formatting logic of its own.

const sci = (v, digits = 2) => {
  if (!isFinite(v) || v === 0) return '0.00E+00';
  const e = Math.floor(Math.log10(Math.abs(v)));
  const m = v / 10 ** e;
  return `${m.toFixed(digits)}E${e >= 0 ? '+' : '-'}${String(Math.abs(e)).padStart(2, '0')}`;
};
const clamp01 = (x) => Math.min(1, Math.max(0, x));

export function buildTelemetry(t, E, P, flux, phase, progress, PHASES) {
  const jitter = (s) => 1 + 0.015 * Math.sin(t * 13.7 + s) + 0.01 * Math.sin(t * 29.1 + s * 3);
  const blast = E.coreGlow / 14 + E.shockA * 0.6;
  const active = E.disk;

  // ENERGY OUTPUT — bolometric luminosity
  const lum = (1e33 * (1 + 40 * blast) + 4.2e40 * active * P.diskEnergy * (0.92 + 0.08 * flux)) * jitter(1);
  const energyLevel = clamp01(Math.log10(lum / 1e33) / 8.2);

  // ROTATION SPEED — inner-disk orbital velocity as a fraction of c
  const vrot = 0.48 * active * E.spin * Math.min(P.rotationSpeed, 2.08) * jitter(2);
  // GRAVITATIONAL FIELD — surface gravity at the forming horizon (m/s²)
  const grav = (E.horizon > 0.01 ? 1.52e12 / Math.max(E.horizon, 0.05) * E.horizon * E.horizon : 9.8e3 * (1 + 2e3 * blast)) * jitter(3);
  const gravLevel = clamp01(E.horizon * 0.85 + blast * 0.4);
  // PLASMA INTENSITY — % of nominal, with temperature
  const plasma = clamp01(0.08 * blast + active * P.diskEnergy * 0.5 * (0.9 + 0.1 * flux) + 0.35 * E.collapseGlow);
  const tempK = 1e5 + 9.4e6 * plasma * jitter(4);
  // JET VELOCITY — bulk Lorentz factor → β
  const gamma = 1 + 6.5 * E.jet * P.jetIntensity;
  const beta = Math.sqrt(1 - 1 / (gamma * gamma));
  // EVENT HORIZON STATUS
  const horizon = E.horizon < 0.02 ? (E.coreGlow > 0 || E.shockA > 0.02 ? 'UNSTABLE' : 'NULL')
    : E.horizon < 0.98 ? 'FORMING' : 'STABLE';
  const rs = 2.95e9 * E.horizon;

  const quiet = phase === 0;
  const readouts = {
    energy: { label: 'ENERGY OUTPUT', value: quiet ? 'NO SIGNAL' : `${sci(lum)}`, unit: 'W', level: quiet ? 0.02 : energyLevel, alert: E.flash > 0.05 },
    rotation: { label: 'ROTATION SPEED', value: active > 0.02 ? `${vrot.toFixed(3)} c` : '— — —', unit: `×${P.rotationSpeed.toFixed(2)} NOMINAL`, level: clamp01(vrot / 1.0), alert: false },
    gravity: { label: 'GRAVITATIONAL FIELD', value: quiet ? '9.81E+00' : sci(grav), unit: 'm/s²', level: quiet ? 0.01 : gravLevel, alert: phase === 2 },
    plasma: { label: 'PLASMA INTENSITY', value: `${(plasma * 100).toFixed(1)} %`, unit: `T ${sci(tempK, 1)} K`, level: plasma, alert: plasma > 0.92 },
    jet: { label: 'JET VELOCITY', value: E.jet > 0.02 ? `${beta.toFixed(4)} c` : 'DORMANT', unit: `Γ ${gamma.toFixed(2)}`, level: clamp01(beta), alert: false },
    horizon: { label: 'EVENT HORIZON STATUS', value: horizon, unit: `Rs ${sci(rs, 2)} km`, level: E.horizon, alert: horizon === 'UNSTABLE' || horizon === 'FORMING' },
  };

  const s = Math.max(0, t);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = (s % 60).toFixed(1).padStart(4, '0');
  return {
    phase, phaseLabel: PHASES[phase], phaseProgress: progress,
    timecode: `T+${mm}:${ss}`,
    alert: phase === 1 || phase === 2,
    locked: phase === 4,
    readouts,
  };
}
