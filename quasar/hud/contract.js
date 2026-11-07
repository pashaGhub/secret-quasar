// The HUD data contract: which readouts and buttons exist, which bridge command each button sends,
// and how engine state maps to the HUD's display values (DomHud.js renders them).

/** Telemetry readout slots → nested view model property names on the "Visor" view model. */
export const READOUTS = ['energy', 'rotation', 'gravity', 'plasma', 'jet', 'horizon'];

/** Buttons → nested "Button" view models. Each fires its "<key>/click" trigger; `event` is the bridge command it maps to. */
export const BUTTONS = {
  btnPlay: { event: 'togglePlay' },
  btnRestart: { event: 'restart', label: 'RESTART' },
  btnMode: { event: 'cycleMode' },
  btnHud: { event: 'toggleHud' },
  rotDown: { event: 'rotDown', label: '−' },
  rotUp: { event: 'rotUp', label: '+' },
  jetDown: { event: 'jetDown', label: '−' },
  jetUp: { event: 'jetUp', label: '+' },
};

/**
 * Maps bridge state → flat { 'path/to/property': value } for the "Visor" view model.
 * DomHud.js renders these values.
 */
export function viewModelValues(P, Tm, MODES) {
  const v = {
    hudVisible: P.hudVisible,
    playing: P.playing,
    phase: Tm.phase,
    mode: P.mode,
    'header/phaseLabel': Tm.phaseLabel,
    'header/phaseIndex': `PHASE ${Tm.phase + 1}/5`,
    'header/timecode': Tm.timecode,
    'header/modeLabel': MODES[P.mode],
    'header/progress': (Tm.phase + Tm.phaseProgress) / 5,
    'header/alert': Tm.alert,
    'reticle/locked': Tm.locked,
    'reticle/status': Tm.locked ? 'TARGET LOCKED' : Tm.phase === 0 ? 'SCANNING' : 'ACQUIRING',
    'reticle/range': Tm.phase === 0 ? 'RNG ——' : 'RNG 2.44E+09 LY',
    'rotDial/value': `${P.rotationSpeed.toFixed(2)}×`,
    'rotDial/level': P.rotationSpeed / 2.5,
    'jetDial/value': `${P.jetIntensity.toFixed(2)}×`,
    'jetDial/level': P.jetIntensity / 2.5,
    'btnPlay/label': P.playing ? 'PAUSE' : 'PLAY',
    'btnPlay/active': !P.playing,
    'btnMode/label': MODES[P.mode],
    'btnMode/active': P.mode !== 0,
    'btnHud/label': P.hudVisible ? 'HUD ON' : 'HUD OFF',
    'btnHud/active': !P.hudVisible,
  };
  for (const key of READOUTS) {
    const r = Tm.readouts[key];
    if (!r) continue;
    v[`${key}/label`] = r.label;
    v[`${key}/value`] = r.value;
    v[`${key}/unit`] = r.unit;
    v[`${key}/level`] = r.level;
    v[`${key}/alert`] = r.alert;
  }
  return v;
}
